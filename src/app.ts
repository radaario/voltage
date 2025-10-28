import 'express-async-errors';
import os from 'os';
import express, { Request, Response } from "express";
import { spawn, ChildProcess } from 'child_process';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDb, pool } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import { enqueueJob } from './queue.js';
import { CreateJobRequest, OutputSpec } from './types.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import cors from "cors";
import { getNow } from './utils/datetime.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// INSTANCE: KEY
const instanceKey = uuidv4();

const app = express();

// Configure express.json() options via an array and apply when present
const expressOptions: any[] = [];
if (config.api.request_body_limit && parseInt(String(config.api.request_body_limit)) > 0) {
  expressOptions.push({ limit: `${config.api.request_body_limit}mb` });
}
app.use(express.json(...expressOptions));

// cors
app.use(cors());

// Database prefix helper — append '_' only when a prefix is configured
const dbPrefix = config.db.prefix ? `${config.db.prefix}_` : '';

// Authentication middleware factory
const authMiddleware = (options: { forceAuth?: boolean } = {}) => {
  return (req: Request, res: Response, next: any) => {
    // Check if authentication is required
    const requireAuth = options.forceAuth || config.dashboard.is_authentication_required;
    
    if (!requireAuth) {
      return next();
    }

    // Get token from various possible locations
    const token = 
      req.query.token || 
      req.query.api_key ||
      req.body.token || 
      req.body.api_key ||
      req.headers.token ||
      req.headers.api_key ||
      req.headers['x-api-key'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

    if (!token) {
      return res.status(401).json({ metadata: {status: false, error: {code: 'AUTH_TOKEN_REQUIRED', message: 'Authentication token required!'}} });
    }

    // Expected tokens
    const dashboardToken = crypto.createHash('md5').update(config.dashboard.password || '').digest('hex');
    const apiToken = config.api.key;

    // Check if token matches either dashboard token or API key
    if (token !== dashboardToken && token !== apiToken) {
      return res.status(401).json({ metadata: { status: false, error: {code: 'AUTH_TOKEN_INVALID', message: 'Invalid authentication token!'}} });
    }

    next();
  };
};

// Keep in-memory ChildProcess handles only. Worker metadata is persisted in DB.
// Keys in processMap are workerKey (uuid per worker), not job keys.
const processMap = new Map<string, ChildProcess>();

// Function to spawn a worker child process for a specific job
async function spawnWorkerForJob(jobKey: string): Promise<void> {
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
      logger.warn({ jobKey, activeCount: runningCount, max: config.workers.max }, 'max workers reached, cannot spawn new worker');
      return;
    }
  } catch (err) {
    logger.error({ err, jobKey }, 'failed to check existing workers in DB');
    return;
  }

  const workerKey = uuidv4();
  let child: ChildProcess;

  /* WORKER: RUN */
  if (config.env === 'prod') {
    const workerScriptPath = path.join(process.cwd(), 'dist', 'worker.js');
    child = spawn('node', [workerScriptPath, instanceKey, workerKey, jobKey], {
      stdio: ['inherit', 'inherit', 'inherit'],
      cwd: process.cwd()
    });
  } else {
    const workerScriptPath = path.join(process.cwd(), 'src', 'worker.ts');
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

  processMap.set(workerKey, child);

  /* INSTANCE: UPDATE */
  try {
    await pool.execute(
      `UPDATE ${dbPrefix}instances SET memory_free = :memory_free, workers_running_count = workers_running_count + 1, updated_at = :now WHERE \`key\` = :instance_key`,
      { instance_key: instanceKey, memory_free: os.freemem(), now: getNow() }
    );
  } catch (err) {
    logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update instance!');
  }

  child.on('exit', async (code, signal) => {
    logger.info({ instanceKey, jobKey, workerKey, code, signal }, 'Worker process exited!');
    processMap.delete(workerKey);
    
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
        `UPDATE ${dbPrefix}instances SET memory_free = :memory_free, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
        { instance_key: instanceKey, memory_free: os.freemem(), now: getNow() }
      );
    } catch (err) {
      logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update instance!');
    }
  });

  child.on('error', async (err) => {
    logger.error({ err, instanceKey, workerKey, jobKey }, 'worker process error');
    processMap.delete(workerKey);
    
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
        `UPDATE ${dbPrefix}instances SET memory_free = :memory_free, workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END, updated_at = :now WHERE \`key\` = :instance_key`,
        { instance_key: instanceKey, memory_free: os.freemem(), now: getNow() }
      );
    } catch (err) {
      logger.error({ err, instanceKey, workerKey, jobKey }, 'Failed to update instance!');
    }
  });

  logger.info({ instanceKey, workerKey, jobKey }, 'Spawned worker process!');
}

// Instance interval: update own instance timestamp and prune old instances/workers
async function instanceInterval(): Promise<void> {
  const now = Date.now();

  try {
  // Update our own instance record (memory_free and heartbeat)
    await pool.execute(
      `UPDATE ${dbPrefix}instances SET memory_free = :memory_free, updated_at = :now WHERE \`key\` = :instance_key`,
      { instance_key: instanceKey, memory_free: os.freemem(), now: getNow() }
    );

    // --- Instances maintenance ---
    const [instances] = await pool.query(`SELECT * FROM ${dbPrefix}instances WHERE \`key\` != :instance_key`, { instance_key: instanceKey });
    
    for (const instance of instances) {
      let instanceStatus = instance.status;
      const last = new Date(instance.updated_at).getTime();
      const age = now - last;

      // If instance is RUNNING but hasn't heartbeated within running_timeout, mark it EXITED
      if (instanceStatus === 'RUNNING' && age > config.instances.running_timeout) {
        try {
          instanceStatus = 'EXITED';
          
          await pool.execute(
            `UPDATE ${dbPrefix}instances SET status = 'EXITED' WHERE \`key\` = :instance_key`,
            { instance_key: instance.key }
          );

          logger.info({ instanceKey: instance.key }, 'marked stale running instance as EXITED');
        } catch (err) {
          logger.error({ err, instanceKey: instance.key }, 'failed to mark stale running instance as EXITED');
        }
      }

      // If instance already EXITED and old enough, remove instance and its workers
      if (instanceStatus === 'EXITED' && age > (config.instances.running_timeout + config.instances.exited_timeout)) {
        try {
          await pool.execute(
            `DELETE FROM ${dbPrefix}workers WHERE \`key\` = :instance_key`,
            { instance_key: instance.key }
          );

          await pool.execute(
            `DELETE FROM ${dbPrefix}instances WHERE \`key\` = :instance_key`,
            { instance_key: instance.key }
          );
          
          logger.info({ instanceKey: instance.key }, 'removed stale exited instance and its workers');
        } catch (err) {
          logger.error({ err, instanceKey: instance.key }, 'failed to remove stale exited instance');
        }
        continue;
      }
    }

    // --- Workers maintenance ---
    const [workers] = await pool.query(`SELECT * FROM ${dbPrefix}workers`);

    for (const worker of workers) {
      let workerStatus = worker.status;
      const last = new Date(worker.updated_at).getTime();
      const age = now - last;

      // If worker is RUNNING but hasn't heartbeated within running_timeout, mark it EXITED
      if (workerStatus === 'RUNNING' && age > config.workers.running_timeout) {
        try {
          workerStatus = 'EXITED';
          
          await pool.execute(
            `UPDATE ${dbPrefix}workers SET status = 'EXITED' WHERE \`key\` = :worker_key`,
            { worker_key: worker.key }
          );

          // Decrement instance workers_running_count for the instance
          try {
            await pool.execute(
              `UPDATE ${dbPrefix}instances SET workers_running_count = CASE WHEN workers_running_count > 0 THEN workers_running_count - 1 ELSE 0 END WHERE \`key\` = :instance_key`,
              { instance_key: worker.instance_key }
            );
          } catch (err) {
            logger.error({ err, instanceKey: worker.instance_key, workerKey: worker.key }, 'failed to decrement instance workers_running_count for stale worker');
          }

          // WORKER: PROCESS: KILL & CLEANUP
          /*
          if (processMap.has(worker.key)) {
            const proc = processMap.get(worker.key);
            
            if (proc) {
              try { proc.kill('SIGTERM'); } catch (_) { }
            }

            processMap.delete(worker.key);
          }
          */

          logger.info({ instanceKey: worker.instance_key, workerKey: worker.key }, 'marked stale running worker as EXITED');
        } catch (err) {
          logger.error({ err, instanceKey: worker.instance_key, workerKey: worker.key }, 'failed to mark stale running worker as EXITED');
        }
      }

      // Remove workers that are EXITED and old enough
      if (workerStatus === 'EXITED' && age > (config.workers.running_timeout + config.workers.exited_timeout)) {
        try {
          await pool.execute(
            `DELETE FROM ${dbPrefix}workers WHERE \`key\` = :worker_key`,
            { worker_key: worker.key }
          );
          
          // WORKER: PROCESS: KILL & CLEANUP
          /*
          if (processMap.has(worker.key)) {
            const proc = processMap.get(worker.key);
            
            if (proc) {
              try { proc.kill('SIGTERM'); } catch (_) { }
            }

            processMap.delete(worker.key);
          }
          */

          logger.info({ instanceKey: worker.instance_key, workerKey: worker.key }, 'removed stale exited worker');
        } catch (err) {
          logger.error({ err, workerKey: worker.key }, 'failed to remove stale exited worker');
        }
        continue;
      }
    }
  } catch (err) {
    logger.error({ err }, 'instance interval maintenance failed');
  }
}


// Sanitize sensitive fields from objects
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = { ...obj };
  const sensitiveFields = ['password', 'secret', 'key', 'username', 'host', 'accessKeyId', 'secretAccessKey'];
  
  // Remove sensitive fields
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }
  
  // For HTTP/HTTPS URLs in notification, remove query params and auth
  if (sanitized.url && typeof sanitized.url === 'string') {
    try {
      const url = new URL(sanitized.url);
      // Remove credentials from URL if present
      url.username = '';
      url.password = '';
      // Remove query parameters that might contain sensitive data
      url.search = '';
      sanitized.url = url.toString();
    } catch (e) {
      // If URL parsing fails, keep as is
    }
  }
  
  return sanitized;
}

// Queue monitoring function
async function monitorQueue(): Promise<void> {
  try {
    // Check for available jobs in the queue that are still PENDING
    // Order by priority (lower = higher priority), then by created_at
    const [rows] = await pool.query(
      `SELECT qj.key, qj.job_key FROM ${dbPrefix}queue_jobs qj
       JOIN ${dbPrefix}jobs j ON qj.job_key = j.key
       WHERE qj.available_at <= :now 
         AND qj.visibility_timeout <= :now
         AND j.status = 'PENDING' 
       ORDER BY qj.priority ASC, qj.created_at ASC
       LIMIT 1`,
      { now: getNow() }
    );
    
    const records = rows as Array<{ key: string; job_key: string }>;
    if (records.length > 0) {
      const record = records[0];
      // Make sure no RUNNING worker exists in DB for that job before spawning
      const [wk] = await pool.query(`SELECT * FROM ${dbPrefix}workers WHERE job_key = :job_key AND status = 'RUNNING'`, { job_key: record.job_key });
      if ((wk as any[]).length === 0) {
        spawnWorkerForJob(record.job_key);
      }
    }
  } catch (err) {
    logger.error({ err }, 'queue monitoring error');
  }
}

/* API: ROUTEs */
// Support both /health and /status for health checks (some load balancers
// or orchestration systems expect one or the other).
app.get(['/status', '/health'], (_req, res) => res.json({ metadata: {status: true} }));

app.get('/config', async (_req, res) => {
  const sanitizedConfig: any = { ...config };

  delete sanitizedConfig.cpu_cores_count;
  delete sanitizedConfig.memory_total;
  delete sanitizedConfig.storage.key;
  delete sanitizedConfig.storage.secret;
  delete sanitizedConfig.db.username;
  delete sanitizedConfig.db.password;
  delete sanitizedConfig.api.key;
  delete sanitizedConfig.dashboard.password;

  return res.json({ metadata: {status: true}, data: sanitizedConfig });
});

app.post('/dashboard/sign/in', async (req, res) => {
  // Accept password from body, query string, or POST data
  const inputPassword = req.query.password || req.body.password || '';

  if (config.dashboard.is_authentication_required) {
    if (!inputPassword) {
      return res.status(400).json({ metadata: {status: false, error: {code: 'PASSWORD_REQUIRED', message: 'Password required!'}} });
    }

    if (inputPassword === config.dashboard.password) {
      const token = crypto.createHash('md5').update(inputPassword).digest('hex');
      return res.json({ metadata: {status: true}, data: {token} });
    } else {
      return res.status(401).json({ metadata: {status: false, error: {code: 'PASSWORD_INVALID', message: 'Invalid password!'}} });
    }
  } else {
    return res.json({ metadata: {status: true} });
  }
});

// Instance status endpoint - list all instances
app.get('/instances', authMiddleware(), async (_req, res) => {
  try {
    const [instances] = await pool.query(`SELECT * FROM ${dbPrefix}instances ORDER BY created_at DESC`);
    
    // If no instances, return empty array immediately
    if (instances.length === 0) {
      return res.json([]);
    }

    // Collect instance keys and fetch workers for those instances in one query
    const instanceKeys = instances.map(instance => instance.key);
    const placeholders = instanceKeys.map((_, i) => `:k${i}`).join(',');
    const params: any = Object.fromEntries(instanceKeys.map((k, i) => [`k${i}`, k]));

    const [workersRows] = await pool.query(
      `SELECT * FROM ${dbPrefix}workers WHERE instance_key IN (${placeholders}) ORDER BY created_at DESC`,
      params
    );

    const workers = workersRows as any[];
    const workersByInstance: Record<string, any[]> = {};
    for (const worker of workers) {
      if (!workersByInstance[worker.instance_key]) workersByInstance[worker.instance_key] = [];
      workersByInstance[worker.instance_key].push(worker);
    }

    // Attach workers array to each instance
    const result = instances.map(instance => ({
      ...instance,
      workers: workersByInstance[instance.key] || []
    }));

    return res.json( {metadata: {status: true}, data: result} );
  } catch (err) {
    logger.error({ err }, 'Failed to fetch instances!');
    res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Failed to list instances!'}} });
  }
});

// Worker status endpoint - read persisted worker metadata and enrich with in-memory process state
app.get('/workers', authMiddleware(), async (_req, res) => {
  try {
    const [workers] = await pool.query(`SELECT * FROM ${dbPrefix}workers ORDER BY created_at DESC`);
    return res.json( {metadata: {status: true}, data: workers} );
  } catch (err) {
    logger.error({ err }, 'Failed to fetch workers!');
    return res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Failed to list workers!'}} });
  }
});

app.get('/jobs', authMiddleware(), async (_req, res) => {
  const [rows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs ORDER BY created_at DESC LIMIT 200`);
  
  // Parse JSON fields and sanitize sensitive information
  const parsedRows = (rows as any[]).map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    input: row.input ? sanitizeObject(JSON.parse(row.input)) : null,
    input_metadata: row.input_metadata ? JSON.parse(row.input_metadata) : null,
    destination: row.destination ? sanitizeObject(JSON.parse(row.destination)) : null,
    notification: row.notification ? sanitizeObject(JSON.parse(row.notification)) : null
  }));

  res.json(parsedRows);
});

app.get('/jobs/:key', authMiddleware(), async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: req.params.key });
  
  if ((rows as any[]).length === 0) {
    return res.status(404).json({ metadata: {status: false, error: {code: 'NOT_FOUND', message: 'Not found!'}} });
  }
  
  const job = (rows as any[])[0];
  
  // Parse JSON fields in job and sanitize sensitive information
  const parsedJob = {
    ...job,
    metadata: job.metadata ? JSON.parse(job.metadata) : null,
    input: job.input ? sanitizeObject(JSON.parse(job.input)) : null,
    input_metadata: job.input_metadata ? JSON.parse(job.input_metadata) : null,
    destination: job.destination ? sanitizeObject(JSON.parse(job.destination)) : null,
    notification: job.notification ? sanitizeObject(JSON.parse(job.notification)) : null
  };
  
  const [outs] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY output_index`, { job_key: job.key });
  
  // Parse JSON fields in outputs and sanitize
  const parsedOuts = (outs as any[]).map(out => ({
    ...out,
    spec_json: out.spec_json ? sanitizeObject(JSON.parse(out.spec_json)) : null,
    result_json: out.result_json ? JSON.parse(out.result_json) : null
  }));
  
  res.json({ job: parsedJob, outputs: parsedOuts });
});

app.post('/jobs', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const body = req.body as CreateJobRequest;

  if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
    return res.status(400).json({ metadata: {status: false, error: {code: 'REQUEST_INVALID', message: 'Require input and outputs[]!'}} });
  }

  const jobKey = uuidv4();
  const conn = await pool.getConnection();

  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    const metadata = body.metadata ? JSON.stringify(body.metadata) : null;
    const priority = body.priority ?? 1000; // Default priority is 1000

    await conn.execute(
      `INSERT INTO ${dbPrefix}jobs (\`key\`, metadata, input, destination, notification, priority, status, updated_at, created_at) VALUES (:key, :metadata, :input, :destination, :notification, :priority, 'QUEUED', :now, :now)`,
      { key: jobKey, metadata: metadata, input: JSON.stringify(body.input), destination: body.destination ? JSON.stringify(body.destination) : null, notification: body.notification ? JSON.stringify(body.notification) : null, priority: priority, now: getNow() }
    );

    for (let i = 0; i < body.outputs.length; i++) {
      const out: OutputSpec = body.outputs[i];
      const outputKey = uuidv4();
      await conn.execute(
        `INSERT INTO ${dbPrefix}job_outputs (\`key\`, job_key, output_index, spec_json, status, updated_at, created_at) VALUES (:key, :job_key, :output_index, :spec_json, 'PENDING', :now, :now)`,
        { key: outputKey, job_key: jobKey, output_index: i, spec_json: JSON.stringify(out), now: getNow() }
      );
    }

    if (conn.commit) await conn.commit();
    await enqueueJob(jobKey, priority);
    
    // Trigger immediate queue check
    setTimeout(() => monitorQueue(), 100);
    
    // Immediately transition from QUEUED to PENDING
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'PENDING' WHERE \`key\` = :key`,
      { key: jobKey }
    );
    
    // Send notification for QUEUED status if notification is specified
    const { notify } = await import('./services/notifier.js');
    const notificationPayload: any = { 
      key: jobKey,
      status: 'QUEUED',
      priority: priority
    };

    // Include custom metadata if present
    if (body.metadata) {
      notificationPayload.metadata = body.metadata;
    }
    
    // Include sanitized input
    const sanitizedInput: any = { ...body.input };
    delete sanitizedInput.username;
    delete sanitizedInput.password;
    delete sanitizedInput.key;
    delete sanitizedInput.secret;
    notificationPayload.input = sanitizedInput;
    
    // Include sanitized outputs
    const sanitizedOutputs = body.outputs.map(out => {
      const sanitizedOut: any = { ...out };
      
      if (sanitizedOut.destination) {
        const dest: any = sanitizedOut.destination;
        delete dest.username;
        delete dest.password;
        delete dest.key;
        delete dest.secret;
      }

      return sanitizedOut;
    });
    
    notificationPayload.outputs = sanitizedOutputs;
    
    // Include sanitized destination if present
    if (body.destination) {
      const sanitizedDest: any = { ...body.destination };
      delete sanitizedDest.username;
      delete sanitizedDest.password;
      delete sanitizedDest.key;
      delete sanitizedDest.secret;
      notificationPayload.destination = sanitizedDest;
    }

    // Include sanitized notification if present
    if (body.notification) {
      const sanitizedNotif: any = { ...body.notification };
      delete sanitizedNotif.username;
      delete sanitizedNotif.password;
      delete sanitizedNotif.key;
      delete sanitizedNotif.secret;
      notificationPayload.notification = sanitizedNotif;
    }
      
    if (body.notification) {
      await notify(body.notification, notificationPayload);
    }
    
    return res.status(202).json({ metadata: {status: true}, data: notificationPayload });
  } catch (err) {
    if (conn.rollback) await conn.rollback();
    logger.error({ err }, 'Create job failed!');
    return res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Failed to create job!'}} });
  } finally {
    if (conn.release) conn.release();
  }
});

app.delete('/jobs/:key', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const jobKey = req.params.key ?? req.params.job_key;
  
  await pool.execute(
    `UPDATE ${dbPrefix}jobs SET status = 'DELETED' WHERE \`key\` = :key`,
    { key: jobKey }
  );
  
  return res.status(204).json({ metadata: {status: true} });
});

app.get('/jobs/:key/preview', authMiddleware(), async (req: Request, res: Response) => {
  const jobKey = req.params.key ?? req.params.job_key;

  const fallbackImagePath = path.join('.', 'public', 'assets', 'images', 'no-preview.webp');
  
  const serveFallbackImage = () => {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.resolve(fallbackImagePath));
  };
  
  try {
    // Check if job exists
    const [rows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: jobKey });
    
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ metadata: {status: false, error: {code: 'NOT_FOUND', message: 'Job not found!'}} });
    }

    if (config.storage.kind === 'AWS_S3') {
      // For S3, download and serve the preview
      const s3Path = `${config.storage.path}/jobs/${jobKey}/preview.webp`;
      
      try {
        const s3Client = new S3Client({
          region: config.storage.region,
          credentials: {
            accessKeyId: config.storage.key,
            secretAccessKey: config.storage.secret || '',
          }
        });

        const command = new GetObjectCommand({
          Bucket: config.storage.bucket,
          Key: s3Path,
        });

        const response = await s3Client.send(command);
        
        // Stream the file from S3 to the response
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        
        if (response.Body) {
          // Convert the stream to buffer and send
          const chunks: Uint8Array[] = [];
          for await (const chunk of response.Body as any) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          res.send(buffer);
        } else {
          // logger.info({ jobKey, s3Path }, 'Preview not found in S3, serving fallback image');
          serveFallbackImage();
        }
      } catch (err) {
        // logger.info({ err, jobKey, s3Path }, 'Failed to fetch preview from S3, serving fallback image');
        serveFallbackImage();
      }
    } else {
      // For LOCAL storage, serve the file directly
      const previewPath = path.join('.', config.storage.path, 'jobs', jobKey, 'preview.webp');
      
      try {
        await fs.access(previewPath);
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.sendFile(path.resolve(previewPath));
      } catch (err) {
        // logger.info({ err, jobKey, previewPath }, 'Preview file not found, serving fallback image');
        serveFallbackImage();
      }
    }
  } catch (err) {
    // logger.error({ err, jobKey }, 'Error serving preview');
    return res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Failed to serve preview!'}} });
  }
});

const clientPath = path.join(dirname(fileURLToPath(import.meta.url)), "../client-build");
app.use(express.static(clientPath));
app.get("/*", (req: Request, res: Response) => res.sendFile(path.join(clientPath, "index.html")));

app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error({ err }, 'unhandled error');
  return res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Internal error!'}} });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully!');
  
  // DB: WORKERs: UPDATE
  pool.execute(
    `UPDATE ${dbPrefix}workers SET status = 'EXITED', updated_at = :now, exit_signal = 'SIGTERM' WHERE \`key\` = :instance_key`,
    { instance_key: instanceKey, now: getNow() }
  ).catch(err => logger.error({ err, instanceKey }, 'Failed to update workers for instance during shutdown!'));
  
  // DB: INSTANCE: UPDATE
  pool.execute(
    `UPDATE ${dbPrefix}instances SET memory_free = :memory_free, updated_at = :now, status = 'EXITED', exit_signal = 'SIGTERM' WHERE \`key\` = :instance_key`,
    { instance_key: instanceKey, memory_free: os.freemem(), now: getNow() }
  ).catch(err => logger.error({ err, instanceKey }, 'Failed to update instance record during shutdown!'));
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully!');
  
  // DB: WORKERs: UPDATE
  pool.execute(
    `UPDATE ${dbPrefix}workers SET updated_at = :now, status = 'EXITED', exit_signal = 'SIGINT' WHERE \`key\` = :instance_key`,
    { instance_key: instanceKey, now: getNow() }
  ).catch(err => logger.error({ err, instanceKey }, 'Failed to update workers for instance during shutdown!'));
  
  // DB: INSTANCE: UPDATE
  pool.execute(
    `UPDATE ${dbPrefix}instances SET memory_free = :memory_free, updated_at = :now, status = 'EXITED', exit_signal = 'SIGINT' WHERE \`key\` = :instance_key`,
    { instance_key: instanceKey, memory_free: os.freemem(), now: getNow() }
  ).catch(err => logger.error({ err, instanceKey }, 'Failed to update instance record during shutdown'));
  
  process.exit(0);
});

// Initialize and start the application
async function main() {
  await initDb();

  logger.info({ instanceKey }, 'application started with instance key');
  
  // INSTANCE: INSERT
  try {
    // INSTANCE: DELETE
    await pool.execute(
      `DELETE FROM ${dbPrefix}instances WHERE \`key\` = :instance_key`,
      { instance_key: instanceKey }
    );

    await pool.execute(
      `INSERT INTO ${dbPrefix}instances (\`key\`, cpu_core_count, memory_total, memory_free, workers_per_cpu_core, workers_max, workers_running_count, updated_at, created_at) VALUES (:instance_key, :cpu_core_count, :memory_total, :memory_free, :workers_per_cpu_core, :workers_max, 0, :now, :now)`,
      { instance_key: instanceKey, cpu_core_count: config.cpu_cores_count, memory_total: config.memory_total, memory_free: os.freemem(), workers_per_cpu_core: config.workers.per_cpu_core, workers_max: config.workers.max, now: getNow() }
    );
  } catch (err) {
    logger.error({ err, instanceKey }, 'failed to register instance in DB');
  }
  
  // SERVER: START
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'api listening');
  });

  // QUEUE: START
  setInterval(monitorQueue, config.jobs.poll_interval);
  logger.info('queue monitoring started');
  
  // Start periodic instance & worker maintenance
  setInterval(instanceInterval, 30000); // Check every 30 seconds
  logger.info({ max: config.workers.max, running_timeout: config.workers.running_timeout, exited_timeout: config.workers.exited_timeout }, 'worker pool management started');
}

main().catch((err) => {
  logger.error({ err }, 'failed to start application');
  process.exit(1);
});
