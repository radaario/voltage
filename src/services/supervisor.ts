import { config } from '../config/index.js';

import { getInstanceSystemInfo, uukey, getNow, subtractNow } from '../utils';
import { logger } from '../utils/logger.js';
import { initDb, dbPool, dbTablePrefix } from '../utils/database.js';
import { storage } from '../utils/storage.js';

import path from 'path';
import { spawn, ChildProcess } from 'child_process';

const intervals = new Map<string, NodeJS.Timeout>();

export async function startSupervisorService(instanceKey: string) {
    logger.info('Starting supervisor service...');

    if (!instanceKey) {
      logger.error('Instance key required!');
      throw new Error('Instance key required!');
    }

    await storage.init(config.storage);
    await initDb();

    async function getMasterInstance(): Promise<any | null> {
        try {
            const [instances] = await dbPool.query(`SELECT * FROM ${dbTablePrefix()}instances ORDER BY created_at ASC`) as any[];
            
            if (!instances.length) {
                logger.error('No instances found in database!');
                return null;
            }

            const masters = instances.filter((instance: any) => instance.type === 'MASTER');
            let master = masters.length ? masters[0] : null;

            if (masters.length > 1) {
                const masterKey = master.key;
                
                await dbPool.execute(
                    `UPDATE ${dbTablePrefix()}instances SET type = 'SLAVE' WHERE type = :type AND \`key\` != :key`,
                    { key: masterKey, type: 'MASTER', now: getNow() }
                );

                // reflect changes locally
                instances.forEach((instance: any) => {
                    if (instance.type === 'MASTER' && instance.key !== masterKey) instance.type = 'SLAVE';
                });

                logger.info('Multiple MASTER instances found; demoted extras to SLAVE!');
            }

            if (!master) {
                master = instances[0];

                await dbPool.execute(
                    `UPDATE ${dbTablePrefix()}instances SET type = :type WHERE \`key\` = :key`,
                    { key: master.key, type: 'MASTER', now: getNow() }
                );

                master.type = 'MASTER';
                logger.info('No MASTER instance found; promoted first instance to MASTER!');
            }

            return master;
        } catch (err: Error | any) {
            logger.error({ err }, 'Selecting MASTER instance failed!');
            throw err;
        }
    }

    async function initInstance() {
      logger.info('Initializing instance...');
      
      const now = getNow();
      const system = JSON.stringify(getInstanceSystemInfo());
      
      try {
        const [existingInstances] = await dbPool.query(
          `SELECT * FROM ${dbTablePrefix()}instances WHERE \`key\` = :instance_key LIMIT 1`,
          { instance_key: instanceKey }
        );
        
        if ((existingInstances as any[]).length === 0) {
          // INSERT new instance
          await dbPool.execute(
            `INSERT INTO ${dbTablePrefix()}instances (\`key\`, system, workers_per_cpu_core, workers_max, workers_running_count, status, updated_at, created_at, outcome) VALUES (:instance_key, :system, :workers_per_cpu_core, :workers_max, 0, 'RUNNING', :now, :now, :outcome)`,
            { 
              instance_key: instanceKey,
              system,
              workers_per_cpu_core: config.workers.per_cpu_core,
              workers_max: config.workers.max,
              now
            }
          );

          await dbPool.execute(
            `UPDATE ${dbTablePrefix()}workers SET status = :status, outcome = :outcome WHERE instance_key = :instance_key`,
            { instance_key: instanceKey, status: 'EXITED', outcome: JSON.stringify({ message: 'Worker exited!' }) }
          );
          
          logger.info({ instanceKey }, 'Instance created in database!');
        } else {
          // UPDATE existing instance
          await dbPool.execute(
            `UPDATE ${dbTablePrefix()}instances SET system = :system, workers_per_cpu_core = :workers_per_cpu_core, workers_max = :workers_max, status = 'RUNNING', updated_at = :now WHERE \`key\` = :instance_key`,
            { 
              instance_key: instanceKey, 
              system, 
              workers_per_cpu_core: config.workers.per_cpu_core, 
              workers_max: config.workers.max, 
              now 
            }
          );

          logger.info({ instanceKey }, 'Instance updated in database!');
        }
      } catch (err: Error | any) {
        logger.error({ instanceKey, err }, 'Instance initialization failed!');
        throw err;
      }
    }

    async function maintainInstance() {
        logger.info('Maintaining instance...');

        // INSTANCE: UPDATE or INSERT (UPSERT)
        const now = getNow();
        const system = JSON.stringify(getInstanceSystemInfo());
        let queryInstance: any = null;
        
        try {
          // First, try to update existing instance
          [queryInstance] = await dbPool.query(
            `SELECT * FROM ${dbTablePrefix()}instances WHERE \`key\` = :instance_key LIMIT 1`,
            { instance_key: instanceKey }
          );
        } catch (err: Error | any) {
        }

        if ((queryInstance as any[]).length === 0) {
          try {
            await dbPool.execute(
              `INSERT INTO ${dbTablePrefix()}instances (\`key\`, system, workers_per_cpu_core, workers_max, workers_running_count, status, updated_at, created_at, outcome) VALUES (:instance_key, :system, :workers_per_cpu_core, :workers_max, 0, 'RUNNING', :now, :now, :outcome)`,
              { instance_key: instanceKey, system, workers_per_cpu_core: config.workers.per_cpu_core, workers_max: config.workers.max, now, outcome: JSON.stringify({ message: 'Instance initialized!' }) }
            );
          } catch (err: Error | any) {
            logger.error({ instanceKey, err }, 'Instance maintenance failed!');
          }

          // WORKERs: UPDATE: EXITED
          
          
          return;
        }

        try {
          await dbPool.execute(
            `UPDATE ${dbTablePrefix()}instances SET system = :system, workers_per_cpu_core = :workers_per_cpu_core, workers_max = :workers_max, workers_running_count = 0, status = 'RUNNING', updated_at = :now WHERE \`key\` = :instance_key`,
            { instance_key: instanceKey, system, workers_per_cpu_core: config.workers.per_cpu_core, workers_max: config.workers.max, now }
          );
        } catch (err: Error | any) {
          logger.error({ instanceKey, err }, 'Instance maintenance failed!');
        }
    }

    async function maintainInstances() {
        logger.info('Maintaining instances...');

        /* INSTANCEs: UPDATE */
        const runningTimeout = config.instances.running_timeout || 60000;
        const exitedTimeout = runningTimeout + (config.instances.exited_timeout || 60000);

        try {
            /* INSTANCEs: UPDATE: RUNNING: TIMEOUT */
            await dbPool.execute(
                `UPDATE ${dbTablePrefix()}instances SET status = 'EXITED', outcome = :outcome WHERE status = 'RUNNING' AND updated_at < :cutoff`,
                { outcome: JSON.stringify({ message: 'Instance exited due to timeout!' }), cutoff: subtractNow(runningTimeout, 'milliseconds') }
            );
        } catch (err: Error | any) {
            logger.error({ err }, 'Instances maintenance failed!');
        }

        try {
            /* INSTANCEs: DELETE: EXITED: TIMEOUT */
            await dbPool.execute(
                `DELETE FROM ${dbTablePrefix()}instances WHERE status = :status AND updated_at < :cutoff`,
                { cutoff: subtractNow(exitedTimeout, 'milliseconds')  }
            );
        } catch (err: Error | any) {
            logger.error({ err }, 'Instances cleanup failed!');
        }
    }

    async function maintainWorkers() {
        logger.info('Maintaining workers...');

        /* WORKERs: UPDATE */
        const runningTimeout = config.workers.running_timeout || 60000;
        const exitedTimeout = runningTimeout + (config.workers.exited_timeout || 60000);

        try {
            /* WORKERs: UPDATE: RUNNING: TIMEOUT */
            await dbPool.execute(
                `UPDATE ${dbTablePrefix()}workers SET status = 'EXITED', outcome = :outcome WHERE status = 'RUNNING' AND updated_at < :cutoff`,
                { outcome: JSON.stringify({ message: 'Worker exited due to timeout!' }), cutoff: subtractNow(runningTimeout, 'milliseconds') }
            );
        } catch (err: Error | any) {
            logger.error({ instanceKey, err }, 'Workers maintenance failed!');
        }

        try {
            /* WORKERs: DELETE: EXITED: TIMEOUT */
            await dbPool.execute(
                `DELETE FROM ${dbTablePrefix()}workers WHERE status = 'EXITED' AND updated_at < :cutoff`,
                { cutoff: subtractNow(exitedTimeout, 'milliseconds')  }
            );
        } catch (err: Error | any) {
            logger.error({ instanceKey, err }, 'Workers cleanup failed!');
        }
    }

    async function pollJobs(): Promise<void> {
        logger.info('Polling jobs...');

        try {
            // Check for available jobs in the queue that are still PENDING
            // Order by priority (lower = higher priority), then by created_at
            const [rows] = await dbPool.query(
                `SELECT qj.key, qj.job_key FROM ${dbTablePrefix()}jobs_queue qj JOIN ${dbTablePrefix()}jobs j ON qj.job_key = j.key WHERE qj.available_at <= :now AND qj.visibility_timeout <= :now AND j.status = 'PENDING' ORDER BY qj.priority ASC, qj.created_at ASC LIMIT 1`,
                { now: getNow() }
            );
            
            const records = rows as Array<{ key: string; job_key: string }>;
            if (records.length > 0) {
                const record = records[0];
                // Make sure no RUNNING worker exists in DB for that job before spawning
                const [wk] = await dbPool.query(
                    `SELECT * FROM ${dbTablePrefix()}workers WHERE job_key = :job_key AND status = 'RUNNING'`,
                    { job_key: record.job_key }
                );
                
                if ((wk as any[]).length === 0) {
                    createWorkerForJob(record.job_key);
                }
            }
        } catch (err: Error | any) {
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
        const [existing] = await dbPool.query(`SELECT * FROM ${dbTablePrefix()}workers WHERE job_key = :job_key AND status = 'RUNNING'`, { job_key: jobKey });
        
        if ((existing as any[]).length > 0) {
          logger.warn({ jobKey }, 'Worker already running for job!');
          return;
        }

        // Respect global max workers by counting RUNNING rows in DB
        const [countRows] = await dbPool.query(`SELECT COUNT(*) as cnt FROM ${dbTablePrefix()}workers WHERE status = 'RUNNING'`);
        const runningCount = (countRows as any[])[0]?.cnt ?? 0;
        if (runningCount >= config.workers.max) {
          logger.warn({ jobKey, activeCount: runningCount, max: config.workers.max }, 'Max workers reached, cannot spawn new worker!');
          return;
        }
      } catch (err: Error | any) {
        logger.error({ err, jobKey }, 'Failed to check existing workers in DB!');
        return;
      }

      const workerKey = uukey();
      let child: ChildProcess;

      /* WORKER: RUN */
      if (config.env === 'prod') {
        const workerScriptPath = path.join(process.cwd(), 'dist', 'services', 'worker', 'index.js');
        child = spawn('node', [workerScriptPath, instanceKey, workerKey, jobKey], {
          stdio: ['inherit', 'inherit', 'inherit'],
          cwd: process.cwd()
        });
      } else {
        const workerScriptPath = path.join(process.cwd(), 'src', 'services', 'worker', 'index.ts');
        child = spawn('npx', ['tsx', workerScriptPath, instanceKey, workerKey, jobKey], {
          stdio: ['inherit', 'inherit', 'inherit'],
          cwd: process.cwd(),
          shell: true
        });
      }

      /* WORKER: INSERT */
      try {
        await dbPool.execute(
          `INSERT INTO ${dbTablePrefix()}workers (\`key\`, instance_key, pid, job_key, status, updated_at, created_at) VALUES (:worker_key, :instance_key, :pid, :job_key, 'RUNNING', :now, :now)`,
          { worker_key: workerKey, instance_key: instanceKey, pid: child.pid, job_key: jobKey, now: getNow() }
        );
      } catch (err: Error | any) {
        logger.error({ err, jobKey }, 'Failed to insert worker!');
      }

      workersProcessMap.set(workerKey, child);

      /* INSTANCE: UPDATE */
      try {
        await dbPool.execute(
          `UPDATE ${dbTablePrefix()}instances SET system = :system, workers_running_count = workers_running_count + 1, updated_at = :now WHERE \`key\` = :instance_key`,
          { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
        );
      } catch (err: Error | any) {
        logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update instance!');
      }

      child.on('exit', async (code, signal) => {
        logger.info({ instanceKey, jobKey, workerKey, code, signal }, 'Worker process exited!');
        workersProcessMap.delete(workerKey);
        
        /* WORKER: UPDATE */
        try {
          await dbPool.execute(
            `UPDATE ${dbTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :worker_key`,
            { worker_key: workerKey, outcome: JSON.stringify({ message: 'Worker exited!', exit_code: code, exit_signal: signal }), now: getNow() }
          );
        } catch (err: Error | any) {
          logger.error({ instanceKey, workerKey, jobKey, err }, 'Failed to update worker!');
        }

        /* INSTANCE: UPDATE */
        try {
          await dbPool.execute(
            `UPDATE ${dbTablePrefix()}instances SET system = :system, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
            { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
          );
        } catch (err: Error | any) {
          logger.error({ instanceKey, workerKey, jobKey, err }, 'Failed to update instance!');
        }
      });

      child.on('error', async (err) => {
        logger.error({ instanceKey, workerKey, jobKey, err }, 'Worker process error!');
        workersProcessMap.delete(workerKey);
        
        /* WORKER: UPDATE */
        try {
          await dbPool.execute(
            `UPDATE ${dbTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :worker_key`,
            { worker_key: workerKey, outcome: JSON.stringify({ message: err.message || 'Unknown error!', exit_signal: 'ERROR' }), now: getNow() }
          );
        } catch (err: Error | any) {
          logger.error({ instanceKey, workerKey, jobKey, err }, 'Failed to update worker!');
        }
        
        /* INSTANCE: UPDATE */
        try {
          await dbPool.execute(
            `UPDATE ${dbTablePrefix()}instances SET system = :system, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
            { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
          );
        } catch (err: Error | any) {
          logger.error({ instanceKey, workerKey, jobKey, err }, 'Failed to update instance!');
        }
      });

      logger.info({ instanceKey, workerKey, jobKey }, 'Spawned worker process!');
    }

    async function cleanupJobs() {
      const [rows] = await dbPool.query(
        `SELECT \`key\` FROM ${dbTablePrefix()}jobs WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_at < :cutoff`,
        { cutoff: subtractNow(config.jobs.retention, 'hours')  }
      );
      
      const keys = (rows as any[]).map((r) => r.key);
      
      if (keys.length === 0) {
        logger.info('No jobs to cleanup!');
        return;
      }
      
      // Delete job folders/objects via unified storage facade
      for (const key of keys) {
        const prefix = `/jobs/${key}/`;
        try {
          await storage.delete(prefix);
          logger.info({ jobKey: key, prefix }, 'Deleted job assets from storage!');
        } catch (err: Error | any) {
          logger.warn({ err, jobKey: key, prefix }, 'Failed to delete job assets from storage!');
        }
      }

      await dbPool.execute(`DELETE FROM ${dbTablePrefix()}jobs WHERE \`key\` IN (${keys.map(() => '?').join(',')})`, keys);
      await dbPool.execute(`DELETE FROM ${dbTablePrefix()}jobs_queue WHERE job_key IN (${keys.map(() => '?').join(',')})`, keys);

      logger.info({ count: keys.length }, 'Cleanup completed jobs!');
    }

    try {
        await initInstance();
        intervals.set('maintainInstance', setInterval(() => maintainInstance(), config.instances.maintain_interval));

        await pollJobs();
        intervals.set('pollJobs', setInterval(() => pollJobs(), config.jobs.poll_interval));

        /* INSTANCE: SELECT: MASTER */
        const masterInstance = await getMasterInstance();
        
        if(masterInstance.key == instanceKey){
            if(config.jobs.retention > 0){
                await cleanupJobs();
                intervals.set('cleanupJobs', setInterval(() => cleanupJobs(), config.jobs.cleanup_interval));
            }

            // Run maintenance immediately on startup
            await maintainInstances();
            intervals.set('maintainInstances', setInterval(() => maintainInstances(), config.instances.maintain_interval));

            await maintainWorkers();
            intervals.set('maintainWorkers', setInterval(() => maintainWorkers(), config.workers.maintain_interval));
        }
    } catch (error: Error | any) {
        logger.error({ error }, 'Failed to start supervisor service!');
        throw error;
    }
}

export async function shutdownSupervisorService(instanceKey: string, signal: string) {
  logger.info(`Supervisor service received ${signal}, shutting down gracefully!`);

  // Clear all intervals
  if (intervals) {
    intervals.forEach((intervalId, key) => {
      clearInterval(intervalId);
      logger.info({ key }, 'Cleared interval!');
    });
    intervals.clear();
  }

  // DB: WORKERs: UPDATE
  try {
    await dbPool.execute(
      `UPDATE ${dbTablePrefix()}workers SET status = 'EXITED', updated_at = :now, outcome = :outcome WHERE instance_key = :instance_key`,
      { instance_key: instanceKey, outcome: JSON.stringify({ message: 'Worker exited due to instance shutdown!', signal }), now: getNow() }
    );
  } catch (err: Error | any) {
    logger.error({ instanceKey, err }, 'Failed to update workers for instance during shutdown!');
  }
  
  // DB: INSTANCE: UPDATE
  try {
    await dbPool.execute(
      `UPDATE ${dbTablePrefix()}instances SET system = :system, status = 'EXITED', updated_at = :now, outcome = :outcome WHERE \`key\` = :instance_key`,
      { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), outcome: JSON.stringify({ message: 'Instance exited due to shutdown!', signal }), now: getNow() }
    );
  } catch (err: Error | any) {
    logger.error({ instanceKey, err }, 'Failed to update instance during shutdown!');
  }

  logger.info('Supervisor service shutdown completed!');
}
