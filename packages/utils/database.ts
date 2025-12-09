// import { logger } from "./logger";
import knex, { Knex } from "knex";

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
	type: string;
	host?: string;
	port?: number;
	username?: string;
	password?: string;
	name?: string;
	table_prefix?: string;
	file_name?: string;
	timezone?: string;
}

class Database {
	private _config: DatabaseConfig | null = null;
	private _knex: Knex | null = null;

	/**
	 * Configure database connection
	 * @param cfg Database configuration
	 */
	config(cfg: DatabaseConfig): void {
		this._config = cfg;
		this._knex = this.createKnexInstance();
	}

	/**
	 * Get Knex instance
	 * @throws Error if database not configured
	 */
	get knex(): Knex {
		if (!this._knex) {
			throw new Error("Database not configured. Call database.config(config.database) first.");
		}
		return this._knex;
	}

	/**
	 * Get table prefix (normalized)
	 * @returns Table prefix with trailing underscore
	 */
	getTablePrefix(): string {
		if (!this._config) throw new Error("Database not configured.");
		const raw = this._config.table_prefix;
		if (!raw) return "";
		let transformed = raw.replace(/[- ]/g, "_");
		if (transformed.endsWith("_")) transformed = transformed.slice(0, -1);
		return transformed + "_";
	}

	/**
	 * Get table query builder with prefix
	 * @param tableName Table name (without prefix)
	 * @returns Knex query builder
	 */
	table(tableName: string): Knex.QueryBuilder {
		return this.knex(this.getTablePrefix() + tableName);
	}

	/**
	 * Execute operations within a transaction
	 * @param callback Transaction callback
	 * @returns Promise with callback result
	 */
	async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
		return this.knex.transaction(callback);
	}

	/**
	 * Check if a table exists
	 * @param tableName Table name (without prefix)
	 * @returns Promise<boolean>
	 */
	async hasTable(tableName: string): Promise<boolean> {
		return this.knex.schema.hasTable(this.getTablePrefix() + tableName);
	}

	/**
	 * Drop a table if it exists
	 * @param tableName Table name (without prefix)
	 */
	async dropTableIfExists(tableName: string): Promise<void> {
		await this.knex.schema.dropTableIfExists(this.getTablePrefix() + tableName);
	}

	/**
	 * Verify and create database schema if needed
	 * Creates all required tables (stats, logs, instances, workers, jobs, etc.)
	 */
	async verifySchemaExists(): Promise<void> {
		try {
			const prefix = this.getTablePrefix();

			// Create stats table
			const hasStats = await this.knex.schema.hasTable(`${prefix}stats`);
			if (!hasStats) {
				await this.knex.schema.createTable(`${prefix}stats`, (table) => {
					table.string("key", 40).primary();
					table.date("date").notNullable().defaultTo(this.knex.fn.now());
					table.text("data").notNullable();
				});
			}

			// Create logs table
			const hasLogs = await this.knex.schema.hasTable(`${prefix}logs`);
			if (!hasLogs) {
				await this.knex.schema.createTable(`${prefix}logs`, (table) => {
					table.string("key", 40).primary();
					table.string("type", 255).notNullable();
					table.string("instance_key", 40).nullable();
					table.string("worker_key", 40).nullable();
					table.string("job_key", 40).nullable();
					table.string("output_key", 40).nullable();
					table.string("notification_key", 40).nullable();
					table.string("message", 1024).notNullable();
					table.text("metadata").notNullable();
					table.datetime("created_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
				});
			}

			// Create instances table
			const hasInstances = await this.knex.schema.hasTable(`${prefix}instances`);
			if (!hasInstances) {
				await this.knex.schema.createTable(`${prefix}instances`, (table) => {
					table.string("key", 40).primary();
					table.enum("type", ["MASTER", "SLAVE"]).notNullable().defaultTo("SLAVE");
					table.text("specs").notNullable();
					table.text("outcome").nullable();
					table.enum("status", ["ONLINE", "OFFLINE"]).notNullable().defaultTo("ONLINE");
					table.datetime("updated_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.datetime("created_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.integer("restart_count").notNullable().defaultTo(0);
				});
			}

			// Create workers table
			const hasWorkers = await this.knex.schema.hasTable(`${prefix}instances_workers`);
			if (!hasWorkers) {
				await this.knex.schema.createTable(`${prefix}instances_workers`, (table) => {
					table.string("key", 40).primary();
					table.string("instance_key", 40).notNullable();
					table.integer("index").notNullable().defaultTo(0);
					table.text("outcome").nullable();
					table.enum("status", ["IDLE", "BUSY", "TIMEOUT", "TERMINATED"]).notNullable().defaultTo("IDLE");
					table.datetime("updated_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.datetime("created_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.string("job_key", 40).nullable();
					table.string("output_key", 40).nullable();
				});
			}

			// Create jobs table
			const hasJobs = await this.knex.schema.hasTable(`${prefix}jobs`);
			if (!hasJobs) {
				await this.knex.schema.createTable(`${prefix}jobs`, (table) => {
					table.string("key", 40).primary();
					table.integer("priority").notNullable().defaultTo(1000);
					table.text("input").notNullable();
					// table.text("outputs").notNullable();
					table.text("destination").nullable();
					table.text("notification").nullable();
					table.text("metadata").nullable();
					table.text("outcome").nullable();
					table
						.enum("status", [
							"RECEIVED",
							"PENDING",
							"RETRYING",
							"QUEUED",
							"STARTED",
							"DOWNLOADING",
							"DOWNLOADED",
							"ANALYZING",
							"ANALYZED",
							"PROCESSING",
							"PROCESSED",
							"UPLOADING",
							"UPLOADED",
							"COMPLETED",
							"CANCELLED",
							"DELETED",
							"FAILED",
							"TIMEOUT"
						])
						.notNullable()
						.defaultTo("RECEIVED");
					table.decimal("progress", 10, 2).notNullable().defaultTo(0.0);
					table.datetime("started_at", { precision: 3 }).nullable();
					table.datetime("downloaded_at", { precision: 3 }).nullable();
					table.datetime("analyzed_at", { precision: 3 }).nullable();
					table.datetime("completed_at", { precision: 3 }).nullable();
					table.datetime("updated_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.datetime("created_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.integer("try_max").notNullable().defaultTo(0);
					table.integer("try_count").notNullable().defaultTo(0);
					table.integer("retry_in").nullable();
					table.datetime("retry_at", { precision: 3 }).nullable();
					table.string("locked_by", 40).nullable();
					table.string("instance_key", 40).nullable();
					table.string("worker_key", 40).nullable();
				});
			}

			// Create jobs table
			const hasJobsOutputs = await this.knex.schema.hasTable(`${prefix}jobs_outputs`);
			if (!hasJobsOutputs) {
				await this.knex.schema.createTable(`${prefix}jobs_outputs`, (table) => {
					table.string("key", 40).primary();
					table.string("job_key", 40).nullable();
					table.integer("index").notNullable().defaultTo(0);
					table.integer("priority").notNullable().defaultTo(1000);
					table.text("specs").notNullable();
					table.text("outcome").nullable();
					table
						.enum("status", [
							"PENDING",
							"RETRYING",
							"QUEUED",
							"STARTED",
							"PROCESSING",
							"PROCESSED",
							"UPLOADING",
							"UPLOADED",
							"COMPLETED",
							"CANCELLED",
							"DELETED",
							"FAILED",
							"TIMEOUT"
						])
						.notNullable()
						.defaultTo("PENDING");
					table.datetime("started_at", { precision: 3 }).nullable();
					table.datetime("processed_at", { precision: 3 }).nullable();
					table.datetime("uploaded_at", { precision: 3 }).nullable();
					table.datetime("completed_at", { precision: 3 }).nullable();
					table.datetime("updated_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.datetime("created_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.integer("try_max").notNullable().defaultTo(0);
					table.integer("try_count").notNullable().defaultTo(0);
					table.integer("retry_in").nullable();
					table.datetime("retry_at", { precision: 3 }).nullable();
					table.string("locked_by", 40).nullable();
					table.string("instance_key", 40).nullable();
					table.string("worker_key", 40).nullable();
				});
			}

			// Create jobs_queue table
			const hasJobsQueue = await this.knex.schema.hasTable(`${prefix}jobs_queue`);
			if (!hasJobsQueue) {
				await this.knex.schema.createTable(`${prefix}jobs_queue`, (table) => {
					table.string("key", 40).primary();
					table.integer("priority").notNullable().defaultTo(1000);
					table.datetime("created_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
					table.string("locked_by", 40).nullable();
				});
			}

			// Create jobs_notifications tables
			for (const jobsNotificationsTable of ["jobs_notifications", "jobs_notifications_queue"]) {
				const hasJobsNotifications = await this.knex.schema.hasTable(`${prefix}${jobsNotificationsTable}`);
				if (!hasJobsNotifications) {
					await this.knex.schema.createTable(`${prefix}${jobsNotificationsTable}`, (table) => {
						table.string("key", 40).primary();
						table.string("job_key", 40).notNullable();
						table.integer("priority").notNullable().defaultTo(1000);
						table.text("specs").notNullable();
						table.text("payload").notNullable();
						table.text("outcome").nullable();
						table
							.enum("status", ["PENDING", "RETRYING", "QUEUED", "SUCCESSFUL", "SKIPPED", "FAILED"])
							.notNullable()
							.defaultTo("PENDING");
						table.datetime("updated_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
						table.datetime("created_at", { precision: 3 }).notNullable().defaultTo(this.knex.fn.now());
						table.integer("try_max").notNullable().defaultTo(1);
						table.integer("try_count").notNullable().defaultTo(1);
						table.integer("retry_in").nullable();
						table.datetime("retry_at", { precision: 3 }).nullable();
						table.string("locked_by", 40).nullable();
						table.string("instance_key", 40).nullable();
						table.string("worker_key", 40).nullable();
					});
				}
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Create Knex instance based on database type
	 * @returns Knex instance
	 * @private
	 */
	private createKnexInstance(): Knex {
		if (!this._config) {
			throw new Error("Database config is null");
		}

		const type = this._config.type.toUpperCase();

		const knexConfig: Knex.Config = {
			client: this.getKnexClient(type),
			useNullAsDefault: type === "SQLITE",
			pool: { min: 2, max: 10 } // Connection pooling
		};

		switch (type) {
			case "SQLITE":
				knexConfig.connection = {
					filename: this._config.file_name ? `./${this._config.file_name}` : "./db.sqlite"
				};
				// SQLite doesn't need connection pooling
				knexConfig.pool = { min: 1, max: 1 };
				break;

			case "MYSQL":
			case "MARIADB":
				knexConfig.connection = {
					host: this._config.host,
					port: this._config.port,
					user: this._config.username,
					password: this._config.password,
					database: this._config.name,
					timezone: this._config.timezone ? this._config.timezone.replace("UTC", "+00:00") : "+00:00",
					dateStrings: true
				};
				break;

			case "POSTGRESQL":
			case "AWS_REDSHIFT":
			case "COCKROACHDB":
				knexConfig.connection = {
					host: this._config.host,
					port: this._config.port,
					user: this._config.username,
					password: this._config.password,
					database: this._config.name
				};
				if (this._config.timezone) {
					const timezone = this._config.timezone; // Capture for closure
					knexConfig.pool = {
						min: 2,
						max: 10,
						afterCreate: (conn: any, done: any) => {
							conn.query(`SET TIME ZONE '${timezone}'`, (err: any) => {
								done(err, conn);
							});
						}
					};
				}
				break;

			case "MSSQL":
				knexConfig.connection = {
					server: this._config.host,
					port: this._config.port,
					user: this._config.username,
					password: this._config.password,
					database: this._config.name,
					options: {
						encrypt: true,
						trustServerCertificate: true,
						enableArithAbort: true
					}
				};
				if (this._config.timezone) {
					/*
					logger.console(
						"WARN",
						"MSSQL does not support setting a session timezone; config.timezone will be ignored for MSSQL connections",
						{ timezone: this._config.timezone }
					);
					*/
				}
				break;

			default:
				throw new Error(`Unsupported database type: ${type}`);
		}

		return knex(knexConfig);
	}

	/**
	 * Get Knex client name based on database type
	 * @param type Database type
	 * @returns Knex client name
	 * @private
	 */
	private getKnexClient(type: string): string {
		switch (type) {
			case "SQLITE":
				return "better-sqlite3";
			case "MYSQL":
			case "MARIADB":
				return "mysql2";
			case "POSTGRESQL":
			case "AWS_REDSHIFT":
			case "COCKROACHDB":
				return "pg";
			case "MSSQL":
				return "mssql";
			default:
				throw new Error(`Unsupported database type: ${type}`);
		}
	}
}

export const database = new Database();
