import { config } from '../../config/index.js';
import { NotificationSpec } from '../../config/types.js';

import { sanitizeData } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';

import axios from 'axios';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export async function notifyJob(job: any): Promise<any> {
  const payload: any = { 
    key: job.key,
    priority: job.priority,
    status: job.status,
    progress: job.progress || 0.00,
  };

  for (const key of ['error', 'metadata', 'input', 'outputs', 'destination', 'notification']) {
    if (job[key]) {
      if (typeof job[key] === 'string'){
        try {
          job[key] = JSON.parse(job[key]);
        } catch (err: Error | any) {
        }
      }

      payload[key] = sanitizeData(job[key]);
    }
  }

  if (job.notification) {
    await notify(job.notification, payload);
  }

  return payload;
}

export async function notify(notification: NotificationSpec, payload: unknown): Promise<void> {
  try {
    if ('type' in notification) {
      if (notification.type === 'HTTP' || notification.type === 'HTTPS') {
        // HTTP/HTTPS notification
        await notifyHttp(notification, payload);
      } else if (notification.type === 'AWS_SNS') {
        // AWS SNS notification
        await notifySns(notification, payload);
      } else {
        logger.warn({ notification }, 'Unknown notification type');
      }
    } else {
      logger.warn({ notification }, 'Invalid notification format');
    }
  } catch (err: Error | any) {
    logger.error({ err, notification }, 'Notification failed');
    // Best-effort notification; ignore failures
  }
}

async function notifyHttp(notification: { type: 'HTTP' | 'HTTPS'; method?: 'GET' | 'POST' | 'PUT'; headers?: Record<string, string>; url: string }, payload: unknown): Promise<void> {
  const method = notification.method || 'POST';
  const headers = { 'Content-Type': 'application/json', 'User-Agent': `${config.name}/${config.version}`, ...(notification.headers || {}) };
  
  // Always include full payload with metadata
  const data = payload;
  
  const requestConfig: any = {
    method,
    headers,
    timeout: 5000
  };

  if (method === 'GET') {
    // For GET requests, append payload as query parameters
    const params = new URLSearchParams();
    Object.entries(data as any).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    requestConfig.url = `${notification.url}?${params.toString()}`;
  } else {
    // For POST/PUT requests, send as JSON body
    requestConfig.url = notification.url;
    requestConfig.data = data;
  }

  await axios.request(requestConfig);
}

async function notifySns(notification: { type: 'AWS_SNS'; access_key: string; access_secret: string; region: string; topic: string }, payload: unknown): Promise<void> {
  const snsClient = new SNSClient({
    region: notification.region,
    credentials: {
      accessKeyId: notification.access_key,
      secretAccessKey: notification.access_secret,
    }
  });

  // Always include full payload with metadata
  const messageData = payload;
  
  const command = new PublishCommand({
    TopicArn: notification.topic,
    Message: JSON.stringify(messageData),
    Subject: `Job ${(payload as any)?.status || 'update'}`,
  });

  await snsClient.send(command);
}

