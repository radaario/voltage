import axios from 'axios';
import { InputSpec } from '../types.js';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../logger.js';

export async function downloadInput(input: InputSpec): Promise<string> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'enc-input-'));
  
  // Extract filename from input source
  let fileName = 'input';
  if (input.service === 'HTTP' || input.service === 'HTTPS') {
    const urlPath = new URL(input.url).pathname;
    const extractedName = path.basename(urlPath);
    if (extractedName && extractedName !== '/') {
      fileName = extractedName;
    }
  } else if (input.service === 'FTP') {
    const extractedName = path.basename(input.path);
    if (extractedName) {
      fileName = extractedName;
    }
  } else if (input.service === 'AWS_S3') {
    const extractedName = path.basename(input.path);
    if (extractedName) {
      fileName = extractedName;
    }
  }
  // For BASE64, we keep the default 'input' filename
  
  const file = path.join(dir, fileName);
  logger.info({ inputService: input.service, extractedFileName: fileName, fullPath: file }, 'Downloading input file');

  if (input.service === 'BASE64') {
    const buffer = Buffer.from(input.content, 'base64');
    await fs.writeFile(file, buffer);
    return file;
  }

  if (input.service === 'HTTP' || input.service === 'HTTPS') {
    const auth = (input.username && input.password) ? {
      username: input.username,
      password: input.password
    } : undefined;
    
    const resp = await axios.get<ArrayBuffer>(input.url, { 
      responseType: 'arraybuffer',
      auth
    });
    await fs.writeFile(file, Buffer.from(resp.data));
    return file;
  }

  if (input.service === 'FTP') {
    // Construct FTP URL with credentials
    const ftpUrl = `ftp://${input.username}:${input.password}@${input.host}${input.path}`;
    const resp = await axios.get<ArrayBuffer>(ftpUrl, {
      responseType: 'arraybuffer'
    });
    await fs.writeFile(file, Buffer.from(resp.data));
    return file;
  }

  if (input.service === 'AWS_S3') {
    return await downloadFromS3(input, file);
  }

  throw new Error(`Unsupported input service: ${input.service}`);
}

async function downloadFromS3(input: { service: 'AWS_S3'; path: string; key: string; secret: string; region: string; bucket: string }, filePath: string): Promise<string> {
  try {
    // Initialize S3 client with credentials from request
    const s3ClientConfig: any = {
      region: input.region,
      credentials: {
        accessKeyId: input.key,
        secretAccessKey: input.secret,
      }
    };

    const s3Client = new S3Client(s3ClientConfig);

    // Download from S3
    const command = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.path,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No data received from S3');
    }

    // Convert stream to buffer and write to file
    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    await fs.writeFile(filePath, buffer);

    logger.info({ 
      bucket: input.bucket, 
      path: input.path,
      size: buffer.length,
      contentType: response.ContentType 
    }, 'Successfully downloaded from S3');

    return filePath;
  } catch (error) {
    logger.error({ error, bucket: input.bucket, path: input.path }, 'S3 download failed');
    throw new Error(`S3 download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

