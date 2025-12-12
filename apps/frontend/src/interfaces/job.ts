interface ServiceConfig {
	service: string;
	url?: string;
	path?: string;
	region?: string;
	bucket?: string;
	file_name?: string;
	file_extension?: string;
	file_mime_type?: string;
	file_size?: number;
	duration?: number;
	duration_in_ts?: number;
	video_width?: number;
	video_width_coded?: number;
	video_height?: number;
	video_height_coded?: number;
	video_aspect_ratio?: string;
	video_aspect_ratio_in_decimal?: number;
	video_frames?: number;
	video_frame_rate?: number;
	video_codec?: string;
	video_profile?: string;
	video_level?: number;
	video_bit_rate?: number;
	video_has_b_frames?: number;
	video_pixel_format?: string;
	video_chroma_location?: string;
	audio_codec?: string;
	audio_profile?: string;
	audio_channels?: number;
	audio_channel_layout?: string;
	audio_sample_rate?: number;
	audio_bit_rate?: number;
}

export interface JobOutput {
	key: string;
	job_key: string;
	index: number;
	specs: any;
	outcome: any | null;
	status:
		| "PENDING"
		| "QUEUED"
		| "PROCESSING"
		| "PROCESSED"
		| "UPLOADING"
		| "UPLOADED"
		| "COMPLETED"
		| "CANCELLED"
		| "DELETED"
		| "FAILED"
		| "TIMEOUT";
	started_at: string | null;
	processed_at: string | null;
	uploaded_at: string | null;
	completed_at: string | null;
	updated_at: string;
	created_at: string;
	try_max: number;
	try_count: number;
	retry_in: number;
}

export interface Job {
	key: string;
	instance_key: string | null;
	worker_key: string | null;
	priority: number;
	input: ServiceConfig;
	destination: ServiceConfig | null;
	notification: ServiceConfig | null;
	metadata: any | null;
	config: any | null;
	outcome: any | null;
	status:
		| "RECEIVED"
		| "PENDING"
		| "RETRYING"
		| "QUEUED"
		| "STARTED"
		| "DOWNLOADING"
		| "DOWNLOADED"
		| "ANALYZING"
		| "ANALYZED"
		| "PROCESSING"
		| "PROCESSED"
		| "UPLOADING"
		| "UPLOADED"
		| "COMPLETED"
		| "CANCELLED"
		| "DELETED"
		| "FAILED"
		| "TIMEOUT";
	progress?: number;
	started_at: string | null;
	analyzed_at: string;
	completed_at: string | null;
	updated_at: string;
	created_at: string;
	try_max: number;
	try_count: number;
	retry_in: number;
}

export interface JobError {
	key: string;
	message: string;
}
