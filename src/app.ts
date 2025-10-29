import { config } from './config';
import { CreateJobRequest, OutputSpec } from './config/types.js';

import { createInstanceKey, getInstanceSystemInfo, uuid, uukey, hash, getNow } from './utils';
import { logger } from './utils/logger.js';
import { initDb, pool } from './utils/database.js';

import 'express-async-errors';
import os from 'os';
import express, { Request, Response } from "express";
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import cors from "cors";
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// INSTANCE: KEY
const instanceKey = createInstanceKey();

const app = express();

// Configure express.json() options via an array and apply when present
const expressOptions: any[] = [];
if (config.api.request_body_limit && parseInt(String(config.api.request_body_limit)) > 0) {
  expressOptions.push({ limit: `${config.api.request_body_limit}mb` });
}
app.use(express.json(...expressOptions));

// cors
app.use(cors());

/* DATABASE: PREFIX */
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
    const dashboardToken = hash(config.dashboard.password || uuid());
    const apiToken = config.api.key;

    // Check if token matches either dashboard token or API key
    if (token !== dashboardToken && token !== apiToken) {
      return res.status(401).json({ metadata: { status: false, error: {code: 'AUTH_TOKEN_INVALID', message: 'Invalid authentication token!'}} });
    }

    next();
  };
};

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
  
}

/* API: ROUTEs */
// Support both /health and /status for health checks (some load balancers
// or orchestration systems expect one or the other).
app.get(['/status', '/health'], (_req, res) => res.json({ metadata: {status: true} }));

app.get('/config', async (_req, res) => {
  const sanitizedConfig: any = { ...config };

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
      const token = hash(inputPassword);
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

    // Parse instance.system JSON and attach workers array to each instance
    const result = instances.map(instance => {
      return {
        ...instance,
        system: instance.system ? JSON.parse(instance.system) : null,
        workers: workersByInstance[instance.key] || []
      };
    });

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
  
  const [outs] = await pool.query(`SELECT * FROM ${dbPrefix}job_outputs WHERE job_key = :job_key ORDER BY \`index\``, { job_key: job.key });
  
  // Parse JSON fields in outputs and sanitize
  const parsedOuts = (outs as any[]).map(out => ({
    ...out,
    specs: out.specs ? sanitizeObject(JSON.parse(out.specs)) : null,
    result: out.result ? JSON.parse(out.result) : null
  }));
  
  res.json({ job: parsedJob, outputs: parsedOuts });
});

app.post('/jobs', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const body = req.body as CreateJobRequest;

  if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
    return res.status(400).json({ metadata: {status: false, error: {code: 'REQUEST_INVALID', message: 'Require input and outputs[]!'}} });
  }

  const jobKey = uukey();
  const conn = await pool.getConnection();

  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    const metadata = body.metadata ? JSON.stringify(body.metadata) : null;
    const priority = body.priority ?? 1000; // Default priority is 1000

    await conn.execute(
      `INSERT INTO ${dbPrefix}jobs (\`key\`, metadata, input, destination, notification, priority, status, updated_at, created_at) VALUES (:key, :metadata, :input, :destination, :notification, :priority, 'QUEUED', :now, :now)`,
      { key: jobKey, metadata: metadata, input: JSON.stringify(body.input), destination: body.destination ? JSON.stringify(body.destination) : null, notification: body.notification ? JSON.stringify(body.notification) : null, priority: priority, now: getNow() }
    );

    for (let index = 0; index < body.outputs.length; index++) {
      const out: OutputSpec = body.outputs[index];
      const outputKey = uukey();
      await conn.execute(
        `INSERT INTO ${dbPrefix}job_outputs (\`key\`, job_key, \`index\`, specs, status, updated_at, created_at) VALUES (:key, :job_key, :index, :specs, 'PENDING', :now, :now)`,
        { key: outputKey, job_key: jobKey, index, specs: JSON.stringify(out), now: getNow() }
      );
    }

    if (conn.commit) await conn.commit();
    
    await pool.execute(
      `INSERT INTO ${dbPrefix}queue_jobs (\`key\`, job_key, priority, visibility_timeout, available_at, created_at) VALUES (:key, :jobKey, :priority, :now, :now, :now)`,
      { key: uukey(), jobKey, priority, now: getNow() }
    );

    // Trigger immediate queue check
    setTimeout(() => monitorQueue(), 100);
    
    // Immediately transition from QUEUED to PENDING
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'PENDING' WHERE \`key\` = :key`,
      { key: jobKey }
    );
    
    // Send notification for QUEUED status if notification is specified
    const { notify } = await import('./services/encoder/notifier.js');
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
    `UPDATE ${dbPrefix}instances SET system = :system, updated_at = :now, status = 'EXITED', exit_signal = 'SIGTERM' WHERE \`key\` = :instance_key`,
    { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
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
    `UPDATE ${dbPrefix}instances SET system = :system, updated_at = :now, status = 'EXITED', exit_signal = 'SIGINT' WHERE \`key\` = :instance_key`,
    { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), now: getNow() }
  ).catch(err => logger.error({ err, instanceKey }, 'Failed to update instance record during shutdown'));
  
  process.exit(0);
});

/* MAINTAINER: INITIALIZE */
function initMaintainer(): ChildProcess {
  const maintainerPath = config.env === 'prod' 
    ? path.join(process.cwd(), 'dist', 'services', 'maintainer.js')
    : path.join(process.cwd(), 'src', 'services', 'maintainer.ts');

  const child = config.env === 'prod'
    ? spawn('node', [maintainerPath, instanceKey], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd()
      })
    : spawn('npx', ['tsx', maintainerPath, instanceKey], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd(),
        shell: true
      });

  logger.info('Maintainer service started');

  child.on('exit', (code, signal) => {
    logger.info({ code, signal }, 'Maintainer service exited, restarting...');
    // Restart the service after a short delay
    setTimeout(() => {
      initMaintainer();
    }, 5000); // Wait 5 seconds before restarting
  });

  child.on('error', (err) => {
    logger.error({ err }, 'Maintainer service error, restarting...');
    // Restart the service after a short delay
    setTimeout(() => {
      initMaintainer();
    }, 5000); // Wait 5 seconds before restarting
  });

  return child;
}

// Initialize and start the application
async function main() {
  await initDb();

  logger.info({ instanceKey }, 'Application started with instance key!');

  // WORKERs: UPDATE: EXITED
  try {
    await pool.execute(
      `UPDATE ${dbPrefix}workers SET status = 'EXITED' WHERE instance_key = :instance_key`,
      { instance_key: instanceKey }
    );
  } catch (err) {
    logger.info({ err, instanceKey }, 'Failed to update workers for instance in DB!');
  }

  try {
    // INSTANCE: DELETE
    await pool.execute(
      `DELETE FROM ${dbPrefix}instances WHERE \`key\` = :instance_key`,
      { instance_key: instanceKey }
    );

    // INSTANCE: INSERT
    await pool.execute(
      `INSERT INTO ${dbPrefix}instances (\`key\`, system, workers_per_cpu_core, workers_max, workers_running_count, updated_at, created_at) VALUES (:instance_key, :system, :workers_per_cpu_core, :workers_max, 0, :now, :now)`,
      { instance_key: instanceKey, system: JSON.stringify(getInstanceSystemInfo()), workers_per_cpu_core: config.workers.per_cpu_core, workers_max: config.workers.max, now: getNow() }
    );
  } catch (err) {
    logger.error({ err, instanceKey }, 'Failed to register instance in DB!');
  }
  
  /* SERVER: START */
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'API listening!');
  });

  /* MAINTAINER: INITILIZE */
  initMaintainer();

  logger.info('Queue monitoring started!');
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start application!');
  process.exit(1);
});
