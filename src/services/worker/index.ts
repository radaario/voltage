import { config } from '../../config';

import { getNow, addNow } from '../../utils';
import { logger } from '../../utils/logger.js';
import { database } from '../../utils/database.js';

import { downloadInput } from './downloader.js';
import { analyzeInputMetadata } from './analyzer.js';
import { generateInputPreview } from './thumbnailer.js';
import { processOutput } from './processor.js';
import { uploadOutput } from './uploader.js';
import { createJobNotification } from './notifier.js';

import path from 'path';
import fs from 'fs/promises';

// import * as tf from '@tensorflow/tfjs-node';

database.config(config.database);

async function run() {
  await logger.insert('INFO', 'Worker starts running...');

  const tempJobFolder = path.join(config.temp_folder, 'jobs', job_key);
  await fs.mkdir(tempJobFolder, { recursive: true }).catch(() => {});
  
  const jobProgressForEachStep = 20.00; // Each step contributes 20% to the total progress

  let job: any = {
    key: job_key,
    instance_key,
    worker_key,
    status: 'STARTED',
    progress: 0.00,
    try_max: 1,
    try_count: 0
  };

  try {
    await updateWorkerStatus('BUSY');

    // JOB: SELECT
    job = await database.table('jobs').where('key', job_key).first();
    if (!job) throw new Error('Job couldn\'t be found!');

    // JOB: STARTING
    await logger.insert('INFO', 'Job found, starting processing...', { job_key: job.key });

    // JOB: UPDATE
    job.instance_key = instance_key;
    job.worker_key = worker_key;
    job.status = 'STARTED';

    // JOB: PARSE
    job.input = job.input ? JSON.parse(job.input as string) : null;
    job.outputs = job.outputs ? JSON.parse(job.outputs as string) : null;
    job.destination = job.destination ? JSON.parse(job.destination as string) : null;
    job.notification = job.notification ? JSON.parse(job.notification as string) : null;
    job.metadata = job.metadata ? JSON.parse(job.metadata as string) : null;
    job.outcome = job.outcome ? JSON.parse(job.outcome as string) : null;
    job.started_at = getNow();
    job.completed_at = null;
    job.try_count = parseInt(job.try_count as string) + 1;
    job.retry_at = null;

    await updateJob(job);
    await createJobNotification(job, job.status);

    // JOB: OUTPUTs: PARSE
    for (let index = 0; index < job.outputs.length; index++) {
      if (typeof job.outputs[index].specs === 'object') job.outputs[index].specs = JSON.stringify(job.outputs[index].specs);
      job.outputs[index].specs = job.outputs[index].specs ? JSON.parse(job.outputs[index].specs) : null;
    }

    let jobOutputsProcessedCount = 0;
    let jobOutputsUploadedCount = 0;

    // JOB: INPUT: DOWNLOADING
    await logger.insert('INFO', 'Downloading job input...');

    job.status = 'DOWNLOADING';

    await updateJob(job);
    await createJobNotification(job, job.status);
    await updateWorkerStatus('BUSY');
    
    const tempJobInputFilePath = await downloadInput(job);

    try {
			await fs.access(tempJobInputFilePath);
		} catch {
			throw new Error('Input couldn\'t be downloaded!');
		}
    
    // JOB: INPUT: DOWNLOADED
    await logger.insert('INFO', 'Job input successfully downloaded!');

    job.status = 'DOWNLOADED';
    job.progress += jobProgressForEachStep;

    await updateJob(job);
    await createJobNotification(job, job.status);
    
    // JOB: INPUT: ANALYZING
    await logger.insert('INFO', 'Analyzing job input...');
    
    job.status = 'ANALYZING';
    
    await updateJob(job);
    await createJobNotification(job, job.status);
    await updateWorkerStatus('BUSY');
    
    const jobInputMetadata = await analyzeInputMetadata(job);
    if (!jobInputMetadata) throw new Error('Input metadata couldn\'t be extracted!');

    job.input = { ...job.input, ...jobInputMetadata };

    // JOB: INPUT: ANALYZED
    await logger.insert('INFO', 'Job input successfully analyzed!');

    job.status = 'ANALYZED';
    job.progress += jobProgressForEachStep;
    
    await updateJob(job);
    await createJobNotification(job, job.status);

    // JOB: INPUT: PREVIEW GENERATING
    await logger.insert('INFO', 'Generating job input preview...');
    
    const jobTempInputPreviewFilePath = await generateInputPreview(job, config.jobs.preview);

    try {
			await fs.access(jobTempInputPreviewFilePath);
      await logger.insert('INFO', 'Job input preview successfully generated!');

      /*
      async function fn() {
        const nsfwjs = await import('nsfwjs');
        const model = await nsfwjs.load();
        const img = await fs.readFile(jobTempInputPreviewFilePath);
        const image = await tf.node.decodeImage(img, 3) as tf.Tensor3D;
        const predictions = await model.classify(image);
        image.dispose(); // Tensor memory must be managed explicitly (it is not sufficient to let a tf.Tensor go out of scope for its memory to be released).
        console.log("predictions", predictions);
      }

      fn();
      */
		} catch (error: Error | any){
      throw new Error('Input preview couldn\'t be generated!');
		}
    
    // JOB: PROCESSING
    await logger.insert('INFO', 'Processing job outputs...');
    
    job.status = 'PROCESSING';

    await updateJob(job);
    await createJobNotification(job, job.status);
    await updateWorkerStatus('BUSY');

    // JOB: OUTPUTs: PROCESSING
    for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
      if (['COMPLETED', 'FAILED'].includes(job.outputs[index].status)) continue;

      await logger.insert('INFO', 'Processing job output...', { output_key: job.outputs[index].key, output_index: job.outputs[index].index });
      
      job.outputs[index].status = 'PROCESSING';
      await updateJob(job);

      try{
        jobOutputsProcessedCount++;
        job.outputs[index].outcome = await processOutput(job, job.outputs[index]);
        job.outputs[index].status = 'PROCESSED';
        await logger.insert('INFO', 'Job output successfully processed!', { output_key: job.outputs[index].key, output_index: job.outputs[index].index });
      } catch (error: Error | any){
        job.outputs[index].status = 'FAILED';
        job.outputs[index].outcome = { message: error.message || 'Couldn\'t be processed!' };
        await logger.insert('ERROR', 'Failed to process job output!', { output_key: job.outputs[index].key, output_index: job.outputs[index].index, error: error.message });
      }

      job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

      await updateJob(job);
      await updateWorkerStatus('BUSY');
    }

    if (jobOutputsProcessedCount > 0) {
      // JOB: PROCESSED
      await logger.insert('INFO', 'Job outputs successfully processed!');

      job.status = 'PROCESSED';

      await updateJob(job);
      await createJobNotification(job, job.status);

      /* JOB: OUTPUTs: UPLOADING */
      await logger.insert('INFO', 'Uploading job outputs...');
      
      job.status = 'UPLOADING';

      await updateJob(job);
      await createJobNotification(job, job.status);
      await updateWorkerStatus('BUSY');

      for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
        if (job.outputs[index].status == 'PROCESSED') {
          const tempJobOutputFilePath = path.join(tempJobFolder, `output.${job.outputs[index].index}.${(job.outputs[index].specs.format || 'mp4').toLowerCase()}`);

          try {
            await fs.access(tempJobOutputFilePath);
          } catch {
            job.outputs[index].status = 'FAILED';
            job.outputs[index].outcome = { message: 'Output file is missing!' };
          }
        }

        if (['COMPLETED', 'FAILED'].includes(job.outputs[index].status)) continue;

        await logger.insert('INFO', 'Uploading job output...', { output_key: job.outputs[index].key, output_index: job.outputs[index].index });
        
        job.outputs[index].status = 'UPLOADING';
        await updateJob(job);

        try {
          job.outputs[index].outcome = await uploadOutput(job, job.outputs[index]);
          job.outputs[index].status = 'COMPLETED';
          await logger.insert('INFO', 'Job output successfully uploaded!', { output_key: job.outputs[index].key, output_index: job.outputs[index].index });
          jobOutputsUploadedCount++;
        } catch (error: Error | any) {
          job.outputs[index].status = 'FAILED';
          job.outputs[index].outcome = { message: error.message || 'Couldn\'t be uploaded!' };
          await logger.insert('ERROR', 'Failed to upload job output!', { output_key: job.outputs[index].key, output_index: job.outputs[index].index, error: error.message });
        }

        job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

        await updateJob(job);
        await updateWorkerStatus('BUSY');
      }

      if (jobOutputsUploadedCount > 0) {
        // JOB: UPLOADED
        await logger.insert('INFO', 'Job outputs successfully uploaded!');

        job.status = 'UPLOADED';

        await updateJob(job);
        await createJobNotification(job, job.status);
      }

      /*
      for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
        if (job.outputs[index].status === 'FAILED') {
          throw new Error('Some outputs failed!');
          break;
        }
      }
      */
    }

    // JOB: OUTPUTs: CHECK FAILED
    if (jobOutputsProcessedCount === job.outputs?.length || jobOutputsUploadedCount === job.outputs?.length) {
      throw new Error('Some outputs failed!');
    }

    job.status = 'COMPLETED';
    job.outcome = { message: 'Successfully completed!' };
  } catch (error: Error | any) {
    job.status = 'FAILED';
    job.outcome = { message: error.message || 'Unknown error occurred!' };

    if (job.try_count < job.try_max) {
      job.status = 'RETRYING';
      job.retry_at = addNow(job.retry_in || 0, 'milliseconds');
    }
  }

  job.progress = 100.00;
  job.completed_at = getNow();

  await fs.rm(tempJobFolder, { recursive: true }).catch(() => {});

  await updateJob(job);
  // await updateWorkerStatus('IDLE');

  if (job.status === 'COMPLETED') {
    await logger.insert('INFO', 'Job completed successfully!');
    await createJobNotification(job, job.status);
    process.exit(0);
  } else {
    await logger.insert('ERROR', 'Job failed!', { error: job.outcome });
    await createJobNotification(job, job.status);
    process.exit(1);
  }
}

async function updateJob(job: any): Promise<void> {
  if (!job.key) return;

  try {
    await database.table('jobs')
      .where('key', job.key)
      .update({
        ...job,
        input: job.input ? JSON.stringify(job.input) : null,
        outputs: job.outputs ? JSON.stringify(job.outputs) : null,
        destination: job.destination ? JSON.stringify(job.destination) : null,
        notification: job.notification ? JSON.stringify(job.notification) : null,
        metadata: job.metadata ? JSON.stringify(job.metadata) : null,
        outcome: job.outcome ? JSON.stringify(job.outcome) : null,
        updated_at: getNow(),
      });
  } catch (error: Error | any) {
    console.log('updateJob', 'ERROR', error);
  }
}

async function updateWorkerStatus(status: string): Promise<void> {
  if (!worker_key) return;

  try {
    await database.table('instances_workers')
      .where('key', worker_key)
      .update({
        job_key,
        status,
        updated_at: getNow()
      });
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to update worker!', { error });
  }
}

(async () => {
  // Get job key and instance key from command line arguments
  const instance_key = process.argv[2];
  const worker_key = process.argv[3];
  const job_key = process.argv[4];

  if (!instance_key) {
    await logger.insert('ERROR', 'Instance key required!');
    process.exit(1);
  }

  logger.setMetadata({ instance_key });

  if (!worker_key) {
    await logger.insert('ERROR', 'Worker key required!');
    process.exit(1);
  }

  logger.setMetadata({ instance_key, worker_key });

  if (!job_key) {
    await logger.insert('ERROR', 'Job key required!');
    process.exit(1);
  }

  logger.setMetadata({ instance_key, worker_key, job_key });

  await run();
})();
