import { spawn } from 'child_process';
import { config } from '../config.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { logger } from '../logger.js';

export async function generatePreview(inputPath: string, jobKey: string, durationInSeconds: number): Promise<string> {
  try {
    // Calculate the middle timestamp of the video
    const middleTimestamp = durationInSeconds / 2;
    
    // Generate preview to temporary location first
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'preview-'));
    const tempPreviewPath = path.join(tempDir, 'preview.webp');
    
    // Use ffmpeg to extract a frame at the middle timestamp and convert to webp
    // -ss: seek to timestamp
    // -i: input file
    // -vframes 1: extract only 1 frame
    // -vf scale: resize to reasonable size (max width 640px, maintaining aspect ratio)
    // -quality: webp quality (0-100, lower is better quality but larger file)
    const args = [
      '-y', // overwrite output file if exists
      '-ss', middleTimestamp.toString(),
      '-i', inputPath,
      '-vframes', '1',
      '-vf', 'scale=640:-1', // width 640, height auto to maintain aspect ratio
      '-quality', '75', // webp quality
      tempPreviewPath
    ];
    
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(config.ffmpeg.path, args, { stdio: 'inherit' });
      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg preview generation exited with code ${code}`));
      });
    });
    
    logger.info({ jobKey, tempPreviewPath, middleTimestamp }, 'Preview generated to temp location');
    
    // Handle storage based on config
    if (config.storage.kind === 'AWS_S3') {
      // Upload to S3
      const s3Path = `${config.storage.path}/jobs/${jobKey}/preview.webp`;
      await uploadPreviewToS3(tempPreviewPath, s3Path);
      
      // Clean up temp file
      await fs.rm(tempDir, { recursive: true, force: true });
      
      const s3Url = `https://${config.storage.bucket}.s3.${config.storage.region}.amazonaws.com/${s3Path}`;
      logger.info({ jobKey, s3Path, s3Url }, 'Preview uploaded to S3');
      return s3Url;
    } else {
      // LOCAL storage - move to permanent location
      const jobDir = path.join('.', config.storage.path, 'jobs', jobKey);
      await fs.mkdir(jobDir, { recursive: true });
      
      const previewPath = path.join(jobDir, 'preview.webp');
      await fs.rename(tempPreviewPath, previewPath);
      
      // Clean up temp directory
      await fs.rmdir(tempDir);
      
      logger.info({ jobKey, previewPath }, 'Preview saved to local storage');
      return previewPath;
    }
  } catch (error) {
    logger.error({ error, jobKey, inputPath }, 'Failed to generate preview');
    throw new Error(`Preview generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function uploadPreviewToS3(filePath: string, s3Path: string): Promise<void> {
  try {
    // Initialize S3 client with credentials from config
    const s3Client = new S3Client({
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.key,
        secretAccessKey: config.storage.secret || '',
      }
    });

    // Read file data
    const fileData = await fs.readFile(filePath);
    
    // Prepare upload parameters
    const uploadParams: PutObjectCommandInput = {
      Bucket: config.storage.bucket,
      Key: s3Path,
      Body: fileData,
      ContentType: 'image/webp',
    };

    // Upload to S3
    const command = new PutObjectCommand(uploadParams);
    const result = await s3Client.send(command);

    logger.info({ 
      bucket: config.storage.bucket, 
      path: s3Path, 
      etag: result.ETag 
    }, 'Preview uploaded to S3');
  } catch (error) {
    logger.error({ error, bucket: config.storage.bucket, path: s3Path }, 'S3 preview upload failed');
    throw new Error(`S3 preview upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

