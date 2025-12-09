export interface JobStats {
	[key: string]: any;
	jobs_completed_count: number;
	jobs_retried_count: number;
	jobs_failed_count: number;
	inputs_completed_count: number;
	inputs_completed_duration: number;
	inputs_failed_count: number;
	inputs_failed_duration: number;
	outputs_completed_count: number;
	outputs_completed_duration: number;
	outputs_failed_count: number;
	outputs_failed_duration: number;
}

export interface JobContext {
	key: string;
	priority: number;
	input?: any;
	destination?: any;
	notification?: any;
	metadata?: any;
	outcome?: any;
	status: string;
	progress: number;
	started_at?: string;
	downloaded_at?: string;
	analyzed_at?: string;
	completed_at?: string;
	updated_at?: string;
	created_at?: string;
	try_max: number;
	try_count: number;
	retry_at?: string | null;
	retry_in?: number;
	locked_by?: string;
	instance_key?: string;
	worker_key?: string;
}

export interface JobOutputContext {
	key: string;
	job_key: string;
	index: number;
	priority: number;
	specs?: any;
	outcome?: any;
	status: string;
	started_at?: string | null;
	processed_at?: string | null;
	uploaded_at?: string | null;
	completed_at?: string | null;
	updated_at?: string;
	created_at?: string;
	try_max: number;
	try_count: number;
	retry_at?: string | null;
	retry_in?: number;
	locked_by?: string;
	instance_key?: string;
	worker_key?: string;
}

export const JOB_PROGRESS_PER_STEP = 20.0; // Each step contributes 20% to the total progress
