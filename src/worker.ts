import { initDb, pool } from './db.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { downloadInput } from './services/downloader.js';
import { encode } from './services/encoder.js';
import { uploadOutput } from './services/uploader.js';
import { notify } from './services/notifier.js';
import { extractMetadata } from './services/metadata.js';
import { generatePreview } from './services/preview.js';
import { InputMetadata, DestinationSpec, NotificationSpec } from './types.js';

async function runWorkerJob(instanceKey: string, workerKey: string, jobKey: string): Promise<void> {
  // dbPrefix available throughout the function
  const dbPrefix = config.db.prefix ? `${config.db.prefix}_` : '';
  
  try {
    await initDb();

    /* WORKER: UPDATE */
    await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });
    
    const [rows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: jobKey });
    if ((rows as any[]).length === 0) {
      logger.warn({ jobKey }, 'Job not found!');
      process.exit(0);
    }

    const job = (rows as any[])[0];

    await pool.execute(`UPDATE ${dbPrefix}jobs SET status = 'DOWNLOADING', started_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: job.key });
    
    // Parse notification spec if available
    const notification: NotificationSpec | undefined = job.notification 
      ? JSON.parse(job.notification as string) 
      : undefined;

    const inputSpec = JSON.parse(job.input as string);
    const inputPath = await downloadInput(inputSpec);
    
    // Check if metadata extraction is requested from input spec
    const shouldExtractMetadata = inputSpec.extract_metadata === true;
    
    let input_metadata: InputMetadata | null = null;
    if (shouldExtractMetadata) {
      /* WORKER: UPDATE */
      await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });

      // Update status to ANALYZING
      await pool.execute(`UPDATE ${dbPrefix}jobs SET status = 'ANALYZING' WHERE \`key\` = :key`, { key: job.key });
      
      // Extract metadata from input file
      logger.info({ jobKey, inputPath }, 'Extracting metadata from input file');
      input_metadata = await extractMetadata(inputPath);
      
      // Save video metadata to database
      await pool.execute(
        `UPDATE ${dbPrefix}jobs SET input_metadata = :input_metadata WHERE \`key\` = :key`,
        { key: job.key, input_metadata: JSON.stringify(input_metadata) }
      );

      logger.info({ jobKey }, 'Input metadata saved to database');
    } else {
      logger.info({ jobKey }, 'Skipping ANALYZING stage (Input metadata extraction not requested)');
    }

    // Generate preview from middle of video
    logger.info({ jobKey, duration: input_metadata?.duration ?? 0 }, 'Generating preview from video');
    await generatePreview(inputPath, job.key, input_metadata?.duration ?? 0);
    logger.info({ jobKey }, 'Preview generated successfully');

    /* WORKER: UPDATE */
    await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });
    
    // Update status to ENCODING
    await pool.execute(`UPDATE ${dbPrefix}jobs SET status = 'ENCODING' WHERE \`key\` = :key`, { key: job.key });
    
    // Parse global destination if available
    const globalDestination: DestinationSpec | undefined = job.destination 
      ? JSON.parse(job.destination as string) 
      : undefined;

    const [outs] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY output_index`, { job_key: job.key });
    for (const out of outs as any[]) {
      await pool.execute(`UPDATE ${dbPrefix}job_outputs SET status = 'ENCODING' WHERE \`key\` = :key`, { key: out.key });
      
      try {
        /* WORKER: UPDATE */
        await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });

        const spec = JSON.parse(out.spec_json);
        const outFile = await encode(inputPath, spec);

        // Update status to UPLOADING
        await pool.execute(`UPDATE ${dbPrefix}jobs SET status = 'UPLOADING' WHERE \`key\` = :key`, { key: job.key });
        
        const result = await uploadOutput(spec, outFile, globalDestination);
        await pool.execute(
          `UPDATE ${dbPrefix}job_outputs SET status = 'UPLOADING', result_json = :res WHERE \`key\` = :key`,
          { key: out.key, res: JSON.stringify(result) }
        );

        /* WORKER: UPDATE */
        await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });
        
        // Mark as COMPLETED after successful upload
        await pool.execute(`UPDATE ${dbPrefix}job_outputs SET status = 'COMPLETED' WHERE \`key\` = :key`, { key: out.key });
      } catch (err: any) {
        const errorObj = {
          key: 'ENCODING_ERROR',
          message: String(err?.message ?? err)
        };

        /* WORKER: UPDATE */
        await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });

        await pool.execute(
          `UPDATE ${dbPrefix}job_outputs SET status = 'FAILED', error = :err WHERE \`key\` = :key`,
          { key: out.key, err: JSON.stringify(errorObj) }
        );
        
        throw err;
      }
    }

    /* WORKER: UPDATE */
    await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });

    await pool.execute(`UPDATE ${dbPrefix}jobs SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: job.key });
    
    if (notification) {
      // Fetch current job data and outputs for notification
      const [jobRows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: job.key });
      const currentJob = (jobRows as any[])[0];
      const [outputRows] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY output_index`, { job_key: job.key });
      
      // Build notification payload
      const notificationPayload: any = { 
        key: currentJob.key,
        status: 'COMPLETED',
        priority: currentJob.priority
      };

      // Include custom metadata if it exists
      if (currentJob.metadata) {
        try {
          notificationPayload.metadata = JSON.parse(currentJob.metadata);
        } catch (err) {
          // If parsing fails, skip metadata
        }
      }
      
      // Parse and sanitize input
      let parsedInput = null;
      if (currentJob.input) {
        try {
          parsedInput = JSON.parse(currentJob.input);
          // Remove sensitive fields
          delete parsedInput.username;
          delete parsedInput.password;
          delete parsedInput.key;
          delete parsedInput.secret;
          
          // If extract_metadata was true and input_metadata exists, merge it directly into input
          if (parsedInput.extract_metadata && currentJob.input_metadata) {
            try {
              const inputMetadata = JSON.parse(currentJob.input_metadata);
              if (typeof inputMetadata === 'object' && inputMetadata !== null) {
                // Spread video metadata properties directly into input
                parsedInput = { ...parsedInput, ...inputMetadata };
              }
            } catch (err) {
              // If parsing fails, skip merging
            }
          }
          
          notificationPayload.input = parsedInput;
        } catch (err) {
          // If parsing fails, skip input
        }
      }
      
      // Parse and sanitize outputs
      if (outputRows && (outputRows as any[]).length > 0) {
        const outputs = (outputRows as any[]).map((out: any) => {
          try {
            const spec = JSON.parse(out.spec_json);
            // Sanitize destination in spec if present
            if (spec.destination) {
              delete spec.destination.username;
              delete spec.destination.password;
              delete spec.destination.key;
              delete spec.destination.secret;
            }
            return {
              output_index: out.output_index,
              status: out.status,
              spec: spec,
              result: out.result_json ? JSON.parse(out.result_json) : null
            };
          } catch (err) {
            return null;
          }
        }).filter((out: any) => out !== null);
        
        notificationPayload.outputs = outputs;
      }
      
      // Parse and sanitize destination if present
      if (currentJob.destination) {
        try {
          const dest = JSON.parse(currentJob.destination);
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
      if (currentJob.notification) {
        try {
          const notif = JSON.parse(currentJob.notification);
          delete notif.username;
          delete notif.password;
          delete notif.key;
          delete notif.secret;
          notificationPayload.notification = notif;
        } catch (err) {
          // If parsing fails, skip notification
        }
      }
      
      await notify(notification, notificationPayload);
    }

    /* WORKER: UPDATE */
    await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });
    
    logger.info({ instanceKey,  workerKey, jobKey }, 'Job completed successfully!');
    process.exit(0);
  } catch (err: any) {
    logger.error({ err, instanceKey,  workerKey, jobKey }, 'Job failed!');

    /* WORKER: UPDATE */
    await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });
    
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
        const [outputRows] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY output_index`, { job_key: job.key });
        
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
            
            // If extract_metadata was true and input_metadata exists, merge it directly into input
            if (parsedInput.extract_metadata && job.input_metadata) {
              try {
                const inputMetadata = JSON.parse(job.input_metadata);
                if (typeof inputMetadata === 'object' && inputMetadata !== null) {
                  // Spread video metadata properties directly into input
                  parsedInput = { ...parsedInput, ...inputMetadata };
                }
              } catch (err) {
                // If parsing fails, skip merging
              }
            }
            
            notificationPayload.input = parsedInput;
          } catch (err) {
            // If parsing fails, skip input
          }
        }
        
        // Parse and sanitize outputs
        if (outputRows && (outputRows as any[]).length > 0) {
          const outputs = (outputRows as any[]).map((out: any) => {
            try {
              const spec = JSON.parse(out.spec_json);
              // Sanitize destination in spec if present
              if (spec.destination) {
                delete spec.destination.username;
                delete spec.destination.password;
                delete spec.destination.key;
                delete spec.destination.secret;
              }
              const outputData: any = {
                output_index: out.output_index,
                status: out.status,
                spec: spec,
                result: out.result_json ? JSON.parse(out.result_json) : null
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
        
        await notify(notification, notificationPayload);
      }
    }

    /* WORKER: UPDATE */
    await pool.execute(`UPDATE ${dbPrefix}workers SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE \`key\` = :key`, { key: workerKey });
    
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
