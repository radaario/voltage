import { logger } from './logger.js';
import knex, { Knex } from 'knex';

class Database {
  private _config: any = null;
  private _knex: Knex | null = null;

  config(cfg: any) {
    this._config = cfg;
    this._knex = this.createKnexInstance();
  }

  get knex(): Knex {
    if (!this._knex) throw new Error('Database not configured. Call database.config(config.database) first.');
    return this._knex;
  }

  getTablePrefix(): string {
    if (!this._config) throw new Error('Database not configured.');
    const raw = this._config.table_prefix;
    if (!raw) return '';
    return raw.replace(/[-_]/g, '') + '_';
  }

  table(tableName: string) {
    return this.knex(this.getTablePrefix() + tableName);
  }

  async verifySchemaExists() {
    logger.console('INFO', 'Ensuring database schema exists...', { type: this._config.type?.toUpperCase() });

    try {
      const prefix = this.getTablePrefix();

      // Create instances table
      const hasInstances = await this.knex.schema.hasTable(`${prefix}instances`);
      if (!hasInstances) {
        await this.knex.schema.createTable(`${prefix}instances`, (table) => {
          table.string('key', 40).primary();
          table.enum('type', ['MASTER', 'SLAVE']).notNullable().defaultTo('SLAVE');
          table.text('specs').notNullable();
          table.text('outcome').nullable();
          table.enum('status', ['ONLINE', 'OFFLINE']).notNullable().defaultTo('ONLINE');
          table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now());
          table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now());
          table.integer('restart_count').notNullable().defaultTo(0);
        });
      }

      // Create workers table
      const hasWorkers = await this.knex.schema.hasTable(`${prefix}instances_workers`);
      if (!hasWorkers) {
        await this.knex.schema.createTable(`${prefix}instances_workers`, (table) => {
          table.string('key', 40).primary();
          table.integer('index').notNullable().defaultTo(0);
          table.string('instance_key', 40).notNullable();
          table.string('job_key', 40).nullable();
          table.text('outcome').nullable();
          table.enum('status', ['IDLE', 'BUSY', 'TIMEOUT', 'TERMINATED']).notNullable().defaultTo('IDLE');
          table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now());
          table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now());
        });
      }

      // Create logs table
      const hasLogs = await this.knex.schema.hasTable(`${prefix}logs`);
      if (!hasLogs) {
        await this.knex.schema.createTable(`${prefix}logs`, (table) => {
          table.string('key', 40).primary();
          table.string('type', 255).notNullable();
          table.string('instance_key', 40).nullable();
          table.string('worker_key', 40).nullable();
          table.string('job_key', 40).nullable();
          table.string('output_key', 40).nullable();
          table.string('notification_key', 40).nullable();
          table.string('message', 1024).notNullable();
          table.text('metadata').notNullable();
          table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now());
        });
      }

      // Create jobs table
      const hasJobs = await this.knex.schema.hasTable(`${prefix}jobs`);
      if (!hasJobs) {
        await this.knex.schema.createTable(`${prefix}jobs`, (table) => {
          table.string('key', 40).primary();
          table.string('instance_key', 40).nullable();
          table.string('worker_key', 40).nullable();
          table.integer('priority').notNullable().defaultTo(1000);
          table.text('input').notNullable();
          table.text('outputs').notNullable();
          table.text('destination').nullable();
          table.text('notification').nullable();
          table.text('metadata').nullable();
          table.text('outcome').nullable();
          table.enum('status', ['RECEIVED', 'PENDING', 'RETRYING', 'QUEUED', 'STARTED', 'DOWNLOADING', 'ANALYZING', 'PROCESSING', 'UPLOADING', 'COMPLETED', 'CANCELLED', 'FAILED', 'TIMEOUT']).notNullable().defaultTo('RECEIVED');
          table.decimal('progress', 10, 2).notNullable().defaultTo(0.00);
          table.timestamp('started_at').nullable();
          table.timestamp('completed_at').nullable();
          table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now());
          table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now());
          table.string('locked_by', 40).nullable();
          table.integer('try_max').notNullable().defaultTo(0);
          table.integer('try_count').notNullable().defaultTo(0);
          table.integer('retry_in').nullable();
          table.timestamp('retry_at').nullable();
        });
      }

      // Create jobs_queue table
      const hasJobsQueue = await this.knex.schema.hasTable(`${prefix}jobs_queue`);
      if (!hasJobsQueue) {
        await this.knex.schema.createTable(`${prefix}jobs_queue`, (table) => {
          table.string('key', 40).primary();
          table.integer('priority').notNullable().defaultTo(1000);
          table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now());
          table.string('locked_by', 40).nullable();
          // table.index(['priority']);
          table.foreign('key').references('key').inTable(`${prefix}jobs`).onDelete('CASCADE');
        });
      }

      // Create jobs_notifications table
      for (const jobsNotificationsTable of ['jobs_notifications', 'jobs_notifications_queue']) {
        const hasJobsNotifications = await this.knex.schema.hasTable(`${prefix}${jobsNotificationsTable}`);
        if (!hasJobsNotifications) {
          await this.knex.schema.createTable(`${prefix}${jobsNotificationsTable}`, (table) => {
            table.string('key', 40).primary();
            table.string('instance_key', 40).nullable();
            table.string('worker_key', 40).nullable();
            table.string('job_key', 40).notNullable();
            table.integer('priority').notNullable().defaultTo(1000);
            table.text('specs').notNullable();
            table.text('payload').notNullable();
            table.text('outcome').nullable();
            table.enum('status', ['PENDING', 'RETRYING', 'QUEUED', 'SUCCESSFUL', 'SKIPPED', 'FAILED']).notNullable().defaultTo('PENDING');
            table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now());
            table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now());
            table.string('locked_by', 40).nullable();
            table.integer('try_max').notNullable().defaultTo(1);
            table.integer('try_count').notNullable().defaultTo(1);
            table.integer('retry_in').nullable();
            table.timestamp('retry_at').nullable();
            table.foreign('job_key').references('key').inTable(`${prefix}jobs`).onDelete('CASCADE');
          });
        }
      }

      logger.console('INFO', 'Database schema verified successfully!');
    } catch (error: Error | any) {
      logger.console('ERROR', 'Failed to verify database schema!', { error });
      throw error;
    }
  }

  private createKnexInstance(): Knex {
    const type = this._config.type.toUpperCase();
    
    let knexConfig: Knex.Config = {
      client: this.getKnexClient(type),
      useNullAsDefault: type === 'SQLITE',
    };

    switch (type) {
      case 'SQLITE':
        knexConfig.connection = {
          filename: this._config.file_name ?? './db.sqlite',
        };
        break;

      case 'MYSQL':
      case 'MARIADB':
        knexConfig.connection = {
          host: this._config.host,
          port: this._config.port,
          user: this._config.username,
          password: this._config.password,
          database: this._config.name,
          timezone: this._config.timezone || 'UTC',
        };
        knexConfig.pool = { min: 0, max: 10 };
        break;

      case 'POSTGRESQL':
      case 'AWS_REDSHIFT':
      case 'COCKROACHDB':
        knexConfig.connection = {
          host: this._config.host,
          port: this._config.port,
          user: this._config.username,
          password: this._config.password,
          database: this._config.name,
        };
        knexConfig.pool = { min: 0, max: 10 };
        if (this._config.timezone) {
          knexConfig.pool = {
            ...knexConfig.pool,
            afterCreate: (conn: any, done: any) => {
              conn.query(`SET TIME ZONE '${this._config.timezone}'`, (err: any) => {
                if (err) {
                  logger.console('ERROR', 'Failed to set PostgreSQL timezone', { timezone: this._config.timezone, error: err });
                }
                done(err, conn);
              });
            }
          };
        }
        break;

      case 'MSSQL':
        knexConfig.connection = {
          server: this._config.host,
          port: this._config.port,
          user: this._config.username,
          password: this._config.password,
          database: this._config.name,
          options: {
            encrypt: true,
            trustServerCertificate: true,
            enableArithAbort: true,
          },
        };
        knexConfig.pool = { min: 0, max: 10 };
        if (this._config.timezone) {
          logger.console('WARN', 'MSSQL does not support setting a session timezone; config.timezone will be ignored for MSSQL connections', { timezone: this._config.timezone });
        }
        break;

      default:
        throw new Error(`Unsupported database type: ${type}`);
    }

    return knex(knexConfig);
  }

  private getKnexClient(type: string): string {
    switch (type) {
      case 'SQLITE':
        return 'better-sqlite3';
      case 'MYSQL':
      case 'MARIADB':
        return 'mysql2';
      case 'POSTGRESQL':
      case 'AWS_REDSHIFT':
      case 'COCKROACHDB':
        return 'pg';
      case 'MSSQL':
        return 'mssql';
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
}

export const database = new Database();
