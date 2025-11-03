import { config } from '../../config/index.js';

import { logger } from '../../utils/logger.js';
import { storage } from '../../utils/storage.js';

import { spawn } from 'child_process';
import path from 'path';

export async function generateInputPreview(job: any, options: any): Promise<string> {
  try {
    const jobTempFolder = path.join(config.temp_folder, 'jobs', job.key);
    const jobTempInputFilePath = path.join(jobTempFolder, 'input');
    const jobTempInputPreviewFilePath = path.join(jobTempFolder, `preview.${(options.format || 'webp').toLowerCase()}`);

    logger.info({ jobKey: job.key }, 'Generating preview from job input...');

    // Calculate the middle timestamp of the video
    const middleTimestamp = (job.input.duration || 0) / 2;
    
    // Use ffmpeg to extract a frame at the middle timestamp and convert to webp
    const args = [
      '-y', // overwrite output file if exists
      '-ss', middleTimestamp.toString(),
      '-i', jobTempInputFilePath,
      '-vframes', '1',
      // '-vf', 'scale=640:-1', // width 640, height auto to maintain aspect ratio
      '-quality', (options.quality || 75).toString(), // webp quality
      jobTempInputPreviewFilePath
    ];
    
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(config.utils.ffmpeg.path, args, { stdio: 'inherit' });
      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Ffmpeg preview generation exited with code ${code}`));
      });
    });

    storage.config(config.storage);
    await storage.upload(jobTempInputPreviewFilePath, `/jobs/${job.key}/preview.${options.format || 'webp'}`);

    logger.info({ jobKey: job.key }, 'Preview generated from job input!');
    return jobTempInputPreviewFilePath;
  } catch (err: Error | any) {
    logger.error({ jobKey: job.key, err }, 'Failed to generate preview from job input!');
    throw new Error(`Preview generation failed: ${err.message || 'Unknown error occurred!'}`);
  }
}
