import { config } from './config/index.js';

import { createInstanceKey } from './utils/index.js';
import { logger } from './utils/logger.js';

import { startApiService } from './services/api.js';
import { startSupervisorService, shutdownSupervisorService } from './services/supervisor.js';

// INSTANCE: KEY
const instance_key = createInstanceKey();

logger.setMetadata({ instance_key });

// Initialize and start the Instance
async function main() {
  await logger.insert('INFO', 'Starting instance...');

  try {
    await startSupervisorService(instance_key);
    await startApiService(instance_key);

    await logger.insert('INFO', 'Instance started successfully!');
  } catch (error: Error | any) {
    await logger.insert('ERROR', 'Failed to start instance!', { error });
    process.exit(1);
  }
}

main().catch((error: Error | any) => {
  logger.insert('ERROR', 'Unhandled error in instance!', { error });
  process.exit(1);
});

process.on('SIGINT', (signal) => gracefulShutdown(signal));
process.on('SIGTERM', (signal) => gracefulShutdown(signal));
process.on('SIGQUIT', (signal) => gracefulShutdown(signal));

const gracefulShutdown = async (signal: string) => {
  await logger.insert('INFO', `Instance received :signal, shutting down gracefully!`, { signal });

  try {
    await shutdownSupervisorService(instance_key, signal);
  } catch (error: Error | any) {
    logger.insert('ERROR', 'Error during graceful shutdown!', { error });
  }
  
  process.exit(0);
};
