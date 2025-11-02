import dotenv from 'dotenv';
import os, { hostname } from 'os';

dotenv.config();

const isWindows = os.platform() === 'win32';
const cpuCoresCount = os.cpus().length;

const ffmpegPathDefault = isWindows ? 'C:\\ffmpeg\\bin\\ffmpeg' : 'ffmpeg';
const ffprobePathDefault = isWindows ? 'C:\\ffmpeg\\bin\\ffprobe' : 'ffprobe';

const dashboardPassword = process.env.VOLTAGE_DASHBOARD_PASSWORD ?? '12345678';

export const config = {
  name: process.env.APP_NAME ?? 'VOLTAGE',
  version: process.env.APP_VERSION ?? '0.0.1',
  env: (process.env.APP_ENV ?? 'local') as 'local' | 'dev' | 'test' | 'prod',
  port: Number(process.env.APP_PORT ?? 8080),
  timezone: (process.env.VOLTAGE_TIMEZONE ?? 'UTC'),
  temp_folder: process.env.VOLTAGE_INSTANCES_TEMP_FOLDER ?? './storage/tmp', // os.tmpdir(),
  storage: {
    type: (process.env.VOLTAGE_STORAGE_TYPE ?? 'LOCAL') as 'LOCAL' | 'AWS_S3' | 'GOOGLE_CLOUD_STORAGE' | 'DO_SPACES' | 'LINODE' | 'WASABI' | 'BACKBLAZE' | 'RACKSPACE' | 'MICROSOFT_AZURE' | 'OTHER_S3' | 'FTP' | 'SFTP',
    endpoint: process.env.VOLTAGE_STORAGE_ENDPOINT ?? '', // for S3-compatible types
    access_key: process.env.VOLTAGE_STORAGE_ACCESS_KEY ?? '', // Access Key ID for S3-compatible types
    access_secret: process.env.VOLTAGE_STORAGE_ACCESS_SECRET ?? '', // Access Key Secret for S3-compatible types
    region: process.env.VOLTAGE_STORAGE_REGION ?? '', // for S3-compatible types
    bucket: process.env.VOLTAGE_STORAGE_BUCKET ?? '', // for S3-compatible types
    host: process.env.VOLTAGE_STORAGE_HOST ?? '', // for FTP/SFTP
    username: process.env.VOLTAGE_STORAGE_USERNAME ?? '', // for FTP/SFTP
    password: process.env.VOLTAGE_STORAGE_PASSWORD ?? '', // for FTP/SFTP
    secure: process.env.VOLTAGE_STORAGE_SECURE === 'true', // for FTP (FTPS with explicit TLS)
    base_path: process.env.VOLTAGE_STORAGE_BASE_PATH ?? './storage',
  },
  database: {
    type: (process.env.VOLTAGE_DATABASE_TYPE ?? 'SQLITE') as 'SQLITE' | 'MYSQL' | 'MARIADB' | 'POSTGRESQL' | 'MSSQL' | 'AWS_REDSHIFT' | 'COCKROACHDB',
    host: process.env.VOLTAGE_DATABASE_HOST ?? 'localhost',
    port: Number(process.env.VOLTAGE_DATABASE_PORT ?? 3306),
    username: process.env.VOLTAGE_DATABASE_USERNAME ?? 'root',
    password: process.env.VOLTAGE_DATABASE_PASSWORD ?? '',
    name: process.env.VOLTAGE_DATABASE_NAME ?? 'voltage',
    table_prefix: process.env.VOLTAGE_DATABASE_TABLE_PREFIX ?? '',
    file_name: process.env.VOLTAGE_DATABASE_FILE_NAME ?? './db.sqlite' // SQLite specific
  },
  api: {
    key: process.env.VOLTAGE_API_KEY ?? '5ef438b9bd1e3f62d2e91385e72b2972',
    request_body_limit: process.env.VOLTAGE_API_REQUEST_BODY_LIMIT ?? 0, // in MB, 0 means no limit
    sensitive_fields: process.env.VOLTAGE_API_SENSITIVE_FIELDS ?? 'password,access_secret',
  },
  dashboard: {
    is_authentication_required: dashboardPassword ? true : false,
    password: dashboardPassword,
  },
  utils: {
    ffmpeg: {
      path: process.env.FFMPEG_PATH ?? ffmpegPathDefault,
    },
    ffprobe: {
      path: process.env.FFPROBE_PATH ?? ffprobePathDefault,
    },
  },
  instances: {
    key_method: (process.env.VOLTAGE_INSTANCES_KEY_METHOD ?? 'IP_ADDRESS') as 'IP_ADDRESS' | 'UNIQUE_KEY',
    maintain_interval: Number(process.env.VOLTAGE_INSTANCES_MAINTAIN_INTERVAL ?? 10 * 1000), // in milliseconds, default 10 seconds
    running_timeout: Number(process.env.VOLTAGE_INSTANCES_RUNNING_TIMEOUT ?? 1 * 60 * 1000), // in milliseconds, default 1 minute
    exited_timeout: Number(process.env.VOLTAGE_INSTANCES_EXITED_TIMEOUT ?? 1 * 60 * 1000), // in milliseconds, default 1 minute
  },
  workers: {
    per_cpu_core: Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 1), // number of workers to run per CPU core
    max: cpuCoresCount * Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 1), // maximum number of workers
    maintain_interval: Number(process.env.VOLTAGE_WORKERS_MAINTAIN_INTERVAL ?? 10 * 1000), // in milliseconds, default 10 seconds
    running_timeout: Number(process.env.VOLTAGE_WORKERS_RUNNING_TIMEOUT ?? 5 * 60 * 1000), // in milliseconds, default 5 minutes
    exited_timeout: Number(process.env.VOLTAGE_WORKERS_EXITED_TIMEOUT ?? 1 * 60 * 1000), // in milliseconds, default 1 minute
  },
  jobs: {
    preview: {
      format: (process.env.VOLTAGE_JOBS_PREVIEW_FORMAT ?? 'webp'), // format of the generated preview thumbnail
      quality: (process.env.VOLTAGE_JOBS_PREVIEW_QUALITY ?? 75),
    },
    poll_interval: Number(process.env.VOLTAGE_JOBS_POLL_INTERVAL ?? 1 * 1000), // in milliseconds, default 1 second
    visibility_timeout: Number(process.env.VOLTAGE_JOBS_VISIBILITY_TIMEOUT ?? 10 * 60 * 1000), // in milliseconds, default 10 minutes
    max_attempts: Number(process.env.VOLTAGE_JOBS_MAX_ATTEMPTS ?? 3), // number of attempts, default 3
    cleanup_interval: Number(process.env.VOLTAGE_JOBS_CLEANUP_INTERVAL ?? 1 * 60 * 60 * 1000), // in milliseconds, default 1 hour
    retention: Number(process.env.VOLTAGE_JOBS_RETENTION ?? 1) // in hours, default 7 days = 24 * 7
  },
  logs: {
    cleanup_interval: Number(process.env.VOLTAGE_LOGS_CLEANUP_INTERVAL ?? 1 * 60 * 60 * 1000), // in milliseconds, default 1 hour
    retention: Number(process.env.VOLTAGE_LOGS_RETENTION ?? 1) // in hours, default 7 days = 24 * 7
  }
};

