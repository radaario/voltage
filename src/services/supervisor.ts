import { config } from '../config/index.js';
import { JobNotificationRow } from '../config/types.js';

import { getInstanceSpecs, uukey, getNow, addNow, subtractNow } from '../utils';
import { logger } from '../utils/logger.js';
import { storage } from '../utils/storage.js';
import { database } from '../utils/database.js';

import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createJobNotification, retryJobNotification } from './worker/notifier.js';

const intervals = new Map<string, NodeJS.Timeout>();

export async function startSupervisorService(instance_key: string) {
    await logger.insert('INFO', 'Starting supervisor service...', { instance_key });

    if (!instance_key) {
      await logger.insert('ERROR', 'Instance key required!');
      throw new Error('Instance key required!');
    }

    logger.setMetadata({ instance_key });
    await storage.config(config.storage);
    database.config(config.database);

    async function getMasterInstance(): Promise<any | null> {
        try {
            const cutoff = subtractNow(config.instances.running_timeout || (1 * 60 * 1000), 'milliseconds');

            const [instances] = await database.query(`SELECT * FROM ${database.getTablePrefix()}instances ORDER BY created_at ASC`) as any[];
            
            if (!instances.length) {
                logger.console('ERROR', 'No instances found in database!');
                return null;
            }

            const masters = instances.filter((instance: any) => instance.type === 'MASTER' && instance.updated_at >= cutoff);
            let master = masters.length ? masters[0] : null;

            if (masters.length > 1) {
                const masterKey = master.key;
                
                await database.execute(
                  `UPDATE ${database.getTablePrefix()}instances SET type = 'SLAVE' WHERE type = :type AND \`key\` != :key`,
                  { key: masterKey, type: 'MASTER', now: getNow() }
                );

                // reflect changes locally
                instances.forEach((instance: any) => {
                    if (instance.type === 'MASTER' && instance.key !== masterKey) instance.type = 'SLAVE';
                });

                logger.console('INFO', 'Multiple MASTER instances found; demoted extras to SLAVE!');
            }

            if (!master) {
                const activeInstances = instances.filter((instance: any) => instance.updated_at >= cutoff);
                master = activeInstances[0];

                await database.execute(
                  `UPDATE ${database.getTablePrefix()}instances SET type = :type WHERE \`key\` = :key`,
                  { key: master.key, type: 'MASTER', now: getNow() }
                );

                master.type = 'MASTER';
                logger.console('INFO', 'No MASTER instance found; promoted first instance to MASTER!');
            }

            return master;
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Selecting MASTER instance failed!', { error });
            throw error;
        }
    }

    async function initInstance() {
      await logger.insert('INFO', 'Initializing instance...');
      
      const now = getNow();
      const specs = getInstanceSpecs();
      
      try {
        const [existingInstances] = await database.query(
          `SELECT * FROM ${database.getTablePrefix()}instances WHERE \`key\` = :instance_key LIMIT 1`,
          { instance_key }
        );
        
        if ((existingInstances as any[]).length === 0) {
          // INSTANCE: INSERT
          await database.execute(
            `INSERT INTO ${database.getTablePrefix()}instances (\`key\`, specs, status, updated_at, created_at) VALUES (:instance_key, :specs, 'RUNNING', :now, :now)`,
            { instance_key, specs: JSON.stringify(specs), now }
          );

          await logger.insert('INFO', 'Instance created!');
          return;
        }

        // INSTANCE: UPDATE
        await database.execute(
          `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, status = 'RUNNING', restart_count = (restart_count + 1), updated_at = :now WHERE \`key\` = :instance_key`,
          { instance_key, specs: JSON.stringify(specs), now }
        );

        await database.execute(
          `UPDATE ${database.getTablePrefix()}workers SET status = :status, outcome = :outcome WHERE instance_key = :instance_key`,
          { instance_key, status: 'EXITED', outcome: JSON.stringify({ message: 'Worker exited!' }) }
        );

        await logger.insert('INFO', 'Instance restarted!');
      } catch (error: Error | any) {
        await logger.insert('ERROR', 'Instance initialization failed!', { error });
        throw error;
      }
    }

    async function maintainInstance() {
        logger.console('INFO', 'Maintaining instance...');

        try {
          await database.execute(
            `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, status = 'RUNNING', updated_at = :now WHERE \`key\` = :instance_key`,
            { instance_key, specs: JSON.stringify(getInstanceSpecs()), now: getNow() }
          );
        } catch (error: Error | any) {
          await logger.insert('ERROR', 'Instance maintenance failed!', { error });
        }
    }

    async function maintainInstances() {
        logger.console('INFO', 'Maintaining instances...');

        /* INSTANCEs: UPDATE */
        const runningTimeout = config.instances.running_timeout || 60000;
        const exitedTimeout = runningTimeout + (config.instances.exited_timeout || 60000);

        /* INSTANCEs: UPDATE: RUNNING: TIMEOUT */
        try {
          await database.execute(
            `UPDATE ${database.getTablePrefix()}instances SET status = 'EXITED', outcome = :outcome WHERE status = 'RUNNING' AND updated_at < :cutoff`,
            { outcome: JSON.stringify({ message: 'Instance exited due to timeout!' }), cutoff: subtractNow(runningTimeout, 'milliseconds') }
          );
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Instances maintenance failed!', { error });
        }

        /* INSTANCEs: DELETE: EXITED: TIMEOUT */
        try {
          await database.execute(
            `DELETE FROM ${database.getTablePrefix()}instances WHERE status = :status AND updated_at < :cutoff`,
            { cutoff: subtractNow(exitedTimeout, 'milliseconds')  }
          );
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Instances cleanup failed!', { error });
        }
    }

    async function maintainWorkers() {
        logger.console('INFO', 'Maintaining workers...');

        /* WORKERs: UPDATE */
        const runningTimeout = config.workers.running_timeout || 60000;
        const exitedTimeout = runningTimeout + (config.workers.exited_timeout || 60000);

        /* WORKERs: UPDATE: RUNNING: TIMEOUT */
        try {
          await database.execute(
            `UPDATE ${database.getTablePrefix()}workers SET status = 'EXITED', outcome = :outcome WHERE status = 'RUNNING' AND updated_at < :cutoff`,
            { outcome: JSON.stringify({ message: 'Worker exited due to timeout!' }), cutoff: subtractNow(runningTimeout, 'milliseconds') }
          );
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Workers maintenance failed!', { error });
        }

        /* WORKERs: DELETE: EXITED: TIMEOUT */
        try {
          await database.execute(
            `DELETE FROM ${database.getTablePrefix()}workers WHERE status = 'EXITED' AND updated_at < :cutoff`,
            { cutoff: subtractNow(exitedTimeout, 'milliseconds')  }
          );
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Workers cleanup failed!', { error });
        }
    }

    async function cleanupLogs() {
      await database.execute(
        `DELETE FROM ${database.getTablePrefix()}logs WHERE created_at < :cutoff`,
        { cutoff: subtractNow(config.logs.retention || 1, 'hours') }
      );

      logger.console('INFO', 'Cleanup completed logs!');
    }

    async function maintainJobs(): Promise<void> {
        logger.console('INFO', 'Maintaining jobs...');

        /* JOBs: PENDINGs */
        try {
          const [pendingJobs] = await database.query(
            `SELECT * FROM ${database.getTablePrefix()}jobs WHERE status = 'PENDING' OR (status = 'RETRYING' AND retry_at <= :now)`,
            { now: getNow() }
          );

          const databaseConn = await database.getConnection();

          for (const pendingJob of pendingJobs) {
            try{
              if (databaseConn.beginTransaction) await databaseConn.beginTransaction();

              await databaseConn.execute(
                `UPDATE ${database.getTablePrefix()}jobs SET status = :status, retry_at = :retry_at WHERE \`key\` = :key`,
                { ...pendingJob, status: 'QUEUED', retry_at: null }
              );
            
              await databaseConn.execute(
                `INSERT INTO ${database.getTablePrefix()}jobs_queue (\`key\`, priority, created_at) VALUES (:key, :priority, :created_at)`,
                { ...pendingJob }
              );

              if (databaseConn.commit) await databaseConn.commit();

              if (pendingJob.notification) await createJobNotification('QUEUED', pendingJob);

              await logger.insert('INFO', 'Job successfully queued! - X', { job_key: pendingJob.key });
            } catch (error: Error | any) {
              if (databaseConn.rollback) await databaseConn.rollback();
              await logger.insert('ERROR', 'Create job queue failed!', { job_key: pendingJob.key, error });
            } finally {
              if (databaseConn.release) databaseConn.release();
            }
          }
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to maintain pending jobs!', { error });
        }

        /* INSTANCE: WORKERs: SELECT */
        const [runningWorkers] = await database.query(
          `SELECT * FROM ${database.getTablePrefix()}workers WHERE instance_key = :instance_key AND status = 'RUNNING'`,
          { instance_key }
        ) as any[];

        const runningWorkersCount = runningWorkers.length;

        /* JOBs: QUEUEDs */
        if (runningWorkersCount < config.workers.max) {
          try {
              const [queuedJobs] = await database.query(
                `SELECT * FROM ${database.getTablePrefix()}jobs_queue ORDER BY priority ASC, created_at ASC LIMIT ${config.workers.max - runningWorkersCount || 1}`,
                { now: getNow() }
              ) as any[];

              for (const queuedJob of queuedJobs) {
                await createWorkerForJob(queuedJob.key);
              }
          } catch (error: Error | any) {
              await logger.insert('ERROR', 'Failed to poll jobs!', { error });
          }
        }
    }

    async function maintainJobsNotifications(): Promise<void> {
        logger.console('INFO', 'Polling job notifications...');

        try {
            // Check for failed notifications that need to be retried
            const [queryNotifications] = await database.query(
              `SELECT * FROM ${database.getTablePrefix()}jobs_notifications WHERE status = 'PENDING' AND retry_at <= :now LIMIT ${config.notifications.poll_limit || 10 }`, //  ORDER BY priority
              { now: getNow() }
            );

            for (const notification of queryNotifications as Array<JobNotificationRow>) {
                retryJobNotification(notification);
            }
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to poll job notifications!', { error });
        }
    }

    // Keep in-memory ChildProcess handles only. Worker metadata is persisted in Database.
    // Keys in workersProcessMap are worker_key (uuid per worker), not job keys.
    const workersProcessMap = new Map<string, ChildProcess>();

    async function createWorkerForJob(job_key: string): Promise<any> {
      const worker = {
        key: uukey(),
      };

      const databaseConn = await database.getConnection();
      
      try {
        if (databaseConn.beginTransaction) await databaseConn.beginTransaction();

        /* JOB: QUEUE: DELETE */
        await database.execute(
          `DELETE FROM ${database.getTablePrefix()}jobs_queue WHERE \`key\` = :job_key`,
          { job_key }
        );

        /* WORKER: INSERT */
        await database.execute(
          `INSERT INTO ${database.getTablePrefix()}workers (\`key\`, instance_key, job_key, status, updated_at, created_at) VALUES (:worker_key, :instance_key, :job_key, 'RUNNING', :now, :now)`,
          { instance_key, worker_key: worker.key, job_key, now: getNow() }
        );

        /* INSTANCE: UPDATE */
        await database.execute(
          `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, workers_running_count = workers_running_count + 1, updated_at = :now WHERE \`key\` = :instance_key`,
          { instance_key, specs: JSON.stringify(getInstanceSpecs()), now: getNow() }
        );

        /* JOB: NOTIFICATIONs: UPDATE */
        await database.execute(
          `UPDATE ${database.getTablePrefix()}jobs_notifications SET instance_key = :instance_key, worker_key = :worker_key WHERE job_key = :job_key`,
          { instance_key, worker_key: worker.key, job_key }
        );

        /* WORKER: CREATE */
        let child: ChildProcess;

        if (config.env === 'prod') {
          const workerScriptPath = path.join(process.cwd(), 'dist', 'services', 'worker', 'index.js');
          child = spawn('node', [workerScriptPath, instance_key, worker.key, job_key], {
            stdio: ['inherit', 'inherit', 'inherit'],
            cwd: process.cwd()
          });
        } else {
          const workerScriptPath = path.join(process.cwd(), 'src', 'services', 'worker', 'index.ts');
          child = spawn('npx', ['tsx', workerScriptPath, instance_key, worker.key, job_key], {
            stdio: ['inherit', 'inherit', 'inherit'],
            cwd: process.cwd(),
            shell: true
          });
        }

        /* WORKER: EVENTs */
        child.on('exit', async (code, signal) => {
          logger.console('INFO', 'Worker process exited!', { worker_key: worker.key, job_key, code, signal });
          workersProcessMap.delete(worker.key);
          
          /* WORKER: UPDATE */
          try {
            await database.execute(
              `UPDATE ${database.getTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :worker_key`,
              { worker_key: worker.key, outcome: JSON.stringify({ message: 'Worker exited!', exit_code: code, exit_signal: signal }), now: getNow() }
            );
          } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to update worker!', { worker_key: worker.key, job_key, error });
          }

          /* INSTANCE: UPDATE */
          try {
            await database.execute(
              `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
              { instance_key, specs: JSON.stringify(getInstanceSpecs()), now: getNow() }
            );
          } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to update instance!', { worker_key: worker.key, job_key, error });
          }
        });

        child.on('error', async (error) => {
          await logger.insert('ERROR', 'Worker process error!', { worker_key: worker.key, job_key, error });
          workersProcessMap.delete(worker.key);
          
          /* WORKER: UPDATE */
          try {
            await database.execute(
              `UPDATE ${database.getTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :worker_key`,
              { worker_key: worker.key, outcome: JSON.stringify({ message: error.message || 'Unknown error occurred!', exit_signal: 'ERROR' }), now: getNow() }
            );
          } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to update worker!', { worker_key: worker.key, job_key, error });
          }
          
          /* INSTANCE: UPDATE */
          try {
            await database.execute(
              `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
              { instance_key, specs: JSON.stringify(getInstanceSpecs()), now: getNow() }
            );
          } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to update instance!', { worker_key: worker.key, job_key, error });
          }
        });

        workersProcessMap.set(worker.key, child);

        if (databaseConn.commit) await databaseConn.commit();

        logger.console('INFO', 'Worker succesfully created for job!', { worker_key: worker.key, job_key });

        return worker;
      } catch (error: Error | any) {
        if (databaseConn.rollback) await databaseConn.rollback();
        await logger.insert('ERROR', 'Failed to create worker for job!', { job_key, error });
        return null;
      } finally {
        if (databaseConn.release) databaseConn.release();
      }
    }

    async function cleanupJobs() {
      const [rows] = await database.query(
        `SELECT \`key\` FROM ${database.getTablePrefix()}jobs WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_at < :cutoff`,
        { cutoff: subtractNow(config.jobs.retention || 24, 'hours')  }
      );
      
      const keys = (rows as any[]).map((r) => r.key);
      
      if (keys.length === 0) {
        logger.console('INFO', 'No jobs to cleanup!');
        return;
      }
      
      // Delete job folders/objects via unified storage facade
      for (const key of keys) {
        const prefix = `/jobs/${key}/`;
        
        try {
          await storage.delete(prefix);
        } catch (error: Error | any) {
        }
      }

      await database.execute(`DELETE FROM ${database.getTablePrefix()}jobs WHERE \`key\` IN (${keys.map(() => '?').join(',')})`, keys);
      // await database.execute(`DELETE FROM ${database.getTablePrefix()}jobs_notifications WHERE job_key IN (${keys.map(() => '?').join(',')})`, keys);
      // await database.execute(`DELETE FROM ${database.getTablePrefix()}jobs_queue WHERE job_key IN (${keys.map(() => '?').join(',')})`, keys);

      logger.console('INFO', 'Cleanup completed jobs!', { count: keys.length });
    }

    try {
        await initInstance();
        intervals.set('maintainInstance', setInterval(() => maintainInstance(), config.instances.maintain_interval || 60000));

        await maintainJobs();
        intervals.set('maintainJobs', setInterval(() => maintainJobs(), config.jobs.maintain_interval || 10000));

        await maintainJobsNotifications();
        intervals.set('maintainJobsNotifications', setInterval(() => maintainJobsNotifications(), config.notifications.maintain_interval || 60000));

        /* INSTANCE: SELECT: MASTER */
        const masterInstance = await getMasterInstance();
        
        if(masterInstance.key == instance_key){
            if((config.jobs.retention || 24) > 0){
                await cleanupJobs();
                intervals.set('cleanupJobs', setInterval(() => cleanupJobs(), config.jobs.cleanup_interval || 3600000));
            }

            await maintainInstances();
            intervals.set('maintainInstances', setInterval(() => maintainInstances(), config.instances.maintain_interval || 60000));

            await maintainWorkers();
            intervals.set('maintainWorkers', setInterval(() => maintainWorkers(), config.workers.maintain_interval || 60000));

            if(!config.logs.is_disabled || (config.logs.retention || 1) > 0){
                await cleanupLogs();
                intervals.set('cleanupLogs', setInterval(() => cleanupLogs(), config.logs.cleanup_interval || 3600000));
            }
        }
    } catch (error: Error | any) {
        await logger.insert('ERROR', 'Failed to start supervisor service!', { error });
        throw error;
    }
}

export async function shutdownSupervisorService(instance_key: string, signal: string) {
  logger.console('INFO', `Supervisor service received :signal, shutting down gracefully!`, { signal });

  // Clear all intervals
  if (intervals) {
    intervals.forEach((intervalId, key) => {
      clearInterval(intervalId);
      logger.console('INFO', `Cleared interval!`, { key });
    });
    intervals.clear();
  }

  // DB: WORKERs: UPDATE
  try {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE instance_key = :instance_key`,
      { instance_key, outcome: JSON.stringify({ message: 'Worker exited due to instance shutdown!', signal }), now: getNow() }
    );
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to update workers for instance during shutdown!', { error });
  }
  
  // DB: INSTANCE: UPDATE
  try {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :instance_key`,
      { instance_key, specs: JSON.stringify(getInstanceSpecs()), outcome: JSON.stringify({ message: 'Instance exited due to shutdown!', signal }), now: getNow() }
    );
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to update instance during shutdown!', { error });
  }

  await logger.insert('INFO', 'Supervisor service shutdown completed!');
}
