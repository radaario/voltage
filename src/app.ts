import { createInstanceKey } from './utils/index.js';
import { logger } from './utils/logger.js';

import { startApiService } from './services/api.js';
import { startSupervisorService, shutdownSupervisorService } from './services/supervisor.js';

// INSTANCE: KEY
const instanceKey = createInstanceKey();

// Initialize and start the Instance
async function main() {
  logger.info({ instanceKey }, 'Starting instance...');

  try {
    await startSupervisorService(instanceKey);
    await startApiService(instanceKey);

    logger.info({ instanceKey }, 'Instance started successfully!');
  } catch (err: Error | any) {
    logger.error({ err }, 'Failed to start instance!');
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error({ err }, 'Unhandled error in instance!');
  process.exit(1);
});

process.on('SIGINT', (signal) => gracefulShutdown(signal));
process.on('SIGTERM', (signal) => gracefulShutdown(signal));
process.on('SIGQUIT', (signal) => gracefulShutdown(signal));

const gracefulShutdown = async (signal: string) => {
  logger.info(`Instance received ${signal}, shutting down gracefully!`);

  try {
    await shutdownSupervisorService(instanceKey, signal);
  } catch (err: Error | any) {
    logger.error({ err }, 'Error during graceful shutdown!');
  }
  
  process.exit(0);
};
