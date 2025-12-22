import {
	FFMPEG_PRESET,
	NSFW_MODEL,
	NSFW_TYPE,
	WHISPER_MODEL,
	STORAGE_TYPE,
	STORAGE_S3_LIKE_ACL,
	DATABASE_TYPE,
	PREVIEW_FORMAT
} from "../../types";

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
		acl: STORAGE_S3_LIKE_ACL;
		expires_in: number | null;
		cache_control: string | null;
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
