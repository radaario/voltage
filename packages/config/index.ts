import os from "os";
import path from "path";
// import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
// import { dir } from "console";

// ES module ortamında __filename ve __dirname yerine:
// const __file = fileURLToPath(import.meta.url);
// const __dir = path.dirname(__file);
const __dir = process.cwd();

const VOLTAGE_PROTOCOL = process.env.VOLTAGE_PROTOCOL ? `${process.env.VOLTAGE_PROTOCOL}` : "http";
const VOLTAGE_HOST = process.env.VOLTAGE_HOST ? `${VOLTAGE_PROTOCOL}://${process.env.VOLTAGE_HOST}` : `${VOLTAGE_PROTOCOL}://localhost`;

const appDir = path.resolve(__dir, "../..");
const appPort = Number(process.env.VOLTAGE_PORT) ?? 8080;
const appHost = `${VOLTAGE_HOST}${appPort !== 80 ? `:${appPort}` : ""}`;
const appPath = process.env.VOLTAGE_PATH ?? "/";
const appUrl = `${appHost}${appPath}`;

const isWindows = os.platform() === "win32";
const cpuCoresCount = os.cpus().length;

const ffmpegPathDefault = isWindows ? "C:\\ffmpeg\\bin\\ffmpeg" : "ffmpeg";
const ffprobePathDefault = isWindows ? "C:\\ffmpeg\\bin\\ffprobe" : "ffprobe";

const frontendPassword = process.env.VOLTAGE_FRONTEND_PASSWORD ?? "12345678";

// Load environment specific .env files and override
let envFiles = [".env"];
if (process.env.VOLTAGE_ENV) envFiles.push(`.env.${process.env.VOLTAGE_ENV}`);
for (const envFile of envFiles) {
	const envPath = path.resolve(__dir, "../..", envFile);
	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath, override: true });
	}
}

export const config = {
	name: process.env.VOLTAGE_NAME ?? "VOLTAGE",
	version: process.env.VOLTAGE_VERSION ?? "1.0.1",
	env: process.env.VOLTAGE_ENV ?? "local",
	url: appUrl,
	protocol: VOLTAGE_PROTOCOL,
	host: appHost,
	path: appPath,
	port: appPort,
	timezone: process.env.VOLTAGE_TIMEZONE ?? "UTC",
	dir: appDir,
	temp_dir: process.env.VOLTAGE_TEMP_DIR ?? `${appDir}/storage/tmp`, // os.tmpdir(),
	utils: {
		ffmpeg: {
			path: process.env.FFMPEG_PATH ?? ffmpegPathDefault
		},
		ffprobe: {
			path: process.env.FFPROBE_PATH ?? ffprobePathDefault
		}
	},
	storage: {
		type: (process.env.VOLTAGE_STORAGE_TYPE ?? "LOCAL") as
			| "LOCAL"
			| "AWS_S3"
			| "GOOGLE_CLOUD_STORAGE"
			| "DO_SPACES"
			| "LINODE"
			| "WASABI"
			| "BACKBLAZE"
			| "RACKSPACE"
			| "MICROSOFT_AZURE"
			| "OTHER_S3"
			| "FTP"
			| "SFTP",
		endpoint: process.env.VOLTAGE_STORAGE_ENDPOINT ?? "", // for S3-compatible types
		access_key: process.env.VOLTAGE_STORAGE_ACCESS_KEY ?? "", // Access Key ID for S3-compatible types
		access_secret: process.env.VOLTAGE_STORAGE_ACCESS_SECRET ?? "", // Access Key Secret for S3-compatible types
		region: process.env.VOLTAGE_STORAGE_REGION ?? "", // for S3-compatible types
		bucket: process.env.VOLTAGE_STORAGE_BUCKET ?? "", // for S3-compatible types
		host: process.env.VOLTAGE_STORAGE_HOST ?? "", // for FTP/SFTP
		username: process.env.VOLTAGE_STORAGE_USERNAME ?? "", // for FTP/SFTP
		password: process.env.VOLTAGE_STORAGE_PASSWORD ?? "", // for FTP/SFTP
		secure: process.env.VOLTAGE_STORAGE_SECURE === "true", // for FTP (FTPS with explicit TLS)
		base_path: process.env.VOLTAGE_STORAGE_BASE_PATH ?? `${appDir}/storage`
	},
	database: {
		type: (process.env.VOLTAGE_DATABASE_TYPE ?? "SQLITE") as
			| "SQLITE"
			| "MYSQL"
			| "MARIADB"
			| "POSTGRESQL"
			| "MSSQL"
			| "AWS_REDSHIFT"
			| "COCKROACHDB",
		host: process.env.VOLTAGE_DATABASE_HOST ?? "localhost",
		port: Number(process.env.VOLTAGE_DATABASE_PORT ?? 3306),
		username: process.env.VOLTAGE_DATABASE_USERNAME ?? "root",
		password: process.env.VOLTAGE_DATABASE_PASSWORD ?? "",
		name: process.env.VOLTAGE_DATABASE_NAME ?? "voltage",
		table_prefix: process.env.VOLTAGE_DATABASE_TABLE_PREFIX ?? "",
		file_name: process.env.VOLTAGE_DATABASE_FILE_NAME ?? `${appDir}/db.sqlite`, // SQLite specific
		cleanup_interval: Number(process.env.VOLTAGE_DATABASE_CLEANUP_INTERVAL ?? 60 * 60 * 1000) // in milliseconds, default 1 hour
	},
	runtime: {
		is_disabled: process.env.VOLTAGE_RUNTIME_IS_DISABLED === "true",
		key_method: (process.env.VOLTAGE_INSTANCES_KEY_METHOD ?? "IP_ADDRESS") as "IP_ADDRESS" | "UNIQUE_KEY",
		maintain_interval: Number(process.env.VOLTAGE_INSTANCES_MAINTAIN_INTERVAL ?? 1 * 10 * 1000), // in milliseconds, default 10 seconds
		online_timeout: Number(process.env.VOLTAGE_INSTANCES_ONLINE_TIMEOUT ?? 1 * 60 * 1000), // in milliseconds, default 1 minute
		purge_after: Number(process.env.VOLTAGE_INSTANCES_PURGE_AFTER ?? 1 * 60 * 1000), // in milliseconds, default 1 minute
		workers: {
			per_cpu_core: Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 1), // number of workers to run per CPU core
			max: cpuCoresCount * Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 1), // maximum number of workers
			busy_timeout: Number(process.env.VOLTAGE_WORKERS_BUSY_TIMEOUT ?? 5 * 60 * 1000), // in milliseconds, default 5 minutes
			idle_after: Number(process.env.VOLTAGE_WORKERS_IDLE_AFTER ?? 1 * 10 * 1000) // in milliseconds, default 10 seconds
		}
	},
	api: {
		is_disabled: process.env.VOLTAGE_API_IS_DISABLED === "true",
		url: process.env.VOLTAGE_HOST ? `${appUrl}/api` : `http://localhost:${Number(process.env.VOLTAGE_API_NODE_PORT) ?? 4000}`,
		node_port: Number(process.env.VOLTAGE_API_NODE_PORT) ?? 4000,
		key: process.env.VOLTAGE_API_KEY ?? "5ef438b9bd1e3f62d2e91385e72b2972",
		request_body_limit: process.env.VOLTAGE_API_REQUEST_BODY_LIMIT ?? 0, // in MB, 0 means no limit
		sensitive_fields: process.env.VOLTAGE_API_SENSITIVE_FIELDS ?? "password,access_secret"
	},
	frontend: {
		is_disabled: process.env.VOLTAGE_FRONTEND_IS_DISABLED === "true",
		url: process.env.VOLTAGE_HOST ? appUrl : `http://localhost:${Number(process.env.VOLTAGE_FRONTEND_NODE_PORT) ?? 3000}`,
		node_port: Number(process.env.VOLTAGE_FRONTEND_NODE_PORT ?? 3000),
		is_authentication_required: frontendPassword ? true : false,
		password: frontendPassword
	},
	logs: {
		is_disabled: process.env.VOLTAGE_LOGS_IS_DISABLED === "true",
		retention: Number(process.env.VOLTAGE_LOGS_RETENTION ?? 60 * 60 * 1000) // in milliseconds, default 1 hour
	},
	jobs: {
		process_interval: Number(process.env.VOLTAGE_JOBS_PROCESS_INTERVAL ?? 1 * 1 * 1000), // in milliseconds, default 1 second
		process_timeout: Number(process.env.VOLTAGE_JOBS_PROCESS_TIMEOUT ?? 10 * 60 * 1000), // in milliseconds, default 10 minutes
		enqueue_on_receive: process.env.VOLTAGE_JOBS_ENQUEUE_ON_RECEIVE ?? true, // enqueue job immediately when received
		enqueue_limit: Number(process.env.VOLTAGE_JOBS_ENQUEUE_LIMIT ?? 10), // default 10 jobs per enqueue
		retention: Number(process.env.VOLTAGE_JOBS_RETENTION ?? 24 * 60 * 60 * 1000), // in milliseconds, default 24 hours || 7 days = 24 * 7
		try_min: Number(process.env.VOLTAGE_JOBS_TRY_MIN ?? 1), // default 0
		try_max: Number(process.env.VOLTAGE_JOBS_TRY_MAX ?? 3), // default 3
		try_count: Number(process.env.VOLTAGE_JOBS_TRY_COUNT ?? 3), // default 0 (no retry)
		retry_in_min: Number(process.env.VOLTAGE_JOBS_RETRY_IN_MIN ?? 1 * 60 * 1000), // in milliseconds, default 60 seconds
		retry_in_max: Number(process.env.VOLTAGE_JOBS_RETRY_IN_MAX ?? 60 * 60 * 1000), // in milliseconds, default 60 minutes
		retry_in: Number(process.env.VOLTAGE_JOBS_RETRY_IN ?? 1 * 60 * 1000), // in milliseconds, default 60 seconds
		preview: {
			format: process.env.VOLTAGE_JOBS_PREVIEW_FORMAT ?? "WEBP", // format of the generated preview thumbnail
			quality: process.env.VOLTAGE_JOBS_PREVIEW_QUALITY ?? 75
		},
		notifications: {
			process_interval: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_PROCESS_INTERVAL ?? 1 * 1000), // in milliseconds, default 1 second
			process_limit: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_PROCESS_LIMIT ?? 10), // default 10 poll
			notify_on: process.env.VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON ?? "RECEIVED,COMPLETED,FAILED,TIMEOUT",
			notify_on_alloweds:
				process.env.VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON_ALLOWEDS ??
				"RECEIVED,PENDING,RETRYING,QUEUED,STARTED,DOWNLOADING,DOWNLOADED,ANALYZING,ANALYZED,PROCESSING,PROCESSED,UPLOADING,UPLOADED,COMPLETED,CANCELLED,DELETED,FAILED,TIMEOUT",
			timeout: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT ?? 1 * 10 * 1000), // in milliseconds, default 10 seconds
			timeout_max: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT_MAX ?? 1 * 30 * 1000), // in milliseconds, default 30 seconds
			try: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_TRY ?? 3), // default 3
			try_max: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_TRY_MAX ?? 3), // default 3
			retry_in: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN ?? 1 * 60 * 1000), // in milliseconds, default 1 minute
			retry_in_max: Number(process.env.VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MAX ?? 60 * 60 * 1000) // in milliseconds, default 60 minutes
		}
	}
};
