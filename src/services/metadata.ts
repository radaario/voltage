import { spawn } from 'child_process';
import { config } from '../config.js';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { InputMetadata } from '../types.js';
import { logger } from '../logger.js';

export async function extractMetadata(filePath: string): Promise<InputMetadata> {
  try {
    // Get file stats
    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName).toLowerCase().replace(/^\./, '');
    
    // Get MIME type based on extension
    const mimeType = getMimeType(fileExtension);
    
    // Run ffprobe to get media metadata
    const ffprobeData = await runFfprobe(filePath);
    
    // Parse the ffprobe output
    const metadata = parseFfprobeOutput(ffprobeData, {
      name: fileName,
      extension: fileExtension,
      mime_type: mimeType,
      size: stats.size
    });
    
    logger.info({ filePath, fileName }, 'Metadata extracted successfully');
    return metadata;
  } catch (error) {
    logger.error({ error, filePath }, 'Failed to extract metadata');
    throw new Error(`Metadata extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mkv': 'video/x-matroska',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'ts': 'video/mp2t',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    'ogv': 'video/ogg',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'wma': 'audio/x-ms-wma'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

async function runFfprobe(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(config.ffmpeg.ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error}`));
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
    });

    ffprobe.on('error', (error) => {
      reject(new Error(`Failed to start ffprobe: ${error.message}`));
    });
  });
}

function parseFfprobeOutput(data: any, fileInfo: { name: string; extension: string; mime_type: string; size: number }): InputMetadata {
  const format = data.format || {};
  const streams = data.streams || [];
  
  // Find video and audio streams
  const videoStream = streams.find((s: any) => s.codec_type === 'video');
  const audioStream = streams.find((s: any) => s.codec_type === 'audio');
  
  // Calculate duration
  const duration = parseFloat(format.duration || '0');
  const durationInTimestamp = Math.round(duration * 1000000); // Convert to microseconds
  
  // Parse video metadata
  let video = null;
  if (videoStream) {
    const width = parseInt(videoStream.width || '0');
    const height = parseInt(videoStream.height || '0');
    const codedWidth = parseInt(videoStream.coded_width || videoStream.width || '0');
    const codedHeight = parseInt(videoStream.coded_height || videoStream.height || '0');
    
    // Calculate aspect ratio
    const aspectRatioDecimal = width > 0 && height > 0 ? width / height : 0;
    const aspectRatio = getAspectRatio(aspectRatioDecimal);
    
    video = {
      width,
      width_coded: codedWidth,
      height,
      height_coded: codedHeight,
      aspect_ratio: aspectRatio,
      aspect_ratio_in_decimal: aspectRatioDecimal,
      frames: parseInt(videoStream.nb_frames || '0'),
      frame_rate: parseFloat(videoStream.r_frame_rate?.split('/')[0] || '0') / parseFloat(videoStream.r_frame_rate?.split('/')[1] || '1'),
      codec: videoStream.codec_name || '',
      profile: videoStream.profile || '',
      level: videoStream.level || '',
      bit_rate: parseInt(videoStream.bit_rate || '0'),
      has_b_frames: parseInt(videoStream.has_b_frames || '0'),
      pixel_format: videoStream.pix_fmt || '',
      chroma_location: videoStream.chroma_location || ''
    };
  }
  
  // Parse audio metadata
  let audio = null;
  if (audioStream) {
    audio = {
      codec: audioStream.codec_name || '',
      profile: audioStream.profile || '',
      channels: parseInt(audioStream.channels || '0'),
      channel_layout: audioStream.channel_layout || '',
      sample_rate: parseInt(audioStream.sample_rate || '0'),
      bit_rate: parseInt(audioStream.bit_rate || '0')
    };
  }
  
  return {
    file: fileInfo,
    duration,
    duration_in_ts: durationInTimestamp,
    video,
    audio
  };
}

function getAspectRatio(decimal: number): string {
  const commonRatios: Array<{ decimal: number; ratio: string }> = [
    { decimal: 1.777777777777778, ratio: '16:9' },
    { decimal: 1.333333333333333, ratio: '4:3' },
    { decimal: 1.0, ratio: '1:1' },
    { decimal: 2.35, ratio: '21:9' },
    { decimal: 1.85, ratio: '1.85:1' },
    { decimal: 2.4, ratio: '2.4:1' }
  ];
  
  // Find the closest match
  let closest = commonRatios[0];
  let minDiff = Math.abs(decimal - closest.decimal);
  
  for (const ratio of commonRatios) {
    const diff = Math.abs(decimal - ratio.decimal);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ratio;
    }
  }
  
  // If the difference is too large, return the decimal as a ratio
  if (minDiff > 0.1) {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const precision = 1000000; // 6 decimal places
    const numerator = Math.round(decimal * precision);
    const denominator = precision;
    const divisor = gcd(numerator, denominator);
    return `${numerator / divisor}:${denominator / divisor}`;
  }
  
  return closest.ratio;
}
