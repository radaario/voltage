import { OutputSpec } from '../types.js';
import { config } from '../config.js';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';
import fs from 'fs/promises';

export async function encode(inputPath: string, spec: OutputSpec): Promise<string> {
  const outDir = await fs.mkdtemp(path.join(tmpdir(), 'enc-out-'));
  const outputPath = path.join(outDir, `output.${spec.container}`);

  const args: string[] = ['-y', '-i', inputPath];
  if (spec.videoCodec) args.push('-c:v', spec.videoCodec);
  if (spec.videoBitrate) args.push('-b:v', spec.videoBitrate);
  if (spec.audioCodec) args.push('-c:a', spec.audioCodec);
  if (spec.audioBitrate) args.push('-b:a', spec.audioBitrate);
  if (spec.width && spec.height) args.push('-vf', `scale=${spec.width}:${spec.height}`);
  if (spec.extraArgs && spec.extraArgs.length > 0) args.push(...spec.extraArgs);
  args.push(outputPath);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(config.ffmpeg.path, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

  return outputPath;
}
