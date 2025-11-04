import { config } from '../config/index.js';
import { JobNotificationRow } from '../config/types.js';

import { getInstanceSpecs, uukey, getNow, subtractNow } from '../utils';
import { logger } from '../utils/logger.js';
import { storage } from '../utils/storage.js';
import { database } from '../utils/database.js';

import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { retryJobNotification } from './worker/notifier.js';

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
            const [instances] = await database.query(`SELECT * FROM ${database.getTablePrefix()}instances ORDER BY created_at ASC`) as any[];
            
            if (!instances.length) {
                logger.console('ERROR', 'No instances found in database!');
                return null;
            }

            const masters = instances.filter((instance: any) => instance.type === 'MASTER');
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
                master = instances[0];

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
      const specs = JSON.stringify(getInstanceSpecs());
      
      try {
        const [existingInstances] = await database.query(
          `SELECT * FROM ${database.getTablePrefix()}instances WHERE \`key\` = :instance_key LIMIT 1`,
          { instance_key }
        );
        
        if ((existingInstances as any[]).length === 0) {
          // INSERT new instance
          await database.execute(
            `INSERT INTO ${database.getTablePrefix()}instances (\`key\`, specs, status, updated_at, created_at) VALUES (:instance_key, :specs, 'RUNNING', :now, :now)`,
            { instance_key, specs, now }
          );

          await database.execute(
            `UPDATE ${database.getTablePrefix()}workers SET status = :status, outcome = :outcome WHERE instance_key = :instance_key`,
            { instance_key, status: 'EXITED', outcome: JSON.stringify({ message: 'Worker exited!' }) }
          );

          await logger.insert('INFO', 'Instance created!');
          return;
        }

        // UPDATE existing instance
        await database.execute(
          `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, status = 'RUNNING', restart_count = (restart_count + 1), updated_at = :now WHERE \`key\` = :instance_key`,
          { instance_key, specs, now }
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

        try {
            /* INSTANCEs: UPDATE: RUNNING: TIMEOUT */
          await database.execute(
            `UPDATE ${database.getTablePrefix()}instances SET status = 'EXITED', outcome = :outcome WHERE status = 'RUNNING' AND updated_at < :cutoff`,
            { outcome: JSON.stringify({ message: 'Instance exited due to timeout!' }), cutoff: subtractNow(runningTimeout, 'milliseconds') }
          );
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Instances maintenance failed!', { error });
        }

        try {
            /* INSTANCEs: DELETE: EXITED: TIMEOUT */
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

        try {
          /* WORKERs: UPDATE: RUNNING: TIMEOUT */
          await database.execute(
            `UPDATE ${database.getTablePrefix()}workers SET status = 'EXITED', outcome = :outcome WHERE status = 'RUNNING' AND updated_at < :cutoff`,
            { outcome: JSON.stringify({ message: 'Worker exited due to timeout!' }), cutoff: subtractNow(runningTimeout, 'milliseconds') }
          );
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Workers maintenance failed!', { error });
        }

        try {
          /* WORKERs: DELETE: EXITED: TIMEOUT */
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

    async function pollJobs(): Promise<void> {
        logger.console('INFO', 'Polling jobs...');

        try {
            // Check for available jobs in the queue that are still PENDING
            // Order by priority (lower = higher priority), then by created_at
            const [rows] = await database.query(
              `SELECT qj.key, qj.job_key FROM ${database.getTablePrefix()}jobs_queue qj JOIN ${database.getTablePrefix()}jobs j ON qj.job_key = j.key WHERE qj.available_at <= :now AND qj.visibility_timeout <= :now AND j.status = 'PENDING' ORDER BY qj.priority ASC, qj.created_at ASC LIMIT ${config.jobs.poll_limit || 1}`,
              { now: getNow() }
            );
            
            const records = rows as Array<{ key: string; job_key: string }>;
            if (records.length > 0) {
                const record = records[0];
                
                // Make sure no RUNNING worker exists in DB for that job before spawning
                const [wk] = await database.query(
                  `SELECT * FROM ${database.getTablePrefix()}workers WHERE job_key = :job_key AND status = 'RUNNING'`,
                  { job_key: record.job_key }
                );
                
                if ((wk as any[]).length === 0) {
                    createWorkerForJob(record.job_key);
                }
            }
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to poll jobs!', { error });
        }
    }

    async function retryJobsNotifications(): Promise<void> {
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

    // Function to spawn a worker child process for a specific job
    async function createWorkerForJob(job_key: string): Promise<void> {
      try {
        // If there's already a RUNNING worker for this job in the DB, skip
        const [existing] = await database.query(`SELECT * FROM ${database.getTablePrefix()}workers WHERE job_key = :job_key AND status = 'RUNNING'`, { job_key });
        
        if ((existing as any[]).length > 0) {
          logger.console('WARN', 'Worker already running for job!', { worker_key: existing[0].key, job_key });
          return;
        }

        // Respect global max workers by counting RUNNING rows in DB
        const [countRows] = await database.query(`SELECT COUNT(*) as cnt FROM ${database.getTablePrefix()}workers WHERE status = 'RUNNING'`);
        const runningCount = (countRows as any[])[0]?.cnt ?? 0;
        
        if (runningCount >= config.workers.max) {
          logger.console('WARN', 'Max workers reached, cannot spawn new worker!', { job_key, activeCount: runningCount, max: config.workers.max });
          return;
        }
      } catch (error: Error | any) {
        await logger.insert('ERROR', 'Failed to check existing workers!', { job_key, error });
        return;
      }

      const worker_key = uukey();
      let child: ChildProcess;

      /* WORKER: RUN */
      if (config.env === 'prod') {
        const workerScriptPath = path.join(process.cwd(), 'dist', 'services', 'worker', 'index.js');
        child = spawn('node', [workerScriptPath, instance_key, worker_key, job_key], {
          stdio: ['inherit', 'inherit', 'inherit'],
          cwd: process.cwd()
        });
      } else {
        const workerScriptPath = path.join(process.cwd(), 'src', 'services', 'worker', 'index.ts');
        child = spawn('npx', ['tsx', workerScriptPath, instance_key, worker_key, job_key], {
          stdio: ['inherit', 'inherit', 'inherit'],
          cwd: process.cwd(),
          shell: true
        });
      }

      /* WORKER: INSERT */
      try {
        await database.execute(
          `INSERT INTO ${database.getTablePrefix()}workers (\`key\`, instance_key, pid, job_key, status, updated_at, created_at) VALUES (:worker_key, :instance_key, :pid, :job_key, 'RUNNING', :now, :now)`,
          { instance_key, worker_key, pid: child.pid, job_key, now: getNow() }
        );
      } catch (error: Error | any) {
        await logger.insert('ERROR', 'Failed to insert worker!', { job_key, error });
      }

      workersProcessMap.set(worker_key, child);

      /* INSTANCE: UPDATE */
      try {
        await database.execute(
          `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, workers_running_count = workers_running_count + 1, updated_at = :now WHERE \`key\` = :instance_key`,
          { instance_key, specs: JSON.stringify(getInstanceSpecs()), now: getNow() }
        );
      } catch (error: Error | any) {
        await logger.insert('ERROR', 'Failed to update instance!', { worker_key, job_key, error });
      }

      /* JOB: NOTIFICATIONs: UPDATE */
      try {
        const test = await database.execute(
          `UPDATE ${database.getTablePrefix()}jobs_notifications SET instance_key = :instance_key, worker_key = :worker_key WHERE job_key = :job_key`,
          { instance_key, worker_key, job_key }
        );
      } catch (error: Error | any) {
        await logger.insert('ERROR', 'Failed to update job notifications!', { worker_key, job_key, error });
      }

      child.on('exit', async (code, signal) => {
        logger.console('INFO', 'Worker process exited!', { worker_key, job_key, code, signal });
        workersProcessMap.delete(worker_key);
        
        /* WORKER: UPDATE */
        try {
          await database.execute(
            `UPDATE ${database.getTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :worker_key`,
            { worker_key, outcome: JSON.stringify({ message: 'Worker exited!', exit_code: code, exit_signal: signal }), now: getNow() }
          );
        } catch (error: Error | any) {
          await logger.insert('ERROR', 'Failed to update worker!', { worker_key, job_key, error });
        }

        /* INSTANCE: UPDATE */
        try {
          await database.execute(
            `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
            { instance_key, specs: JSON.stringify(getInstanceSpecs()), now: getNow() }
          );
        } catch (error: Error | any) {
          await logger.insert('ERROR', 'Failed to update instance!', { worker_key, job_key, error });
        }
      });

      child.on('error', async (error) => {
        await logger.insert('ERROR', 'Worker process error!', { worker_key, job_key, error });
        workersProcessMap.delete(worker_key);
        
        /* WORKER: UPDATE */
        try {
          await database.execute(
            `UPDATE ${database.getTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :worker_key`,
            { worker_key, outcome: JSON.stringify({ message: error.message || 'Unknown error occurred!', exit_signal: 'ERROR' }), now: getNow() }
          );
        } catch (error: Error | any) {
          await logger.insert('ERROR', 'Failed to update worker!', { worker_key, job_key, error });
        }
        
        /* INSTANCE: UPDATE */
        try {
          await database.execute(
            `UPDATE ${database.getTablePrefix()}instances SET specs = :specs, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
            { instance_key, specs: JSON.stringify(getInstanceSpecs()), now: getNow() }
          );
        } catch (error: Error | any) {
          await logger.insert('ERROR', 'Failed to update instance!', { worker_key, job_key, error });
        }
      });

      logger.console('INFO', 'Spawned worker process!', { worker_key, job_key });
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

        await pollJobs();
        intervals.set('pollJobs', setInterval(() => pollJobs(), config.jobs.poll_interval || 10000));

        await retryJobsNotifications();
        intervals.set('retryJobsNotifications', setInterval(() => retryJobsNotifications(), config.notifications.poll_interval || 60000));

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
