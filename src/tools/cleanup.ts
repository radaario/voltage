import { pool } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getNow } from '../utils/datetime.js';
import fs from 'fs/promises';
import path from 'path';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

export async function main() {
  const hours = config.jobs.retention;
  
  const [rows] = await pool.query(
    `SELECT \`key\` FROM jobs WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_at < DATE_SUB(:now, INTERVAL :hours HOUR)`,
    { now: getNow(), hours: hours }
  );
  
  const keys = (rows as any[]).map((r) => r.key);
  
  if (keys.length === 0) {
    logger.info('no jobs to cleanup');
    return;
  }
  
  // Delete job folders/objects from storage based on storage kind
  if (config.storage.kind === 'AWS_S3') {
    // Delete from S3
    for (const key of keys) {
      try {
        await deleteJobFromS3(key);
        logger.info({ jobKey: key }, 'Deleted job from S3');
      } catch (err) {
        logger.warn({ err, jobKey: key }, 'Failed to delete job from S3');
      }
    }
  } else {
    // Delete from local storage
    for (const key of keys) {
      const jobDir = path.join(config.storage.path, 'jobs', key);
      try {
        await fs.rm(jobDir, { recursive: true, force: true });
        logger.info({ jobKey: key, jobDir }, 'Deleted job folder from local storage');
      } catch (err) {
        logger.warn({ err, jobKey: key, jobDir }, 'Failed to delete job folder from local storage');
      }
    }
  }
  
  await pool.execute(`DELETE FROM jobs WHERE \`key\` IN (${keys.map(() => '?').join(',')})`, keys);
  
  logger.info({ count: keys.length }, 'cleanup completed jobs');
}

async function deleteJobFromS3(jobKey: string): Promise<void> {
  try {
    const s3Client = new S3Client({
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.key,
        secretAccessKey: config.storage.secret || '',
      }
    });

    // List all objects under the job prefix
    const prefix = `jobs/${jobKey}/`;
    const listCommand = new ListObjectsV2Command({
      Bucket: config.storage.bucket,
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      // Delete all objects in the job folder
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: config.storage.bucket,
        Delete: {
          Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key! })),
        },
      });

      await s3Client.send(deleteCommand);
      logger.info({ jobKey, objectCount: listResponse.Contents.length }, 'Deleted job objects from S3');
    } else {
      logger.info({ jobKey }, 'No S3 objects found for job');
    }
  } catch (error) {
    logger.error({ error, jobKey }, 'Failed to delete job from S3');
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0));
}

