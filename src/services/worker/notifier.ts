import { config } from '../../config/index.js';
import { JobNotificationRow, NotificationSpec } from '../../config/types.js';

import { uukey, getNow, addNow, sanitizeData } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';

import axios from 'axios';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export async function createJobNotification(event: string, job: any): Promise<any> {
    logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

    let outcome: any = {
      status: 'FAILED',
    };

    let jobNotificationEvents = config.notifications.events_default ? config.notifications.events_default.split(',') : [];
    if (job.notification && job.notification.events && Array.isArray(job.notification.events)) {
      jobNotificationEvents = job.notification.events;
    }

    if (jobNotificationEvents && !jobNotificationEvents.includes(event)) {
      return { status: 'SKIPPED' };
    }

    const { database } = await import('../../utils/database.js');

    database.config(config.database);

    const sanitizedJob = sanitizeData(job);
    const now = getNow();

    const notificationOutcome = await notify(event, job.notification, sanitizedJob);

    let notification: JobNotificationRow = {
      key: uukey(),
      event: event,
      instance_key: job.instance_key,
      worker_key: job.worker_key,
      job_key: job.key,
      priority: job.priority ?? 1000,
      specs: job.notification || null,
      payload: sanitizedJob || null,
      status: notificationOutcome.status || 'FAILED',
      retry_max: 0,
      retry_count: 1,
      retry_in: 0,
      retry_at: null,
      updated_at: now,
      created_at: now,
      outcome: notificationOutcome || null,
    };
  
    if (notification.status === 'FAILED') {
      notification.retry_max = job.notification?.retry ? parseInt(job.notification.retry) : config.notifications.retry;
      if (notification.retry_max < config.notifications.retry_min) notification.retry_max = config.notifications.retry_min;
      if (notification.retry_max > config.notifications.retry_max) notification.retry_max = config.notifications.retry_max;

      notification.retry_in = parseInt(job.notification?.retry_in) > 0 ? parseInt(job.notification.retry_in) : config.notifications.retry_in;
      if (notification.retry_in < config.notifications.retry_in_min) notification.retry_in = config.notifications.retry_in_min;
      if (notification.retry_in > config.notifications.retry_in_max) notification.retry_in = config.notifications.retry_in_max;
      
      if (notification.retry_in > 0 && (notification.retry_count || 1) < notification.retry_max) {
        notification.status = 'PENDING';
        notification.retry_at = addNow(notification.retry_in, 'milliseconds');
      }
    }

    if(notification.status === 'SUCCESSFUL') {
      try {
        await database.execute(`UPDATE ${database.getTablePrefix()}jobs_notifications SET status = 'SKIPPED' WHERE job_key = :job_key AND status = 'PENDING'`, // , updated_at = :now
          { job_key: notification.job_key, now: getNow() }
        );
      } catch (error: Error | any) {
      }
    }

    try {
      await database.execute(
        `INSERT INTO ${database.getTablePrefix()}jobs_notifications (\`key\`, instance_key, worker_key, job_key, event, priority, specs, payload, status, retry_max, retry_count, retry_in, retry_at, updated_at, created_at, outcome) VALUES (:key, :instance_key, :worker_key, :job_key, :event, :priority, :specs, :payload, :status, :retry_max, :retry_count, :retry_in, :retry_at, :updated_at, :created_at, :outcome)`,
        { 
          ...notification,
          specs: notification.specs ? JSON.stringify(notification.specs) : null,
          payload: notification.payload ? JSON.stringify(notification.payload) : null,
          outcome: notification.outcome ? JSON.stringify(notification.outcome) : null
        }
      );

      return notificationOutcome;
    } catch (error: Error | any) {
      logger.console('ERROR', 'Failed to create job notification record!', { notification_key: notification.key, notification_event: notification.event, error });
      outcome = { status: 'FAILED', error: { message: error.message || 'Unknown error occurred!' } }; // , outcome: notificationOutcome
    }

    return outcome;
}

export async function retryJobNotification(notification: any): Promise<any> {
  logger.setMetadata({ instance_key: notification.instance_key, worker_key: notification.worker_key, job_key: notification.job_key });
  logger.console('INFO', 'Retrying job notification...', { notification_key: notification.key, notification_event: notification.event });

  let outcome: any = {
    status: 'FAILED',
  };

  const { database } = await import('../../utils/database.js');

  database.config(config.database);

  try {
    const notificationOutcome = await notify(notification.event, JSON.parse(notification.specs), JSON.parse(notification.payload));

    notification.status = notificationOutcome.status || 'FAILED';
    notification.retry_count = (notification.retry_count || 0) + 1;
    notification.updated_at = getNow();
    notification.outcome = notificationOutcome;

    if (notification.status === 'FAILED') {
      notification.retry_at = null;

      if (notification.retry_in > 0 && notification.retry_count < notification.retry_max) {
        notification.status = 'PENDING';
        notification.retry_at = addNow(notification.retry_in, 'milliseconds');
      }
    }

    if(notification.status === 'SUCCESSFUL') {
      try {
        await database.execute(`UPDATE ${database.getTablePrefix()}jobs_notifications SET status = 'SKIPPED' WHERE job_key = :job_key AND status = 'PENDING'`, // , updated_at = :now
          { job_key: notification.job_key }
        );
      } catch (error: Error | any) {
      }
    }

    await database.execute(
      `UPDATE ${database.getTablePrefix()}jobs_notifications SET status = :status, retry_count = :retry_count, retry_at = :retry_at, updated_at = :updated_at, outcome = :outcome WHERE \`key\` = :key`,
      { ...notification, outcome: JSON.stringify(notification.outcome) }
    );

    if (notificationOutcome.status === 'SUCCESSFUL') {
      outcome = { status: 'SUCCESSFUL' };
    } else {
      outcome.error = { message: notificationOutcome.error?.message || 'Unknown error occurred!' };
    }
  } catch (error: Error | any) {
    logger.console('ERROR', 'Failed to retry job notification!', { notification_key: notification.key, notification_event: notification.event, error });
    outcome.error = { message: error.message || 'Unknown error occurred!' };
  }

  return outcome;
}

export async function notify(event: string, specs: NotificationSpec, payload: unknown): Promise<any> {
  let outcome: any = {
    status: 'FAILED',
  };

  try {
    if (specs.type === 'HTTP' || specs.type === 'HTTPS') {
      // HTTP/HTTPS notification
      outcome = await notifyHttp(event, specs, payload);
    } else if (specs.type === 'AWS_SNS') {
      // AWS SNS notification
      outcome = await notifySns(event, specs, payload);
    } else {
      throw new Error('Unknown notification type!');
    }
  } catch (error: Error | any) {
    logger.console('ERROR', 'Notification failed!', { error: { code: error.code, name: error.name, message: error.message || 'Unknown error occurred!' } });
    outcome.error = { message: error.message || 'Unknown error occurred!' };
  }

  return outcome;
}

async function notifyHttp(event: string, specs: any, payload: any): Promise<any> {
  const method = specs.method || 'POST';
  const headers = { 'Content-Type': 'application/json', 'User-Agent': `${config.name}/${config.version}`, ...(specs.headers || {}) };
  
  // Always include full payload with metadata
  const data = {event, ...payload};
  
  const requestConfig: any = {
    method,
    headers,
    timeout: (specs.timeout && parseInt(specs.timeout) > 0 && parseInt(specs.timeout) < config.notifications.timeout) ? parseInt(specs.timeout) : config.notifications.timeout || (10 * 1000),
  };

  if (method === 'GET') {
    // For GET requests, append payload as query parameters
    const params = new URLSearchParams();
    Object.entries(data as any).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    requestConfig.url = `${specs.url}?${params.toString()}`;
  } else {
    // For POST/PUT requests, send as JSON body
    requestConfig.url = specs.url;
    requestConfig.data = data;
  }

  const response = await axios.request(requestConfig);

  let outcome: any = {
    status: response.status === 200 ? 'SUCCESSFUL' : 'FAILED',
    http_status_code: response.status,
  };

  if (response.status !== 200) outcome.error = { message: response.statusText || 'Unknown error' };
  if (response.headers) outcome.header = response.headers;
  if (response.data) outcome.body = response.data;

  return outcome;
}

async function notifySns(event: string, specs: any, payload: any): Promise<any> {
  const snsClient = new SNSClient({
    region: specs.region,
    credentials: {
      accessKeyId: specs.access_key,
      secretAccessKey: specs.access_secret,
    }
  });

  // Always include full payload with metadata
  const messageData = {event, ...payload};
  
  const command = new PublishCommand({
    TopicArn: specs.topic,
    Message: JSON.stringify(messageData),
    Subject: `Job ${(payload as any)?.status || 'update'}`,
  });

  const response = await snsClient.send(command);

  let outcome: any = {
    status: response.$metadata.httpStatusCode === 200 ? 'SUCCESSFUL' : 'FAILED',
    http_status_code: response.$metadata.httpStatusCode,
  };

  if (response.$metadata.httpStatusCode !== 200) outcome.error = { message: 'Unknown error' }; // response.$metadata?.httpStatusText
  if (response.MessageId) outcome.message_id = response.MessageId;
  
  return outcome;
}

