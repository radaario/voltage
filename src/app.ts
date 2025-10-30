import { config } from './config';
import { CreateJobRequest, OutputSpec } from './config/types.js';

import { createInstanceKey, getInstanceSystemInfo, uuid, uukey, hash, getNow, sanitizeData } from './utils';
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

app.get('/jobs', authMiddleware(), async (req, res) => {
  const defaultLimit = 25;
  const rawLimit = req.query.limit;
  const rawPage = req.query.page;
  const searchQuery = req.query.q ? String(req.query.q).trim() : '';

  let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;

  let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
  if (isNaN(page) || page < 1) page = 1;

  const offset = (page - 1) * limit;

  // Build WHERE clause for search
  let whereClause = '';
  const params: any = { limit, offset };
  
  if (searchQuery) {
    const searchPattern = `%${searchQuery}%`;
    whereClause = ` WHERE (\`key\` LIKE :search OR input LIKE :search OR destination LIKE :search OR notification LIKE :search OR metadata LIKE :search)`;
    params.search = searchPattern;
  }

  // Get total count for pagination metadata
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM ${dbPrefix}jobs${whereClause}`,
    searchQuery ? { search: params.search } : {}
  ) as any;

  // Get paginated data
  const [rawRows] = await pool.query(
    `SELECT * FROM ${dbPrefix}jobs${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    params
  );

  // Parse JSON fields and sanitize sensitive information
  const data = (rawRows as any[]).map(row => ({
    ...row,
    input: row.input ? sanitizeData(JSON.parse(row.input)) : null,
    outputs: row.outputs ? sanitizeData(JSON.parse(row.outputs)) : null,
    destination: row.destination ? sanitizeData(JSON.parse(row.destination)) : null,
    notification: row.notification ? sanitizeData(JSON.parse(row.notification)) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  }));

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;
  const nextPage = hasMore ? page + 1 : null;
  const prevPage = page > 1 ? page - 1 : null;

  return res.json({
    metadata: {status: true},
    data,
    pagination: {
      limit,
      page,
      total,
      total_pages: totalPages,
      has_more: hasMore,
      next_page: nextPage,
      prev_page: prevPage
    }
  });
});

app.get('/jobs/:key', authMiddleware(), async (req, res) => {
  const [rawRows] = await pool.query(`SELECT * FROM ${dbPrefix}jobs WHERE \`key\` = :key`, { key: req.params.key });
  
  if ((rawRows as any[]).length === 0) {
    return res.status(404).json({ metadata: {status: false, error: {code: 'NOT_FOUND', message: 'Not found!'}} });
  }
  
  const rawData = (rawRows as any[])[0];
  
  // Parse JSON fields in job and sanitize sensitive information
  const data = {
    ...rawData,
    input: rawData.input ? sanitizeData(JSON.parse(rawData.input)) : null,
    outputs: rawData.outputs ? sanitizeData(JSON.parse(rawData.outputs)) : null,
    destination: rawData.destination ? sanitizeData(JSON.parse(rawData.destination)) : null,
    notification: rawData.notification ? sanitizeData(JSON.parse(rawData.notification)) : null,
    metadata: rawData.metadata ? JSON.parse(rawData.metadata) : null
  };
  
  res.json({ metadata: { status: true }, data });
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

    const now = getNow();
    const priority = body.priority ?? 1000; // Default priority is 1000

    const outputs = [];
    for (let index = 0; index < body.outputs.length; index++) {
      const output: OutputSpec = body.outputs[index];
      outputs.push({ key: uukey(), job_key: jobKey, index, specs: output, status: 'PENDING', updated_at: now, created_at: now, result: null, error: null });
    }

    console.log("OUTPUTS:", outputs);

    await conn.execute(
      `INSERT INTO ${dbPrefix}jobs (\`key\`, input, outputs, destination, notification, metadata, priority, status, updated_at, created_at) VALUES (:key, :input, :outputs, :destination, :notification, :metadata, :priority, 'QUEUED', :now, :now)`,
      { 
        key: jobKey,
        input: body.input ? JSON.stringify(body.input) : null,
        outputs: outputs ? JSON.stringify(outputs) : null,
        destination: body.destination ? JSON.stringify(body.destination) : null,
        notification: body.notification ? JSON.stringify(body.notification) : null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        priority: priority,
        now: getNow()
      }
    );

    for (const output of outputs) {
      await conn.execute(
        `INSERT INTO ${dbPrefix}job_outputs (\`key\`, job_key, \`index\`, specs, status, updated_at, created_at) VALUES (:key, :job_key, :index, :specs, 'PENDING', :now, :now)`,
        { ...output, specs: JSON.stringify(output.specs), now }
      );
    }

    if (conn.commit) await conn.commit();
    
    await pool.execute(
      `INSERT INTO ${dbPrefix}jobs_queue (\`key\`, job_key, priority, visibility_timeout, available_at, created_at) VALUES (:key, :jobKey, :priority, :now, :now, :now)`,
      { key: uukey(), jobKey, priority, now: getNow() }
    );

    // Immediately transition from QUEUED to PENDING
    await pool.execute(
      `UPDATE ${dbPrefix}jobs SET status = 'PENDING' WHERE \`key\` = :key`,
      { key: jobKey }
    );
    
    const { notifyJob } = await import('./services/encoder/notifier.js');
    const notificationPayload = await notifyJob(jobKey, 'QUEUED', priority, {...body, outputs});
    
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
