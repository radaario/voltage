import { config } from '../../config/index.js';
import { NotificationSpec } from '../../config/types.js';

import { logger } from '../../utils/logger.js';

import axios from 'axios';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export async function notify(notification: NotificationSpec, payload: unknown): Promise<any> {
  let outcome: any = {
    status: 'FAILED',
  };

  try {
    if ('type' in notification) {
      if (notification.type === 'HTTP' || notification.type === 'HTTPS') {
        // HTTP/HTTPS notification
        outcome = await notifyHttp(notification, payload);
      } else if (notification.type === 'AWS_SNS') {
        // AWS SNS notification
        outcome = await notifySns(notification, payload);
      } else {
        throw new Error('Unknown notification type!');
      }
    } else {
      throw new Error('Invalid notification format!');
    }
  } catch (err: Error | any) {
    logger.error({ err, notification }, 'Notification failed!');
    outcome.error = { message: err.message || 'Unknown error' };
  }

  return outcome;
}

async function notifyHttp(notification: any, payload: unknown): Promise<any> {
  const method = notification.method || 'POST';
  const headers = { 'Content-Type': 'application/json', 'User-Agent': `${config.name}/${config.version}`, ...(notification.headers || {}) };
  
  // Always include full payload with metadata
  const data = payload;
  
  const requestConfig: any = {
    method,
    headers,
    timeout: (notification.timeout && parseInt(notification.timeout) > 0 && parseInt(notification.timeout) < config.notifications.timeout) ? parseInt(notification.timeout) : config.notifications.timeout || (10 * 1000),
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

async function notifySns(notification: { type: 'AWS_SNS'; access_key: string; access_secret: string; region: string; topic: string }, payload: unknown): Promise<any> {
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

  const response = await snsClient.send(command);

  let outcome: any = {
    status: response.$metadata.httpStatusCode === 200 ? 'SUCCESSFUL' : 'FAILED',
    http_status_code: response.$metadata.httpStatusCode,
  };

  if (response.$metadata.httpStatusCode !== 200) outcome.error = { message: 'Unknown error' }; // response.$metadata?.httpStatusText
  if (response.MessageId) outcome.message_id = response.MessageId;
  
  return outcome;
}

