export type AWS_S3_ACL = 'PUBLIC_READ' | 'PUBLIC_READ_WRITE' |  'AUTHENTICATED_READ' | 'AWS_EXEC_READ' | 'BUCKET_OWNER_READ' | 'BUCKET_OWNER_FULL_CONTROL' | 'PRIVATE';

export type InputSpec =
  | { 
      type: 'BASE64'; 
      content: string;
    }  
  | { 
      type: 'HTTP' | 'HTTPS'; 
      username?: string;
      password?: string;
      url: string;
    }
  | { 
      type: 'AWS_S3' | 'GOOGLE_CLOUD_STORAGE' | 'DO_SPACES' | 'LINODE' | 'WASABI' | 'BACKBLAZE' | 'RACKSPACE' | 'MICROSOFT_AZURE' | 'OTHER_S3';
      access_key: string; // Access Key ID
      access_secret: string; // Access Key Secret
      region: string;
      bucket: string;
      path: string;
    }
  | { 
      type: 'FTP' | 'SFTP'; 
      host: string;
      username?: string;
      password?: string;
      path: string;
    };

export type DestinationSpec =
  | {
      type: 'HTTP' | 'HTTPS';
      method?: 'POST' | 'PUT';
      headers?: Record<string, string>;
      url: string;
    }
  | {
    type: 'AWS_S3' | 'GOOGLE_CLOUD_STORAGE' | 'DO_SPACES' | 'LINODE' | 'WASABI' | 'BACKBLAZE' | 'RACKSPACE' | 'MICROSOFT_AZURE' | 'OTHER_S3';
    endpoint?: string; // Custom endpoint for non-AWS S3 compatible types
    access_key: string; // Access Key ID
    access_secret: string; // Access Key Secret
    region: string;
    bucket: string;
    acl?: AWS_S3_ACL;
    expires?: number;
    cache_control?: string;
    }
  | {
      type: 'FTP' | 'SFTP';
      host: string;
      port?: number; // optional, default FTP: 21, SFTP: 22
      username: string;
      password: string;
      secure?: boolean; // for FTP (FTPS with explicit TLS)
    };

export type OutputSpec = {
  container: 'mp4' | 'mkv' | 'mov' | 'webm' | 'ts' | string;
  videoCodec?: string;
  videoBitrate?: string; // e.g. '2500k'
  audioCodec?: string;
  audioBitrate?: string; // e.g. '128k'
  width?: number;
  height?: number;
  extraArgs?: string[]; // advanced ffmpeg args
  path?: string; // required if destination is AWS_S3 or FTP
  acl?: AWS_S3_ACL;
  expires?: number;
  cache_control?: string;
  destination?: DestinationSpec; // optional - if not provided, will use global destination
};

export type NotificationSpec =
  | {
      type: 'HTTP' | 'HTTPS';
      method?: 'GET' | 'POST' | 'PUT';
      headers?: Record<string, string>;
      url: string;
      timeout?: number; // in milliseconds
      retry?: number;
      retry_in?: number; // in milliseconds
    }
  | {
      type: 'AWS_SNS';
      access_key: string; // Access Key ID
      access_secret: string; // Access Key Secret
      region: string;
      topic: string; // Topic ARN
      timeout?: number; // in milliseconds
      retry?: number;
      retry_in?: number; // in milliseconds
    };

export type CreateJobRequest = {
  priority?: number; // priority value (lower = higher priority, default: 1000)
  input: InputSpec;
  outputs: OutputSpec[];
  destination?: DestinationSpec; // optional global destination for outputs that don't have their own
  notification?: NotificationSpec;
  metadata?: Record<string, any>[]; // custom metadata to be sent back with notifications
};

export type JobRow = {
  key: string;
  instance_key?: string;
  worker_key?: string;
  priority?: number | 1000;
  input?: any | null;
  outputs?: any | null;
  destination?: any | null;
  notification?: any | null;
  metadata?: any | null;
  status: 'QUEUED' | 'PENDING' | 'DOWNLOADING' | 'ANALYZING' | 'ENCODING' | 'UPLOADING' | 'COMPLETED' | 'CANCELLED' | 'DELETED' | 'FAILED';
  progress: number | 0.00; // PENDING = 0; DOWNLOADING = 20; ANALYZING = 40; ENCODING = 60; UPLOADING = 80; COMPLETED = 100;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
  created_at?: string;
  outcome?: any | null;
};

export type JobNotificationRow = {
  key: string;
  instance_key?: string;
  worker_key?: string;
  job_key?: string;
  type?: string;
  priority?: number | 1000;
  payload?: any | null;
  status?: 'PENDING' | 'SUCCESSFUL' | 'SKIPPED' | 'FAILED';
  retry_max?: number | 0;
  retry_count?: number | 0;
  retry_at?: string | null;
  updated_at?: string;
  created_at?: string;
  outcome?: any | null;
};

export type JobOutputRow = {
  key: string;
  job_key: string;
  index: number;
  specs: unknown;
  result: unknown | null;
  status: 'PENDING' | 'ENCODING' | 'UPLOADING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  updated_at: string;
  created_at: string;
  error: unknown | null;
};

