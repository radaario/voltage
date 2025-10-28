import dotenv from 'dotenv';
import os from 'os';

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
  cpu_cores_count: cpuCoresCount,
  memory_total: os.totalmem(),
  timezone: (process.env.VOLTAGE_TIMEZONE ?? 'UTC'),
  storage: {
    kind: (process.env.VOLTAGE_STORAGE_KIND ?? 'LOCAL') as 'LOCAL' | 'AWS_S3',
    key: process.env.VOLTAGE_STORAGE_KEY ?? '',
    secret: process.env.VOLTAGE_STORAGE_SECRET,
    region: process.env.VOLTAGE_STORAGE_REGION ?? '',
    bucket: process.env.VOLTAGE_STORAGE_BUCKET ?? '',
    path: process.env.VOLTAGE_STORAGE_PATH ?? '/storage'
  },
  db: {
    kind: (process.env.VOLTAGE_DB_KIND ?? 'SQLITE') as 'SQLITE' | 'MYSQL' | 'MARIADB' | 'POSTGRESQL' | 'MSSQL' | 'AWS_REDSHIFT' | 'COCKROACHDB',
    host: process.env.VOLTAGE_DB_HOST ?? 'localhost',
    port: Number(process.env.VOLTAGE_DB_PORT ?? 3306),
    username: process.env.VOLTAGE_DB_USERNAME ?? 'root',
    password: process.env.VOLTAGE_DB_PASSWORD ?? '',
    database: process.env.VOLTAGE_DB_DATABASE ?? 'voltage',
    prefix: process.env.VOLTAGE_DB_PREFIX ?? '',
    filename: process.env.VOLTAGE_DB_FILENAME ?? './db.sqlite' // SQLite specific
  },
  api: {
    key: process.env.VOLTAGE_API_KEY ?? '',
    request_body_limit: process.env.VOLTAGE_API_REQUEST_BODY_LIMIT ?? 0, // in MB, 0 means no limit
  },
  dashboard: {
    is_authentication_required: dashboardPassword ? true : false,
    password: dashboardPassword,
  },
  instances: {
    running_timeout: Number(process.env.VOLTAGE_INSTANCES_RUNNING_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
    exited_timeout: Number(process.env.VOLTAGE_INSTANCES_EXITED_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
  },
  workers: {
    per_cpu_core: Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 1), // number of workers to run per CPU core
    max: cpuCoresCount * Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 1), // maximum number of workers
    running_timeout: Number(process.env.VOLTAGE_WORKERS_RUNNING_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
    exited_timeout: Number(process.env.VOLTAGE_WORKERS_EXITED_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
  },
  ffmpeg: {
    path: process.env.FFMPEG_PATH ?? ffmpegPathDefault,
  },
  ffprobe: {
    path: process.env.FFPROBE_PATH ?? ffprobePathDefault,
  },
  jobs: {
    poll_interval: Number(process.env.VOLTAGE_JOBS_POLL_INTERVAL ?? 1000), // in milliseconds
    visibility_timeout: Number(process.env.VOLTAGE_JOBS_VISIBILITY_TIMEOUT ?? 10 * 60 * 1000), // in milliseconds
    max_attempts: Number(process.env.VOLTAGE_JOBS_MAX_ATTEMPTS ?? 3), // number of attempts
    retention: Number(process.env.VOLTAGE_JOBS_RETENTION ?? 24 * 7) // in hours
  }
};

