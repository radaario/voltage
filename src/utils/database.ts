
import { logger } from './logger.js';

import DatabaseDriver from 'better-sqlite3';
import mysql from 'mysql2/promise';
import pg from 'pg';
import mssql from 'mssql';

const { Pool: PgPool } = pg;

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

class Database {
  private _config: any = null;
  private _dbPool: DbPool | null = null;

  config(cfg: any) {
    this._config = cfg;
    this._dbPool = this.createDatabasePool();
  }

  get dbPool(): DbPool {
    if (!this._dbPool) throw new Error('Database not configured. Call database.config(config.database) first.');
    return this._dbPool;
  }

  getTablePrefix(): string {
    if (!this._config) throw new Error('Database not configured.');
    const raw = this._config.table_prefix;
    if (!raw) return '';
    return raw.replace(/[-_]/g, '') + '_';
  }

  async query(sql: string, params?: Record<string, any>) {
    return this.dbPool.query(sql, params);
  }

  async execute(sql: string, params?: Record<string, any>) {
    return this.dbPool.execute(sql, params);
  }

  async getConnection() {
    return this.dbPool.getConnection();
  }

  async verifySchemaExists() {
    logger.console('INFO', 'Ensuring database schema exists...', { type: this._config.type?.toUpperCase() });
    const conn = await this.dbPool.getConnection();
    
    try {
      if (conn.beginTransaction) await conn.beginTransaction();

      await conn.execute(`CREATE TABLE IF NOT EXISTS ${this.getTablePrefix()}instances (
        \`key\` CHAR(40) PRIMARY KEY,
        type ENUM('MASTER','SLAVE') NOT NULL DEFAULT 'SLAVE',
        specs JSON NOT NULL,
        status ENUM('RUNNING','EXITED') NOT NULL DEFAULT 'RUNNING',
        restart_count INT NOT NULL DEFAULT 0,
        workers_running_count INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        outcome JSON NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

      await conn.execute(`CREATE TABLE IF NOT EXISTS ${this.getTablePrefix()}workers (
        \`key\` CHAR(40) PRIMARY KEY,
        instance_key CHAR(40) NOT NULL,
        job_key CHAR(40) NOT NULL,
        status ENUM('RUNNING','EXITED') NOT NULL DEFAULT 'RUNNING',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        outcome JSON NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

      // FOREIGN KEY (job_key) REFERENCES ${this.getTablePrefix()}jobs(\`key\`) ON DELETE CASCADE

      await conn.execute(`CREATE TABLE IF NOT EXISTS ${this.getTablePrefix()}logs (
        \`key\` CHAR(40) PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        instance_key CHAR(40) NULL,
        worker_key CHAR(40) NULL,
        job_key CHAR(40) NULL,
        output_key CHAR(40) NULL,
        notification_key CHAR(40) NULL,
        message VARCHAR(1024) NOT NULL,
        metadata JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

      await conn.execute(`CREATE TABLE IF NOT EXISTS ${this.getTablePrefix()}jobs (
        \`key\` CHAR(40) PRIMARY KEY,
        instance_key CHAR(40) NULL,
        worker_key CHAR(40) NULL,
        priority INT NOT NULL DEFAULT 1000,
        input JSON NOT NULL,
        outputs JSON NOT NULL,
        destination JSON NULL,
        notification JSON NULL,
        metadata JSON NULL,
        status ENUM('RECEIVED','PENDING', 'RETRYING','QUEUED','DOWNLOADING','ANALYZING','ENCODING','UPLOADING','COMPLETED','CANCELLED','FAILED') NOT NULL DEFAULT 'RECEIVED',
        progress DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        outcome JSON NULL,
        try_max INT NOT NULL DEFAULT 0,
        try_count INT NOT NULL DEFAULT 0,
        retry_in INT NULL,
        retry_at TIMESTAMP NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

      await conn.execute(`CREATE TABLE IF NOT EXISTS ${this.getTablePrefix()}jobs_queue (
        \`key\` CHAR(40) PRIMARY KEY,
        priority INT NOT NULL DEFAULT 1000,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (priority),
        FOREIGN KEY (\`key\`) REFERENCES ${this.getTablePrefix()}jobs(\`key\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

      // instance_key CHAR(40) NULL,
      // worker_key CHAR(40) NULL,

      await conn.execute(`CREATE TABLE IF NOT EXISTS ${this.getTablePrefix()}jobs_notifications (
        \`key\` CHAR(40) PRIMARY KEY,
        instance_key CHAR(40) NULL,
        worker_key CHAR(40) NULL,
        job_key CHAR(40) NOT NULL,
        event VARCHAR(255) NOT NULL,
        priority INT NOT NULL DEFAULT 1000,
        specs JSON NOT NULL,
        payload JSON NOT NULL,
        status ENUM('PENDING','SUCCESSFUL','SKIPPED','FAILED') NOT NULL DEFAULT 'PENDING',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        outcome JSON NULL,
        retry_max INT NOT NULL DEFAULT 0,
        retry_count INT NOT NULL DEFAULT 0,
        retry_in INT NULL,
        retry_at TIMESTAMP NULL,
        FOREIGN KEY (job_key) REFERENCES ${this.getTablePrefix()}jobs(\`key\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

      if (this._config.type?.toUpperCase() === 'SQLITE') {
        // await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${this.getTablePrefix()}workers_job_key ON ${this.getTablePrefix()}workers(job_key);`);
        await conn.execute(`CREATE INDEX IF NOT EXISTS idx_${this.getTablePrefix()}jobs_queue_priority ON ${this.getTablePrefix()}jobs_queue(priority);`);
      }

      if (conn.commit) await conn.commit();
    } catch (error: Error | any) {
      if (conn.rollback) await conn.rollback();
      throw error;
    } finally {
      if (conn.release) conn.release();
    }
  }

  private createDatabasePool(): DbPool {
    const type = this._config.type.toUpperCase();
    switch (type) {
      case 'SQLITE':
        return this.createSQLitePool();
      case 'MYSQL':
      case 'MARIADB':
        return this.createMySQLPool();
      case 'POSTGRESQL':
      case 'AWS_REDSHIFT':
      case 'COCKROACHDB':
        return this.createPostgreSQLPool();
      case 'MSSQL':
        return this.createMSSQLPool();
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  private createSQLitePool(): DbPool {
    const db = new DatabaseDriver(this._config.file_name ?? './db.sqlite');
    db.pragma('journal_mode = WAL');
    // ...existing code for convertSQLForSQLite and convertParamsForSQLite...
    const convertSQLForSQLite = (sql: string): string => {
      const CT_PLACEHOLDER = '__CT_PLACEHOLDER__';
      let converted = sql
        .replace(/CURRENT_TIMESTAMP/g, CT_PLACEHOLDER)
        .replace(/`/g, '"')
        .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g, '')
        .replace(/FOR UPDATE SKIP LOCKED/g, '')
        .replace(/CHAR\(40\)/g, 'TEXT')
        .replace(/VARCHAR\((\d+)\)/g, 'TEXT')
        .replace(/INT(?!\w)/g, 'INTEGER')
        .replace(/TIMESTAMP/g, 'TEXT')
        .replace(/JSON/g, 'TEXT')
        .replace(/TEXT NULL/g, 'TEXT')
        .replace(/ENUM\([^)]+\)/g, 'TEXT');
      converted = converted
        .replace(new RegExp(CT_PLACEHOLDER + ' ON UPDATE ' + CT_PLACEHOLDER, 'g'), 'CURRENT_TIMESTAMP')
        .replace(/DATE_ADD\(__CT_PLACEHOLDER__, INTERVAL (\d+) SECOND\)/g, "datetime('now', '+$1 seconds')")
        .replace(new RegExp(CT_PLACEHOLDER, 'g'), 'CURRENT_TIMESTAMP');
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
        } catch (error: Error | any) {
          logger.console('ERROR', 'SQLite query error', { sql: finalSql, params: paramArray, error });
          throw error;
        }
      },
      async execute(sql: string, params?: Record<string, any>): Promise<any> {
        const convertedSql = convertSQLForSQLite(sql);
        const [finalSql, paramArray] = convertParamsForSQLite(convertedSql, params);
        try {
          const stmt = db.prepare(finalSql);
          const result = stmt.run(...paramArray);
          return result;
        } catch (error: Error | any) {
          logger.console('ERROR', 'SQLite execute error', { sql: finalSql, params: paramArray, error });
          throw error;
        }
      },
      async getConnection(): Promise<DbConnection> {
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
          release() {}
        };
      }
    };
    return sqlitePool;
  }

  private createMySQLPool(): DbPool {
    const mysqlPool = mysql.createPool({
      host: this._config.host,
      port: this._config.port,
      user: this._config.username,
      password: this._config.password,
      database: this._config.name,
      connectionLimit: 10,
      namedPlaceholders: true,
      timezone: this._config.timezone ?? undefined
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

  private createPostgreSQLPool(): DbPool {
    const pgPool = new PgPool({
      host: this._config.host,
      port: this._config.port,
      user: this._config.username,
      password: this._config.password,
      database: this._config.name,
      max: 10
    });
    if (this._config.timezone) {
      try {
        // @ts-ignore
        pgPool.on('connect', (client: any) => {
          client.query(`SET TIME ZONE '${this._config.timezone}'`).catch((error: any) => {
            logger.console('ERROR', 'Failed to set Postgres session timezone', { timezone: this._config.timezone, error });
          });
        });
      } catch (error: Error | any) {
        logger.console('ERROR', 'Failed to register Postgres connect handler for timezone', { timezone: this._config.timezone, error });
      }
    }
    const convertSQLForPostgreSQL = (sql: string): string => {
      return sql
        .replace(/`/g, '"')
        .replace(/ENUM\(([^)]+)\)/g, 'VARCHAR(255) CHECK (value IN ($1))')
        .replace(/CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/g, 'CURRENT_TIMESTAMP')
        .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g, '')
        .replace(/CHAR\(40\)/g, 'VARCHAR(40)')
        .replace(/DATE_ADD\(CURRENT_TIMESTAMP, INTERVAL :(\w+) SECOND\)/g, "CURRENT_TIMESTAMP + INTERVAL '$1 seconds'")
        .replace(/FOR UPDATE SKIP LOCKED/g, 'FOR UPDATE SKIP LOCKED');
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
    const outerConfig = this._config;
    const pool: DbPool = {
      async query(sql: string, params?: Record<string, any>): Promise<[any[], any]> {
        const convertedSql = convertSQLForPostgreSQL(sql);
        const [finalSql, paramArray] = convertParamsForPostgreSQL(convertedSql, params);
        try {
          const result = await pgPool.query(finalSql, paramArray);
          return [result.rows, result];
        } catch (error: Error | any) {
          logger.console('ERROR', 'PostgreSQL query error', { sql: finalSql, params: paramArray, error });
          throw error;
        }
      },
      async execute(sql: string, params?: Record<string, any>): Promise<any> {
        const convertedSql = convertSQLForPostgreSQL(sql);
        const [finalSql, paramArray] = convertParamsForPostgreSQL(convertedSql, params);
        try {
          const result = await pgPool.query(finalSql, paramArray);
          return result;
        } catch (error: Error | any) {
          logger.console('ERROR', 'PostgreSQL execute error', { sql: finalSql, params: paramArray, error });
          throw error;
        }
      },
      async getConnection(): Promise<DbConnection> {
        const client = await pgPool.connect();
        if (outerConfig.timezone) {
          try {
            await client.query(`SET TIME ZONE '${outerConfig.timezone}'`);
          } catch (error: Error | any) {
            logger.console('ERROR', 'Failed to set timezone on Postgres connection', { timezone: outerConfig.timezone, error });
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

  private createMSSQLPool(): DbPool {
    const poolConfig: mssql.config = {
      server: this._config.host,
      port: this._config.port,
      user: this._config.username,
      password: this._config.password,
      database: this._config.name,
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
    mssqlPool.connect().catch((error: any) => {
      logger.console('ERROR', 'MSSQL connection failed', { error });
    });
    if (this._config.timezone) {
      logger.console('WARN', 'MSSQL does not support setting a session timezone; config.timezone will be ignored for MSSQL connections', { timezone: this._config.timezone });
    }
    const convertSQLForMSSQL = (sql: string): string => {
      return sql
        .replace(/`/g, '')
        .replace(/ENUM\([^)]+\)/g, 'VARCHAR(255)')
        .replace(/CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/g, 'CURRENT_TIMESTAMP')
        .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g, '')
        .replace(/CHAR\(40\)/g, 'VARCHAR(40)')
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
        } catch (error: Error | any) {
          logger.console('ERROR', 'MSSQL query error', { sql: finalSql, params: finalParams, error });
          throw error;
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
        } catch (error: Error | any) {
          logger.console('ERROR', 'MSSQL execute error', { sql: finalSql, params: finalParams, error });
          throw error;
        }
      },
      async getConnection(): Promise<DbConnection> {
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
          async commit() {},
          async rollback() {},
          release() {}
        };
      }
    };
    return pool;
  }
}

export const database = new Database();
