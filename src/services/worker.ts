import { config } from '../config';

import { getNow } from '../utils';
import { logger } from '../utils/logger.js';
import { initDb, pool } from '../utils/database.js';

import { JobRow } from '../config/types.js';

import { downloadInput } from './encoder/downloader.js';
import { encode } from './encoder/encoder.js';
import { uploadOutput } from './encoder/uploader.js';
import { notifyJob } from './encoder/notifier.js';
import { extractMetadata } from './encoder/metadata.js';
import { generatePreview } from './encoder/preview.js';

// dbPrefix available throughout the function
const dbPrefix = config.db.prefix ? `${config.db.prefix}_` : '';
await initDb();

async function runWorkerJob(instanceKey: string, workerKey: string, jobKey: string): Promise<void> {
  const jobProgressForEachStep = 20.00; // Each step contributes 20% to the total progress

  let job: JobRow = {
    key: jobKey,
    status: 'PENDING',
    progress: 0.00
  };

  try {
    await updateWorker(workerKey, 'RUNNING');

    /* JOB: SELECT */
    const [rows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: jobKey });
    if ((rows as any[]).length === 0) {
      logger.warn({ jobKey }, 'Job not found!');
      process.exit(0);
    }

    job = (rows as any[])[0];
    
    if (!job.key) throw new Error('Job key is missing!');

    /* JOB: PARSE */
    job.input = job.input ? JSON.parse(job.input as string) : null;
    job.outputs = job.outputs ? JSON.parse(job.outputs as string) : null;
    job.destination = job.destination ? JSON.parse(job.destination as string) : null;
    job.notification = job.notification ? JSON.parse(job.notification as string) : null;
    job.metadata = job.metadata ? JSON.parse(job.metadata as string) : null;
    job.error = job.error ? JSON.parse(job.error as string) : null;

    if (!job.outputs) throw new Error('Job outputs are missing!');

    /* JOB: OUTPUTs: PARSE */
    for (let index = 0; index < job.outputs.length; index++) {
      job.outputs[index].specs = job.outputs[index].specs ? JSON.parse(job.outputs[index].specs) : null;
    }

    let jobOutputsEncodedFiles = [];
    let jobOutputsFaileds = [];
    
    /* JOB: INPUT: DOWNLOADING */
    logger.info({ jobKey }, 'Downloading job input file!');
    job.status = 'DOWNLOADING';

    await startJob(job);
    await updateWorker(workerKey, 'RUNNING');
    
    const jobInputPath = await downloadInput(job.input);
    if (!jobInputPath) throw new Error('Job input file couldn\'t be downloaded!');
    
    /* JOB: INPUT: ANALYZING */
    logger.info({ jobKey, jobInputPath }, 'Extracting metadata from job input file!');
    job.status = 'ANALYZING';
    job.progress += jobProgressForEachStep;

    await updateJob(job);
    await updateWorker(workerKey, 'RUNNING');
    
    const jobInputMetadata = await extractMetadata(jobInputPath);
    if (!jobInputMetadata) throw new Error('Job input file metadata couldn\'t be extracted!');
    
    job.input = { ...job.input, ...jobInputMetadata };

    /* JOB: INPUT: PREVIEW */
    logger.info({ jobKey, duration: job.input?.duration ?? 0 }, 'Generating preview from input file!');
    
    try{
      await generatePreview(jobInputPath, job.key, job.input?.duration ?? 0);
      logger.info({ jobKey }, 'Preview generated successfully!');
    } catch (err) {
      logger.warn({ jobKey, err }, 'Preview generation failed!');
    }
    
    /* JOB: OUTPUTs: ENCODING */
    logger.info({ jobKey }, 'Encoding job outputs!');
    job.status = 'ENCODING';

    await updateJob(job);
    await updateWorker(workerKey, 'RUNNING');
    
    for (let index = 0; index < job.outputs.length; index++) {
      if (job.outputs[index].status !== 'FAILED') continue;
      
      job.outputs[index].status = 'ENCODING';

      try{
        jobOutputsEncodedFiles[job.outputs[index].key] = await encode(jobInputPath, job.outputs[index].specs);
      } catch (err){
        jobOutputsFaileds.push(job.outputs[index].key);
        job.outputs[index].status = 'FAILED';
      }

      job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

      await updateJob(job);
      await updateWorker(workerKey, 'RUNNING');
    }

    /* JOB: OUTPUTs: UPLOADING */
    logger.info({ jobKey }, 'Uploading job outputs!');
    job.status = 'UPLOADING';

    await updateJob(job);
    await updateWorker(workerKey, 'RUNNING');

    for (let index = 0; index < job.outputs.length; index++) {
      if (job.outputs[index].status !== 'FAILED') continue;
      
      job.outputs[index].status = 'UPLOADING';

      if (jobOutputsEncodedFiles[job.outputs[index].key]) {
        job.outputs[index].status = 'UPLOADING';
        job.outputs[index].result = await uploadOutput(job.outputs[index].specs, jobOutputsEncodedFiles[job.outputs[index].key], job.destination);
      } else{
        jobOutputsFaileds.push(job.outputs[index].key);
        job.outputs[index].status = 'FAILED';
      }

      job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

      await updateJob(job);
      await updateWorker(workerKey, 'RUNNING');
    }

    if (jobOutputsFaileds.length > 0) throw new Error(`Some outputs failed: ${jobOutputsFaileds.join(', ')}`);

    job.status = 'COMPLETED';
    job.error = null
  } catch (err: any) {
    job.status = 'FAILED';
    job.error = { message: err.message || 'Unknown error' };
  }

  job.progress = 100.00;

  await updateJob(job);
  await updateWorker(workerKey, 'EXITED');

  if (job.notification) {
    await notifyJob({...job});
  }

  if (job.status === 'COMPLETED') {
    logger.info({ instanceKey,  workerKey, jobKey }, 'Job completed successfully!');
    process.exit(0);
  } else {
    logger.info({ instanceKey,  workerKey, jobKey }, 'Job failed!');
    process.exit(1);
  }
}

async function startJob(job: any): Promise<void> {
  if (!job.key) return;

  try {
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = :status, started_at = :now, updated_at = :now WHERE \`key\` = :key`,
      { key: job.key, status: job.status, now: getNow() }
    );
  } catch (err) {
  }
}

async function updateJob(job: any): Promise<void> {
  if (!job.key) return;

  try {
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET input = :input, outputs = :outputs, status = :status, updated_at = :now, error = :error WHERE \`key\` = :key`,
      {
        key: job.key,
        input: job.input ? JSON.stringify(job.input) : null,
        outputs: job.outputs ? JSON.stringify(job.outputs) : null,
        status: job.status,
        now: getNow(),
        error: job.error ? JSON.stringify(job.error) : null
      }
    );
  } catch (err) {
  }
}

async function updateWorker(workerKey: string, status: string): Promise<void> {
  if (!workerKey) return;

  try {
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = :status, updated_at = :now WHERE \`key\` = :key`,
      { key: workerKey, status, now: getNow() }
    );
  } catch (err) {
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
