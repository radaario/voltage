import { config } from '../../config/index.js';
import { JobNotificationRow, NotificationSpec } from '../../config/types.js';

import { uukey, getNow, addNow, sanitizeData } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';

import axios from 'axios';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

let database: any = null;

export async function createJobNotification(event: string, job: any): Promise<any> {
    logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

    let outcome: any = {
      status: 'FAILED',
    };

    let jobNotificationEvents = config.jobs.notifications.events_default ? config.jobs.notifications.events_default.split(',') : [];
    if (job.notification && job.notification.events && Array.isArray(job.notification.events)) {
      jobNotificationEvents = job.notification.events;
    }

    if (jobNotificationEvents && !jobNotificationEvents.includes(event)) {
      return { status: 'SKIPPED' };
    }

    if (!database) {
      const _database = await import('../../utils/database.js');
      database = _database.database;
      database.config(config.database);
    }

    const sanitizedJob = sanitizeData({ ...job, status: event });
    const now = getNow();

    const notificationOutcome = await notify(event, job.notification, sanitizedJob);

    let notification: any = {
      key: uukey(),
      event: event,
      instance_key: job.instance_key,
      worker_key: job.worker_key,
      job_key: job.key,
      priority: job.priority ?? 1000,
      specs: job.notification || null,
      payload: sanitizedJob || null,
      outcome: notificationOutcome || null,
      status: notificationOutcome.status || 'FAILED',
      updated_at: now,
      created_at: now,
      try_max: config.jobs.notifications.try || 3, // default 3
      try_count: 1,
      retry_in: config.jobs.notifications.retry_in || (1 * 60 * 1000), // in milliseconds, default 1 minute
      retry_at: null,
    };

    if (job?.notification?.try && parseInt(job.notification.try) > 0) notification.try_max = parseInt(job.notification.try);
    if (notification.try_max < 1) notification.try_max = 1;
    if (notification.try_max > config.jobs.notifications.try_max) notification.try_max = config.jobs.notifications.try_max;

    if (job.notification?.retry_in && parseInt(job.notification.retry_in) > 0) notification.retry_in = parseInt(job.notification.retry_in);
    if (notification.retry_in < (1 * 1000)) notification.retry_in = (1 * 1000);
    if (notification.retry_in > config.jobs.notifications.retry_in_max) notification.retry_in = config.jobs.notifications.retry_in_max;
  
    if (notification.status === 'FAILED' && notification.try_count < notification.try_max) {
      notification.status = 'RETRYING';
      notification.retry_at = addNow(notification.retry_in, 'milliseconds');

      // JOB: NOTIFICATION: QUEUE: INSERT
      await database.table('jobs_notifications_queue').insert(notification); // .onConflict('key').merge();
    }

    if(['SUCCESSFUL', 'FAILED'].includes(notification.status)) {
      try {
        // JOB: NOTIFICATION: QUEUE: DELETE
        // await database.table('jobs_notifications_queue').where('key', notification.key).del();
        // await database.table('jobs_notifications').where('job_key', notification.job_key).whereIn('status', ['PENDING', 'RETRYING']).update({status: 'SKIPPED'});
      } catch (error: Error | any) {
      }
    }

    try {
      // JOB: NOTIFICATION: INSERT
      await database.table('jobs_notifications').insert({
        ...notification,
        specs: notification.specs ? JSON.stringify(notification.specs) : null,
        payload: notification.payload ? JSON.stringify(notification.payload) : null,
        outcome: notification.outcome ? JSON.stringify(notification.outcome) : null,
      });
      
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

  if (!database) {
    const _database = await import('../../utils/database.js');
    database = _database.database;
    database.config(config.database);
  }

  try {
    const notificationOutcome = await notify(notification.event, JSON.parse(notification.specs), JSON.parse(notification.payload));

    notification.status = notificationOutcome.status || 'FAILED';
    notification.try_count = (notification.try_count || 1) + 1;
    notification.updated_at = getNow();
    notification.outcome = notificationOutcome;
    notification.retry_at = null;

    if (notification.status === 'FAILED' && notification.try_count < notification.try_max) {
      notification.status = 'RETRYING';
      notification.retry_at = addNow(notification.retry_in, 'milliseconds');

      // JOB: NOTIFICATION: QUEUE: UPDATE OR INSERT
      try {
        await database.table('jobs_notifications_queue').insert(notification).onConflict('key').merge();
      } catch (error: Error | any) {
        console.log("ERROR", error);
      }
    }

    if(['SUCCESSFUL', 'FAILED'].includes(notification.status)) {
      try {
        // JOB: NOTIFICATION: QUEUE: DELETE
        await database.table('jobs_notifications_queue').where('key', notification.key).del();
        // await database.table('jobs_notifications').where('job_key', notification.job_key).whereIn('status', ['PENDING', 'RETRYING']).update({ status: 'SKIPPED' });
      } catch (error: Error | any) {
      }
    }

    // JOB: NOTIFICATION: UPDATE
    await database.table('jobs_notifications')
      .where('key', notification.key)
      .update({
        ...notification,
        specs: notification.specs ? JSON.stringify(notification.specs) : null,
        payload: notification.payload ? JSON.stringify(notification.payload) : null,
        outcome: notification.outcome ? JSON.stringify(notification.outcome) : null,
      });

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
    logger.console('WARNING', 'Notification couldn\'t be sent!', { error: { code: error.code, name: error.name, message: error.message || 'Unknown error occurred!' } });
    outcome.error = { message: error.message || 'Unknown error occurred!' };
  }

  return outcome;
}

async function notifyHttp(event: string, specs: any, payload: any): Promise<any> {
  const method = specs.method || 'POST';
  const headers = { 'Content-Type': 'application/json', 'User-Agent': `${config.name}/${config.version}`, ...(specs.headers || {}) };
  
  // Always include full payload with metadata
  const data = {event, ...payload};

  let timeout = specs.timeout || config.jobs.notifications.timeout;
  if (timeout < 1) timeout = 1;
  if (timeout > config.jobs.notifications.timeout_max) timeout = config.jobs.notifications.timeout_max;

  const requestConfig: any = {
    method,
    headers,
    timeout,
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

