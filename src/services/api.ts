import { config } from '../config/index.js';
import { CreateJobRequest, OutputSpec } from '../config/types.js';

import { sanitizeData, uuid, uukey, hash, getNow } from '../utils/index.js';
import { logger } from '../utils/logger.js';
import { storage } from '../utils/storage.js';
import { database } from '../utils/database.js';

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
      return res.status(401).json({ metadata: {status: 'ERROR', error: {code: 'AUTH_TOKEN_REQUIRED', message: 'Authentication token required!'}} });
    }

    // Expected tokens
    const dashboardToken = hash(config.dashboard.password || uuid());
    const apiToken = config.api.key;

    // Check if token matches either dashboard token or API key
    if (token !== dashboardToken && token !== apiToken) {
      return res.status(401).json({ metadata: { status: 'ERROR', error: {code: 'AUTH_TOKEN_INVALID', message: 'Invalid authentication token!'}} });
    }

    next();
  };
};

// API: ROUTEs
// Support both /health and /status for health checks (some load balancers
// or orchestration systems expect one or the other).
app.get(['/status', '/health'], (req, res) => res.json({ metadata: {status: 'SUCCESSFUL'} }));

app.get('/config', async (req, res) => {
  return res.json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(config) });
});

app.post('/auth', async (req, res) => {
  // Accept password from body, query string, or POST data
  const inputPassword = (req.query.password || req.body.password || '').trim();

  if (config.dashboard.is_authentication_required) {
    if (!inputPassword) {
      return res.status(400).json({ metadata: {status: 'ERROR', error: {code: 'PASSWORD_REQUIRED', message: 'Password required!'}} });
    }

    if (inputPassword === config.dashboard.password) {
      const token = hash(inputPassword);
      return res.json({ metadata: {status: 'SUCCESSFUL'}, data: {token} });
    } else {
      return res.status(401).json({ metadata: {status: 'ERROR', error: {code: 'PASSWORD_INVALID', message: 'Invalid password!'}} });
    }
  } else {
    return res.json({ metadata: {status: 'SUCCESSFUL'} });
  }
});

// Instance status endpoint - list all instances
app.get('/instances', authMiddleware(), async (req, res) => {
  try {
    const instanceKey = (req.query.instance_key || req.body.instance_key || '').trim();

    // If instance_key provided, fetch only that instance and return as object (not array)
    if (instanceKey) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}instances WHERE \`key\` = :key LIMIT 1`,
        { key: instanceKey }
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Instance not found!'}} });
      }

      const instance = (rows as any[])[0];

      const [workersRows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers WHERE instance_key = :key ORDER BY created_at DESC`,
        { key: instanceKey }
      );

      const workers = workersRows as any[];

      const result = { ...instance, specs: instance.specs ? JSON.parse(instance.specs) : null, workers };

      return res.json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(result) });
    }

    const [instances] = await database.query(`SELECT * FROM ${database.getTablePrefix()}instances ORDER BY created_at DESC`);
    
    // If no instances, return empty array immediately
    if (instances.length === 0) {
      return res.json([]);
    }

    // Collect instance keys and fetch workers for those instances in one query
    const instanceKeys = instances.map(instance => instance.key);
    const placeholders = instanceKeys.map((_, i) => `:k${i}`).join(',');
    const params: any = Object.fromEntries(instanceKeys.map((k, i) => [`k${i}`, k]));

    const [workersRows] = await database.query(
      `SELECT * FROM ${database.getTablePrefix()}workers WHERE instance_key IN (${placeholders}) ORDER BY created_at DESC`,
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
        specs: instance.specs ? JSON.parse(instance.specs) : null,
        workers: workersByInstance[instance.key] || []
      };
    });

    return res.json( {metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(result)} );
  } catch (err: Error | any) {
    logger.error({ err }, 'Failed to fetch instances!');
    res.status(500).json({ metadata: {status: 'ERROR', error: { code: 'INTERNAL_ERROR', message: err.message || 'Unknown error occurred!' }} });
  }
});

// Worker status endpoint - read persisted worker metadata and enrich with in-memory process state
app.get('/workers', authMiddleware(), async (req, res) => {
  try {
    const workerKey = (req.query.worker_key || req.body.worker_key || '').trim();

    // If worker_key provided, fetch only that worker and return as object (not array)
    if (workerKey) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers WHERE \`key\` = :key LIMIT 1`,
        { key: workerKey }
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Worker not found!'}} });
      }

      const worker = (rows as any[])[0];

      return res.json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(worker) });
    }

    const instanceKey = (req.query.instance_key || req.body.instance_key || '').trim();

    const [workers] = instanceKey
      ? await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers WHERE instance_key = :instance_key ORDER BY created_at DESC`,
        { instance_key: instanceKey }
      )
      : await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers ORDER BY created_at DESC`
      );
    
    return res.json( {metadata: {status: 'SUCCESSFUL'}, data: workers} );
  } catch (err: Error | any) {
    logger.error({ err }, 'Failed to fetch workers!');
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: err.message || 'Unknown error occurred!'}} });
  }
});

app.get('/jobs', authMiddleware(), async (req, res) => {
  try {
    const jobKey = (req.query.job_key || req.body.job_key || '').trim();

    // If job_key provided, fetch only that job and return as object (not array)
    if (jobKey) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}jobs WHERE \`key\` = :key LIMIT 1`,
        { key: jobKey }
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Job not found!'}} });
      }

      const job = (rows as any[])[0];

      return res.json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(job) });
    }

    const defaultLimit = 25;
    const rawLimit = req.query.limit;
    const rawPage = req.query.page;
    const instanceKey = (req.query.instance_key || req.body.instance_key || '').trim();
    const workerKey = (req.query.worker_key || req.body.worker_key || '').trim();
    const status = (req.query.status || req.body.status || '').trim();
    const searchQuery = req.query.q ? String(req.query.q).trim() : '';

    let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
    if (isNaN(limit) || limit < 1) limit = defaultLimit;

    let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    const offset = (page - 1) * limit;

    // Build WHERE clause for search
    let whereClause = '';
    const params: any = { limit, offset };

    if (instanceKey) {
      whereClause += (whereClause ? ' AND ' : '') + 'instance_key = :instanceKey';
      params.instanceKey = instanceKey;
    }

    if (workerKey) {
      whereClause += (whereClause ? ' AND ' : '') + 'worker_key = :workerKey';
      params.workerKey = workerKey;
    }

    if (status) {
      whereClause += (whereClause ? ' AND ' : '') + 'status = :status';
      params.status = status;
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      whereClause += (whereClause ? ' AND ' : '') + `(\`key\` LIKE :search OR input LIKE :search OR destination LIKE :search OR notification LIKE :search OR metadata LIKE :search)`;
      params.search = searchPattern;
    }

    if(whereClause) whereClause = ' WHERE ' + whereClause;

    // Get total count for pagination metadata
    const [[{ total }]] = await database.query(
      `SELECT COUNT(*) as total FROM ${database.getTablePrefix()}jobs${whereClause}`,
      searchQuery ? { search: params.search } : {}
    ) as any;

    // Get paginated data
    const [rawRows] = await database.query(
      `SELECT * FROM ${database.getTablePrefix()}jobs${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
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
      metadata: {status: 'SUCCESSFUL'},
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
  } catch (err: Error | any) {
    logger.error({ err }, 'Failed to fetch workers!');
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: err.message || 'Unknown error occurred!'}} });
  }
});

app.put('/jobs', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const body = req.body as CreateJobRequest;

  if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
    return res.status(400).json({ metadata: { status: 'ERROR', error: {code: 'REQUEST_INVALID', message: 'Require input and outputs[]!'} } });
  }

  const databaseConn = await database.getConnection();

  try {
    if (databaseConn.beginTransaction) await databaseConn.beginTransaction();

    const jobKey = uukey();
    const priority = body.priority ?? 1000; // Default priority is 1000
    const now = getNow();

    const outputs = [];
    for (let index = 0; index < body.outputs.length; index++) {
      const output: OutputSpec = body.outputs[index];
      outputs.push({ key: uukey(), job_key: jobKey, index, specs: output, status: 'PENDING', updated_at: now, created_at: now, result: null, error: null });
    }

    if (body.notification){
      if (body.notification.events && Array.isArray(body.notification.events)) {
        const allowedEvents = config.notifications.events_allowed.split(",").map(e => e.trim());

        body.notification.events = body.notification.events.filter((event:string) =>
          allowedEvents.includes(event)
        );
      }
    }

    await databaseConn.execute(
      `INSERT INTO ${database.getTablePrefix()}jobs (\`key\`, priority, input, outputs, destination, notification, metadata, status, updated_at, created_at) VALUES (:key, :priority, :input, :outputs, :destination, :notification, :metadata, 'QUEUED', :now, :now)`,
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

    if (databaseConn.commit) await databaseConn.commit();
    
    await database.execute(
      `INSERT INTO ${database.getTablePrefix()}jobs_queue (\`key\`, job_key, priority, visibility_timeout, available_at, created_at) VALUES (:key, :jobKey, :priority, :now, :now, :now)`,
      { key: uukey(), jobKey, priority, now: getNow() }
    );

    // Immediately transition from QUEUED to PENDING
    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs SET status = 'PENDING' WHERE \`key\` = :key`,
      { key: jobKey }
    );

    const job = {key: jobKey, priority, status: 'QUEUED', ...body, outputs};
    
    if (job.notification) {
      const { createJobNotification } = await import('./worker/notifier.js');
      await createJobNotification('QUEUED', job);
    }

    return res.status(202).json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(job) });
  } catch (err: Error | any) {
    if (databaseConn.rollback) await databaseConn.rollback();
    logger.error({ err }, 'Create job failed!');
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: err.message || 'Unknown error occurred!'}} });
  } finally {
    if (databaseConn.release) databaseConn.release();
  }
});

app.delete('/jobs', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const jobKey = (req.query.job_key || req.body.job_key || '').trim();
  
  if(jobKey) {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs SET status = 'DELETED' WHERE \`key\` = :key`,
      { key: jobKey }
    );
  }
  
  return res.status(204).json({ metadata: {status: 'SUCCESSFUL'} });
});

app.get('/jobs/preview', authMiddleware(), async (req: Request, res: Response) => {
  const jobKey = (req.query.job_key || req.body.job_key || '').trim();

  const fallbackImagePath = path.join('.', 'public', 'assets', 'images', 'no-preview.webp');
  
  const serveFallbackImage = () => {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.resolve(fallbackImagePath));
  };
  
  try {
    if(jobKey){
      // Check if job exists
      const [rows] = await database.query(`SELECT * FROM ${database.getTablePrefix()}jobs WHERE \`key\` = :key`, { key: jobKey });
      
      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Job not found!'}} });
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
        
      }
    }

    return serveFallbackImage();
  } catch (err: Error | any) {
    // logger.error({ err, jobKey }, 'Error serving preview');
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: err.message || 'Unknown error occurred!'}} });
  }
});

app.get('/jobs/notifications', authMiddleware(), async (req, res) => {
  try {
    const notificationKey = (req.query.notification_key || req.body.notification_key || '').trim();

    // If notification_key provided, fetch only that notification and return as object (not array)
    if (notificationKey) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}jobs_notifications WHERE \`key\` = :key LIMIT 1`,
        { key: notificationKey }
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Notification not found!'}} });
      }

      const notification = (rows as any[])[0];

      return res.json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(notification) });
    }

    const defaultLimit = 25;
    const rawLimit = req.query.limit;
    const rawPage = req.query.page;
    const instanceKey = (req.query.instance_key || req.body.instance_key || '').trim();
    const workerKey = (req.query.worker_key || req.body.worker_key || '').trim();
    const jobKey = (req.query.job_key || req.body.job_key || '').trim();
    const event = (req.query.event || req.body.event || '').trim();
    const status = (req.query.status || req.body.status || '').trim();
    const searchQuery = req.query.q ? String(req.query.q).trim() : '';

    let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
    if (isNaN(limit) || limit < 1) limit = defaultLimit;

    let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    const offset = (page - 1) * limit;

    // Build WHERE clause for search
    let whereClause = '';
    const params: any = { limit, offset };

    if (instanceKey) {
      whereClause += (whereClause ? ' AND ' : '') + 'instance_key = :instanceKey';
      params.instanceKey = instanceKey;
    }

    if (workerKey) {
      whereClause += (whereClause ? ' AND ' : '') + 'worker_key = :workerKey';
      params.workerKey = workerKey;
    }

    if (jobKey) {
      whereClause += (whereClause ? ' AND ' : '') + 'job_key = :jobKey';
      params.jobKey = jobKey;
    }

    if (event) {
      whereClause += (whereClause ? ' AND ' : '') + 'event = :event';
      params.event = event;
    }

    if (status) {
      whereClause += (whereClause ? ' AND ' : '') + 'status = :status';
      params.status = status;
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      whereClause += (whereClause ? ' AND ' : '') + `(\`key\` LIKE :search OR payload LIKE :search OR outcome LIKE :search)`;
      params.search = searchPattern;
    }

    if(whereClause) whereClause = ' WHERE ' + whereClause;

    // Get total count for pagination metadata
    const [[{ total }]] = await database.query(
      `SELECT COUNT(*) as total FROM ${database.getTablePrefix()}jobs_notifications${whereClause}`,
      searchQuery ? { search: params.search } : {}
    ) as any;

    // Get paginated data
    const [rawRows] = await database.query(
      `SELECT * FROM ${database.getTablePrefix()}jobs_notifications${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
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
      metadata: {status: 'SUCCESSFUL'},
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
  } catch (err: Error | any) {
    logger.error({ err }, 'Failed to fetch job notifications!');
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: err.message || 'Unknown error occurred!'}} });
  }
});

const clientPath = path.join(dirname(fileURLToPath(import.meta.url)), "../../client-build");
app.use(express.static(clientPath));
app.get("/*", (req: Request, res: Response) => res.sendFile(path.join(clientPath, "index.html")));

app.use((err: any, req: any, res: any, _next: any) => {
  logger.error({ err }, 'Unhandled error occurred on API service!');
  return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: 'Internal error!'}} });
});

export async function startApiService(instanceKey: string) {
  logger.info('Starting API service...');

  if (!instanceKey) {
    logger.error('Instance key required!');
    throw new Error('Instance key required!');
  }

  await storage.config(config.storage);
  
  database.config(config.database);
  await database.verifySchemaExists();

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
