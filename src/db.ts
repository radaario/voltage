import { config } from './config.js';
import { logger } from './logger.js';
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import pg from 'pg';
import mssql from 'mssql';

const { Pool: PgPool } = pg;

// Database prefix helper — append '_' only when a prefix is configured
const dbPrefix = config.db.prefix ? `${config.db.prefix}_` : '';

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

let dbPool: DbPool;

// Initialize database pool based on config.db.kind
function createDatabasePool(): DbPool {
  const kind = config.db.kind;
  
  switch (kind) {
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
      throw new Error(`Unsupported database kind: ${kind}`);
  }
}

// SQLite implementation
function createSQLitePool(): DbPool {
  const filename = (config.db as any).filename ?? './db.sqlite';
  const db = new Database(filename);
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
      } catch (err: any) {
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
      } catch (err: any) {
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
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    connectionLimit: 10,
    namedPlaceholders: true
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
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    max: 10
  });
  
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
      } catch (err: any) {
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
      } catch (err: any) {
        logger.error({ err, sql: finalSql, params: paramArray }, 'PostgreSQL execute error');
        throw err;
      }
    },
    
    async getConnection(): Promise<DbConnection> {
      const client = await pgPool.connect();
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
    server: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
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
      } catch (err: any) {
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
      } catch (err: any) {
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
export const pool: DbPool = createDatabasePool();
dbPool = pool;

export async function initDb(): Promise<void> {
  logger.info({ dbKind: config.db.kind }, 'Ensuring database schema exists');
  const conn = await pool.getConnection();
  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    // Instances table: track running instances/pods of this application
    await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbPrefix}instances (
      instance_key VARCHAR(255) PRIMARY KEY,
      cpu_core_count INT NOT NULL DEFAULT 0,
      memory_total INT NOT NULL DEFAULT 0,
      memory_free INT NOT NULL DEFAULT 0,
      workers_per_cpu_core INT NOT NULL DEFAULT 0,
      workers_max INT NOT NULL DEFAULT 0,
      workers_running_count INT NOT NULL DEFAULT 0,
      status ENUM('RUNNING','EXITED') NOT NULL DEFAULT 'RUNNING',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      exit_code INT NULL,
      exit_signal VARCHAR(50) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    // Workers table: persist information about active workers so the cluster
    // can observe worker state across instances instead of relying on in-memory maps.
    await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbPrefix}workers (
      worker_key CHAR(36) PRIMARY KEY,
      job_key CHAR(36) NOT NULL,
      pid INT NULL,
      instance_key VARCHAR(255) NULL,
      status ENUM('RUNNING','EXITED') NOT NULL DEFAULT 'RUNNING',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      exit_code INT NULL,
      exit_signal VARCHAR(50) NULL,
      FOREIGN KEY (job_key) REFERENCES ${dbPrefix}jobs(\`key\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    
    await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbPrefix}jobs (
      \`key\` CHAR(36) PRIMARY KEY,
      metadata JSON NULL,
      input JSON NOT NULL,
      input_metadata JSON NULL,
      destination JSON NULL,
      notification JSON NULL,
      status ENUM('QUEUED','PENDING','DOWNLOADING','ANALYZING','ENCODING','UPLOADING','COMPLETED','CANCELLED','FAILED') NOT NULL DEFAULT 'QUEUED',
      priority INT NOT NULL DEFAULT 1000,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      error JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbPrefix}job_outputs (
      \`key\` CHAR(36) PRIMARY KEY,
      job_key CHAR(36) NOT NULL,
      output_index INT NOT NULL,
      spec_json JSON NOT NULL,
      status ENUM('PENDING','ENCODING','UPLOADING','COMPLETED','CANCELLED','FAILED') NOT NULL DEFAULT 'PENDING',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      result_json JSON NULL,
      error JSON NULL,
      FOREIGN KEY (job_key) REFERENCES ${dbPrefix}jobs(\`key\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS ${dbPrefix}queue_jobs (
      \`key\` CHAR(36) PRIMARY KEY,
      job_key CHAR(36) NOT NULL,
      priority INT NOT NULL DEFAULT 1000,
      visibility_timeout TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_by VARCHAR(255) NULL,
      locked_at TIMESTAMP NULL,
      attempts INT NOT NULL DEFAULT 0,
      available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (available_at),
      INDEX (visibility_timeout),
      INDEX (priority),
      FOREIGN KEY (job_key) REFERENCES ${dbPrefix}jobs(\`key\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    // Index to quickly find workers by job_key
    if (config.db.kind === 'SQLITE') {
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbPrefix}workers_job_key ON ${dbPrefix}workers(job_key);`);
    }
    
    // Create indexes separately for SQLite (MySQL ignores IF NOT EXISTS for indexes in tables)
    if (config.db.kind === 'SQLITE') {
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbPrefix}queue_jobs_available_at ON ${dbPrefix}queue_jobs(available_at);`);
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbPrefix}queue_jobs_visibility_timeout ON ${dbPrefix}queue_jobs(visibility_timeout);`);
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${dbPrefix}queue_jobs_priority ON ${dbPrefix}queue_jobs(priority);`);
    }
    
    if (conn.commit) await conn.commit();
  } catch (err) {
    if (conn.rollback) await conn.rollback();
    throw err;
  } finally {
    if (conn.release) conn.release();
  }
}
