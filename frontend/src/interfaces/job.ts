interface ServiceConfig {
  service: string;
  url?: string;
  region?: string;
  bucket?: string;
}

export interface Job {
  key: string;
  metadata: any | null;
  input: ServiceConfig;
  input_metadata: any | null;
  destination: ServiceConfig;
  notification: ServiceConfig;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  priority: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  error: string | null;
}

export interface JobError {
  key: string;
  message: string;
}