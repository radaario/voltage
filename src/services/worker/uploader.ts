import { config } from '../../config/index.js';

import { guessContentType } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';
import { storage } from '../../utils/storage.js';

import path from 'path';
import fs from 'fs/promises';

import axios from 'axios';

export async function uploadOutput(job: any, output: any): Promise<Record<string, unknown>> {
  const jobTempFolder = path.join(config.temp_folder, 'jobs', job.key);
  const jobTempOutputFilePath = path.join(jobTempFolder, `output.${output.index}.${(output.format || 'mp4').toLowerCase()}`);

  // Use output's destination if available, otherwise fall back to global destination
  const destination = output?.specs?.destination || job?.destination;

  if (!destination) {
    throw new Error('No destination specified for job output!');
  }

  if (!jobTempOutputFilePath) {
    throw new Error('No local file path provided for upload!');
  }

  // HTTP(S) direct push
  if (destination.type === 'HTTP' || destination.type === 'HTTPS') {
    const resp = await axios.request({
      url: destination.url,
      method: destination.method ?? 'POST',
      headers: { 'Content-Type': 'application/octet-stream', ...(destination.headers ?? {}) },
      data: await fs.readFile(jobTempOutputFilePath)
    });

    return { status: resp.status, headers: resp.headers, body: resp.data };
  }

  // For remote destinations, we need a remote path from the output spec
  if (!output?.specs?.path) {
    throw new Error('Path is required in output.specs for remote upload destinations!');
  }

  // Initialize storage based on destination
  const key = String(output.specs.path).replace(/^\/+/, '');
  const contentType = guessContentType(key);
  
  await storage.config(destination);
  await storage.upload(jobTempOutputFilePath, key, contentType);

  // Build a result similar to previous S3 uploader
  const location = (destination as any).bucket ? `s3://${(destination as any).bucket}/${key}` : key;
  const url = storage.getPublicUrl(key) || null;

  logger.info({ destinationType: destination.type, bucket: (destination as any).bucket, path: key, url }, 'Job output uploaded!');

  return { path: key, location, url };
}

