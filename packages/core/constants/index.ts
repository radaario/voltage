export const HTTPS_TYPES = ["HTTP", "HTTPS"] as const;
export const BASE64_TYPES = ["BASE64"] as const;

export const STORAGE_S3_LIKE_TYPES = [
	"OTHER_S3",
	"AWS_S3",
	"GOOGLE_CLOUD_STORAGE",
	"DO_SPACES",
	"LINODE",
	"WASABI",
	"BACKBLAZE",
	"RACKSPACE",
	"MICROSOFT_AZURE"
] as const;

export const STORAGE_S3_LIKE_ACLS = [
	"PUBLIC_READ",
	"PUBLIC_READ_WRITE",
	"AUTHENTICATED_READ",
	"AWS_EXEC_READ",
	"BUCKET_OWNER_READ",
	"BUCKET_OWNER_FULL_CONTROL",
	"PRIVATE"
] as const;

export const STORAGE_FTP_TYPES = ["FTP", "SFTP"] as const;

export const STORAGE_TYPES = ["LOCAL", ...STORAGE_S3_LIKE_TYPES, ...STORAGE_FTP_TYPES] as const;

export const DATABASE_TYPES = ["SQLITE", "MYSQL", "MARIADB", "POSTGRESQL", "MSSQL", "AWS_REDSHIFT", "COCKROACHDB"] as const;

export const INSTANCE_KEY_METHODS = ["IP_ADDRESS", "UNIQUE_KEY"] as const;

export const FFPROBE_GENERAL_ATTRIBUTES = ["DURATION", "SIZE"] as const;
export const FFPROBE_VIDEO_ATTRIBUTES = ["WIDTH", "HEIGHT", "CODEC", "FRAME_RATE", "BIT_RATE"] as const;
export const FFPROBE_AUDIO_ATTRIBUTES = ["CODEC", "CHANNELS", "SAMPLE_RATE", "CHANNEL_LAYOUT", "BIT_RATE"] as const;

export const FFMPEG_PRESETS = ["MEDIUM", "ULTRA_FAST", "SUPER_FAST", "VERY_FAST", "FASTER", "FAST", "SLOW", "SLOWER"] as const;
export const NSFW_MODELS = ["MOBILE_NET_V2", "MOBILE_NET_V2_MID", "INCEPTION_V3"] as const;
export const NSFW_TYPES = ["GRAPH", "LITE"] as const;
export const WHISPER_MODELS = [
	"BASE",
	"BASE_EN",
	"TINY",
	"TINY_EN",
	"SMALL",
	"SMALL_EN",
	"MEDIUM",
	"MEDIUM_EN",
	"LARGE",
	"LARGE_V1",
	"LARGE_V3_TURBO"
] as const;

export const PREVIEW_FORMATS = ["PNG", "JPG", "BMP", "WEBP"] as const;

export const FIT_MODES = ["PAD", "STRETCH", "CROP", "MAX"] as const;
export const ROTATE_MODES = [90, -90, 180, -180] as const;
export const FLIP_MODES = ["HORIZONTAL", "VERTICAL", "BOTH"] as const;

export const VIDEO_FORMATS = [
	"MP4",
	"WEBM",
	"OGV",
	"MOV",
	"AVI",
	"WMV",
	"ASF",
	"FLV",
	"MKV",
	"TS",
	"M2TS",
	"MPG",
	"MPEG",
	"GIF",
	"RAW"
] as const;

export const VIDEO_CODECS = [
	"LIB_X_264",
	"LIB_X_265",
	"LIB_VPX",
	"LIB_VPX_VP9",
	"LIB_AOM_AV1",
	"MPEG_4",
	"MPEG_2_VIDEO",
	"H264_NVENC",
	"HEVC_NVENC",
	"H264_QSV",
	"HEVC_QSV",
	"H264_VAAPI",
	"COPY",
	"PRORES",
	"DNXHD",
	"FFV_1",
	"UTVIDEO"
] as const;
export const VIDEO_PROFILES = ["MAIN", "BASELINE", "HIGH", "HIGH_10", "HIGH_422", "HIGH_444"] as const;
export const VIDEO_PIXEL_FORMATS = [
	"YUV_420_P",
	"YUV_422_P",
	"YUV_444_P",
	"YUV_422_P101E",
	"YUV_444_P101E",
	"NV_12",
	"NV_21",
	"RGB_24",
	"BGR_24",
	"RGBA",
	"BGRA",
	"ARGB",
	"GBRP",
	"GRAY",
	"GRAY_161_E",
	"CUDA",
	"VAAPI",
	"QSV",
	"DXVA2_VLD",
	"VIDEO_TOOL_BOX"
] as const;
export const VIDEO_LEVELS = [1.0, 1.1, 1.2, 1.3, 2.0, 2.1, 2.2, 3.0, 3.1, 3.2, 4.0, 4.1, 4.2, 5.0, 5.1, 5.2, 6.0, 6.1, 6.2] as const;

export const AUDIO_FORMATS = ["MP3", "AAC", "WAV", "FLAC", "OGG", "OPUS", "ALAC", "WMA", "AIFF", "AMR-NB", "AMR-WB"] as const;
export const AUDIO_CODECS = [
	"LIB_MP3_LAME",
	"PCM_S16_LE",
	"PCM_S24_LE",
	"PCM_S32_LE",
	"FLAC",
	"ALAC",
	"WAVPACK",
	"AAC",
	"LIB_OPUS",
	"LIB_VORBIS",
	"AC3",
	"EAC3",
	"MP2",
	"WMAV2"
] as const;
export const AUDIO_CHANNELS = [2, 1, 4, 6, 8] as const;

export const THUMBNAIL_FORMATS = ["PNG", "JPG", "WEBP", "BMP"] as const;

export const SUBTITLE_FORMATS = ["SRT", "VTT", "JSON", "CSV", "TXT"] as const;

export const NOTIFICATION_NOTIFY_ON_TYPES = [
	"RECEIVED",
	"PENDING",
	"RETRYING",
	"QUEUED",
	"STARTED",
	"DOWNLOADING",
	"DOWNLOADED",
	"ANALYZING",
	"ANALYZED",
	"PROCESSING",
	"PROCESSED",
	"UPLOADING",
	"UPLOADED",
	"COMPLETED",
	"CANCELLED",
	"DELETED",
	"FAILED",
	"TIMEOUT"
] as const;

export const NOTIFICATION_NOTIFY_ON_DEFAULT = ["RECEIVED", "COMPLETED", "FAILED", "TIMEOUT"] as const;
