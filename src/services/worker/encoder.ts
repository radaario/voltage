import { config } from '../../config/index.js';

import { logger } from '../../utils/logger.js';

import { spawn } from 'child_process';
import path from 'path';

export async function encodeOutput(job: any, output: any): Promise<any> {
  const jobTempFolder = path.join(config.temp_folder, 'jobs', job.key);
  const jobTempInputFilePath = path.join(jobTempFolder, 'input');
  const jobTempOutputFilePath = path.join(jobTempFolder, `output.${output.index}.${(output.format || 'mp4').toLowerCase()}`);

  logger.info({ jobKey: job.key, outputKey: output.key, outputIndex: output.index }, 'Encoding job output...');

  const args: string[] = ['-y', '-i', jobTempInputFilePath];
  if (output.specs.videoCodec) args.push('-c:v', output.specs.videoCodec);
  if (output.specs.videoBitrate) args.push('-b:v', output.specs.videoBitrate);
  if (output.specs.audioCodec) args.push('-c:a', output.specs.audioCodec);
  if (output.specs.audioBitrate) args.push('-b:a', output.specs.audioBitrate);
  if (output.specs.width && output.specs.height) args.push('-vf', `scale=${output.specs.width}:${output.specs.height}`);
  if (output.specs.extraArgs && output.specs.extraArgs.length > 0) args.push(...output.specs.extraArgs);
  args.push(jobTempOutputFilePath);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(config.utils.ffmpeg.path, args, { stdio: 'inherit' });
      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Ffmpeg encoding job output exited with code ${code}`));
      });
    });

    logger.info({ jobKey: job.key, outputKey: output.key, outputIndex: output.index }, 'Job output encoded!');
    
    return { file_path: jobTempOutputFilePath };
  } catch (err: Error | any) {
    return { ...err || { message: 'Unknown error!' }, args };
  }
}
