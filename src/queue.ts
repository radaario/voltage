import { pool } from './db.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';

// Database prefix helper — append '_' only when a prefix is configured
const dbPrefix = config.db.prefix ? `${config.db.prefix}_` : '';

export async function enqueueJob(jobKey: string, priority: number = 1000): Promise<void> {
  const queueKey = uuidv4();
  await pool.execute(
    `INSERT INTO ${dbPrefix}queue_jobs (\`key\`, job_key, priority, visibility_timeout, available_at) VALUES (:key, :jobKey, :priority, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { key: queueKey, jobKey, priority }
  );
}

export type Dequeued = { queueKey: string; jobKey: string } | null;

export async function dequeueJob(workerId: string): Promise<Dequeued> {
  const conn = await pool.getConnection();
  try {
    if (conn.beginTransaction) await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT \`key\`, job_key FROM ${dbPrefix}queue_jobs
       WHERE available_at <= CURRENT_TIMESTAMP AND visibility_timeout <= CURRENT_TIMESTAMP
       ORDER BY priority ASC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );
    const records = rows as Array<{ key: string; job_key: string }>;
    if (records.length === 0) {
      if (conn.commit) await conn.commit();
      return null;
    }
    const record = records[0];
    const vtSeconds = Math.ceil(config.jobs.visibilityTimeout / 1000);
    await conn.execute(
      `UPDATE ${dbPrefix}queue_jobs SET locked_by = :workerId, locked_at = CURRENT_TIMESTAMP, attempts = attempts + 1,
        visibility_timeout = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL :vt SECOND)
       WHERE \`key\` = :key`,
      { workerId, vt: vtSeconds, key: record.key }
    );
    if (conn.commit) await conn.commit();
    return { queueKey: record.key, jobKey: record.job_key };
  } catch (err) {
    if (conn.rollback) await conn.rollback();
    logger.error({ err }, 'dequeue failed');
    throw err;
  } finally {
    if (conn.release) conn.release();
  }
}

export async function deleteQueueItem(queueKey: string): Promise<void> {
  await pool.execute(`DELETE FROM ${dbPrefix}queue_jobs WHERE \`key\` = :key`, { key: queueKey });
}

export async function extendVisibility(queueKey: string): Promise<void> {
  const vtSeconds = Math.ceil(config.jobs.visibilityTimeout / 1000);
  await pool.execute(
    `UPDATE ${dbPrefix}queue_jobs SET visibility_timeout = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL :vt SECOND) WHERE \`key\` = :key`,
    { vt: vtSeconds, key: queueKey }
  );
}

