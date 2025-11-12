export type AWS_S3_ACL = 'PUBLIC_READ' | 'PUBLIC_READ_WRITE' |  'AUTHENTICATED_READ' | 'AWS_EXEC_READ' | 'BUCKET_OWNER_READ' | 'BUCKET_OWNER_FULL_CONTROL' | 'PRIVATE';

export type InputSpecs =
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

export type DestinationSpecs =
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

type OutputSpecsCommon = {
  path?: string; // required if destination is S3 or FTP
  acl?: AWS_S3_ACL; // optional if destination is S3, default: PUBLIC
  expires?: number; // optional if destination is S3, in seconds
  cache_control?: string; // optional if destination is S3
  destination?: DestinationSpecs; // optional - if not provided, will use global destination
};

type OutputSpecsCut = {
  offset?: number; // in seconds
  duration?: number; // in seconds
};

type OutputSpecsImage = {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  fit?: 'PAD' | 'STRETCH' | 'CROP' | 'MAX';
  rotate?: 90 | -90 | 180 | -180;
  flip?: 'HORIZONTAL' | 'VERTICAL' | 'BOTH';
};

type OutputSpecsAudio = {
  audio_codec?: string;
  audio_bitrate?: string; // e.g. '128k'
  audio_sample_rate?: number; // in Hz
  audio_channels?: number; // e.g. 2
};

export type OutputSpecs =
  | ({
      type: 'VIDEO',
      format: 'MP4' | 'WEBM' | 'OGV' | 'MOV' | 'AVI' | 'WMV' | 'ASF' | 'FLV' | 'MKV' | 'TS' | 'M2TS' | 'MPG' | 'MPEG' | 'GIF' | 'RAW' | string;
      video_codec?: string;
      video_bitrate?: string; // e.g. '2500k'
      video_pix_fmt?: string; // e.g. 'yuv420p'
      video_fps?: number;
      video_vprofile?: string; // e.g. 'high', 'main', 'baseline'
      video_level?: string; // e.g. '4.0', '4.1', '5.0'
      video_deinterlace?: boolean;
    } & OutputSpecsAudio & OutputSpecsCut & OutputSpecsImage & OutputSpecsCommon)
  | ({
      type: 'AUDIO',
      format: 'MP3' | 'AAC' | 'WAV' | 'FLAC' | 'OGG' | 'OPUS' | 'ALAC' | 'WMA' | 'AIFF' | 'AMR-NB' | 'AMR-WB' | string;
    } & OutputSpecsAudio & OutputSpecsCut & OutputSpecsCommon)
  | ({
      type: 'THUMBNAIL',
      format: 'JPG' | 'PNG' | 'WEBP' | 'BMP' | string;
      offset?: number; // in seconds
    } & OutputSpecsImage & OutputSpecsCommon)
  | ({
      type: 'SUBTITLE'
      format: 'SRT' | 'VTT' | 'JSON' | 'CSV' | 'TXT' | string;
      language?: string;
      model?: 'BASE' | 'BASE_EN' | 'TINY' | 'TINY_EN' | 'SMALL' | 'SMALL_EN' | 'MEDIUM' | 'MEDIUM_EN' | 'LARGE_V1' | 'LARGE_V3_TURBO' | string;
    } & OutputSpecsCommon);

export type NotificationSpecs =
  | {
      type: 'HTTP' | 'HTTPS';
      method?: 'GET' | 'POST' | 'PUT';
      headers?: Record<string, string>;
      url: string;
      notify_on?: any;
      timeout?: number; // in milliseconds
      try?: number;
      retry_in?: number; // in milliseconds
    }
  | {
      type: 'AWS_SNS';
      access_key: string; // Access Key ID
      access_secret: string; // Access Key Secret
      region: string;
      topic: string; // Topic ARN
      notify_on?: any;
      timeout?: number; // in milliseconds
      try?: number;
      retry_in?: number; // in milliseconds
    };

export type JobRequest = {
  priority?: number; // priority value (lower = higher priority, default: 1000)
  input: InputSpecs;
  outputs: OutputSpecs[];
  destination?: DestinationSpecs; // optional global destination for outputs that don't have their own
  notification?: NotificationSpecs;
  metadata?: Record<string, any>[]; // custom metadata to be sent back with notifications
  try_max?: number | 1;
  retry_in?: number | 0;
};

export type JobRow = {
  key: string;
  instance_key?: string | null;
  worker_key?: string | null;
  priority?: number | 1000;
  input?: any | null;
  outputs?: any | null;
  destination?: any | null;
  notification?: any | null;
  metadata?: any | null;
  status?: 'RECEIVED' | 'PENDING' | 'RETRYING' | 'QUEUED' | 'STARTED' | 'DOWNLOADING' | 'DOWNLOADED' | 'ANALYZING' | 'ANALYZED' | 'PROCESSING' | 'PROCESSED' | 'UPLOADING' | 'UPLOADED' | 'COMPLETED' | 'CANCELLED' | 'DELETED' | 'FAILED' | 'TIMEOUT';
  progress?: number | 0.00; // STARTED = 0; DOWNLOADING = 20; ANALYZING = 40; PROCESSING = 60; UPLOADING = 80; COMPLETED = 100;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
  created_at?: string;
  outcome?: any | null;
  try_max?: number | 1;
  try_count?: number | 0;
  retry_in?: number | 0;
  retry_at?: string | null;
};

export type JobNotificationRow = {
  key: string;
  instance_key?: string | null;
  worker_key?: string | null;
  job_key?: string;
  priority?: number | 1000;
  specs?: any | null;
  payload?: any | null;
  outcome?: any | null;
  status?: 'PENDING' | 'RETRYING' | 'QUEUED' | 'SUCCESSFUL' | 'SKIPPED' | 'FAILED';
  updated_at?: string;
  created_at?: string;
  try_max: number | 3; // default 3
  try_count: number | 0;
  retry_in: number | 60000; // in milliseconds, default 1 minute
  retry_at?: string | null;
};

