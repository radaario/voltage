export type AWS_S3_ACL = 'PUBLIC_READ' | 'PUBLIC_READ_WRITE' |  'AUTHENTICATED_READ' | 'AWS_EXEC_READ' | 'BUCKET_OWNER_READ' | 'BUCKET_OWNER_FULL_CONTROL' | 'PRIVATE';

export type InputSpec =
  | { 
      service: 'HTTP' | 'HTTPS'; 
      username?: string;
      password?: string;
      url: string;
      extract_metadata?: boolean;
    }
  | { 
      service: 'BASE64'; 
      content: string;
      extract_metadata?: boolean;
    }
  | { 
      service: 'FTP'; 
      host: string;
      username?: string;
      password?: string;
      path: string;
      extract_metadata?: boolean;
    }
  | { 
      service: 'AWS_S3'; 
      key: string; // access key id
      secret: string; // access key secret
      region: string;
      bucket: string;
      path: string;
      extract_metadata?: boolean;
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
    key: string; // Access Key Id
    secret: string; // Access Key Secret
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
      key: string; // access key id
      secret: string; // access key secret
      region: string;
      topic: string; // topic arn
    };

export type CreateJobRequest = {
  metadata?: Record<string, any>[]; // custom metadata to be sent back with notifications
  input: InputSpec;
  outputs: OutputSpec[];
  destination?: DestinationSpec; // optional global destination for outputs that don't have their own
  notification?: NotificationSpec;
  priority?: number; // priority value (lower = higher priority, default: 1000)
};

export type JobRow = {
  key: string;
  metadata: unknown | null;
  input: unknown;
  input_metadata: unknown | null;
  destination: unknown | null;
  notification: unknown | null;
  status: 'QUEUED' | 'PENDING' | 'DOWNLOADING' | 'ANALYZING' | 'ENCODING' | 'UPLOADING' | 'COMPLETED' | 'CANCELLED' | 'DELETED' | 'FAILED';
  priority: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  error: unknown | null;
};

export type InputMetadata = {
  file: {
    name: string;
    extension: string;
    mime_type: string;
    size: number;
  };
  duration: number; // in seconds, e.g. 60.066667
  duration_in_ts: number; // in timestamp format, e.g. 922624
  video: null | {
    width: number;
    width_coded: number;
    height: number;
    height_coded: number;
    aspect_ratio: string; // e.g. "16:9", "4:3"
    aspect_ratio_in_decimal: number; // e.g. 1.777777777777778
    frames: number;
    frame_rate: number;
    codec: string;
    profile: string;
    level: string;
    bit_rate: number;
    has_b_frames: number;
    pixel_format: string; // e.g. "yuv420p", "yuv422p", "yuv444p"
    chroma_location: string;
  };
  audio: null | {
    codec: string;
    profile: string;
    channels: number;
    channel_layout: string; // e.g. "5.1"
    sample_rate: number;
    bit_rate: number;
  };
};

export type JobOutputRow = {
  key: string;
  job_key: string;
  output_index: number;
  spec_json: unknown;
  result_json: unknown | null;
  status: 'PENDING' | 'ENCODING' | 'UPLOADING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  updated_at: string;
  created_at: string;
  error: unknown | null;
};

