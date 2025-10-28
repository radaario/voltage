import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: config.env !== 'prod' ? { target: 'pino-pretty' } : undefined
});

