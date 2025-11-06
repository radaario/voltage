import { config } from '../../config';

import { sanitizeData, getNow, addNow } from '../../utils';
import { logger } from '../../utils/logger.js';
import { database } from '../../utils/database.js';

import { JobRow } from '../../config/types.js';

import { downloadInput } from './downloader.js';
import { analyzeInputMetadata } from './analyzer.js';
import { generateInputPreview } from './thumbnailer.js';
import { encodeOutput } from './encoder.js';
import { uploadOutput } from './uploader.js';
import { createJobNotification } from './notifier.js';

import path from 'path';
import fs from 'fs/promises';

database.config(config.database);

async function run(instance_key: string, worker_key: string, job_key: string): Promise<void> {
  logger.setMetadata({ instance_key, worker_key, job_key });

  await logger.insert('INFO', 'Worker starts running...');

  const jobTempFolder = path.join(config.temp_folder, 'jobs', job_key);
  await fs.mkdir(jobTempFolder, { recursive: true }).catch(() => {});
  
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
    await updateWorker(worker_key, 'RUNNING');

    /* JOB: SELECT */
    [[job]] = await database.query(`SELECT * FROM ${database.getTablePrefix()}jobs WHERE \`key\` = :key LIMIT 1`, { key: job_key });
    if (!job) throw new Error('Job couldn\'t be found!');

    /* JOB: UPDATE */
    job.instance_key = instance_key;
    job.worker_key = worker_key;
    job.status = 'STARTED';

    /* JOB: PARSE */
    job.input = job.input ? JSON.parse(job.input as string) : null;
    job.outputs = job.outputs ? JSON.parse(job.outputs as string) : null;
    job.destination = job.destination ? JSON.parse(job.destination as string) : null;
    job.notification = job.notification ? JSON.parse(job.notification as string) : null;
    job.metadata = job.metadata ? JSON.parse(job.metadata as string) : null;
    job.started_at = getNow();
    job.completed_at = null;
    job.outcome = job.outcome ? JSON.parse(job.outcome as string) : null;
    job.try_count = parseInt(job.try_count as string) + 1;
    job.retry_at = null;

    await updateJob(job);
    await createJobNotification('STARTED', job);

    /* JOB: OUTPUTs: PARSE */
    for (let index = 0; index < job.outputs.length; index++) {
      if (typeof job.outputs[index].specs === 'object') job.outputs[index].specs = JSON.stringify(job.outputs[index].specs);
      job.outputs[index].specs = job.outputs[index].specs ? JSON.parse(job.outputs[index].specs) : null;
    }

    /* JOB: INPUT: DOWNLOADING */
    job.status = 'DOWNLOADING';

    await logger.insert('INFO', 'Downloading job input...');

    await updateJob(job);
    await updateWorker(worker_key, 'RUNNING');
    
    const jobTempInputFilePath = await downloadInput(job);
    if (!jobTempInputFilePath) throw new Error('Input couldn\'t be downloaded!');

    await createJobNotification('DOWNLOADED', job);
    
    /* JOB: INPUT: ANALYZING */
    job.status = 'ANALYZING';
    job.progress += jobProgressForEachStep;

    await logger.insert('INFO', 'Analyzing job input...');

    await updateJob(job);
    await updateWorker(worker_key, 'RUNNING');
    
    const jobInputMetadata = await analyzeInputMetadata(job);
    if (!jobInputMetadata) throw new Error('Input metadata couldn\'t be extracted!');

    job.input = { ...job.input, ...jobInputMetadata };

    await createJobNotification('ANALYZED', job);

    /* JOB: INPUT: PREVIEW */
    await logger.insert('INFO', 'Generating job input preview...');
    
    const jobTempInputPreviewFilePath = await generateInputPreview(job, config.jobs.preview);
    // if (!jobTempInputPreviewFilePath) throw new Error('Input preview couldn\'t be generated!');    
    
    /* JOB: OUTPUTs: ENCODING */
    job.status = 'ENCODING';

    await logger.insert('INFO', 'Encoding job outputs...');

    await updateJob(job);
    await updateWorker(worker_key, 'RUNNING');

    for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
      if (['COMPLETED', 'FAILED'].includes(job.outputs[index].status)) continue;
      
      job.outputs[index].status = 'ENCODING';

      try{
        job.outputs[index].outcome = await encodeOutput(job, job.outputs[index]);
      } catch (error: Error | any){
        job.outputs[index].status = 'FAILED';
        job.outputs[index].outcome = error || { message: 'Couldn\'t be encoded!' };
      }

      job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

      await logger.insert('INFO', 'Job output encoded!', { output_key: job.outputs[index].key, output_index: job.outputs[index].index });

      await updateJob(job);
      await updateWorker(worker_key, 'RUNNING');
    }

    await createJobNotification('ENCODED', job);

    /* JOB: OUTPUTs: UPLOADING */
    job.status = 'UPLOADING';

    await logger.insert('INFO', 'Uploading job outputs...');

    await updateJob(job);
    await updateWorker(worker_key, 'RUNNING');

    for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
      if (['COMPLETED', 'FAILED'].includes(job.outputs[index].status)) continue;
      
      job.outputs[index].status = 'UPLOADING';

      try {
        job.outputs[index].outcome = await uploadOutput(job, job.outputs[index]);
        job.outputs[index].status = 'COMPLETED';
      } catch (error: Error | any) {
        job.outputs[index].status = 'FAILED';
        job.outputs[index].outcome = error || { message: 'Couldn\'t be uploaded!' };
      }

      job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

      await logger.insert('INFO', 'Job output uploaded!', { output_key: job.outputs[index].key, output_index: job.outputs[index].index });

      await updateJob(job);
      await updateWorker(worker_key, 'RUNNING');
    }

    await createJobNotification('UPLOADED', job);

    for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
      if (job.outputs[index].status === 'FAILED') {
        throw new Error('Some outputs failed!');
        break;
      }
    }

    job.status = 'COMPLETED';
    job.outcome = { message: 'Successfully completed!' };
  } catch (error: Error | any) {
    job.status = 'FAILED';
    job.outcome = error || { message: 'Unknown error' };

    if (job.try_count < job.try_max) {
      job.status = 'RETRYING';
      job.retry_at = addNow(job.retry_in || 0, 'milliseconds');
    }
  }

  job.progress = 100.00;
  job.completed_at = getNow();

  await updateJob(job);
  await updateWorker(worker_key, 'EXITED');

  await fs.rm(jobTempFolder, { recursive: true }).catch(() => {});

  if (job.status === 'COMPLETED') {
    await logger.insert('INFO', 'Job completed successfully!');
    await createJobNotification('COMPLETED', job);
    process.exit(0);
  } else {
    await logger.insert('ERROR', 'Job failed!', { error: job.outcome });
    await createJobNotification('FAILED', job);
    process.exit(1);
  }
}

async function updateJob(job: any): Promise<void> {
  if (!job.key) return;

  try {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs SET instance_key = :instance_key, worker_key = :worker_key, input = :input, outputs = :outputs, status = :status, progress = :progress, started_at = :now, completed_at = :completed_at, updated_at = :updated_at, outcome = :outcome, try_count = :try_count, retry_at = :retry_at WHERE \`key\` = :key`,
      {
        ...job,
        input: job.input ? JSON.stringify(job.input) : null,
        outputs: job.outputs ? JSON.stringify(job.outputs) : null,
        outcome: job.outcome ? JSON.stringify(job.outcome) : null,
        updated_at: getNow(),
      }
    );
  } catch (error: Error | any) {
  }
}

async function updateWorker(worker_key: string, status: string): Promise<void> {
  if (!worker_key) return;

  try {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}workers SET status = :status, updated_at = :now WHERE \`key\` = :key`,
      { key: worker_key, status, now: getNow() }
    );
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to update worker!', { error });
  }
}

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

run(instance_key, worker_key, job_key);
