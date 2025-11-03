import { config } from '../config/index.js';
import { CreateJobRequest, OutputSpec } from '../config/types.js';

import { sanitizeData, uuid, uukey, hash, getNow } from '../utils/index.js';
import { storage } from '../utils/storage.js';
import { logger } from '../utils/logger.js';
import { initDb, dbPool, dbTablePrefix } from '../utils/database.js';

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'express-async-errors';
import express, { Request, Response } from "express";
import cors from "cors";
// Storage operations are abstracted via utils/storage

const app = express();

// Configure express.json() options via an array and apply when present
const expressOptions: any[] = [];
if (config.api.request_body_limit && parseInt(String(config.api.request_body_limit)) > 0) {
  expressOptions.push({ limit: `${config.api.request_body_limit}mb` });
}
app.use(express.json(...expressOptions));

// cors
app.use(cors());

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

// API: ROUTEs
// Support both /health and /status for health checks (some load balancers
// or orchestration systems expect one or the other).
app.get(['/status', '/health'], (_req, res) => res.json({ metadata: {status: true} }));

app.get('/config', async (_req, res) => {
  return res.json({ metadata: {status: true}, data: sanitizeData(config) });
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
  const [instances] = await dbPool.query(`SELECT * FROM ${dbTablePrefix()}instances ORDER BY created_at DESC`);
    
    // If no instances, return empty array immediately
    if (instances.length === 0) {
      return res.json([]);
    }

    // Collect instance keys and fetch workers for those instances in one query
    const instanceKeys = instances.map(instance => instance.key);
    const placeholders = instanceKeys.map((_, i) => `:k${i}`).join(',');
    const params: any = Object.fromEntries(instanceKeys.map((k, i) => [`k${i}`, k]));

    const [workersRows] = await dbPool.query(
      `SELECT * FROM ${dbTablePrefix()}workers WHERE instance_key IN (${placeholders}) ORDER BY created_at DESC`,
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
  } catch (err: Error | any) {
    logger.error({ err }, 'Failed to fetch instances!');
    res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Failed to list instances!'}} });
  }
});

// Worker status endpoint - read persisted worker metadata and enrich with in-memory process state
app.get('/workers', authMiddleware(), async (_req, res) => {
  try {
  const [workers] = await dbPool.query(`SELECT * FROM ${dbTablePrefix()}workers ORDER BY created_at DESC`);
    return res.json( {metadata: {status: true}, data: workers} );
  } catch (err: Error | any) {
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
  const [[{ total }]] = await dbPool.query(
    `SELECT COUNT(*) as total FROM ${dbTablePrefix()}jobs${whereClause}`,
    searchQuery ? { search: params.search } : {}
  ) as any;

  // Get paginated data
  const [rawRows] = await dbPool.query(
    `SELECT * FROM ${dbTablePrefix()}jobs${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    params
  );

  // Parse JSON fields and sanitize sensitive information
  const data = sanitizeData(rawRows);

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
  const [rawRows] = await dbPool.query(`SELECT * FROM ${dbTablePrefix()}jobs WHERE \`key\` = :key`, { key: req.params.key });
  
  if ((rawRows as any[]).length === 0) {
    return res.status(404).json({ metadata: {status: false, error: {code: 'NOT_FOUND', message: 'Not found!'}} });
  }
  
  const rawData = (rawRows as any[])[0];
  const data = sanitizeData(rawData);
  
  res.json({ metadata: { status: true }, data });
});

app.post('/jobs', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const body = req.body as CreateJobRequest;

  if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
    return res.status(400).json({ metadata: {status: false, error: {code: 'REQUEST_INVALID', message: 'Require input and outputs[]!'}} });
  }

  const conn = await dbPool.getConnection();

  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    const jobKey = uukey();
    const priority = body.priority ?? 1000; // Default priority is 1000
    const now = getNow();

    const outputs = [];
    for (let index = 0; index < body.outputs.length; index++) {
      const output: OutputSpec = body.outputs[index];
      outputs.push({ key: uukey(), job_key: jobKey, index, specs: output, status: 'PENDING', updated_at: now, created_at: now, result: null, error: null });
    }

    await conn.execute(
      `INSERT INTO ${dbTablePrefix()}jobs (\`key\`, priority, input, outputs, destination, notification, metadata, status, updated_at, created_at) VALUES (:key, :priority, :input, :outputs, :destination, :notification, :metadata, 'QUEUED', :now, :now)`,
      { 
        key: jobKey,
        priority: priority,
        input: body.input ? JSON.stringify(body.input) : null,
        outputs: outputs ? JSON.stringify(outputs) : null,
        destination: body.destination ? JSON.stringify(body.destination) : null,
        notification: body.notification ? JSON.stringify(body.notification) : null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        now: getNow()
      }
    );

    if (conn.commit) await conn.commit();
    
    await dbPool.execute(
      `INSERT INTO ${dbTablePrefix()}jobs_queue (\`key\`, job_key, priority, visibility_timeout, available_at, created_at) VALUES (:key, :jobKey, :priority, :now, :now, :now)`,
      { key: uukey(), jobKey, priority, now: getNow() }
    );

    // Immediately transition from QUEUED to PENDING
    await dbPool.execute(
      `UPDATE ${dbTablePrefix()}jobs SET status = 'PENDING' WHERE \`key\` = :key`,
      { key: jobKey }
    );
    
    const { notifyJob } = await import('./worker/notifier.js');
    const notificationPayload = await notifyJob({key: jobKey, priority, status: 'QUEUED', ...body, outputs});

    return res.status(202).json({ metadata: {status: true}, data: notificationPayload });
  } catch (err: Error | any) {
    if (conn.rollback) await conn.rollback();
    logger.error({ err }, 'Create job failed!');
    return res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Failed to create job!'}} });
  } finally {
    if (conn.release) conn.release();
  }
});

app.delete('/jobs/:key', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const jobKey = req.params.key ?? req.params.job_key;
  
  await dbPool.execute(
    `UPDATE ${dbTablePrefix()}jobs SET status = 'DELETED' WHERE \`key\` = :key`,
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
  const [rows] = await dbPool.query(`SELECT * FROM ${dbTablePrefix()}jobs WHERE \`key\` = :key`, { key: jobKey });
    
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ metadata: {status: false, error: {code: 'NOT_FOUND', message: 'Job not found!'}} });
    }

    try {
      // Try to read via storage facade; if missing, fall back to placeholder
      const exists = await storage.exists(`/jobs/${jobKey}/preview.${config.jobs.preview.format.toLowerCase()}`);
      if (!exists) return serveFallbackImage();
      const buffer = await storage.read(`/jobs/${jobKey}/preview.${config.jobs.preview.format.toLowerCase()}`);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.send(buffer);
    } catch (err: Error | any) {
      // logger.info({ err, jobKey, key }, 'Failed to read preview from storage, serving fallback image');
      return serveFallbackImage();
    }
  } catch (err: Error | any) {
    // logger.error({ err, jobKey }, 'Error serving preview');
    return res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Failed to serve preview!'}} });
  }
});

const clientPath = path.join(dirname(fileURLToPath(import.meta.url)), "../../client-build");
app.use(express.static(clientPath));
app.get("/*", (req: Request, res: Response) => res.sendFile(path.join(clientPath, "index.html")));

app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error({ err }, 'Unhandled error occurred on API service!');
  return res.status(500).json({ metadata: {status: false, error: {code: 'INTERNAL_ERROR', message: 'Internal error!'}} });
});

export async function startApiService(instanceKey: string) {
  logger.info('Starting API service...');

  if (!instanceKey) {
    logger.error('Instance key required!');
    throw new Error('Instance key required!');
  }

  await storage.config(config.storage);
  await initDb();

  // SERVER: START
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, () => {
      logger.info({ instanceKey, port: config.port }, 'API service started successfully!');
      resolve(server);
    }).on('error', (err) => {
      logger.error({ err }, 'Failed to start API service!');
      reject(err);
    });
  });
}
