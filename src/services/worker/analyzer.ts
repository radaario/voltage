import { config } from '../../config/index.js';

import { logger } from '../../utils/logger.js';

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export async function analyzeInputMetadata(job: any): Promise<any[]> {
  try {
    const jobTempFolder = path.join(config.temp_folder, 'jobs', job.key);
    const jobTempInputFilePath = path.join(jobTempFolder, 'input');

    logger.info({ jobKey: job.key }, 'Extracting metadata from job input...');

    /* FILE: INFO: EXTRACT */
    const fileName = path.basename(jobTempInputFilePath);
    const fileExtension = path.extname(fileName).toLowerCase().replace(/^\./, '');
    const fileStats = await fs.stat(jobTempInputFilePath);
    const fileMimeType = getMimeType(fileExtension);
    
    /* FFPROBE: RUN */
    const ffprobeData = await runFfprobe(jobTempInputFilePath);
    
    /* METADATA: EXTRACT */
    const metadata = parseFfprobeOutput(ffprobeData, {
      file_name: fileName,
      file_extension: fileExtension,
      file_mime_type: fileMimeType,
      file_size: fileStats.size
    });
    
    logger.info({ jobKey: job.key }, 'Metadata successfully extracted from job input!');
    return metadata;
  } catch (err: Error | any) {
    logger.error({ jobKey: job.key, err }, 'Failed to extract metadata from job input!');
    throw new Error(`Metadata extraction failed: ${err.message || 'Unknown error occurred!'}`);
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

async function runFfprobe(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(config.utils.ffprobe.path, [
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
        } catch (err: Error | any) {
          reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
    });

    ffprobe.on('error', (err: Error | any) => {
      reject(new Error(`Failed to start ffprobe: ${err.message}`));
    });
  });
}

function parseFfprobeOutput(data: any, fileInfo: any): any[] {
  const format = data.format || {};
  const streams = data.streams || [];
  
  /* VIDEO & AUDIO: STREAMs: FIND */
  const videoStream = streams.find((s: any) => s.codec_type === 'video');
  const audioStream = streams.find((s: any) => s.codec_type === 'audio');
  
  /* DURATION: CALCULATION */
  const duration = parseFloat(format.duration || '0');
  const durationInTimestamp = Math.round(duration * 1000000); // Convert to microseconds
  
  /* VIDEO: INFO: PARSE */
  let videoInfo = null;
  if (videoStream) {
    const videoWidth = parseInt(videoStream.width || '0');
    const videoHeight = parseInt(videoStream.height || '0');
    const videoCodedWidth = parseInt(videoStream.coded_width || videoStream.width || '0');
    const videoCodedHeight = parseInt(videoStream.coded_height || videoStream.height || '0');
    
    // Calculate aspect ratio
    const videoAspectRatioDecimal = videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 0;
    const videoAspectRatio = getAspectRatio(videoAspectRatioDecimal);
    
    videoInfo = {
      video_width: videoWidth,
      video_width_coded: videoCodedWidth,
      video_height: videoHeight,
      video_height_coded: videoCodedHeight,
      video_aspect_ratio: videoAspectRatio,
      video_aspect_ratio_in_decimal: videoAspectRatioDecimal,
      video_frames: parseInt(videoStream.nb_frames || '0'),
      video_frame_rate: parseFloat(videoStream.r_frame_rate?.split('/')[0] || '0') / parseFloat(videoStream.r_frame_rate?.split('/')[1] || '1'),
      video_codec: videoStream.codec_name || '',
      video_profile: videoStream.profile || '',
      video_level: videoStream.level || '',
      video_bit_rate: parseInt(videoStream.bit_rate || '0'),
      video_has_b_frames: parseInt(videoStream.has_b_frames || '0'),
      video_pixel_format: videoStream.pix_fmt || '',
      video_chroma_location: videoStream.chroma_location || ''
    };
  }
  
  /* AUDIO: INFO: PARSE */
  let audioInfo = null;
  if (audioStream) {
    audioInfo = {
      audio_codec: audioStream.codec_name || '',
      audio_profile: audioStream.profile || '',
      audio_channels: parseInt(audioStream.channels || '0'),
      audio_channel_layout: audioStream.channel_layout || '',
      audio_sample_rate: parseInt(audioStream.sample_rate || '0'),
      audio_bit_rate: parseInt(audioStream.bit_rate || '0')
    };
  }
  
  return {
    ...fileInfo,
    duration,
    duration_in_ts: durationInTimestamp,
    ...videoInfo,
    ...audioInfo
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
