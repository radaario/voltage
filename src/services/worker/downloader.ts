import { config } from '../../config/index.js';

import { logger } from '../../utils/logger.js';
import { storage } from '../../utils/storage.js';

import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';

export async function downloadInput(job: any): Promise<string> {
  try {
    logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

    const jobTempFolder = path.join(config.temp_folder, 'jobs', job.key);
    const jobTempInputFilePath = path.join(jobTempFolder, 'input');

    logger.console('INFO', 'Downloading job input file...');

    if (job.input.type === 'BASE64') {
      const buffer = Buffer.from(job.input.content, 'base64');
      
      await fs.writeFile(jobTempInputFilePath, buffer);

      logger.console('INFO', 'Job input file successfully downloaded!');
      return jobTempInputFilePath;
    }

    if (job.input.type === 'HTTP' || job.input.type === 'HTTPS') {
      const auth = (job.input.username && job.input.password) ? {
        username: job.input.username,
        password: job.input.password
      } : undefined;
      
      const resp = await axios.get<ArrayBuffer>(job.input.url, { 
        responseType: 'arraybuffer',
        auth
      });

      await fs.writeFile(jobTempInputFilePath, Buffer.from(resp.data));

      logger.console('INFO', 'Job input file successfully downloaded!');
      return jobTempInputFilePath;
    }

    if (!['BASE64', 'HTTP', 'HTTPS'].includes(job.input.type)) {
      await storage.config(job.input);
      await storage.download(job.input.path, jobTempInputFilePath);

      logger.console('INFO', 'Job input file successfully downloaded!');
      return jobTempInputFilePath;
    }

    throw new Error(`Unsupported input type: ${job.input.type}!`);
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Job input file couldn\'t be downloaded!', { error });
    throw new Error((`Job input file couldn\'t be downloaded! ${error.message || ''}`).trim());
  }
}

