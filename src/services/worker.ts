import { config } from '../config';

import { getNow } from '../utils';
import { logger } from '../utils/logger.js';
import { initDb, pool } from '../utils/database.js';

import { DestinationSpec, NotificationSpec } from '../config/types.js';

import { downloadInput } from './encoder/downloader.js';
import { encode } from './encoder/encoder.js';
import { uploadOutput } from './encoder/uploader.js';
import { notifyJob } from './encoder/notifier.js';
import { extractMetadata } from './encoder/metadata.js';
import { generatePreview } from './encoder/preview.js';

async function runWorkerJob(instanceKey: string, workerKey: string, jobKey: string): Promise<void> {
  // dbPrefix available throughout the function
  const dbPrefix = config.db.prefix ? `${config.db.prefix}_` : '';
  
  try {
    await initDb();

    /* WORKER: UPDATE */
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, now: getNow() }
    );
    
    const [rows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: jobKey });
    if ((rows as any[]).length === 0) {
      logger.warn({ jobKey }, 'Job not found!');
      process.exit(0);
    }

    const job = (rows as any[])[0];
    let inputSpec = JSON.parse(job.input as string);

    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'DOWNLOADING', started_at = :now WHERE \`key\` = :key`,
      { key: job.key, now: getNow() }
    );
    
    // Parse notification spec if available
    const notification: NotificationSpec | undefined = job.notification 
      ? JSON.parse(job.notification as string) 
      : undefined;

    const inputPath = await downloadInput(inputSpec);
    
    /* WORKER: UPDATE */
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, now: getNow() }
    );

    // Update status to ANALYZING
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'ANALYZING' WHERE \`key\` = :key`,
      { key: job.key }
    );
    
    // Extract metadata from input file
    logger.info({ jobKey, inputPath }, 'Extracting metadata from input file');
    const inputMetadata = await extractMetadata(inputPath);
    if (inputMetadata) inputSpec = { ...inputSpec, ...inputMetadata };
    
    // Save video metadata to database
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET input = :input WHERE \`key\` = :key`,
      { key: job.key, input: JSON.stringify(inputSpec) }
    );

    logger.info({ jobKey }, 'Input metadata saved to database');

    // Generate preview from middle of video
    logger.info({ jobKey, duration: inputSpec?.duration ?? 0 }, 'Generating preview from video');
    await generatePreview(inputPath, job.key, inputSpec?.duration ?? 0);
    logger.info({ jobKey }, 'Preview generated successfully');

    /* WORKER: UPDATE */
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, now: getNow() }
    );
    
    // Update status to ENCODING
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'ENCODING' WHERE \`key\` = :key`,
      { key: job.key }
    );
    
    // Parse global destination if available
    const globalDestination: DestinationSpec | undefined = job.destination 
      ? JSON.parse(job.destination as string) 
      : undefined;

    const [outs] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY \`index\``, { job_key: job.key });
    for (const out of outs as any[]) {
      await pool.execute(
        `UPDATE ${dbPrefix}job_outputs SET status = 'ENCODING' WHERE \`key\` = :key`,
        { key: out.key }
      );
      
      try {
        /* WORKER: UPDATE */
        await pool.execute(
          `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
          { key: workerKey, now: getNow() }
        );

        const specs = JSON.parse(out.specs);
        const outFile = await encode(inputPath, specs);

        // Update status to UPLOADING
        await pool.execute(
          `UPDATE ${dbPrefix}jobs SET status = 'UPLOADING' WHERE \`key\` = :key`,
          { key: job.key }
        );
        
        const result = await uploadOutput(specs, outFile, globalDestination);
        await pool.execute(
          `UPDATE ${dbPrefix}job_outputs SET status = 'UPLOADING', result = :res WHERE \`key\` = :key`,
          { key: out.key, res: JSON.stringify(result) }
        );

        /* WORKER: UPDATE */
        await pool.execute(
          `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
          { key: workerKey, now: getNow() }
        );
        
        // Mark as COMPLETED after successful upload
        await pool.execute(
          `UPDATE ${dbPrefix}job_outputs SET status = 'COMPLETED' WHERE \`key\` = :key`,
          { key: out.key }
        );
      } catch (err: any) {
        const errorObj = {
          key: 'ENCODING_ERROR',
          message: String(err?.message ?? err)
        };

        /* WORKER: UPDATE */
        await pool.execute(
          `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
          { key: workerKey, now: getNow() }
        );

        await pool.execute(
          `UPDATE ${dbPrefix}job_outputs SET status = 'FAILED', error = :err WHERE \`key\` = :key`,
          { key: out.key, err: JSON.stringify(errorObj) }
        );
        
        throw err;
      }
    }

    /* WORKER: UPDATE */
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, now: getNow() }
    );

    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'COMPLETED', completed_at = :now WHERE \`key\` = :key`,
      { key: job.key, now: getNow() }
    );
    
    if (notification) {
      // Fetch current job data and outputs for notification
      const [jobRows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: job.key });
      const currentJob = (jobRows as any[])[0];
      const [outputRows] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY \`index\``, { job_key: job.key });
      
      currentJob.outputs = outputRows;
      
      await notifyJob(currentJob.key, 'COMPLETED', currentJob.priority, currentJob);
    }

    /* WORKER: UPDATE */
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, now: getNow() }
    );
    
    logger.info({ instanceKey,  workerKey, jobKey }, 'Job completed successfully!');
    process.exit(0);
  } catch (err: any) {
    logger.error({ err, instanceKey,  workerKey, jobKey }, 'Job failed!');

    /* WORKER: UPDATE */
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, now: getNow() }
    );
    
    const errorObj = {
      key: 'JOB_PROCESSING_ERROR',
      message: String(err?.message ?? err)
    };

    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'FAILED', error = :err WHERE \`key\` = :key`,
      { key: jobKey, err: JSON.stringify(errorObj) }
    );
    
    const [rows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: jobKey });
    
    if ((rows as any[]).length > 0) {
      const job = (rows as any[])[0];
      const notification: NotificationSpec | undefined = job.notification 
        ? JSON.parse(job.notification as string) 
        : undefined;

      if (notification) {
        const [outputRows] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY \`index\``, { job_key: job.key });
        
        // Build notification payload
        const notificationPayload: any = { 
          key: job.key,
          status: 'FAILED',
          priority: job.priority
        };
        
        // Parse and include error if present
        if (job.error) {
          try {
            notificationPayload.error = JSON.parse(job.error);
          } catch (err) {
            notificationPayload.error = job.error;
          }
        }

        // Include custom metadata if it exists
        if (job.metadata) {
          try {
            notificationPayload.metadata = JSON.parse(job.metadata);
          } catch (err) {
            // If parsing fails, skip metadata
          }
        }

        // Parse and sanitize input
        let parsedInput = null;
        if (job.input) {
          try {
            parsedInput = JSON.parse(job.input);
            // Remove sensitive fields
            delete parsedInput.username;
            delete parsedInput.password;
            delete parsedInput.key;
            delete parsedInput.secret;
            
            notificationPayload.input = parsedInput;
          } catch (err) {
            // If parsing fails, skip input
          }
        }
        
        // Parse and sanitize outputs
        if (outputRows && (outputRows as any[]).length > 0) {
          const outputs = (outputRows as any[]).map((out: any) => {
            try {
              const specs = JSON.parse(out.specs);
              // Sanitize destination in specs if present
              if (specs.destination) {
                delete specs.destination.username;
                delete specs.destination.password;
                delete specs.destination.key;
                delete specs.destination.secret;
              }
              const outputData: any = {
                index: out.index,
                specs: specs,
                status: out.status,
                result: out.result ? JSON.parse(out.result) : null
              };
              
              // Parse and include error if present
              if (out.error) {
                try {
                  outputData.error = JSON.parse(out.error);
                } catch (err) {
                  outputData.error = out.error;
                }
              }
              
              return outputData;
            } catch (err) {
              return null;
            }
          }).filter((out: any) => out !== null);
          
          notificationPayload.outputs = outputs;
        }
        
        // Parse and sanitize destination if present
        if (job.destination) {
          try {
            const dest = JSON.parse(job.destination);
            delete dest.username;
            delete dest.password;
            delete dest.key;
            delete dest.secret;
            notificationPayload.destination = dest;
          } catch (err) {
            // If parsing fails, skip destination
          }
        }

        // Parse and sanitize notification if present
        if (job.notification) {
          try {
            const notif = JSON.parse(job.notification);
            delete notif.username;
            delete notif.password;
            delete notif.key;
            delete notif.secret;
            notificationPayload.notification = notif;
          } catch (err) {
            // If parsing fails, skip notification
          }
        }
        
        await notifyJob(job.key, 'FAILED', job.priority, job);
      }
    }

    /* WORKER: UPDATE */
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, now: getNow() }
    );
    
    process.exit(1);
  }
}

// Get job key and instance key from command line arguments
const instanceKey = process.argv[2];
const workerKey = process.argv[3];
const jobKey = process.argv[4];

if (!instanceKey) {
  logger.error('Instance key required!');
  process.exit(1);
}

if (!workerKey) {
  logger.error('Worker key required!');
  process.exit(1);
}

if (!jobKey) {
  logger.error('Job key required!');
  process.exit(1);
}

logger.info({ instanceKey, workerKey, jobKey }, 'Starting worker for job!');
runWorkerJob(instanceKey, workerKey, jobKey);
