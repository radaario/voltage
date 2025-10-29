import { config } from '../config';

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: config.env !== 'prod' ? { target: 'pino-pretty' } : undefined
});

