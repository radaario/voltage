import {
	HTTPS_TYPES,
	BASE64_TYPES,
	STORAGE_TYPES,
	STORAGE_S3_LIKE_TYPES,
	STORAGE_S3_LIKE_ACLS,
	STORAGE_FTP_TYPES,
	DATABASE_TYPES,
	FFMPEG_PRESETS,
	NSFW_MODELS,
	NSFW_TYPES,
	WHISPER_MODELS,
	PREVIEW_FORMATS,
	VIDEO_FORMATS,
	VIDEO_CODECS,
	VIDEO_PROFILES,
	VIDEO_PIXEL_FORMATS,
	VIDEO_LEVELS,
	AUDIO_FORMATS,
	AUDIO_CODECS,
	AUDIO_CHANNELS,
	THUMBNAIL_FORMATS,
	SUBTITLE_FORMATS,
	FIT_MODES,
	ROTATE_MODES,
	FLIP_MODES,
	NOTIFICATION_NOTIFY_ON_TYPES
} from "../constants";

// =====================================================
// CONFIGURATION TYPES
// =====================================================

export type HTTP_TYPE = (typeof HTTPS_TYPES)[number];
export type BASE64_TYPE = (typeof BASE64_TYPES)[number];

export type STORAGE_TYPE = (typeof STORAGE_TYPES)[number];
export type STORAGE_S3_LIKE_TYPE = (typeof STORAGE_S3_LIKE_TYPES)[number];
export type STORAGE_S3_LIKE_ACL = (typeof STORAGE_S3_LIKE_ACLS)[number];
export type STORAGE_FTP_TYPE = (typeof STORAGE_FTP_TYPES)[number];

export type DATABASE_TYPE = (typeof DATABASE_TYPES)[number];

export type FFMPEG_PRESET = (typeof FFMPEG_PRESETS)[number];
export type NSFW_MODEL = (typeof NSFW_MODELS)[number];
export type NSFW_TYPE = (typeof NSFW_TYPES)[number];
export type WHISPER_MODEL = (typeof WHISPER_MODELS)[number];

export type PREVIEW_FORMAT = (typeof PREVIEW_FORMATS)[number];

export type VIDEO_FORMAT = (typeof VIDEO_FORMATS)[number];
export type VIDEO_CODEC = (typeof VIDEO_CODECS)[number];
export type VIDEO_PROFILE = (typeof VIDEO_PROFILES)[number];
export type VIDEO_PIXEL_FORMAT = (typeof VIDEO_PIXEL_FORMATS)[number];
export type VIDEO_LEVEL = (typeof VIDEO_LEVELS)[number];

export type AUDIO_FORMAT = (typeof AUDIO_FORMATS)[number];
export type AUDIO_CODEC = (typeof AUDIO_CODECS)[number];
export type AUDIO_CHANNEL = (typeof AUDIO_CHANNELS)[number];

export type THUMBNAIL_FORMAT = (typeof THUMBNAIL_FORMATS)[number];
export type SUBTITLE_FORMAT = (typeof SUBTITLE_FORMATS)[number];

export type FIT_MODE = (typeof FIT_MODES)[number];
export type ROTATE_MODE = (typeof ROTATE_MODES)[number];
export type FLIP_MODE = (typeof FLIP_MODES)[number];

export type NOTIFICATIONS_NOTIFY_ON_TYPE = (typeof NOTIFICATION_NOTIFY_ON_TYPES)[number];

export interface APP_CONFIG {
	name: string;
	version: string;
	env: string;
	ngnix_port: number;
	url: string;
	protocol: string;
	host: string;
	path: string;
	port: number;
	timezone: string;
	dir: string;
	temp_dir: string;

	utils: {
		ffprobe: {
			path: string;
			general_attributes: string;
			video_attributes: string;
			audio_attributes: string;
		};
		ffmpeg: {
			path: string;
			preset: FFMPEG_PRESET;
			quality: number;
		};
		nsfw: {
			model: NSFW_MODEL;
			size: number;
			type: NSFW_TYPE;
			threshold: number;
		};
		whisper: {
			model: WHISPER_MODEL;
			with_cuda: boolean;
		};
	};

	storage: {
		type: STORAGE_TYPE;
		endpoint: string;
		access_key: string;
		access_secret: string;
		region: string;
		bucket: string;
		host: string;
		username: string;
		password: string;
		secure: boolean;
		base_path: string;
	};

	database: {
		type: DATABASE_TYPE;
		host: string;
		port: number;
		username: string;
		password: string;
		name: string;
		table_prefix: string;
		file_name: string;
		cleanup_interval: number;
	};

	runtime: {
		is_disabled: boolean;
		key_method: string;
		maintain_interval: number;
		online_timeout: number;
		purge_after: number;
		workers: {
			per_cpu_core: number;
			max: number;
			busy_interval: number;
			busy_timeout: number;
			idle_after: number;
		};
	};

	api: {
		is_disabled: boolean;
		url: string;
		node_port: number;
		key: string | null;
		request_body_limit: number | string;
		auth_rate_limit: {
			window_ms: number;
			max_requests: number;
		};
		sensitive_fields: string;
	};

	frontend: {
		is_disabled: boolean;
		url: string;
		node_port: number;
		is_authentication_required: boolean;
		password: string | null;
		data_refetch_interval: number;
		datetime_format: string;
		local_storage: {
			prefix: string | null;
		};
	};

	stats: {
		retention: number;
	};

	logs: {
		is_disabled: boolean;
		retention: number;
	};

	jobs: {
		queue_timeout: number;
		process_interval: number;
		process_timeout: number;
		enqueue_on_receive: boolean | string;
		enqueue_limit: number;
		retention: number;
		input_analysis: boolean;
		preview_generation: boolean;
		nsfw_detection: boolean;
		priority: number;
		try: number;
		try_min: number;
		try_max: number;
		retry_in: number;
		retry_in_min: number;
		retry_in_max: number;
		preview: {
			format: PREVIEW_FORMAT;
			quality: number | string;
		};
		outputs: {
			process_interval: number;
		};
		notifications: {
			process_interval: number;
			process_limit: number;
			notify_on: string;
			notify_on_alloweds: string;
			timeout: number;
			timeout_max: number;
			try: number;
			try_min: number;
			try_max: number;
			retry_in: number;
			retry_in_min: number;
			retry_in_max: number;
		};
	};
}

// =====================================================
// JOB TYPES
// =====================================================

export type JobConfig = {
	input_analysis?: boolean; // disable ffprobe analysis
	preview_generation?: boolean; // disable input preview generation
	nsfw_detection?: boolean; // disable NSFW detection

	ffprobe_general_attributes?: string; // comma-separated list of ffprobe general properties to extract
	ffprobe_video_attributes?: string; // comma-separated list of ffprobe video stream properties to extract
	ffprobe_audio_attributes?: string; // comma-separated list of ffprobe audio stream properties to extract

	ffmpeg_preset?: FFMPEG_PRESET; // ffmpeg preset to use for processing
	ffmpeg_quality?: number; // ffmpeg quality to use for processing (0-100)

	nsfw_model?: NSFW_MODEL; // NSFW model to use
	nsfw_size?: number; // NSFW model input size
	nsfw_type?: NSFW_TYPE; // NSFW model type
	nsfw_threshold?: number; // NSFW detection threshold

	whisper_model?: WHISPER_MODEL; // Whisper model to use
	whisper_with_cuda?: boolean; // use CUDA for Whisper
};

export type JobInput =
	| {
			type: BASE64_TYPE;
			name?: string;
			content: string;
	  }
	| {
			type: HTTP_TYPE;
			method?: "GET" | "POST" | "PUT";
			agent?: string;
			headers?: Record<string, string>;
			params?: Record<string, string>;
			username?: string;
			password?: string;
			url: string;
	  }
	| {
			type: STORAGE_S3_LIKE_TYPE;
			name?: string;
			access_key: string; // Access Key ID
			access_secret: string; // Access Key Secret
			region: string;
			bucket: string;
			path: string;
	  }
	| {
			type: STORAGE_FTP_TYPE;
			name?: string;
			host: string;
			port?: number; // optional, default FTP: 21, SFTP: 22
			username: string;
			password: string;
			secure?: boolean; // for FTP (FTPS with explicit TLS)
			path: string;
	  };

export type JobDestination =
	| {
			type: HTTP_TYPE;
			method?: "GET" | "POST" | "PUT";
			agent?: string;
			headers?: Record<string, string>;
			params?: Record<string, string>;
			username?: string;
			password?: string;
			url?: string;
	  }
	| {
			type: STORAGE_S3_LIKE_TYPE;
			endpoint?: string; // Custom endpoint for non-AWS S3 compatible types
			access_key: string; // Access Key ID
			access_secret: string; // Access Key Secret
			region: string;
			bucket: string;
			path?: string;
			acl?: STORAGE_S3_LIKE_ACL;
			expires?: number;
			cache_control?: string;
	  }
	| {
			type: STORAGE_FTP_TYPE;
			host: string;
			port?: number; // optional, default FTP: 21, SFTP: 22
			username: string;
			password: string;
			secure?: boolean; // for FTP (FTPS with explicit TLS)
			path?: string;
	  };

type JobOutputConfigCommon = {
	// priority?: number; // priority value (lower = higher priority, default: 1000)
	// name?: string; // optional custom name for the output file
	// path?: string; // required if destination is S3 or FTP
	// acl?: STORAGE_S3_LIKE_ACL; // optional if destination is S3, default: PUBLIC
	// expires?: number; // optional if destination is S3, in seconds
	// cache_control?: string; // optional if destination is S3
	// destination?: JobDestination | null; // optional - if not provided, will use global destination
	ffmpeg_preset?: FFMPEG_PRESET; // ffmpeg preset to use for this output
	ffmpeg_quality?: number; // ffmpeg quality to use for this output (0-100)
	// try?: number; // maximum number of tries for this output
	// retry_in?: number; // retry interval for this output in milliseconds
};

type JobOutputConfigTrim = {
	offset?: number; // in seconds
	duration?: number; // in seconds
};

type JobOutputConfigImage = {
	width?: number;
	height?: number;
	quality?: number; // 1-100
	fit?: FIT_MODE;
	rotate?: ROTATE_MODE;
	flip?: FLIP_MODE;
};

type JobOutputConfigAudio = {
	audio_codec?: AUDIO_CODEC;
	audio_bit_rate?: number | string; // e.g. '128k'
	audio_sample_rate?: number; // in Hz
	audio_channels?: AUDIO_CHANNEL; // e.g. 2
};

export type JobOutputConfig =
	| ({
			type: "VIDEO";
			format: VIDEO_FORMAT;
			video_codec?: VIDEO_CODEC;
			video_bit_rate?: number | string; // e.g. '2500k'
			video_pixel_format?: VIDEO_PIXEL_FORMAT; // e.g. 'YUV_420_P'
			video_frame_rate?: number | string;
			video_profile?: VIDEO_PROFILE; // e.g. 'MAIN', 'HIGH', 'BASELINE'
			video_level?: VIDEO_LEVEL; // e.g. 4.0, 4.1, 5.0
			video_deinterlace?: boolean;
	  } & JobOutputConfigAudio &
			JobOutputConfigTrim &
			JobOutputConfigImage &
			JobOutputConfigCommon)
	| ({
			type: "AUDIO";
			format: AUDIO_FORMAT;
	  } & JobOutputConfigAudio &
			JobOutputConfigTrim &
			JobOutputConfigCommon)
	| ({
			type: "THUMBNAIL";
			format: THUMBNAIL_FORMAT;
			offset?: number; // in seconds
	  } & JobOutputConfigImage &
			JobOutputConfigCommon)
	| ({
			type: "SUBTITLE";
			format: SUBTITLE_FORMAT;
			language?: string;
			whisper_model?: WHISPER_MODEL; // for subtitle outputs - Whisper model to use
			whisper_with_cuda?: boolean; // for subtitle outputs - whether to use CUDA for Whisper
	  } & JobOutputConfigTrim &
			JobOutputConfigCommon);

export type JobOutputRequest = JobOutputConfig & {
	priority?: number | 1000;
	type?: string;
	name?: string;
	path?: string; // required if destination is S3 or FTP
	url?: string; // required if destination is HTTP
	destination?: JobDestination | null; // optional - if not provided, will use global destination
	acl?: STORAGE_S3_LIKE_ACL; // optional if destination is S3, default: PUBLIC
	expires?: number; // optional if destination is S3, in seconds
	cache_control?: string; // optional if destination is S3
	try?: number; // maximum number of tries for this output
	retry_in?: number; // retry interval for this output in milliseconds
};

export type JobOutputRow = {
	key: string;
	job_key?: string | null;
	index: number | 0;
	priority?: number | 1000;
	type: "VIDEO" | "AUDIO" | "THUMBNAIL" | "SUBTITLE";
	name?: string | null;
	config?: any | null;
	destination?: any | null;
	outcome?: any | null;
	status?:
		| "PENDING"
		| "RETRYING"
		| "QUEUED"
		| "STARTED"
		| "PROCESSING"
		| "PROCESSED"
		| "UPLOADING"
		| "UPLOADED"
		| "COMPLETED"
		| "CANCELLED"
		| "DELETED"
		| "FAILED"
		| "TIMEOUT";
	started_at?: string | null;
	processed_at?: string | null;
	uploaded_at?: string | null;
	completed_at?: string | null;
	updated_at?: string;
	created_at?: string;
	try_max?: number | 1;
	try_count?: number | 0;
	retry_in?: number | 0;
	retry_at?: string | null;
	locked_by?: string | null;
	instance_key?: string | null;
	worker_key?: string | null;
};

export type JobNotification =
	| {
			type: HTTP_TYPE;
			method?: "GET" | "POST" | "PUT";
			agent?: string;
			headers?: Record<string, string>;
			params?: Record<string, string>;
			username?: string;
			password?: string;
			url: string;
			notify_on?: NOTIFICATIONS_NOTIFY_ON_TYPE[];
			timeout?: number; // in milliseconds
			try?: number;
			retry_in?: number; // in milliseconds
	  }
	| {
			type: "AWS_SNS";
			access_key: string; // Access Key ID
			access_secret: string; // Access Key Secret
			region: string;
			topic: string; // Topic ARN
			notify_on?: NOTIFICATIONS_NOTIFY_ON_TYPE[];
			timeout?: number; // in milliseconds
			try?: number;
			retry_in?: number; // in milliseconds
	  };

export type JobRequest = {
	priority?: number; // priority value (lower = higher priority, default: 1000)
	config?: JobConfig; // optional custom config overrides for this job
	input: JobInput;
	outputs: JobOutputRequest[];
	destination?: JobDestination; // optional global destination for outputs that don't have their own
	notification?: JobNotification;
	metadata?: Record<string, any>[]; // custom metadata to be sent back with notifications
	try?: number;
	retry_in?: number;
};

export type JobRow = {
	key: string;
	priority?: number | 1000;
	config?: any | null;
	input?: any | null;
	destination?: any | null;
	notification?: any | null;
	metadata?: any | null;
	outcome?: any | null;
	status?:
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
	progress?: number | 0.0; // STARTED = 0; DOWNLOADING = 20; ANALYZING = 40; PROCESSING = 60; UPLOADING = 80; COMPLETED = 100;
	started_at?: string | null;
	downloaded_at?: string | null;
	analyzed_at?: string | null;
	completed_at?: string | null;
	updated_at?: string;
	created_at?: string;
	try_max?: number | 1;
	try_count?: number | 0;
	retry_in?: number | 0;
	retry_at?: string | null;
	locked_by?: string | null;
	instance_key?: string | null;
	worker_key?: string | null;
};

export type JobNotificationRow = {
	key: string;
	job_key?: string;
	priority?: number | 1000;
	config?: any | null;
	payload?: any | null;
	outcome?: any | null;
	status?: "PENDING" | "RETRYING" | "QUEUED" | "SUCCESSFUL" | "SKIPPED" | "FAILED";
	updated_at?: string;
	created_at?: string;
	try_max: number | 3; // default 3
	try_count: number | 0;
	retry_in: number | 60000; // in milliseconds, default 1 minute
	retry_at?: string | null;
	instance_key?: string | null;
	worker_key?: string | null;
};
