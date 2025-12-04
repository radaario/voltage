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
	instance_key: string;
	worker_key: string;
	status: string;
	progress: number;
	try_max: number;
	try_count: number;
	input?: any;
	outputs?: any[];
	destination?: any;
	notification?: any;
	metadata?: any;
	outcome?: any;
	started_at?: string;
	analyzed_at?: string;
	completed_at?: string;
	retry_at?: string | null;
	retry_in?: number;
}

export interface ProcessingResult {
	outputsProcessedCount: number;
	outputsUploadedCount: number;
}

export const JOB_PROGRESS_PER_STEP = 20.0; // Each step contributes 20% to the total progress
