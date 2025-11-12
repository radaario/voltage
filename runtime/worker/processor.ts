import { config } from '@voltage/config';

import { logger } from '@voltage/utils/logger';

import { spawn } from 'child_process';
import path from 'path';

export async function processOutput(job: any, output: any): Promise<any> {
  logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

  const tempJobFolder = path.join(config.temp_folder, 'jobs', job.key);
  const tempJobInputFilePath = path.join(tempJobFolder, 'input');
  const tempJobOutputFilePath = path.join(tempJobFolder, `output.${output.index}.${(output.specs.format || 'mp4').toLowerCase()}`);

  logger.console('INFO', 'Processing job output...', { output_key: output.key, output_index: output.index});

  if (output.specs.type === 'SUBTITLE') {
    const jobInputAudioFilePath = path.join(tempJobFolder, 'audio.wav');
    
    // Convert input to WAV
    const wavArgs = ['-y', '-i', tempJobInputFilePath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', jobInputAudioFilePath];
    
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(config.utils.ffmpeg.path, wavArgs, { stdio: 'ignore' });
        proc.on('error', reject);
        proc.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Ffmpeg WAV conversion exited with code ${code}`));
        });
      });
      
      // Generate subtitles using whisper-node
      const { nodewhisper } = await import('nodejs-whisper');
      
      const outputFormat = (output.specs.format || 'srt').toLowerCase();
      const modelName = (output.specs.model || 'base').toLowerCase().replace('_en', '.en').replace('_', '-');
      
      await nodewhisper(path.resolve(jobInputAudioFilePath), {
        modelName: modelName,
        autoDownloadModelName: modelName,
        whisperOptions: {
          outputInSrt: outputFormat === 'srt',
          outputInVtt: outputFormat === 'vtt',
          outputInCsv: outputFormat === 'csv',
          outputInJson: outputFormat === 'json',
          outputInText: outputFormat === 'txt',
          // translateToEnglish: output.specs.translate || false,
          language: output.specs.language || 'auto',
          wordTimestamps: false,
          timestamps_length: 20,
          splitOnWord: true,
        }
      });

      logger.console('INFO', 'Subtitle generated!', { output_key: output.key, output_index: output.index });
      
      return { file_path: tempJobOutputFilePath };
    } catch (error: Error | any) {
      await logger.insert('ERROR', 'Failed to generate subtitle!', { output_key: output.key, output_index: output.index, error });
      throw new Error((`Failed to generate subtitle! ${error.message || 'Unknown error occurred!'}`).trim());
      return { message: error.message || 'Failed to process job output!' };
    }
  }

  const args: string[] = ['-y', '-i', tempJobInputFilePath];
  
  // Handle cut/trim operations
  if (output.specs.offset !== undefined) {
    let offset = output.specs.offset;
    if (job.input.duration && offset > job.input.duration) offset = job.input.duration;
    args.push('-ss', String(offset));
  }

  if (output.specs.duration !== undefined) args.push('-t', String(output.specs.duration));

  // Video codec and bitrate
  if (output.specs.video_codec) args.push('-c:v', output.specs.video_codec);
  if (output.specs.video_bitrate) args.push('-b:v', output.specs.video_bitrate);
  
  // Video profile and level
  if (output.specs.video_vprofile) args.push('-profile:v', output.specs.video_vprofile);
  if (output.specs.video_level) args.push('-level', output.specs.video_level);
  
  // Video pixel format
  if (output.specs.video_pix_fmt) args.push('-pix_fmt', output.specs.video_pix_fmt);
  
  // Video frame rate
  if (output.specs.video_fps) args.push('-r', String(output.specs.video_fps));
  
  // Deinterlace
  if (output.specs.video_deinterlace) args.push('-vf', 'yadif');

  // Audio codec and settings
  if (output.specs.audio_codec) args.push('-c:a', output.specs.audio_codec);
  if (output.specs.audio_bitrate) args.push('-b:a', output.specs.audio_bitrate);
  if (output.specs.audio_sample_rate) args.push('-ar', String(output.specs.audio_sample_rate));
  if (output.specs.audio_channels) args.push('-ac', String(output.specs.audio_channels));

  // Image/video scaling, rotation, and effects
  if (output.specs.type === 'THUMBNAIL') {
    args.push('-quality', String(output.specs.quality || 75));
    args.push('-vframes', '1');
  } else {
    if (output.specs.quality !== undefined) {
      args.push('-q:v', String(output.specs.quality)); 
    }
  }

  const videoFilters: string[] = [];
  
  if (output.specs.width && output.specs.height) {
    const fit = output.specs.fit || 'PAD';
    switch (fit) {
      case 'STRETCH':
        videoFilters.push(`scale=${output.specs.width}:${output.specs.height}`);
        break;
      case 'CROP':
        videoFilters.push(`scale=${output.specs.width}:${output.specs.height}:force_original_aspect_ratio=increase,crop=${output.specs.width}:${output.specs.height}`);
        break;
      case 'MAX':
        videoFilters.push(`scale='min(${output.specs.width},iw)':'min(${output.specs.height},ih)':force_original_aspect_ratio=decrease`);
        break;
      case 'PAD':
      default:
        videoFilters.push(`scale=${output.specs.width}:${output.specs.height}:force_original_aspect_ratio=decrease,pad=${output.specs.width}:${output.specs.height}:(ow-iw)/2:(oh-ih)/2`);
        break;
    }
  }
  
  if (output.specs.rotate) {
    switch (output.specs.rotate) {
      case 90:
        videoFilters.push('transpose=1');
        break;
      case -90:
        videoFilters.push('transpose=2');
        break;
      case 180:
      case -180:
        videoFilters.push('transpose=1,transpose=1');
        break;
    }
  }
  
  if (output.specs.flip) {
    switch (output.specs.flip) {
      case 'HORIZONTAL':
        videoFilters.push('hflip');
        break;
      case 'VERTICAL':
        videoFilters.push('vflip');
        break;
      case 'BOTH':
        videoFilters.push('hflip,vflip');
        break;
    }
  }
  
  if (videoFilters.length > 0) {
    args.push('-vf', videoFilters.join(','));
  }
  
  args.push(tempJobOutputFilePath);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(config.utils.ffmpeg.path, args, { stdio: 'inherit' }); // inherit
      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Ffmpeg processing job output exited with code ${code}`));
      });
    });

    logger.console('INFO', 'Job output processed!', { output_key: output.key, output_index: output.index });
    
    return { file_path: tempJobOutputFilePath };
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to process job output!', { output_key: output.key, output_index: output.index,error });
    throw new Error((`Failed to process job output! ${error.message || ''}`).trim());
    return { message: error.message || 'Failed to process job output!', args };
  }
}
