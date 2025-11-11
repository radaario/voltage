import { config } from '../config/index.js';

import { getInstanceSpecs, hash, getNow, subtractNow } from '../utils';
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
    await database.verifySchemaExists();

    async function getMasterInstance(): Promise<any | null> {
        try {
            const activeInstances = await database.table('instances').where('status', 'ONLINE').orderBy('created_at', 'asc');
            
            if (!activeInstances.length) {
                logger.console('ERROR', 'No active instances found in database!');
                return null;
            }

            const masterInstances = activeInstances.filter((instance: any) => instance.type === 'MASTER');
            let masterInstance = masterInstances.length ? masterInstances[0] : null;

            if (!masterInstance) {
                masterInstance = activeInstances[0];
                masterInstance.type = 'MASTER';
                await database.table('instances').where('key', masterInstance.key).update({ type: 'MASTER' });
                logger.console('INFO', 'No MASTER instance found; promoted first instance to MASTER!');
            }

            if (masterInstances.length > 1) {
                await database.table('instances').where('type', 'MASTER').whereNot('key', masterInstance.key).update({ type: 'SLAVE' });
                logger.console('INFO', 'Multiple MASTER instances found; demoted extras to SLAVE!');
            }

            return masterInstance;
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
        /* WORKERS: COUNT */
        const _existsWorkersCount = await database.table('instances_workers').where('instance_key', instance_key).count('* as count').first();
        const existsWorkersCount = (_existsWorkersCount as any).count || 0;
        const missingWorkersCount = config.instances.workers.max - existsWorkersCount;

        /* WORKERs: INSERT */
        if (missingWorkersCount > 0) {
            const newWorkers = Array.from({ length: missingWorkersCount }, (_, index) => ({
              key: hash(`${instance_key}:${existsWorkersCount + index}`),
              index: existsWorkersCount + index,
              instance_key,
              job_key: null,
              status: 'IDLE',
              updated_at: now,
              created_at: now,
            }));

          await database.table('instances_workers').insert(newWorkers);

          logger.console('INFO', `${missingWorkersCount} new workers initialized for instance!`);
        }

        /* WORKERs: UPDATE */
        await database.table('instances_workers')
          .where('instance_key', instance_key)
          .update({
            job_key: null,
            status: database.knex.raw(`CASE WHEN \`index\` < ? THEN 'IDLE' ELSE 'TERMINATED' END`, [config.instances.workers.max]),
            updated_at: now,
          });
      } catch (error: Error | any) {
      }
      
      try {
        /* INSTANCEs: SELECT */
        const instance = await database.table('instances').select('key').where('key', instance_key).first();
        
        if (!instance) {
          // INSTANCE: INSERT
          await database.table('instances').insert({
            key: instance_key,
            specs: JSON.stringify(specs),
            status: 'ONLINE',
            updated_at: now,
            created_at: now
          });

          await logger.insert('INFO', 'Instance created!');
          return;
        }

        // INSTANCE: UPDATE
        await database.table('instances')
          .where('key', instance_key)
          .update({
            specs: JSON.stringify(specs),
            status: 'ONLINE',
            restart_count: database.knex.raw('restart_count + 1'),
            updated_at: now
          });

        await logger.insert('INFO', 'Instance restarted!');
      } catch (error: Error | any) {
        await logger.insert('ERROR', 'Instance initialization failed!', { error });
        throw error;
      }
    }

    async function maintainInstancesAndWorkers() {
        // MAINTAIN ITSELF
        logger.console('INFO', 'Maintaining itself...');

        try {
          // INSTACE: UPDATE
          await database.table('instances')
            .where('key', instance_key)
            .update({
              specs: JSON.stringify(getInstanceSpecs()),
              status: 'ONLINE',
              updated_at: getNow(),
            });

          // WORKERS: UPDATE
          await database.table('instances_workers').where('instance_key', instance_key).where('status', 'IDLE').update({ updated_at: getNow(), });
        } catch (error: Error | any) {
          await logger.insert('ERROR', 'Instance maintenance failed!', { error });
        }

        /* INSTANCE: SELECT: MASTER */
        const masterInstance = await getMasterInstance();

        /* INSTANCEs & WORKERs: MAINTAINING */
        if (!masterInstance || masterInstance.key !== instance_key) {
            logger.console('INFO', 'Maintaining workers...');

            /* WORKERs: UPDATE: TIMEOUT */
            const busyTimeout = config.instances.workers.busy_timeout || (5 * 60 * 1000); // in milliseconds, default 5 minutes

            const timeoutedWorkers = await database.table('instances_workers').where('status', 'BUSY').where('updated_at', '<', subtractNow(busyTimeout, 'milliseconds'))

            if (timeoutedWorkers.length > 0) {
              const timeoutedWorkerKeys = timeoutedWorkers.map((r: any) => r.key).filter(Boolean);

              for (const timeoutedWorkerKey of timeoutedWorkerKeys) {
                workersProcessMap.delete(timeoutedWorkerKey);
              }

              await database.table('instances_workers')
                .whereIn('key', timeoutedWorkerKeys)
                .update({
                  job_key: null,
                  status: 'TIMEOUT',
                  updated_at: getNow(),
                  outcome: JSON.stringify({ message: 'Busy worker timed out!' }),
                });
            }

            /* WORKERs: UPDATE: IDLE */
            const idleAfter = config.instances.workers.idle_after || (1 * 10 * 1000); // in milliseconds, default 10 seconds

            try {
              await database.table('instances_workers')
                .where('status', 'TIMEOUT')
                .where('updated_at', '<', subtractNow(idleAfter, 'milliseconds'))
                .update({
                  job_key: null,
                  status: 'IDLE',
                  updated_at: getNow(),
                  outcome: JSON.stringify({ message: 'Worker is idle again!' }),
                });
            } catch (error: Error | any) {
                await logger.insert('ERROR', 'The worker timed out and could not be updated!', { error });
            }

            logger.console('INFO', 'Maintaining instances...');

            /* INSTANCEs: UPDATE: OFFLINE */
            const offlineTimeout = config.instances.online_timeout || (1 * 60 * 1000); // in milliseconds, default 1 minute

            try {
              const inactiveInstances = await database.table('instances')
                .where('status', 'ONLINE')
                .where('updated_at', '<', subtractNow(offlineTimeout, 'milliseconds'))
                .select('key');

              const inactiveInstanceKeys = inactiveInstances.map((r: any) => r.key).filter(Boolean);

              if (inactiveInstanceKeys.length > 0) {
                await database.table('instances_workers')
                  .whereIn('instance_key', inactiveInstanceKeys)
                  .update({
                    job_key: null,
                    status: 'TERMINATED',
                    updated_at: getNow(),
                    outcome: JSON.stringify({ message: 'The worker was terminated because the instance was offline!' })
                  });

                await database.table('instances')
                  .whereIn('key', inactiveInstanceKeys)
                  .update({
                    status: 'OFFLINE',
                    updated_at: getNow(),
                    outcome: JSON.stringify({ message: 'The instance has gone offline because it has not been updated for a long time!' })
                  });
              }
            } catch (error: Error | any) {
                await logger.insert('ERROR', 'Unable to take offline instances that were not updated!', { error });
            }

            /* INSTANCEs: DELETE: PURGE */
            const purgeAfter = config.instances.purge_after || (1 * 60 * 1000); // in milliseconds, default 1 minute

            try {
              const offlineInstances = await database.table('instances')
                .where('status', 'OFFLINE')
                .where('updated_at', '<', subtractNow(purgeAfter, 'milliseconds'))
                .select('key');

              const offlineInstanceKeys = offlineInstances.map((r: any) => r.key).filter(Boolean);

              if (offlineInstanceKeys.length > 0) {
                await database.table('instances_workers').whereIn('instance_key', offlineInstanceKeys).delete();
                await database.table('instances').whereIn('key', offlineInstanceKeys).delete();
              }
            } catch (error: Error | any) {
                await logger.insert('ERROR', 'Purging offline instances failed!', { error });
            }
        }
    }

    async function processJobs(): Promise<void> {
        // JOBs: PENDINGs
        logger.console('INFO', 'Enqueuing pending jobs...');

        try {
          // JOBs: PENDINGs: LOCK
          await database.table('jobs')
            // .where('try_count', '<', 'try_max')
            .where(function() {
              this.where('status', 'PENDING')
                .orWhere(function() {
                  this.where('status', 'RETRYING')
                    .where('retry_at', '<=', getNow());
                });
            })
            .where('locked_by', null)
            .orderBy('priority', 'asc')
            .orderBy('created_at', 'asc')
            .limit(config.jobs.enqueue_limit || 10) // default 10
            .update({ updated_at: getNow(), locked_by: instance_key });

          const pendingJobs = await database.table('jobs').where('locked_by', instance_key);

          for (const pendingJob of pendingJobs) {
            // JOB: QUEUE: INSERT
            await database.table('jobs_queue')
              .insert({ key: pendingJob.key, priority: pendingJob.priority, created_at: pendingJob.created_at })
              .then(async result => {
                // JOB: UPDATE: QUEUED
                await database.table('jobs').where('key', pendingJob.key).update({ status: 'QUEUED', updated_at: getNow(), locked_by: null });
                await createJobNotification(pendingJob, 'QUEUED');
                await logger.insert('INFO', 'Job successfully queued!', { job_key: pendingJob.key });
              })
              .catch(async error => {
                // JOB: UPDATE: PENDING
                await database.table('jobs').where('key', pendingJob.key).update({ status: 'PENDING', updated_at: getNow(), locked_by: null });
                await logger.insert('ERROR', 'Enqueuing job failed!', { job_key: pendingJob.key, error });
              });
          }

          // JOBs: PENDINGs: RELEASE
          await database.table('jobs').where('locked_by', instance_key).update({updated_at: getNow(), locked_by: null });
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to maintain pending jobs!', { error });
        }

        // JOBs: QUEUEDs: PROCESSING
        logger.console('INFO', 'Processing jobs queue...');
        
        const idleWorkers = await database.table('instances_workers').where('instance_key', instance_key).where('status', 'IDLE');

        if (idleWorkers.length > 0) {
          try {
              // JOBs: QUEUEDs: LOCK
              await database.table('jobs_queue')
                .where('locked_by', null)
                .update({ locked_by: instance_key })
                .orderBy('priority', 'asc')
                .orderBy('created_at', 'asc')
                .limit(idleWorkers.length);

              // JOBs: QUEUEDs: LOCKEDs
              const queuedJobs = await database.table('jobs_queue').where('locked_by', instance_key);

              for (let index = 0; index < queuedJobs.length; index++) {
                const idleWorker = idleWorkers[index];
                const queuedJob = queuedJobs[index];
                
                try {
                  await logger.insert('INFO', 'Spawning worker for job...', { worker_key: idleWorker.key, job_key: queuedJob.key });

                  // WORKER: UPDATE: BUSY
                  await database.table('instances_workers').where('key', idleWorker.key).update({ status: 'BUSY', updated_at: getNow() });

                  await spawnWorkerForJob(idleWorker.key, queuedJob.key);

                  // JOB: QUEUE: DELETE
                  await database.table('jobs_queue').where('key', queuedJob.key).delete();

                  await logger.insert('INFO', 'Spawned worker for job...', { worker_key: idleWorker.key, job_key: queuedJob.key });
                } catch (error: Error | any) {
                  // WORKER: UPDATE: BUSY
                  await database.table('instances_workers').where('key', idleWorker.key).update({ status: 'IDLE', updated_at: getNow() });

                  await logger.insert('ERROR', 'Failed to spawn worker for job!', { worker_key: idleWorker.key, job_key: queuedJob.key, error });
                }
              }

              // JOBs: QUEUEDs: RELEASE
              if (queuedJobs.length > 0) {
                await database.table('jobs_queue').where('locked_by', instance_key).update({ locked_by: null });
              }
          } catch (error: Error | any) {
              await logger.insert('ERROR', 'Failed to poll jobs!', { error });
          }
        }

        // JOBs: TIMEOUTs
        if (config.jobs.process_timeout > 0){
          logger.console('INFO', 'Jobs are timing out...');
          
          try {
            await database.table('jobs')
              .whereNotIn('status', ['COMPLETED', 'CANCELLED', 'FAILED', 'TIMEOUT'])
              .where('updated_at', '<', subtractNow(config.jobs.process_timeout || (10 * 60 * 1000), 'milliseconds')) // in milliseconds, default 10 minutes
              .where('try_count', '>', 0)
              .update({ status: 'TIMEOUT' });
          } catch (error: Error | any) {
            await logger.insert('ERROR', 'Jobs could not be timed out!', { error });
          }
        }
    }

    async function processJobsNotifications(): Promise<void> {
        // JOBs: NOTIFICATIONs: PROCESSING
        logger.console('INFO', 'Processing jobs notifications queue...');  

        try {
            // JOBs: NOTIFICATIONs: QUEUE: LOCK
            await database.table('jobs_notifications_queue')
              // .where('try_count', '<', 'try_max')
              .where(function() {
                this.where('status', 'PENDING')
                  .orWhere(function() {
                    this.where('status', 'RETRYING')
                      .where('retry_at', '<=', getNow());
                  });
              })
              .where('locked_by', null)
              .orderBy('priority', 'asc')
              .orderBy('created_at', 'asc')
              .limit(config.jobs.notifications.process_limit || 10) // default 10
              .update({ locked_by: instance_key }); // updated_at: getNow(),

            // JOBs: NOTIFICATIONs: QUEUE: SELECT LOCKEDs
            const pendingJobsNotifications = await database.table('jobs_notifications_queue').where('locked_by', instance_key);
            
            for (const pendingNotification of pendingJobsNotifications) {
              await retryJobNotification(pendingNotification);
            }

            // JOBs: QUEUEDs: RELEASE
            await database.table('jobs_notifications_queue').where('locked_by', instance_key).update({ locked_by: null });
        } catch (error: Error | any) {
            await logger.insert('ERROR', 'Failed to process jobs notifications queue!', { error });
        }
    }

    const workersProcessMap = new Map<string, ChildProcess>();

    async function spawnWorkerForJob(worker_key: string, job_key: string): Promise<any> {
      try {
        /* JOB: NOTIFICATIONs: UPDATE */
        // await database.table('jobs_notifications').where('job_key', job_key).update({ instance_key, worker_key: worker_key });

        /* WORKER: CREATE */
        let child: ChildProcess;

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

        /* WORKER: EVENTs */
        child.on('exit', async (code, signal) => {
          logger.console('INFO', 'Worker exited!', { worker_key, job_key, code, signal });
          workersProcessMap.delete(worker_key);
          
          /* WORKER: UPDATE */
          await database.table('instances_workers')
            .where('key', worker_key)
            .update({
              job_key: null,
              status: 'IDLE',
              updated_at: getNow(),
              outcome: JSON.stringify({ message: 'Worker exited!', exit_code: code, exit_signal: signal })
            })
            .catch(error => {
              logger.insert('ERROR', 'Failed to idle worker!', { worker_key, job_key, error });
            });
        });

        child.on('error', async (error) => {
          await logger.insert('ERROR', 'Worker exited due error!', { worker_key, job_key, error });
          workersProcessMap.delete(worker_key);
          
          /* WORKER: UPDATE */
          await database.table('instances_workers')
            .where('key', worker_key)
            .update({
              job_key: null,
              status: 'IDLE',
              updated_at: getNow(),
              outcome: JSON.stringify({ message: error.message || 'Unknown error occurred!', exit_signal: 'ERROR' })
            })
            .catch(error => {
              logger.insert('ERROR', 'Failed to idle worker!', { worker_key, job_key, error });
            });
        });

        workersProcessMap.set(worker_key, child);

        logger.console('INFO', 'Worker successfully spawned for the job!', { worker_key, job_key });
      } catch (error: Error | any) {
        await logger.insert('ERROR', 'Failed to spawn worker for the job!', { job_key, error });
        throw error;
      }
    }

    async function cleanup() {
      if (config.jobs.retention > 0){
        /* JOBs: CLEANUP */
        logger.console('INFO', 'Cleaning up completed jobs...');

        const jobs = await database.table('jobs')
          .select('key')
          .where('status', 'COMPLETED')
          .whereNotNull('completed_at')
          .where('completed_at', '<', subtractNow(config.jobs.retention || (24 * 60 * 60 * 1000), 'milliseconds')); // in milliseconds, default 24 hours
        
        const jobsKeys = jobs.map((r: any) => r.key);
        
        if (jobsKeys.length > 0) {
          // Delete job folders/objects via unified storage facade
          for (const job_key of jobsKeys) {
            try {
              await storage.delete(`/jobs/${job_key}/`);
            } catch (error: Error | any) {
            }
          }

          await database.table('jobs').whereIn('key', jobsKeys).del();
          // await database.table('jobs_queue').whereIn('key', jobsKeys).del();
          // await database.table('jobs_notifications').whereIn('job_key', jobsKeys).del();

          logger.console('INFO', 'Jobs cleaning completed!', { count: jobsKeys.length });
        }
      }

      /* LOGS: CLEANUP */
      if (!config.logs.is_disabled || (config.logs.retention || (60 * 60 * 1000)) > 0) { // in milliseconds, default 1 hour
          logger.console('INFO', 'Cleaning logs...');
          await database.table('logs').where('created_at', '<', subtractNow(config.logs.retention || (60 * 60 * 1000), 'milliseconds')).del(); // in milliseconds, default 1 hour
          logger.console('INFO', 'Logs cleaning completed!');
      }
    }

    try {
        await initInstance();

        await maintainInstancesAndWorkers();
        intervals.set('maintainInstancesAndWorkers', setInterval(() => maintainInstancesAndWorkers(), config.instances.maintain_interval || 60000));
        
        await processJobs();
        intervals.set('processJobs', setInterval(() => processJobs(), config.jobs.process_interval || 10000));

        await processJobsNotifications();
        intervals.set('processJobsNotifications', setInterval(() => processJobsNotifications(), config.jobs.notifications.process_interval || 60000));

        await cleanup();
        intervals.set('cleanup', setInterval(() => cleanup(), config.database.cleanup_interval || (60 * 60 * 1000))); // in milliseconds, default 1 hour
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
    await database.table('instances_workers')
      .where('instance_key', instance_key)
      .update({
        job_key: null,
        status: 'TERMINATED',
        updated_at: getNow(),
        outcome: JSON.stringify({ message: 'The worker was terminated because the instance was shutdown!', signal })
      });
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to update workers for instance during shutdown!', { error });
  }
  
  // DB: INSTANCE: UPDATE
  try {
    await database.table('instances')
      .where('key', instance_key)
      .update({
        specs: JSON.stringify(getInstanceSpecs()),
        status: 'OFFLINE',
        updated_at: getNow(),
        outcome: JSON.stringify({ message: 'The instance has gone offline due to shutdown!', signal })
      });
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to update instance during shutdown!', { error });
  }

  await logger.insert('INFO', 'Supervisor service shutdown completed!');
}
