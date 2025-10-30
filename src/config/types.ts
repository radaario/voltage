export type AWS_S3_ACL = 'PUBLIC_READ' | 'PUBLIC_READ_WRITE' |  'AUTHENTICATED_READ' | 'AWS_EXEC_READ' | 'BUCKET_OWNER_READ' | 'BUCKET_OWNER_FULL_CONTROL' | 'PRIVATE';

export type InputSpec =
  | { 
      service: 'HTTP' | 'HTTPS'; 
      username?: string;
      password?: string;
      url: string;
    }
  | { 
      service: 'BASE64'; 
      content: string;
    }
  | { 
      service: 'FTP'; 
      host: string;
      username?: string;
      password?: string;
      path: string;
    }
  | { 
      service: 'AWS_S3';
      access_key_id: string; // Access Key ID
      secret_access_key: string; // Access Key Secret
      region: string;
      bucket: string;
      path: string;
    };

export type DestinationSpec =
  | {
      service: 'HTTP' | 'HTTPS';
      method?: 'POST' | 'PUT';
      headers?: Record<string, string>;
      url: string;
    }
  | {
      service: 'FTP' | 'SFTP';
      host: string;
      username: string;
      password: string;
    }
  | {
    service: 'AWS_S3' | 'OTHER_S3' | 'GOOGLE_CLOUD_STORAGE' | 'DO_SPACES' | 'LINODE' | 'WASABI' | 'BACKBLAZE' | 'RACKSPACE' | 'MICROSOFT_AZURE';
    endpoint?: string; // Custom endpoint for non-AWS S3 compatible services
    access_key_id: string; // Access Key ID
    secret_access_key: string; // Access Key Secret
    region: string;
    bucket: string;
    acl?: AWS_S3_ACL;
    expires?: number;
    cache_control?: string;
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
      service: 'HTTP' | 'HTTPS';
      method?: 'GET' | 'POST' | 'PUT';
      headers?: Record<string, string>;
      url: string;
    }
  | {
      service: 'AWS_SNS';
      access_key_id: string; // Access Key ID
      secret_access_key: string; // Access Key Secret
      region: string;
      topic: string; // Topic ARN
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
  error?: any | null;
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

