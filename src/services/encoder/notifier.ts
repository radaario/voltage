import { config } from '../../config';
import { NotificationSpec } from '../../config/types.js';

import { sanitizeData } from '../../utils';
import { logger } from '../../utils/logger.js';

import axios from 'axios';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export async function notifyJob(jobKey: string, status: string, priority: number, job: any): Promise<any> {
  const payload: any = { 
    key: jobKey,
    status: status,
    priority: priority
  };

  for (const key of ['error', 'metadata', 'input', 'outputs', 'destination', 'notification']) {
    if (job[key]) {
      if (typeof job[key] === 'string'){
        try {
          job[key] = JSON.parse(job[key]);
        } catch (e) {
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
    if ('service' in notification) {
      if (notification.service === 'HTTP' || notification.service === 'HTTPS') {
        // HTTP/HTTPS notification
        await notifyHttp(notification, payload);
      } else if (notification.service === 'AWS_SNS') {
        // AWS SNS notification
        await notifySns(notification, payload);
      } else {
        logger.warn({ notification }, 'Unknown notification service');
      }
    } else {
      logger.warn({ notification }, 'Invalid notification format');
    }
  } catch (error) {
    logger.error({ error, notification }, 'Notification failed');
    // Best-effort notification; ignore failures
  }
}

async function notifyHttp(notification: { service: 'HTTP' | 'HTTPS'; method?: 'GET' | 'POST' | 'PUT'; headers?: Record<string, string>; url: string }, payload: unknown): Promise<void> {
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

async function notifySns(notification: { service: 'AWS_SNS'; access_key_id: string; secret_access_key: string; region: string; topic: string }, payload: unknown): Promise<void> {
  const snsClient = new SNSClient({
    region: notification.region,
    credentials: {
      accessKeyId: notification.access_key_id,
      secretAccessKey: notification.secret_access_key,
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

