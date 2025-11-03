import { config } from '../config/index.js';

// Returns the database prefix with a trailing '_' if needed
export function dbTablePrefix(): string {
  const raw = config.database.table_prefix;
  if (!raw) return '';
  return raw.replace(/[-_]/g, '') + '_';
}

import { logger } from './logger.js';

import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import pg from 'pg';
import mssql from 'mssql';

const { Pool: PgPool } = pg;

// Database interface for unified operations
export interface DbConnection {
  query(sql: string, params?: Record<string, any>): Promise<[any[], any]>;
  execute(sql: string, params?: Record<string, any>): Promise<any>;
  getConnection?(): Promise<DbConnection>;
  beginTransaction?(): Promise<void>;
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
  release?(): void;
}

export interface DbPool extends DbConnection {
  getConnection(): Promise<DbConnection>;
}

// Initialize database pool based on config.database.type
function createDatabasePool(): DbPool {
  const type = config.database.type.toUpperCase();
  
  switch (type) {
    case 'SQLITE':
      return createSQLitePool();
    case 'MYSQL':
    case 'MARIADB':
      return createMySQLPool();
    case 'POSTGRESQL':
    case 'AWS_REDSHIFT':
    case 'COCKROACHDB':
      return createPostgreSQLPool();
    case 'MSSQL':
      return createMSSQLPool();
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}

// SQLite implementation
function createSQLitePool(): DbPool {
  const db = new Database(config.database.file_name ?? './db.sqlite');
  db.pragma('journal_mode = WAL');
  
  const convertSQLForSQLite = (sql: string): string => {
    // Convert MySQL-specific syntax to SQLite
    // Use placeholder to protect CURRENT_TIMESTAMP before type replacements
    // Important: Placeholder must not contain "TIMESTAMP" or it will be replaced too!
    const CT_PLACEHOLDER = '__CT_PLACEHOLDER__';
    
    let converted = sql
      .replace(/CURRENT_TIMESTAMP/g, CT_PLACEHOLDER) // Protect CURRENT_TIMESTAMP
      .replace(/`/g, '"') // Replace backticks with double quotes
      .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g, '')
      .replace(/FOR UPDATE SKIP LOCKED/g, '') // SQLite doesn't support SKIP LOCKED
      .replace(/CHAR\(36\)/g, 'TEXT')
      .replace(/VARCHAR\((\d+)\)/g, 'TEXT')
      .replace(/INT(?!\w)/g, 'INTEGER')
      .replace(/TIMESTAMP/g, 'TEXT') // Now safe to replace TIMESTAMP type
      .replace(/JSON/g, 'TEXT')
      .replace(/TEXT NULL/g, 'TEXT')
      .replace(/ENUM\([^)]+\)/g, 'TEXT');
    
    // Restore CURRENT_TIMESTAMP and handle special cases
    converted = converted
      .replace(new RegExp(CT_PLACEHOLDER + ' ON UPDATE ' + CT_PLACEHOLDER, 'g'), 'CURRENT_TIMESTAMP')
      .replace(/DATE_ADD\(__CT_PLACEHOLDER__, INTERVAL (\d+) SECOND\)/g, "datetime('now', '+$1 seconds')")
      .replace(new RegExp(CT_PLACEHOLDER, 'g'), 'CURRENT_TIMESTAMP');
    
    // Remove inline INDEX declarations (SQLite doesn't support them in CREATE TABLE)
    converted = converted.replace(/,?\s*INDEX\s*\([^)]+\)/gi, '');
    
    return converted;
  };
  
  const convertParamsForSQLite = (sql: string, params?: Record<string, any>): [string, any[]] => {
    if (!params) return [sql, []];
    
    const paramArray: any[] = [];
    const convertedSql = sql.replace(/:(\w+)/g, (match, paramName) => {
      paramArray.push(params[paramName]);
      return '?';
    });
    
    return [convertedSql, paramArray];
  };
  
  const sqlitePool: DbPool = {
    async query(sql: string, params?: Record<string, any>): Promise<[any[], any]> {
      const convertedSql = convertSQLForSQLite(sql);
      const [finalSql, paramArray] = convertParamsForSQLite(convertedSql, params);
      
      try {
        const stmt = db.prepare(finalSql);
        const rows = stmt.all(...paramArray);
        return [rows, null];
      } catch (err: Error | any) {
        logger.error({ err, sql: finalSql, params: paramArray }, 'SQLite query error');
        throw err;
      }
    },
    
    async execute(sql: string, params?: Record<string, any>): Promise<any> {
      const convertedSql = convertSQLForSQLite(sql);
      const [finalSql, paramArray] = convertParamsForSQLite(convertedSql, params);
      
      try {
        const stmt = db.prepare(finalSql);
        const result = stmt.run(...paramArray);
        return result;
      } catch (err: Error | any) {
        logger.error({ err, sql: finalSql, params: paramArray }, 'SQLite execute error');
        throw err;
      }
    },
    
    async getConnection(): Promise<DbConnection> {
      // SQLite doesn't need separate connections, return a wrapped version
      return {
        query: sqlitePool.query,
        execute: sqlitePool.execute,
        async beginTransaction() {
          db.prepare('BEGIN TRANSACTION').run();
        },
        async commit() {
          db.prepare('COMMIT').run();
        },
        async rollback() {
          db.prepare('ROLLBACK').run();
        },
        release() {
          // No-op for SQLite
        }
      };
    }
  };
  
  return sqlitePool;
}

// MySQL/MariaDB implementation
function createMySQLPool(): DbPool {
  const mysqlPool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.username,
    password: config.database.password,
    database: config.database.name,
    connectionLimit: 10,
    namedPlaceholders: true,
    // If config.timezone is set, forward it to the MySQL driver so TIMESTAMP
    // parsing/formatting happens in the requested timezone. mysql2 accepts
    // strings like '+00:00' or named zones depending on the driver/OS.
    timezone: config.timezone ?? undefined
  });
  
  const pool: DbPool = {
    async query(sql: string, params?: Record<string, any>): Promise<[any[], any]> {
      return await mysqlPool.query(sql, params);
    },
    
    async execute(sql: string, params?: Record<string, any>): Promise<any> {
      return await mysqlPool.execute(sql, params);
    },
    
    async getConnection(): Promise<DbConnection> {
      const conn = await mysqlPool.getConnection();
      return {
        query: conn.query.bind(conn),
        execute: conn.execute.bind(conn),
        beginTransaction: conn.beginTransaction.bind(conn),
        commit: conn.commit.bind(conn),
        rollback: conn.rollback.bind(conn),
        release: conn.release.bind(conn)
      };
    }
  };
  
  return pool;
}

// PostgreSQL implementation (also works for AWS Redshift and CockroachDB)
function createPostgreSQLPool(): DbPool {
  const pgPool = new PgPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.username,
    password: config.database.password,
    database: config.database.name,
    max: 10
  });
  // If a timezone is configured, ensure each new client session uses it.
  // We register a connect handler so clients borrowed from the pool have
  // the session timezone set. We also guard calls where necessary.
  if (config.timezone) {
    try {
      // pg.Pool emits 'connect' when a new client is connected
      // Note: types may not include 'on' here but runtime supports it.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      pgPool.on('connect', (client: any) => {
        client.query(`SET TIME ZONE '${config.timezone}'`).catch((err: any) => {
          logger.error({ err, timezone: config.timezone }, 'Failed to set Postgres session timezone');
        });
      });
    } catch (err: Error | any) {
      logger.error({ err, timezone: config.timezone }, 'Failed to register Postgres connect handler for timezone');
    }
  }
  
  const convertSQLForPostgreSQL = (sql: string): string => {
    // Convert MySQL-specific syntax to PostgreSQL
    return sql
      .replace(/`/g, '"') // Replace backticks with double quotes
      .replace(/ENUM\(([^)]+)\)/g, 'VARCHAR(255) CHECK (value IN ($1))')
      .replace(/CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/g, 'CURRENT_TIMESTAMP')
      .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g, '')
      .replace(/CHAR\(36\)/g, 'VARCHAR(36)')
      .replace(/DATE_ADD\(CURRENT_TIMESTAMP, INTERVAL :(\w+) SECOND\)/g, "CURRENT_TIMESTAMP + INTERVAL '$1 seconds'")
      .replace(/FOR UPDATE SKIP LOCKED/g, 'FOR UPDATE SKIP LOCKED'); // PostgreSQL supports this
  };
  
  const convertParamsForPostgreSQL = (sql: string, params?: Record<string, any>): [string, any[]] => {
    if (!params) return [sql, []];
    
    const paramArray: any[] = [];
    const paramMap: Record<string, number> = {};
    
    const convertedSql = sql.replace(/:(\w+)/g, (match, paramName) => {
      if (!paramMap[paramName]) {
        paramArray.push(params[paramName]);
        paramMap[paramName] = paramArray.length;
      }
      return `$${paramMap[paramName]}`;
    });
    
    return [convertedSql, paramArray];
  };
  
  const pool: DbPool = {
    async query(sql: string, params?: Record<string, any>): Promise<[any[], any]> {
      const convertedSql = convertSQLForPostgreSQL(sql);
      const [finalSql, paramArray] = convertParamsForPostgreSQL(convertedSql, params);
      
      try {
        const result = await pgPool.query(finalSql, paramArray);
        return [result.rows, result];
      } catch (err: Error | any) {
        logger.error({ err, sql: finalSql, params: paramArray }, 'PostgreSQL query error');
        throw err;
      }
    },
    
    async execute(sql: string, params?: Record<string, any>): Promise<any> {
      const convertedSql = convertSQLForPostgreSQL(sql);
      const [finalSql, paramArray] = convertParamsForPostgreSQL(convertedSql, params);
      
      try {
        const result = await pgPool.query(finalSql, paramArray);
        return result;
      } catch (err: Error | any) {
        logger.error({ err, sql: finalSql, params: paramArray }, 'PostgreSQL execute error');
        throw err;
      }
    },
    
    async getConnection(): Promise<DbConnection> {
      const client = await pgPool.connect();
      // Ensure session timezone is set for this connection as well. This
      // covers the case where the pool connect handler may not have run or
      // when borrowing an existing connection that needs the session set.
      if (config.timezone) {
        try {
          // Setting timezone per-session
          // Use a template literal but protect from injection by limiting
          // to configured values; we assume config.timezone is trusted here.
          await client.query(`SET TIME ZONE '${config.timezone}'`);
        } catch (err: Error | any) {
          logger.error({ err, timezone: config.timezone }, 'Failed to set timezone on Postgres connection');
        }
      }

      return {
        async query(sql: string, params?: Record<string, any>): Promise<[any[], any]> {
          const convertedSql = convertSQLForPostgreSQL(sql);
          const [finalSql, paramArray] = convertParamsForPostgreSQL(convertedSql, params);
          const result = await client.query(finalSql, paramArray);
          return [result.rows, result];
        },
        async execute(sql: string, params?: Record<string, any>): Promise<any> {
          const convertedSql = convertSQLForPostgreSQL(sql);
          const [finalSql, paramArray] = convertParamsForPostgreSQL(convertedSql, params);
          return await client.query(finalSql, paramArray);
        },
        async beginTransaction() {
          await client.query('BEGIN');
        },
        async commit() {
          await client.query('COMMIT');
        },
        async rollback() {
          await client.query('ROLLBACK');
        },
        release() {
          client.release();
        }
      };
    }
  };
  
  return pool;
}

// MSSQL implementation
function createMSSQLPool(): DbPool {
  const poolConfig: mssql.config = {
    server: config.database.host,
    port: config.database.port,
    user: config.database.username,
    password: config.database.password,
    database: config.database.name,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
  
  const mssqlPool = new mssql.ConnectionPool(poolConfig);
  
  // Connect to the pool
  mssqlPool.connect().catch((err: any) => {
    logger.error({ err }, 'MSSQL connection failed');
  });

  // SQL Server doesn't provide a simple session-level 'SET TIME ZONE' like
  // Postgres or MySQL. If a timezone is configured, log a warning so users
  // know it won't automatically be applied at the connection/session level.
  if (config.timezone) {
    logger.warn({ timezone: config.timezone }, 'MSSQL does not support setting a session timezone; config.timezone will be ignored for MSSQL connections');
  }
  
  const convertSQLForMSSQL = (sql: string): string => {
    // Convert MySQL-specific syntax to MSSQL
    return sql
      .replace(/`/g, '') // Remove backticks
      .replace(/ENUM\([^)]+\)/g, 'VARCHAR(255)')
      .replace(/CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/g, 'CURRENT_TIMESTAMP')
      .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g, '')
      .replace(/CHAR\(36\)/g, 'VARCHAR(36)')
      .replace(/FOR UPDATE SKIP LOCKED/g, 'WITH (ROWLOCK, READPAST)')
      .replace(/DATE_ADD\(CURRENT_TIMESTAMP, INTERVAL :(\w+) SECOND\)/g, "DATEADD(SECOND, @$1, GETDATE())")
      .replace(/AUTO_INCREMENT/g, 'IDENTITY(1,1)')
      .replace(/CURRENT_TIMESTAMP/g, 'GETDATE()');
  };
  
  const convertParamsForMSSQL = (sql: string, params?: Record<string, any>): [string, Record<string, any>] => {
    if (!params) return [sql, {}];
    
    const convertedSql = sql.replace(/:(\w+)/g, '@$1');
    return [convertedSql, params];
  };
  
  const pool: DbPool = {
    async query(sql: string, params?: Record<string, any>): Promise<[any[], any]> {
      const convertedSql = convertSQLForMSSQL(sql);
      const [finalSql, finalParams] = convertParamsForMSSQL(convertedSql, params);
      
      try {
        const request = mssqlPool.request();
        
        if (finalParams) {
          Object.entries(finalParams).forEach(([key, value]) => {
            request.input(key, value);
          });
        }
        
        const result = await request.query(finalSql);
        return [result.recordset || [], result];
      } catch (err: Error | any) {
        logger.error({ err, sql: finalSql, params: finalParams }, 'MSSQL query error');
        throw err;
      }
    },
    
    async execute(sql: string, params?: Record<string, any>): Promise<any> {
      const convertedSql = convertSQLForMSSQL(sql);
      const [finalSql, finalParams] = convertParamsForMSSQL(convertedSql, params);
      
      try {
        const request = mssqlPool.request();
        
        if (finalParams) {
          Object.entries(finalParams).forEach(([key, value]) => {
            request.input(key, value);
          });
        }
        
        const result = await request.query(finalSql);
        return result;
      } catch (err: Error | any) {
        logger.error({ err, sql: finalSql, params: finalParams }, 'MSSQL execute error');
        throw err;
      }
    },
    
    async getConnection(): Promise<DbConnection> {
      // For MSSQL, return a connection from the pool
      return {
        async query(sql: string, params?: Record<string, any>): Promise<[any[], any]> {
          return await pool.query(sql, params);
        },
        async execute(sql: string, params?: Record<string, any>): Promise<any> {
          return await pool.execute(sql, params);
        },
        async beginTransaction() {
          const transaction = new mssql.Transaction(mssqlPool);
          await transaction.begin();
        },
        async commit() {
          // Transaction commit handled separately
        },
        async rollback() {
          // Transaction rollback handled separately
        },
        release() {
          // Pool handles connection release
        }
      };
    }
  };
  
  return pool;
}

// Export the pool
export const dbPool: DbPool = createDatabasePool();

export async function initDb(): Promise<void> {
  logger.info({ dbType: config.database.type.toUpperCase() }, 'Ensuring database schema exists...');
  const conn = await dbPool.getConnection();

  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    // Instances table: track running instances/pods of this application
      await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbTablePrefix()}instances (
      \`key\` VARCHAR(255) PRIMARY KEY,
      type ENUM('MASTER','SLAVE') NOT NULL DEFAULT 'SLAVE',
      specs JSON NOT NULL,
      status ENUM('RUNNING','EXITED') NOT NULL DEFAULT 'RUNNING',
      restart_count INT NOT NULL DEFAULT 0,
      workers_running_count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      outcome JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    // Workers table: persist information about active workers so the cluster
    // can observe worker state across instances instead of relying on in-memory maps.
      await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbTablePrefix()}workers (
      \`key\` CHAR(36) PRIMARY KEY,
      instance_key VARCHAR(255) NULL,
      pid INT NULL,
      job_key CHAR(36) NOT NULL,
      status ENUM('RUNNING','EXITED') NOT NULL DEFAULT 'RUNNING',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      outcome JSON NULL,
      FOREIGN KEY (job_key) REFERENCES ${dbTablePrefix()}jobs(\`key\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbTablePrefix()}jobs (
      \`key\` CHAR(36) PRIMARY KEY,
      priority INT NOT NULL DEFAULT 1000,
      input JSON NOT NULL,
      outputs JSON NOT NULL,
      destination JSON NULL,
      notification JSON NULL,
      metadata JSON NULL,
      status ENUM('QUEUED','PENDING','DOWNLOADING','ANALYZING','ENCODING','UPLOADING','COMPLETED','CANCELLED','FAILED') NOT NULL DEFAULT 'QUEUED',
      progress DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      outcome JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    /*
    await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbTablePrefix()}job_outputs (
      \`key\` CHAR(36) PRIMARY KEY,
      job_key CHAR(36) NOT NULL,
      \`index\` INT NOT NULL,
      specs JSON NOT NULL,
      status ENUM('PENDING','ENCODING','UPLOADING','COMPLETED','CANCELLED','FAILED') NOT NULL DEFAULT 'PENDING',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      result JSON NULL,
      error JSON NULL,
      FOREIGN KEY (job_key) REFERENCES ${dbTablePrefix()}jobs(\`key\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    */

      await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbTablePrefix()}jobs_queue (
      \`key\` CHAR(36) PRIMARY KEY,
      job_key CHAR(36) NOT NULL,
      priority INT NOT NULL DEFAULT 1000,
      visibility_timeout TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_by VARCHAR(255) NULL,
      locked_at TIMESTAMP NULL,
      attempts INT NOT NULL DEFAULT 0,
      available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (priority),
      INDEX (available_at),
      INDEX (visibility_timeout),
      FOREIGN KEY (job_key) REFERENCES ${dbTablePrefix()}jobs(\`key\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    // Index to quickly find workers by job_key
    if (config.database.type.toUpperCase() === 'SQLITE') {
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbTablePrefix()}workers_job_key ON ${dbTablePrefix()}workers(job_key);`);
    }
    
    // Create indexes separately for SQLite (MySQL ignores IF NOT EXISTS for indexes in tables)
    if (config.database.type.toUpperCase() === 'SQLITE') {
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbTablePrefix()}jobs_queue_priority ON ${dbTablePrefix()}jobs_queue(priority);`);
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbTablePrefix()}jobs_queue_available_at ON ${dbTablePrefix()}jobs_queue(available_at);`);
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbTablePrefix()}jobs_queue_visibility_timeout ON ${dbTablePrefix()}jobs_queue(visibility_timeout);`);
    }
    
    if (conn.commit) await conn.commit();
  } catch (err: Error | any) {
    if (conn.rollback) await conn.rollback();
    throw err;
  } finally {
    if (conn.release) conn.release();
  }
}
