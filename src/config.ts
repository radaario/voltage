import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const isWindows = os.platform() === 'win32';
const cpuCoreCount = os.cpus().length;

const defaultFfmpegPath = isWindows ? 'C:\\ffmpeg\\bin\\ffmpeg' : 'ffmpeg';
const defaultFfprobePath = isWindows ? 'C:\\ffmpeg\\bin\\ffprobe' : 'ffprobe';

export const config = {
  name: process.env.APP_NAME ?? 'VOLTAGE',
  version: process.env.APP_VERSION ?? '0.0.1',
  env: (process.env.APP_ENV ?? 'local') as 'local' | 'dev' | 'test' | 'prod',
  port: Number(process.env.APP_PORT ?? 8080),
  cpuCoreCount: cpuCoreCount,
  memoryTotal: os.totalmem(),
  storage: {
    kind: (process.env.VOLTAGE_STORAGE_KIND ?? 'LOCAL') as 'LOCAL' | 'AWS_S3',
    key: process.env.VOLTAGE_STORAGE_KEY ?? '',
    secret: process.env.VOLTAGE_STORAGE_SECRET,
    region: process.env.VOLTAGE_STORAGE_REGION ?? '',
    bucket: process.env.VOLTAGE_STORAGE_BUCKET ?? '',
    path: process.env.VOLTAGE_STORAGE_PATH ?? '/tmp'
  },
  db: {
    kind: (process.env.VOLTAGE_DB_KIND ?? 'SQLITE') as 'SQLITE' | 'MYSQL' | 'MARIADB' | 'POSTGRESQL' | 'MSSQL' | 'AWS_REDSHIFT' | 'COCKROACHDB',
    host: process.env.VOLTAGE_DB_HOST ?? 'localhost',
    port: Number(process.env.VOLTAGE_DB_PORT ?? 3306),
    user: process.env.VOLTAGE_DB_USER ?? 'root',
    password: process.env.VOLTAGE_DB_PASSWORD ?? '',
    database: process.env.VOLTAGE_DB_DATABASE ?? 'voltage',
    prefix: process.env.VOLTAGE_DB_PREFIX ?? '',
    filename: process.env.VOLTAGE_DB_FILENAME ?? './db.sqlite' // SQLite specific
  },
  api: {
    key: process.env.VOLTAGE_API_KEY ?? '',
  },
  instances: {
    runningTimeout: Number(process.env.VOLTAGE_INSTANCES_RUNNING_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
    exitedTimeout: Number(process.env.VOLTAGE_INSTANCES_EXITED_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
  },
  workers: {
    perCpuCore: Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 2), // number of workers to run per CPU core
    max: cpuCoreCount * Number(process.env.VOLTAGE_WORKERS_PER_CPU_CORE ?? 2), // maximum number of workers
    runningTimeout: Number(process.env.VOLTAGE_WORKERS_RUNNING_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
    exitedTimeout: Number(process.env.VOLTAGE_WORKERS_EXITED_TIMEOUT ?? 60000), // in milliseconds, default 1 minute
  },
  jobs: {
    pollInterval: Number(process.env.VOLTAGE_JOBS_POLL_INTERVAL ?? 1000), // in milliseconds
    visibilityTimeout: Number(process.env.VOLTAGE_JOBS_VISIBILITY_TIMEOUT ?? 10 * 60 * 1000), // in milliseconds
    maxAttempts: Number(process.env.VOLTAGE_JOBS_MAX_ATTEMPTS ?? 3), // number of attempts
    retention: Number(process.env.VOLTAGE_JOBS_RETENTION ?? 24 * 7) // in hours
  },
  ffmpeg: {
    path: process.env.FFMPEG_PATH ?? defaultFfmpegPath,
    ffprobePath: process.env.FFPROBE_PATH ?? defaultFfprobePath,
  },
};

