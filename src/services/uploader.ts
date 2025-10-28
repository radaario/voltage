import axios from 'axios';
import { OutputSpec, DestinationSpec, AWS_S3_ACL } from '../types.js';
import fs from 'fs/promises';
import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { logger } from '../logger.js';

export async function uploadOutput(spec: OutputSpec, filePath: string, globalDestination?: DestinationSpec): Promise<Record<string, unknown>> {
  // Use output's destination if available, otherwise fall back to global destination
  const destination = spec.destination || globalDestination;
  
  if (!destination) {
    throw new Error('No destination specified for output and no global destination provided');
  }

  if (destination.service === 'HTTP' || destination.service === 'HTTPS') {
    const data = await fs.readFile(filePath);
    const method = destination.method ?? 'POST';
    const resp = await axios.request({
      url: destination.url,
      method,
      headers: { 'Content-Type': 'application/octet-stream', ...(destination.headers ?? {}) },
      data
    });
    return { status: resp.status, headers: resp.headers };
  }

  if (destination.service === 'FTP') {
    // Basic FTP upload not implemented; recommend proper FTP client lib.
    throw new Error('FTP upload not implemented; extend with an FTP client');
  }

  const s3CompatibleServices = ['AWS_S3', 'OTHER_S3', 'GOOGLE_CLOUD_STORAGE', 'DO_SPACES', 'LINODE', 'WASABI', 'BACKBLAZE', 'RACKSPACE', 'MICROSOFT_AZURE'] as const;
  
  if (s3CompatibleServices.includes(destination.service as any)) {
    // For S3-compatible services, we need the path from the output spec
    if (!spec.path) {
      throw new Error(`Path is required for ${destination.service} destination`);
    }

    const s3Destination = destination as { 
      service: typeof s3CompatibleServices[number];
      key: string;
      secret: string;
      region: string;
      bucket: string;
      acl?: AWS_S3_ACL;
      endpoint?: string;
    };

    // Resolve ACL precedence for acl
    const aclFromOutput = (spec as OutputSpec & { acl?: AWS_S3_ACL }).acl;
    const aclFromSpecDestination = spec.destination && s3CompatibleServices.includes((spec.destination as any).service)
      ? (spec.destination as any).acl
      : undefined;
    const aclFromGlobal = globalDestination && s3CompatibleServices.includes((globalDestination as any).service)
      ? (globalDestination as any).acl
      : undefined;
    const acl: AWS_S3_ACL = (aclFromOutput || aclFromSpecDestination || aclFromGlobal || 'PUBLIC_READ') as AWS_S3_ACL;

    // Resolve ACL precedence for expires
    const expiresFromOutput = (spec as OutputSpec & { expires?: number }).expires;
    const expiresFromSpecDestination = spec.destination && s3CompatibleServices.includes((spec.destination as any).service)
      ? (spec.destination as any).expires
      : undefined;
    const expiresFromGlobal = globalDestination && s3CompatibleServices.includes((globalDestination as any).service)
      ? (globalDestination as any).expires
      : undefined;
    const expires: number | undefined = expiresFromOutput || expiresFromSpecDestination || expiresFromGlobal;

    // Resolve ACL precedence for cache_control
    const cacheControlFromOutput = (spec as OutputSpec & { cache_control?: string }).cache_control;
    const cacheControlFromSpecDestination = spec.destination && s3CompatibleServices.includes((spec.destination as any).service)
      ? (spec.destination as any).cache_control
      : undefined;
    const cacheControlFromGlobal = globalDestination && s3CompatibleServices.includes((globalDestination as any).service)
      ? (globalDestination as any).cache_control
      : undefined;
    const cacheControl: string | undefined = cacheControlFromOutput || cacheControlFromSpecDestination || cacheControlFromGlobal;

    return await uploadToS3(s3Destination, spec.path, filePath, acl, expires, cacheControl);
  }

  throw new Error(`Unsupported destination service: ${destination.service}`);
}

async function uploadToS3(destination: { 
  service: 'AWS_S3' | 'OTHER_S3' | 'GOOGLE_CLOUD_STORAGE' | 'DO_SPACES' | 'LINODE' | 'WASABI' | 'BACKBLAZE' | 'RACKSPACE' | 'MICROSOFT_AZURE';
  key: string; 
  secret: string; 
  region: string; 
  bucket: string; 
  acl?: string;
  endpoint?: string;
}, s3Path: string, filePath: string, acl?: string, expires?: number, cacheControl?: string): Promise<Record<string, unknown>> {
  try {
    // Initialize S3 client with credentials and proper endpoint for each service
    const s3ClientConfig: any = {
      region: destination.region,
      credentials: {
        accessKeyId: destination.key,
        secretAccessKey: destination.secret,
      },
      ...(destination.endpoint ? { endpoint: destination.endpoint } : {}),
    };

    // Configure service-specific endpoints if not provided
    if (!destination.endpoint) {
      switch (destination.service) {
        case 'GOOGLE_CLOUD_STORAGE':
          s3ClientConfig.endpoint = `https://storage.googleapis.com`;
          break;
        case 'DO_SPACES':
          s3ClientConfig.endpoint = `https://${destination.region}.digitaloceanspaces.com`;
          break;
        case 'LINODE':
          s3ClientConfig.endpoint = `https://${destination.region}.linodeobjects.com`;
          break;
        case 'WASABI':
          s3ClientConfig.endpoint = `https://s3.${destination.region}.wasabisys.com`;
          break;
        case 'BACKBLAZE':
          s3ClientConfig.endpoint = `https://s3.${destination.region}.backblazeb2.com`;
          break;
        case 'RACKSPACE':
          s3ClientConfig.endpoint = `https://storage101.${destination.region}.clouddrive.com/v1`;
          break;
        case 'MICROSOFT_AZURE':
          s3ClientConfig.endpoint = `https://${destination.bucket}.blob.core.windows.net`;
          break;
        case 'OTHER_S3':
          if (!destination.endpoint) {
            throw new Error('Endpoint is required for OTHER_S3 service');
          }
          break;
      }
    }

    const s3Client = new S3Client(s3ClientConfig);

    // Read file data
    const fileData = await fs.readFile(filePath);

    // Ensure S3 key has no leading slash
    const key = s3Path.replace(/^\/+/, '');

    // Prepare upload parameters
    const uploadParams: PutObjectCommandInput = {
      Bucket: destination.bucket,
      Key: key,
      Body: fileData,
      ContentType: getContentTypeFromFileExtension(key),
    };

    if (['AWS_S3', 'DO_SPACES', 'LINODE', 'WASABI'].includes(destination.service) && acl) {
      // Normalize ACL to the format AWS expects (lowercase and '-' instead of '_')
      // e.g. 'PUBLIC_READ' -> 'public-read'
      const normalizedAcl = String(acl).toLowerCase().replace(/_/g, '-');
      (uploadParams as any).ACL = normalizedAcl;
    }

    if (['AWS_S3', 'GOOGLE_CLOUD_STORAGE'].includes(destination.service) && typeof expires === 'number') {
      // expires parametresi, S3'te Expires header olarak Date objesiyle verilmeli
      (uploadParams as any).Expires = new Date(Date.now() + expires * 1000);
    }

    if (['AWS_S3', 'GOOGLE_CLOUD_STORAGE'].includes(destination.service) && cacheControl) {
      (uploadParams as any).CacheControl = cacheControl;
    }
    
    // Upload to S3
    const command = new PutObjectCommand(uploadParams);
    const result = await s3Client.send(command);

    logger.info({ 
      bucket: destination.bucket, 
      path: key, 
      etag: result.ETag,
      versionId: result.VersionId 
    }, 'Successfully uploaded to S3');

    return {
      bucket: destination.bucket,
      path: key,
      etag: result.ETag,
      versionId: result.VersionId,
      location: `s3://${destination.bucket}/${key}`,
      url: `https://${destination.bucket}.s3.${destination.region}.amazonaws.com/${key}`
    };
  } catch (error) {
    logger.error({ error, bucket: destination.bucket, path: s3Path }, 'S3 upload failed');
    throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getContentTypeFromFileExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mkv': 'video/x-matroska',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'ts': 'video/mp2t',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    'ogg': 'video/ogg',
    'ogv': 'video/ogg'
  };
  
  return contentTypes[ext || ''] || 'application/octet-stream';
}

