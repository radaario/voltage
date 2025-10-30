interface ServiceConfig {
	service: string;
	url?: string;
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

interface InputMetadata {
	file: {
		name: string;
		extension: string;
		mime_type: string;
		size: number;
	};
	duration: number;
	duration_in_ts: number;
	video: null | {
		video_width: number;
		video_width_coded: number;
		video_height: number;
		video_height_coded: number;
		video_aspect_ratio: string;
		video_aspect_ratio_in_decimal: number;
		video_frames: number;
		video_frame_rate: number;
		video_codec: string;
		video_profile: string;
		video_level: string;
		video_bit_rate: number;
		video_has_b_frames: number;
		video_pixel_format: string;
		video_chroma_location: string;
	};
	audio: null | {
		audio_codec: string;
		audio_profile: string;
		audio_channels: number;
		audio_channel_layout: string;
		audio_sample_rate: number;
		audio_bit_rate: number;
	};
}

export interface Job {
	key: string;
	metadata: any | null;
	input: ServiceConfig;
	input_metadata: InputMetadata | null;
	destination: ServiceConfig | null;
	notification: ServiceConfig | null;
	status:
		| "PENDING"
		| "QUEUED"
		| "RUNNING"
		| "COMPLETED"
		| "FAILED"
		| "DOWNLOADING"
		| "ANALYZING"
		| "ENCODING"
		| "UPLOADING"
		| "CANCELLED"
		| "DELETED";
	priority: number;
	progress?: number;
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
