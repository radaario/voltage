import { config } from '../config/index.js';

import { getInstanceSystemInfo, uukey, getNow, subtractNow } from '../utils';
import { logger } from '../utils/logger.js';
import { pool } from '../utils/database.js';

import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

/* DATABASE: PREFIX */
const dbPrefix = config.db.prefix ? `${config.db.prefix}_` : '';

async function getMasterInstance(): Promise<any | null> {
    try {
        const [instances] = await pool.query(`SELECT * FROM ${dbPrefix}instances ORDER BY created_at ASC`) as any[];
        
        if (!instances.length) {
            logger.error('No instances found in database!');
            return null;
        }

        const masters = instances.filter((instance: any) => instance.type === 'MASTER');
        let master = masters.length ? masters[0] : null;

        if (masters.length > 1) {
            const masterKey = master.key;
            
            await pool.execute(
                `UPDATE ${dbPrefix}instances SET type = 'SLAVE' WHERE type = :type AND \`key\` != :key`,
                { now: getNow(), type: 'MASTER', key: masterKey }
            );

            // reflect changes locally
            instances.forEach((instance: any) => {
                if (instance.type === 'MASTER' && instance.key !== masterKey) instance.type = 'SLAVE';
            });

            logger.info('Multiple MASTER instances found; demoted extras to SLAVE!');
        }

        if (!master) {
            master = instances[0];

            await pool.execute(
                `UPDATE ${dbPrefix}instances SET type = :type WHERE \`key\` = :key`,
                { type: 'MASTER', now: getNow(), key: master.key }
            );

            master.type = 'MASTER';
            logger.info('No MASTER instance found; promoted first instance to MASTER!');
        }

        return master;
    } catch (err) {
        logger.error({ err }, 'Selecting MASTER instance failed!');
        throw err;
    }
}

async function maintainInstance() {
    logger.info('Instance maintenance started!');
    
    /* INSTANCE: UPDATE */
    try {
        await pool.execute(
            `UPDATE ${dbPrefix}instances SET system = :system, updated_at = :now WHERE \`key\` = :instance_key`,
            { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
        );
    } catch (err) {
        logger.error({ err }, 'Instance maintenance failed!');
    }
}

async function maintainInstances() {
    logger.info('Instances maintenance started!');

    /* INSTANCEs: UPDATE */
    const runningTimeout = config.instances.running_timeout || 60000;
    const exitedTimeout = runningTimeout + (config.instances.exited_timeout || 60000);

    try {
        /* INSTANCEs: UPDATE: RUNNING: TIMEOUT */
        await pool.execute(
            `UPDATE ${dbPrefix}instances SET status = 'EXITED' WHERE status = 'RUNNING' AND updated_at < :cutoff`,
            { cutoff: subtractNow(runningTimeout, 'milliseconds')  }
        );
    } catch (err) {
        logger.error({ err }, 'Instances maintenance failed!');
    }

    try {
        /* INSTANCEs: DELETE: EXITED: TIMEOUT */
        await pool.execute(
            `DELETE FROM ${dbPrefix}instances WHERE status = 'EXITED' AND updated_at < :cutoff`,
            { cutoff: subtractNow(exitedTimeout, 'milliseconds')  }
        );
    } catch (err) {
        logger.error({ err }, 'Instances maintenance failed!');
    }
}

async function maintainWorkers() {
    logger.info('Workers maintenance started!');

    /* WORKERs: UPDATE */
    const runningTimeout = config.workers.running_timeout || 60000;
    const exitedTimeout = runningTimeout + (config.workers.exited_timeout || 60000);

    try {
        /* WORKERs: UPDATE: RUNNING: TIMEOUT */
        await pool.execute(
            `UPDATE ${dbPrefix}workers SET status = 'EXITED' WHERE status = 'RUNNING' AND updated_at < :cutoff`,
            { cutoff: subtractNow(runningTimeout, 'milliseconds')  }
        );
    } catch (err) {
        logger.error({ err }, 'Workers maintenance failed!');
    }

    try {
        /* WORKERs: DELETE: EXITED: TIMEOUT */
        await pool.execute(
            `DELETE FROM ${dbPrefix}workers WHERE status = 'EXITED' AND updated_at < :cutoff`,
            { cutoff: subtractNow(exitedTimeout, 'milliseconds')  }
        );
    } catch (err) {
        logger.error({ err }, 'Workers maintenance failed!');
    }
}

async function pollJobs(): Promise<void> {
    try {
        // Check for available jobs in the queue that are still PENDING
        // Order by priority (lower = higher priority), then by created_at
        const [rows] = await pool.query(
            `SELECT qj.key, qj.job_key FROM ${dbPrefix}queue_jobs qj JOIN ${dbPrefix}jobs j ON qj.job_key = j.key WHERE qj.available_at <= :now AND qj.visibility_timeout <= :now AND j.status = 'PENDING' ORDER BY qj.priority ASC, qj.created_at ASC LIMIT 1`,
            { now: getNow() }
        );
        
        const records = rows as Array<{ key: string; job_key: string }>;
        if (records.length > 0) {
            const record = records[0];
            // Make sure no RUNNING worker exists in DB for that job before spawning
            const [wk] = await pool.query(
                `SELECT * FROM ${dbPrefix}workers WHERE job_key = :job_key AND status = 'RUNNING'`,
                { job_key: record.job_key }
            );
            
            if ((wk as any[]).length === 0) {
                createWorkerForJob(record.job_key);
            }
        }
    } catch (err) {
        logger.error({ err }, 'queue monitoring error');
    }
}

// Keep in-memory ChildProcess handles only. Worker metadata is persisted in DB.
// Keys in workersProcessMap are workerKey (uuid per worker), not job keys.
const workersProcessMap = new Map<string, ChildProcess>();

// Function to spawn a worker child process for a specific job
async function createWorkerForJob(jobKey: string): Promise<void> {
  try {
    // If there's already a RUNNING worker for this job in the DB, skip
    const [existing] = await pool.query(`SELECT * FROM ${dbPrefix}workers WHERE job_key = :job_key AND status = 'RUNNING'`, { job_key: jobKey });
    
    if ((existing as any[]).length > 0) {
      logger.warn({ jobKey }, 'Worker already running for job!');
      return;
    }

    // Respect global max workers by counting RUNNING rows in DB
    const [countRows] = await pool.query(`SELECT COUNT(*) as cnt FROM ${dbPrefix}workers WHERE status = 'RUNNING'`);
    const runningCount = (countRows as any[])[0]?.cnt ?? 0;
    if (runningCount >= config.workers.max) {
      logger.warn({ jobKey, activeCount: runningCount, max: config.workers.max }, 'Max workers reached, cannot spawn new worker!');
      return;
    }
  } catch (err) {
    logger.error({ err, jobKey }, 'Failed to check existing workers in DB!');
    return;
  }

  const workerKey = uukey();
  let child: ChildProcess;

  /* WORKER: RUN */
  if (config.env === 'prod') {
    const workerScriptPath = path.join(process.cwd(), 'dist', 'services', 'worker.js');
    child = spawn('node', [workerScriptPath, instanceKey, workerKey, jobKey], {
      stdio: ['inherit', 'inherit', 'inherit'],
      cwd: process.cwd()
    });
  } else {
    const workerScriptPath = path.join(process.cwd(), 'src', 'services', 'worker.ts');
    child = spawn('npx', ['tsx', workerScriptPath, instanceKey, workerKey, jobKey], {
      stdio: ['inherit', 'inherit', 'inherit'],
      cwd: process.cwd(),
      shell: true
    });
  }

  /* WORKER: INSERT */
  try {
    await pool.execute(
      `INSERT INTO ${dbPrefix}workers (\`key\`, instance_key, pid, job_key, status, updated_at, created_at) VALUES (:worker_key, :instance_key, :pid, :job_key, 'RUNNING', :now, :now)`,
      { worker_key: workerKey, instance_key: instanceKey, pid: child.pid, job_key: jobKey, now: getNow() }
    );
  } catch (err) {
    logger.error({ err, jobKey }, 'Failed to insert worker!');
  }

  workersProcessMap.set(workerKey, child);

  /* INSTANCE: UPDATE */
  try {
    await pool.execute(
      `UPDATE ${dbPrefix}instances SET system = :system, workers_running_count = workers_running_count + 1, updated_at = :now WHERE \`key\` = :instance_key`,
      { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
    );
  } catch (err) {
    logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update instance!');
  }

  child.on('exit', async (code, signal) => {
    logger.info({ instanceKey, jobKey, workerKey, code, signal }, 'Worker process exited!');
    workersProcessMap.delete(workerKey);
    
    /* WORKER: UPDATE */
    try {
      await pool.execute(
        `UPDATE ${dbPrefix}workers SET status = 'EXITED', exit_code = :code, exit_signal = :signal, updated_at = :now WHERE \`key\` = :worker_key`,
        { code, signal, worker_key: workerKey, now: getNow() }
      );
    } catch (err) {
      logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update worker!');
    }

    /* INSTANCE: UPDATE */
    try {
      await pool.execute(
        `UPDATE ${dbPrefix}instances SET system = :system, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
        { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
      );
    } catch (err) {
      logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update instance!');
    }
  });

  child.on('error', async (err) => {
    logger.error({ err, instanceKey, workerKey, jobKey }, 'worker process error');
    workersProcessMap.delete(workerKey);
    
    /* WORKER: UPDATE */
    try {
      await pool.execute(
        `UPDATE ${dbPrefix}workers SET status = 'EXITED', exit_code = NULL, exit_signal = 'ERROR', updated_at = :now WHERE \`key\` = :worker_key`,
        { worker_key: workerKey, now: getNow() }
      );
    } catch (err) {
      logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update worker!');
    }
    
    /* INSTANCE: UPDATE */
    try {
      await pool.execute(
        `UPDATE ${dbPrefix}instances SET system = :system, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
        { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
      );
    } catch (err) {
      logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update instance!');
    }
  });

  logger.info({ instanceKey, workerKey, jobKey }, 'Spawned worker process!');
}

async function cleanupJobs() {
  const [rows] = await pool.query(
    `SELECT \`key\` FROM ${dbPrefix}jobs WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_at < :cutoff`,
    { cutoff: subtractNow(config.jobs.retention, 'hours')  }
  );
  
  const keys = (rows as any[]).map((r) => r.key);
  
  if (keys.length === 0) {
    logger.info('No jobs to cleanup!');
    return;
  }
  
  // Delete job folders/objects from storage based on storage kind
  if (config.storage.kind === 'AWS_S3') {
    // Delete from S3
    for (const key of keys) {
      try {
        await deleteJobFromS3(key);
        logger.info({ jobKey: key }, 'Deleted job from S3!');
      } catch (err) {
        logger.warn({ err, jobKey: key }, 'Failed to delete job from S3!');
      }
    }
  } else {
    // Delete from local storage
    for (const key of keys) {
      const jobDir = path.join(config.storage.path, 'jobs', key);
      try {
        await fs.rm(jobDir, { recursive: true, force: true });
        logger.info({ jobKey: key, jobDir }, 'Deleted job folder from local storage!');
      } catch (err) {
        logger.warn({ err, jobKey: key, jobDir }, 'Failed to delete job folder from local storage!');
      }
    }
  }
  
  await pool.execute(`DELETE FROM ${dbPrefix}jobs WHERE \`key\` IN (${keys.map(() => '?').join(',')})`, keys);
  
  logger.info({ count: keys.length }, 'Cleanup completed jobs!');
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
      logger.info({ jobKey, objectCount: listResponse.Contents.length }, 'Deleted job objects from S3!');
    } else {
      logger.info({ jobKey }, 'No S3 objects found for job!');
    }
  } catch (error) {
    logger.error({ error, jobKey }, 'Failed to delete job from S3!');
    throw error;
  }
}

const instanceKey = process.argv[2];

if (!instanceKey) {
  logger.error('Instance key required!');
  process.exit(1);
}

async function main() {
    try {
        logger.info('Maintainer service starting!');

        await pollJobs();
        setInterval(() => pollJobs(), config.jobs.poll_interval);

        await maintainInstance();
        setInterval(() => maintainInstance(), config.instances.maintain_interval);

        /* INSTANCE: SELECT: MASTER */
        const masterInstance = await getMasterInstance();
        
        if(masterInstance.key == instanceKey){
            if(config.jobs.retention > 0){
                await cleanupJobs();
                setInterval(() => cleanupJobs(), config.jobs.cleanup_interval);
            }

            // Run maintenance immediately on startup
            await maintainInstances();
            setInterval(() => maintainInstances(), config.instances.maintain_interval);

            await maintainWorkers();
            setInterval(() => maintainWorkers(), config.workers.maintain_interval);
        }

        // Keep the process running
        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM signal, shutting down maintainer!');
            process.exit(0);
        });

        process.on('SIGINT', () => {
            logger.info('Received SIGINT signal, shutting down maintainer!');
            process.exit(0);
        });
    } catch (error) {
        logger.error({ error }, 'Failed to start maintainer service!');
        process.exit(1);
    }
}

// Start the maintainer service
main().catch((error) => {
    logger.error({ error }, 'Unhandled error in maintainer service!');
    process.exit(1);
});
