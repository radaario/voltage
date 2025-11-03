import { config } from '../../config';

import { sanitizeData, getNow } from '../../utils';
import { logger } from '../../utils/logger.js';
import { database } from '../../utils/database.js';

import { JobRow } from '../../config/types.js';

import { downloadInput } from './downloader.js';
import { analyzeInputMetadata } from './analyzer.js';
import { generateInputPreview } from './thumbnailer.js';
import { encodeOutput } from './encoder.js';
import { uploadOutput } from './uploader.js';

import path from 'path';
import fs from 'fs/promises';

database.config(config.database);
await database.verifySchemaExists();

async function run(instanceKey: string, workerKey: string, jobKey: string): Promise<void> {
  logger.info({ instanceKey, workerKey, jobKey }, 'worker starts running...');

  const jobTempFolder = path.join(config.temp_folder, 'jobs', jobKey);
  await fs.mkdir(jobTempFolder, { recursive: true }).catch(() => {});
  
  const jobProgressForEachStep = 20.00; // Each step contributes 20% to the total progress

  let job: JobRow = {
    key: jobKey,
    instance_key: instanceKey,
    worker_key: workerKey,
    status: 'PENDING',
    progress: 0.00
  };

  try {
    await updateWorker(workerKey, 'RUNNING');

    /* JOB: SELECT */
    const [queryJob] = await database.query(`SELECT * FROM ${database.getTablePrefix()}jobs WHERE \`key\` = :key`, { key: jobKey });
    if ((queryJob as any[]).length === 0) {
      logger.warn({ jobKey }, 'Job not found!');
      process.exit(0);
    }

    job = (queryJob as any[])[0];
    if (!job.key) throw new Error('Job couldn\'t be found!');

    /* JOB: UPDATE */
    job.instance_key = instanceKey;
    job.worker_key = workerKey;

    /* JOB: PARSE */
    job.input = job.input ? JSON.parse(job.input as string) : null;
    job.outputs = job.outputs ? JSON.parse(job.outputs as string) : null;
    job.destination = job.destination ? JSON.parse(job.destination as string) : null;
    job.notification = job.notification ? JSON.parse(job.notification as string) : null;
    job.metadata = job.metadata ? JSON.parse(job.metadata as string) : null;
    job.outcome = job.outcome ? JSON.parse(job.outcome as string) : null;

    if (!job.outputs) throw new Error('Job outputs are missing!');

    /* JOB: OUTPUTs: PARSE */
    for (let index = 0; index < job.outputs.length; index++) {
      if (typeof job.outputs[index].specs === 'object') job.outputs[index].specs = JSON.stringify(job.outputs[index].specs);
      job.outputs[index].specs = job.outputs[index].specs ? JSON.parse(job.outputs[index].specs) : null;
    }

    /* JOB: INPUT: DOWNLOADING */
    job.status = 'DOWNLOADING';

    await startJob(job);
    await updateWorker(workerKey, 'RUNNING');
    
    const jobTempInputFilePath = await downloadInput(job);
    if (!jobTempInputFilePath) throw new Error('Input couldn\'t be downloaded!');
    
    /* JOB: INPUT: ANALYZING */
    job.status = 'ANALYZING';
    job.progress += jobProgressForEachStep;

    await updateJob(job);
    await updateWorker(workerKey, 'RUNNING');
    
    const jobInputMetadata = await analyzeInputMetadata(job);
    if (!jobInputMetadata) throw new Error('Input metadata couldn\'t be extracted!');
    
    job.input = { ...job.input, ...jobInputMetadata };

    /* JOB: INPUT: PREVIEW */
    const jobTempInputPreviewFilePath = await generateInputPreview(job, config.jobs.preview);
    // if (!jobTempInputPreviewFilePath) throw new Error('Input preview couldn\'t be generated!');    
    
    /* JOB: OUTPUTs: ENCODING */
    logger.info({ jobKey }, 'Encoding job outputs...');
    job.status = 'ENCODING';

    await updateJob(job);
    await updateWorker(workerKey, 'RUNNING');

    for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
      if (job.outputs[index].status === 'FAILED') continue;
      
      job.outputs[index].status = 'ENCODING';

      try{
        job.outputs[index].outcome = await encodeOutput(job, job.outputs[index]);
      } catch (err: Error | any){
        job.outputs[index].status = 'FAILED';
        job.outputs[index].outcome = err || { message: 'Couldn\'t be encoded!' };
      }

      job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

      await updateJob(job);
      await updateWorker(workerKey, 'RUNNING');
    }

    /* JOB: OUTPUTs: UPLOADING */
    logger.info({ jobKey }, 'Uploading job outputs...');
    job.status = 'UPLOADING';

    await updateJob(job);
    await updateWorker(workerKey, 'RUNNING');

    for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
      if (job.outputs[index].status === 'FAILED') continue;
      
      job.outputs[index].status = 'UPLOADING';

      try {
        job.outputs[index].outcome = await uploadOutput(job, job.outputs[index]);
        job.outputs[index].status = 'COMPLETED';
      } catch (err: Error | any) {
        job.outputs[index].status = 'FAILED';
        job.outputs[index].outcome = err || { message: 'Couldn\'t be uploaded!' };
      }

      job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

      await updateJob(job);
      await updateWorker(workerKey, 'RUNNING');
    }

    for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
      if (job.outputs[index].status === 'FAILED') {
        throw new Error('Some outputs failed!');
        break;
      }
    }

    job.status = 'COMPLETED';
    job.outcome = { message: 'Successfully completed!' };
  } catch (err: Error | any) {
    job.status = 'FAILED';
    job.outcome = err || { message: 'Unknown error' };
  }

  job.progress = 100.00;

  await updateJob(job);
  await updateWorker(workerKey, 'EXITED');

  if (job.notification) {
    const { notify } = await import('./notifier.js');
    const notificationOutcome = await notify(job.notification, sanitizeData(job));
  }

  await fs.rm(jobTempFolder, { recursive: true }).catch(() => {});

  if (job.status === 'COMPLETED') {
    logger.info({ instanceKey,  workerKey, jobKey }, 'Job successfully completed!');
    process.exit(0);
  } else {
    logger.info({ instanceKey,  workerKey, jobKey }, 'Job failed!');
    process.exit(1);
  }
}

async function startJob(job: any): Promise<void> {
  if (!job.key) return;

  try {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs SET instance_key = :instance_key, worker_key = :worker_key, status = :status, progress = :progress, started_at = :now, updated_at = :now WHERE \`key\` = :key`,
      {
        key: job.key,
        instance_key: job.instance_key,
        worker_key: job.worker_key,
        status: job.status,
        progress: job.progress,
        now: getNow()
      }
    );
  } catch (err: Error | any) {
  }
}

async function updateJob(job: any): Promise<void> {
  if (!job.key) return;

  try {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs SET input = :input, outputs = :outputs, status = :status, progress = :progress, updated_at = :now, outcome = :outcome WHERE \`key\` = :key`,
      {
        key: job.key,
        instance_key: job.instance_key,
        worker_key: job.worker_key,
        input: job.input ? JSON.stringify(job.input) : null,
        outputs: job.outputs ? JSON.stringify(job.outputs) : null,
        status: job.status,
        progress: job.progress,
        outcome: job.outcome ? JSON.stringify(job.outcome) : null,
        now: getNow(),
      }
    );
  } catch (err: Error | any) {
  }
}

async function updateWorker(workerKey: string, status: string): Promise<void> {
  if (!workerKey) return;

  try {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}workers SET status = :status, updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, status, now: getNow() }
    );
  } catch (err: Error | any) {
    logger.error({ workerKey, err }, 'Failed to update worker!');
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
run(instanceKey, workerKey, jobKey);
