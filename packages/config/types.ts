import {
	STORAGE_TYPES,
	DATABASE_TYPES,
	INSTANCE_KEY_METHODS,
	FFMPEG_PRESETS,
	NSFW_MODELS,
	NSFW_TYPES,
	WHISPER_MODELS,
	PREVIEW_FORMATS
} from "./defaults";

// =====================================================
// CONFIGURATION TYPES
// =====================================================

export type StorageType = (typeof STORAGE_TYPES)[number];

export type DatabaseType = (typeof DATABASE_TYPES)[number];

export type InstanceKeyMethod = (typeof INSTANCE_KEY_METHODS)[number];

export type FFmpegPreset = (typeof FFMPEG_PRESETS)[number];

export type NSFWModel = (typeof NSFW_MODELS)[number];

export type NSFWType = (typeof NSFW_TYPES)[number];

export type WhisperModel = (typeof WHISPER_MODELS)[number];

export type PreviewFormat = (typeof PREVIEW_FORMATS)[number];

export interface AppConfig {
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
			preset: FFmpegPreset;
			quality: number;
		};
		nsfw: {
			model: NSFWModel;
			size: number;
			type: NSFWType;
			threshold: number;
		};
		whisper: {
			model: WhisperModel;
			with_cuda: boolean;
		};
	};

	storage: {
		type: StorageType;
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
		type: DatabaseType;
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
		key_method: InstanceKeyMethod;
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
		analyze_input: boolean;
		generate_preview: boolean;
		detect_nsfw: boolean;
		queue_timeout: number;
		process_interval: number;
		process_timeout: number;
		enqueue_on_receive: boolean | string;
		enqueue_limit: number;
		retention: number;
		try_min: number;
		try_max: number;
		try_count: number;
		retry_in_min: number;
		retry_in_max: number;
		retry_in: number;
		preview: {
			format: PreviewFormat;
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
			try_max: number;
			retry_in: number;
			retry_in_max: number;
		};
	};
}

// =====================================================
// JOB TYPES
// =====================================================

export type AWS_S3_ACL =
	| "PUBLIC_READ"
	| "PUBLIC_READ_WRITE"
	| "AUTHENTICATED_READ"
	| "AWS_EXEC_READ"
	| "BUCKET_OWNER_READ"
	| "BUCKET_OWNER_FULL_CONTROL"
	| "PRIVATE";

export type JobConfig = {
	analyze_input?: boolean; // disable ffprobe analysis
	generate_preview?: boolean; // disable input preview generation
	detect_nsfw?: boolean; // disable NSFW detection

	ffprobe_general_attributes?: string; // comma-separated list of ffprobe general properties to extract
	ffprobe_video_attributes?: string; // comma-separated list of ffprobe video stream properties to extract
	ffprobe_audio_attributes?: string; // comma-separated list of ffprobe audio stream properties to extract

	ffmpeg_preset?: FFmpegPreset; // ffmpeg preset to use for processing
	ffmpeg_quality?: number; // ffmpeg quality to use for processing (0-100)

	nsfw_model?: NSFWModel; // NSFW model to use
	nsfw_size?: number; // NSFW model input size
	nsfw_type?: NSFWType; // NSFW model type
	nsfw_threshold?: number; // NSFW detection threshold

	whisper_model?: WhisperModel; // Whisper model to use
	whisper_with_cuda?: boolean; // use CUDA for Whisper
};

export type JobInput =
	| {
			type: "BASE64";
			content: string;
			name?: string;
	  }
	| {
			type: "HTTP" | "HTTPS";
			username?: string;
			password?: string;
			url: string;
			name?: string;
	  }
	| {
			type:
				| "AWS_S3"
				| "GOOGLE_CLOUD_STORAGE"
				| "DO_SPACES"
				| "LINODE"
				| "WASABI"
				| "BACKBLAZE"
				| "RACKSPACE"
				| "MICROSOFT_AZURE"
				| "OTHER_S3";
			access_key: string; // Access Key ID
			access_secret: string; // Access Key Secret
			region: string;
			bucket: string;
			path: string;
			name?: string;
	  }
	| {
			type: "FTP" | "SFTP";
			host: string;
			username?: string;
			password?: string;
			path: string;
			name?: string;
	  };

export type JobDestinationConfig =
	| {
			type: "HTTP" | "HTTPS";
			method?: "POST" | "PUT";
			headers?: Record<string, string>;
			url: string;
	  }
	| {
			type:
				| "AWS_S3"
				| "GOOGLE_CLOUD_STORAGE"
				| "DO_SPACES"
				| "LINODE"
				| "WASABI"
				| "BACKBLAZE"
				| "RACKSPACE"
				| "MICROSOFT_AZURE"
				| "OTHER_S3";
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
			type: "FTP" | "SFTP";
			host: string;
			port?: number; // optional, default FTP: 21, SFTP: 22
			username: string;
			password: string;
			secure?: boolean; // for FTP (FTPS with explicit TLS)
	  };

type JobOutputConfigCommon = {
	name?: string; // optional custom name for the output file
	path?: string; // required if destination is S3 or FTP
	acl?: AWS_S3_ACL; // optional if destination is S3, default: PUBLIC
	expires?: number; // optional if destination is S3, in seconds
	cache_control?: string; // optional if destination is S3
	destination?: JobDestinationConfig; // optional - if not provided, will use global destination
	ffmpeg_preset?: FFmpegPreset; // ffmpeg preset to use for this output
	ffmpeg_quality?: number; // ffmpeg quality to use for this output (0-100)
};

type JobOutputConfigCut = {
	offset?: number; // in seconds
	duration?: number; // in seconds
};

type JobOutputConfigImage = {
	width?: number;
	height?: number;
	quality?: number; // 1-100
	fit?: "PAD" | "STRETCH" | "CROP" | "MAX";
	rotate?: 90 | -90 | 180 | -180;
	flip?: "HORIZONTAL" | "VERTICAL" | "BOTH";
};

type JobOutputConfigAudio = {
	audio_codec?: string;
	audio_bit_rate?: number | string; // e.g. '128k'
	audio_sample_rate?: number; // in Hz
	audio_channels?: number; // e.g. 2
};

export type JobOutputConfig =
	| ({
			type: "VIDEO";
			format:
				| "MP4"
				| "WEBM"
				| "OGV"
				| "MOV"
				| "AVI"
				| "WMV"
				| "ASF"
				| "FLV"
				| "MKV"
				| "TS"
				| "M2TS"
				| "MPG"
				| "MPEG"
				| "GIF"
				| "RAW"
				| string;
			video_codec?: string;
			video_bit_rate?: number | string; // e.g. '2500k'
			video_pixel_format?: string; // e.g. 'yuv420p'
			video_frame_rate?: number | string;
			video_profile?: string; // e.g. 'high', 'main', 'baseline'
			video_level?: string; // e.g. '4.0', '4.1', '5.0'
			video_deinterlace?: boolean;
	  } & JobOutputConfigAudio &
			JobOutputConfigCut &
			JobOutputConfigImage &
			JobOutputConfigCommon)
	| ({
			type: "AUDIO";
			format: "MP3" | "AAC" | "WAV" | "FLAC" | "OGG" | "OPUS" | "ALAC" | "WMA" | "AIFF" | "AMR-NB" | "AMR-WB" | string;
	  } & JobOutputConfigAudio &
			JobOutputConfigCut &
			JobOutputConfigCommon)
	| ({
			type: "THUMBNAIL";
			format: "JPG" | "PNG" | "WEBP" | "BMP" | string;
			offset?: number; // in seconds
	  } & JobOutputConfigImage &
			JobOutputConfigCommon)
	| ({
			type: "SUBTITLE";
			format: "SRT" | "VTT" | "JSON" | "CSV" | "TXT" | string;
			language?: string;
			whisper_model?: WhisperModel; // for subtitle outputs - Whisper model to use
			whisper_with_cuda?: boolean; // for subtitle outputs - whether to use CUDA for Whisper
	  } & JobOutputConfigCommon);

export type JobNotificationConfig =
	| {
			type: "HTTP" | "HTTPS";
			method?: "GET" | "POST" | "PUT";
			headers?: Record<string, string>;
			url: string;
			notify_on?: any;
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
			notify_on?: any;
			timeout?: number; // in milliseconds
			try?: number;
			retry_in?: number; // in milliseconds
	  };

export type JobRequest = {
	priority?: number; // priority value (lower = higher priority, default: 1000)
	config?: JobConfig; // optional custom config overrides for this job
	input: JobInput;
	outputs: JobOutputConfig[];
	destination?: JobDestinationConfig; // optional global destination for outputs that don't have their own
	notification?: JobNotificationConfig;
	metadata?: Record<string, any>[]; // custom metadata to be sent back with notifications
	try_max?: number | 1;
	retry_in?: number | 0;
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

export type JobOutputRow = {
	key: string;
	job_key?: string | null;
	index: number | 0;
	priority?: number | 1000;
	config?: any | null;
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
