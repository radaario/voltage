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
import { createJobNotification } from './worker/notifier.js';

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
    const instance_key = (req.query.instance_key || req.body.instance_key || '').trim();

    // If instance_key provided, fetch only that instance and return as object (not array)
    if (instance_key) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}instances WHERE \`key\` = :key LIMIT 1`,
        { key: instance_key }
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Instance not found!'}} });
      }

      const instance = (rows as any[])[0];

      const [workersRows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers WHERE instance_key = :key ORDER BY created_at DESC`,
        { key: instance_key }
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
    const instance_keys = instances.map(instance => instance.key);
    const placeholders = instance_keys.map((_, i) => `:k${i}`).join(',');
    const params: any = Object.fromEntries(instance_keys.map((k, i) => [`k${i}`, k]));

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
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to fetch instances!', { error });
    res.status(500).json({ metadata: {status: 'ERROR', error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch instances!' }} });
  }
});

// Worker status endpoint - read persisted worker metadata and enrich with in-memory process state
app.get('/workers', authMiddleware(), async (req, res) => {
  try {
    const worker_key = (req.query.worker_key || req.body.worker_key || '').trim();

    // If worker_key provided, fetch only that worker and return as object (not array)
    if (worker_key) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers WHERE \`key\` = :key LIMIT 1`,
        { key: worker_key }
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Worker not found!'}} });
      }

      const worker = (rows as any[])[0];

      return res.json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(worker) });
    }

    const instance_key = (req.query.instance_key || req.body.instance_key || '').trim();

    const [workers] = instance_key
      ? await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers WHERE instance_key = :instance_key ORDER BY created_at DESC`,
        { instance_key }
      )
      : await database.query(
        `SELECT * FROM ${database.getTablePrefix()}workers ORDER BY created_at DESC`
      );
    
    return res.json( {metadata: {status: 'SUCCESSFUL'}, data: workers} );
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to fetch workers!', { error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch workers!'}} });
  }
});

app.get('/logs', authMiddleware(), async (req, res) => {
  try {
    const log_key = (req.query.log_key || req.body.log_key || '').trim();

    // If log_key provided, fetch only that log and return as object (not array)
    if (log_key) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}logs WHERE \`key\` = :key LIMIT 1`,
        { key: log_key }
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Log not found!'}} });
      }

      const log = (rows as any[])[0];

      return res.json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(log) });
    }

    const defaultLimit = 25;
    const rawLimit = req.query.limit;
    const rawPage = req.query.page;
    const instance_key = (req.query.instance_key || req.body.instance_key || '').trim();
    const worker_key = (req.query.worker_key || req.body.worker_key || '').trim();
    const job_key = (req.query.job_key || req.body.job_key || '').trim();
    const output_key = (req.query.output_key || req.body.output_key || '').trim();
    const notification_key = (req.query.notification_key || req.body.notification_key || '').trim();
    const type = (req.query.type || req.body.type || '').trim();
    const q = req.query.q ? String(req.query.q).trim() : '';

    let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
    if (isNaN(limit) || limit < 1) limit = defaultLimit;

    let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    const offset = (page - 1) * limit;

    // Build WHERE clause for search
    let whereClause = '';
    const params: any = { limit, offset };

    if (type) {
      whereClause += (whereClause ? ' AND ' : '') + 'type = :type';
      params.type = type;
    }

    if (instance_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'instance_key = :instance_key';
      params.instance_key = instance_key;
    }

    if (worker_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'worker_key = :worker_key';
      params.worker_key = worker_key;
    }

    if (job_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'job_key = :job_key';
      params.job_key = job_key;
    }

    if (output_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'output_key = :output_key';
      params.output_key = output_key;
    }

    if (notification_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'notification_key = :notification_key';
      params.notification_key = notification_key;
    }

    if (q) {
      const searchPattern = `%${q}%`;
      whereClause += (whereClause ? ' AND ' : '') + `(\`key\` LIKE :search OR instance_key LIKE :search OR worker_key LIKE :search OR job_key LIKE :search OR message LIKE :search OR params LIKE :search)`;
      params.search = searchPattern;
    }

    if(whereClause) whereClause = ' WHERE ' + whereClause;

    // Get total count for pagination metadata
    const [[{ total }]] = await database.query(
      `SELECT COUNT(*) as total FROM ${database.getTablePrefix()}logs${whereClause}`,
      { ...params }
    ) as any;

    // Get paginated data
    const [rawRows] = await database.query(
      `SELECT * FROM ${database.getTablePrefix()}logs${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
      { ...params }
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
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to fetch logs!', { error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch logs!'}} });
  }
});

app.delete('/logs/all', authMiddleware(), async (req, res) => {
  try {
    await database.execute(`DELETE FROM ${database.getTablePrefix()}logs`);
    return res.json({ metadata: {status: 'SUCCESSFUL'}, message: 'All logs deleted successfully!' });
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to delete logs!', { error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete logs!'}} });
  }
});

app.get('/jobs', authMiddleware(), async (req, res) => {
  try {
    const job_key = (req.query.job_key || req.body.job_key || '').trim();

    // If job_key provided, fetch only that job and return as object (not array)
    if (job_key) {
      const [rows] = await database.query(
        `SELECT * FROM ${database.getTablePrefix()}jobs WHERE \`key\` = :key LIMIT 1`,
        { key: job_key }
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
    const instance_key = (req.query.instance_key || req.body.instance_key || '').trim();
    const worker_key = (req.query.worker_key || req.body.worker_key || '').trim();
    const status = (req.query.status || req.body.status || '').trim();
    const q = req.query.q ? String(req.query.q).trim() : '';

    let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
    if (isNaN(limit) || limit < 1) limit = defaultLimit;

    let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    const offset = (page - 1) * limit;

    // Build WHERE clause for search
    let whereClause = '';
    const params: any = { limit, offset };

    if (instance_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'instance_key = :instance_key';
      params.instance_key = instance_key;
    }

    if (worker_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'worker_key = :worker_key';
      params.worker_key = worker_key;
    }

    if (status) {
      whereClause += (whereClause ? ' AND ' : '') + 'status = :status';
      params.status = status;
    }

    if (q) {
      const searchPattern = `%${q}%`;
      whereClause += (whereClause ? ' AND ' : '') + `(\`key\` LIKE :search OR input LIKE :search OR destination LIKE :search OR notification LIKE :search OR metadata LIKE :search)`;
      params.search = searchPattern;
    }

    if(whereClause) whereClause = ' WHERE ' + whereClause;

    // Get total count for pagination metadata
    const [[{ total }]] = await database.query(
      `SELECT COUNT(*) as total FROM ${database.getTablePrefix()}jobs${whereClause}`,
      { ...params }
    ) as any;

    // Get paginated data
    const [rawRows] = await database.query(
      `SELECT * FROM ${database.getTablePrefix()}jobs${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
      { ...params }
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
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to fetch jobs!', { error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch jobs!'}} });
  }
});

app.put('/jobs', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const body = req.body as CreateJobRequest;

  if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
    return res.status(400).json({ metadata: { status: 'ERROR', error: {code: 'REQUEST_INVALID', message: 'Require input and outputs[]!'} } });
  }

  try {
    const job_key = uukey();
    const priority = body.priority ?? 1000; // Default priority is 1000
    const now = getNow();

    const outputs = [];
    for (let index = 0; index < body.outputs.length; index++) {
      const output: OutputSpec = body.outputs[index];
      outputs.push({ key: uukey(), job_key, index, specs: output, status: 'PENDING', updated_at: now, created_at: now, outcome: null });
    }

    if (outputs.length === 0) {
      return res.status(400).json({ metadata: { status: 'ERROR', error: {code: 'REQUEST_INVALID', message: 'At least one output specification is required!'} } });
    }

    if (body.notification){
      if (body.notification.events && Array.isArray(body.notification.events)) {
        const allowedEvents = config.notifications.events_allowed.split(",").map(e => e.trim());

        body.notification.events = body.notification.events.filter((event:string) =>
          allowedEvents.includes(event)
        );
      }
    }

    const job = { 
      key: job_key,
      priority: priority,
      input: body.input ? body.input : null,
      outputs: outputs ? outputs : null,
      destination: body.destination ? body.destination : null,
      notification: body.notification ? body.notification : null,
      metadata: body.metadata ? body.metadata : null,
      status: 'RECEIVED',
      updated_at: now,
      created_at: now,
    };

    await logger.insert('INFO', 'Job request received!', { job_key });

    await database.execute(
      `INSERT INTO ${database.getTablePrefix()}jobs (\`key\`, priority, input, outputs, destination, notification, metadata, status, updated_at, created_at) VALUES (:key, :priority, :input, :outputs, :destination, :notification, :metadata, :status, :updated_at, :created_at)`,
      {
        ...job,
        input: job.input ? JSON.stringify(job.input) : null,
        outputs: job.outputs ? JSON.stringify(job.outputs) : null,
        destination: job.destination ? JSON.stringify(job.destination) : null,
        notification: job.notification ? JSON.stringify(job.notification) : null,
        metadata: job.metadata ? JSON.stringify(job.metadata) : null,
        status: 'PENDING'
      }
    );

    if (job.notification) await createJobNotification('RECEIVED', job);

    await logger.insert('INFO', 'Job successfully created!', { job_key });

    /* JOB: QUEUED: INSERT */
    const databaseConn = await database.getConnection();

    try {
      if (databaseConn.beginTransaction) await databaseConn.beginTransaction();

      await database.execute(
        `INSERT INTO ${database.getTablePrefix()}jobs_queue (\`key\`, priority, created_at) VALUES (:key, :priority, :created_at)`,
        { ...job }
      );

      await database.execute(
        `UPDATE ${database.getTablePrefix()}jobs SET status = :status WHERE \`key\` = :key`,
        { ...job, status: 'QUEUED' }
      );

      job.status = 'QUEUED';

      if (databaseConn.commit) await databaseConn.commit();

      if (job.notification) await createJobNotification('QUEUED', job);

      await logger.insert('INFO', 'Job successfully queued!', { job_key });
    } catch (error: Error | any) {
      if (databaseConn.rollback) await databaseConn.rollback();
      await logger.insert('ERROR', 'Create job queue failed!', { job_key, error });
    } finally {
      if (databaseConn.release) databaseConn.release();
    }

    return res.status(202).json({ metadata: {status: 'SUCCESSFUL'}, data: sanitizeData(job) });
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Create job failed!', { error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Unknown error occurred!'}} });
  }
});

app.delete('/jobs', authMiddleware({ forceAuth: !!config.api.key }), async (req: Request, res: Response) => {
  const job_key = (req.query.job_key || req.body.job_key || '').trim();
  
  if(job_key) {
    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs SET status = 'DELETED' WHERE \`key\` = :key`,
      { key: job_key }
    );
  }
  
  return res.status(204).json({ metadata: {status: 'SUCCESSFUL'} });
});

app.get('/jobs/preview', authMiddleware(), async (req: Request, res: Response) => {
  const job_key = (req.query.job_key || req.body.job_key || '').trim();

  const fallbackImagePath = path.join('.', 'public', 'assets', 'images', 'no-preview.webp');
  
  const serveFallbackImage = () => {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.resolve(fallbackImagePath));
  };
  
  try {
    if(job_key){
      // Check if job exists
      const [rows] = await database.query(`SELECT * FROM ${database.getTablePrefix()}jobs WHERE \`key\` = :key`, { key: job_key });
      
      if ((rows as any[]).length === 0) {
        return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Job not found!'}} });
      }

      try {
        // Try to read via storage facade; if missing, fall back to placeholder
        const exists = await storage.exists(`/jobs/${job_key}/preview.${config.jobs.preview.format.toLowerCase()}`);
        if (!exists) return serveFallbackImage();
        const buffer = await storage.read(`/jobs/${job_key}/preview.${config.jobs.preview.format.toLowerCase()}`);
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.send(buffer);
      } catch (error: Error | any) {
        
      }
    }

    return serveFallbackImage();
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Error serving preview image!', { job_key, error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Error serving preview image!'}} });
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
    const instance_key = (req.query.instance_key || req.body.instance_key || '').trim();
    const worker_key = (req.query.worker_key || req.body.worker_key || '').trim();
    const job_key = (req.query.job_key || req.body.job_key || '').trim();
    const event = (req.query.event || req.body.event || '').trim();
    const status = (req.query.status || req.body.status || '').trim();
    const q = req.query.q ? String(req.query.q).trim() : '';

    let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
    if (isNaN(limit) || limit < 1) limit = defaultLimit;

    let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    const offset = (page - 1) * limit;

    // Build WHERE clause for search
    let whereClause = '';
    const params: any = { limit, offset };

    if (instance_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'instance_key = :instance_key';
      params.instance_key = instance_key;
    }

    if (worker_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'worker_key = :worker_key';
      params.worker_key = worker_key;
    }

    if (job_key) {
      whereClause += (whereClause ? ' AND ' : '') + 'job_key = :job_key';
      params.job_key = job_key;
    }

    if (event) {
      whereClause += (whereClause ? ' AND ' : '') + 'event = :event';
      params.event = event;
    }

    if (status) {
      whereClause += (whereClause ? ' AND ' : '') + 'status = :status';
      params.status = status;
    }

    if (q) {
      const searchPattern = `%${q}%`;
      whereClause += (whereClause ? ' AND ' : '') + `(\`key\` LIKE :search OR payload LIKE :search OR outcome LIKE :search)`;
      params.search = searchPattern;
    }

    if(whereClause) whereClause = ' WHERE ' + whereClause;

    // Get total count for pagination metadata
    const [[{ total }]] = await database.query(
      `SELECT COUNT(*) as total FROM ${database.getTablePrefix()}jobs_notifications${whereClause}`,
      { ...params }
    ) as any;

    // Get paginated data
    const [rawRows] = await database.query(
      `SELECT * FROM ${database.getTablePrefix()}jobs_notifications${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
      { ...params }
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
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to fetch job notifications!', { error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch job notifications!'}} });
  }
});

app.post('/jobs/notifications/retry', authMiddleware(), async (req, res) => {
  try {
    const notification_key = (req.query.notification_key || req.body.notification_key || '').trim();

    if (!notification_key) {
      return res.status(400).json({ metadata: {status: 'ERROR', error: {code: 'NOTIFICATION_KEY_REQUIRED', message: 'Notification key required!'}} });
    }

    const [rows] = await database.query(
      `SELECT * FROM ${database.getTablePrefix()}jobs_notifications WHERE \`key\` = :key LIMIT 1`,
      { key: notification_key }
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ metadata: {status: 'ERROR', error: {code: 'NOT_FOUND', message: 'Notification not found!'}} });
    }

    // Reset notification status to PENDING for retry
    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs_notifications SET status = 'PENDING', retry_at = :now, updated_at = :now WHERE \`key\` = :key`,
      { key: notification_key, now: getNow() }
    );

    return res.json({ metadata: {status: 'SUCCESSFUL'}, message: 'Notification successfully rescheduled!' });
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to fetch job notifications!', { error });
    return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch job notifications!'}} });
  }
});

const clientPath = path.join(dirname(fileURLToPath(import.meta.url)), "../../client-build");
app.use(express.static(clientPath));
app.get("/*", (req: Request, res: Response) => res.sendFile(path.join(clientPath, "index.html")));

app.use((error: any, req: any, res: any, _next: any) => {
  logger.insert('ERROR', 'An error occurred on API service!', { error });
  return res.status(500).json({ metadata: {status: 'ERROR', error: {code: 'INTERNAL_ERROR', message: 'An error occurred on API service!'}} });
});

export async function startApiService(instance_key: string) {
  logger.insert('INFO', 'Starting API service on :port...', { instance_key, port: config.port });

  if (!instance_key) {
    await logger.insert('ERROR', 'Instance key required!');
    throw new Error('Instance key required!');
  }

  logger.setMetadata({ instance_key });
  await storage.config(config.storage);
  database.config(config.database);

  // SERVER: START
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, () => {
      logger.insert('INFO', 'API service started successfully on :port!', { port: config.port });
      resolve(server);
    }).on('error', (error: Error | any) => {
      logger.insert('ERROR', 'Failed to start API service!', { error });
      reject(error);
    });
  });
}
