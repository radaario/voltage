import {
	HTTPS_TYPES,
	STORAGE_S3_LIKE_TYPES,
	STORAGE_S3_LIKE_ACLS,
	STORAGE_FTP_TYPES,
	BASE64_TYPES,
	FFMPEG_PRESETS,
	NSFW_MODELS,
	NSFW_TYPES,
	WHISPER_MODELS,
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
	NOTIFICATION_NOTIFY_ON_TYPES,
	NOTIFICATION_NOTIFY_ON_DEFAULT
} from "@voltage/config";
import { appConfig } from "@voltage/config";
import { Joi } from "@/utils/joi.util";

// Job config schema with defaults
const jobConfigSchema = Joi.object({
	input_analysis: Joi.boolean().failover(appConfig.jobs.input_analysis || true) /* ! */,
	preview_generation: Joi.boolean().failover(appConfig.jobs.preview_generation || true) /* ! */,
	nsfw_detection: Joi.boolean().failover(appConfig.jobs.nsfw_detection || false) /* ! */,

	// FFprobe Configs
	ffprobe_general_attributes: Joi.string().default(appConfig.utils.ffprobe.general_attributes || null) /* ? */,
	ffprobe_video_attributes: Joi.string().default(appConfig.utils.ffprobe.video_attributes || null) /* ? */,
	ffprobe_audio_attributes: Joi.string().default(appConfig.utils.ffprobe.audio_attributes || null) /* ? */,

	// FFMPEG Configs
	ffmpeg_preset: Joi.any().constantcase().validOrDefault(FFMPEG_PRESETS, appConfig.utils.ffmpeg.preset) /* ! */,
	ffmpeg_quality: Joi.any()
		.range(0, 100, appConfig.utils.ffmpeg.quality || null)
		.allow(null) /* ! */,

	// NSFW Detection Configs
	nsfw_model: Joi.any().constantcase().validOrDefault(NSFW_MODELS, appConfig.utils.nsfw.model) /* ! */,
	nsfw_size: Joi.any().range(64, 1024, appConfig.utils.nsfw.size || 224) /* ! */,
	nsfw_type: Joi.any().constantcase().validOrDefault(NSFW_TYPES, appConfig.utils.nsfw.type) /* ! */,
	nsfw_threshold: Joi.any().range(0, 100, appConfig.utils.nsfw.threshold || 75) /* ! */,

	// Whisper Configs
	whisper_model: Joi.any().constantcase().validOrDefault(WHISPER_MODELS, appConfig.utils.whisper.model) /* ! */,
	whisper_with_cuda: Joi.boolean().failover(appConfig.utils.whisper.with_cuda || false) /* ! */
});

// Job input schemas for each type
const jobInputHttpSchema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...HTTPS_TYPES)
		.required() /* ! */,
	name: Joi.string().failover(null).allow(null).optional() /* ! */,
	method: Joi.any().constantcase().valid("POST", "PUT", "GET").failover("GET").required() /* ! */,
	url: Joi.string().uri().required() /* ! */,
	headers: Joi.object().pattern(Joi.string(), Joi.string()).failover(null).allow(null).optional() /* ! */,
	agent: Joi.string().failover(null).allow(null).optional() /* ! */,
	username: Joi.string().failover(null).allow(null).optional() /* ! */,
	password: Joi.string().failover(null).allow(null).optional() /* ! */
});

const jobInputS3LikeSchema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...STORAGE_S3_LIKE_TYPES)
		.required() /* ! */,
	name: Joi.string().failover(null).allow(null).optional() /* ! */,
	access_key: Joi.string().required() /* ! */,
	access_secret: Joi.string().required() /* ! */,
	region: Joi.string().required() /* ! */,
	bucket: Joi.string().required() /* ! */,
	path: Joi.string().required() /* ! */
});

const jobInputFtpSchema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...STORAGE_FTP_TYPES)
		.required() /* ! */,
	name: Joi.string().failover(null).allow(null).optional() /* ! */,
	host: Joi.string().required() /* ! */,
	port: Joi.any().range(1, 65535, 21).optional() /* ! */,
	username: Joi.string().failover(null).allow(null).optional() /* ! */,
	password: Joi.string().failover(null).allow(null).optional() /* ! */,
	secure: Joi.boolean().failover(false).optional() /* ! */,
	path: Joi.string().required() /* ! */
});

const jobInputBase64Schema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...BASE64_TYPES)
		.required() /* ! */,
	name: Joi.string().failover(null).allow(null).optional() /* ! */,
	content: Joi.string().required() /* ! */
});

const jobInputSchema = Joi.alternatives().try(jobInputHttpSchema, jobInputS3LikeSchema, jobInputFtpSchema, jobInputBase64Schema);

// Job destination schemas
const jobDestinationHttpSchema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...HTTPS_TYPES)
		.required() /* ! */,
	method: Joi.any().constantcase().valid("POST", "PUT", "GET").failover("POST").required() /* ! */,
	url: Joi.string().uri().required() /* ! */,
	headers: Joi.object().pattern(Joi.string(), Joi.string()).failover(null).allow(null).optional() /* ! */,
	agent: Joi.string().failover(null).allow(null).optional() /* ! */,
	username: Joi.string().failover(null).allow(null).optional() /* ! */,
	password: Joi.string().failover(null).allow(null).optional() /* ! */
});

const jobDestinationS3LikeSchema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...STORAGE_S3_LIKE_TYPES)
		.required() /* ! */,
	endpoint: Joi.string().optional() /* ! */,
	access_key: Joi.string().required() /* ! */,
	access_secret: Joi.string().required() /* ! */,
	region: Joi.string().required() /* ! */,
	bucket: Joi.string().required() /* ! */,
	acl: Joi.any().constantcase().validOrDefault(STORAGE_S3_LIKE_ACLS) /* ! */,
	expires: Joi.number().failover(null).allow(null) /* ! */,
	cache_control: Joi.string().failover(null).allow(null) /* ! */
});

const jobDestinationFtpSchema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...STORAGE_FTP_TYPES)
		.required() /* ! */,
	host: Joi.string().required() /* ! */,
	port: Joi.any().range(1, 65535, 21).optional() /* ! */,
	username: Joi.string().failover(null).allow(null).optional() /* ! */,
	password: Joi.string().failover(null).allow(null).optional() /* ! */,
	secure: Joi.boolean().failover(false).optional() /* ! */
});

const jobDestinationSchema = Joi.alternatives().try(jobDestinationHttpSchema, jobDestinationS3LikeSchema, jobDestinationFtpSchema);

// Job notification schemas
const jobNotificationCommonSchema = {
	notify_on: Joi.array()
		.items(Joi.any().constantcase().validOrDefault(NOTIFICATION_NOTIFY_ON_TYPES))
		.default(NOTIFICATION_NOTIFY_ON_DEFAULT)
		.allow(null),
	timeout: Joi.number()
		.min(0)
		.max(appConfig.jobs.notifications.timeout_max)
		.default(appConfig.jobs.notifications.timeout || 10 * 1000),
	try: Joi.number()
		.integer()
		.min(appConfig.jobs.notifications.try_min || 1)
		.max(appConfig.jobs.notifications.try_max || 3)
		.default(appConfig.jobs.notifications.try || 3),
	retry_in: Joi.number()
		.integer()
		.min(appConfig.jobs.notifications.retry_in_min || 1 * 60 * 1000)
		.max(appConfig.jobs.notifications.retry_in_max || 60 * 60 * 1000)
		.default(appConfig.jobs.notifications.retry_in || 1 * 60 * 1000)
};

const jobNotificationHttpSchema = Joi.object({
	type: Joi.any()
		.constantcase()
		.valid(...HTTPS_TYPES)
		.required(),
	method: Joi.any().constantcase().valid("POST", "PUT", "GET").failover("POST").required(),
	url: Joi.string().uri().required(),
	headers: Joi.object().pattern(Joi.string(), Joi.string()).failover(null).allow(null).optional() /* ! */,
	agent: Joi.string().failover(null).allow(null).optional() /* ! */,
	username: Joi.string().failover(null).allow(null).optional() /* ! */,
	password: Joi.string().failover(null).allow(null).optional() /* ! */,
	...jobNotificationCommonSchema
});

const jobNotificationAwsSnsSchema = Joi.object({
	type: Joi.any().constantcase().valid("AWS_SNS").required(),
	access_key: Joi.string().required(),
	access_secret: Joi.string().required(),
	region: Joi.string().required(),
	topic: Joi.string().required(),
	...jobNotificationCommonSchema
});

const jobNotificationSchema = Joi.alternatives().try(jobNotificationHttpSchema, jobNotificationAwsSnsSchema);

// Job output common schemas
const jobOutputConfigCommonSchema = {
	name: Joi.string().optional(),
	priority: Joi.any().range(1, undefined, appConfig.jobs.priority || 1000) /* ! */,
	path: Joi.string().optional()
};

const jobOutputConfigCommonVisualSchema = {
	width: Joi.any().range(1, 7680, null).optional() /* ! */,
	height: Joi.any().range(1, 7680, null).optional() /* ! */,
	quality: Joi.any().range(0, 100).optional() /* ! */,
	fit: Joi.any()
		.constantcase()
		.valid(...FIT_MODES)
		.failover(FIT_MODES[0])
		.optional() /* ! */,
	rotate: Joi.any().validOrStrip(ROTATE_MODES).optional() /* ! */,
	flip: Joi.any().constantcase().validOrStrip(FLIP_MODES).optional() /* ! */
};

const jobOutputConfigCommonFileSchema = {
	acl: Joi.any().constantcase().validOrStrip(STORAGE_S3_LIKE_ACLS).optional() /* ! */,
	expires: Joi.number().optional() /* ! */,
	cache_control: Joi.string().optional() /* ! */
};

const jobOutputConfigCommonFfmpegSchema = {
	ffmpeg_preset: Joi.any()
		.constantcase()
		.valid(...FFMPEG_PRESETS)
		.failover(appConfig.utils.ffmpeg.preset || FFMPEG_PRESETS[0])
		.optional() /* ! */,
	ffmpeg_quality: Joi.any()
		.range(0, 100, appConfig.utils.ffmpeg.quality || null)
		.allow(null)
		.optional() /* ! */
};

const jobOutputConfigCommonVideoSchema = {
	video_codec: Joi.any()
		.constantcase()
		.valid(...VIDEO_CODECS)
		.failover(VIDEO_CODECS[0])
		.optional() /* ! */,
	video_bit_rate: Joi.any().bitrate().optional() /* ! */,
	video_pixel_format: Joi.any()
		.constantcase()
		.valid(...VIDEO_PIXEL_FORMATS)
		.failover(VIDEO_PIXEL_FORMATS[0])
		.optional() /* ! */,
	video_frame_rate: Joi.any().framerate().optional() /* ! */,
	video_profile: Joi.any()
		.constantcase()
		.valid(...VIDEO_PROFILES)
		.failover(VIDEO_PROFILES[0])
		.optional() /* ! */,
	video_level: Joi.number()
		.valid(...VIDEO_LEVELS)
		.failover(VIDEO_LEVELS[0])
		.optional() /* ! */,
	video_deinterlace: Joi.boolean().failover(true).optional() /* ! */
};

const jobOutputConfigCommonAudioSchema = {
	audio_codec: Joi.any()
		.constantcase()
		.valid(...AUDIO_CODECS)
		.failover(AUDIO_CODECS[0])
		.optional() /* ! */,
	audio_bit_rate: Joi.any().bitrate().optional() /* ! */,
	audio_sample_rate: Joi.any().samplerate().optional() /* ! */,
	audio_channels: Joi.any()
		.constantcase()
		.valid(...AUDIO_CHANNELS)
		.failover(AUDIO_CHANNELS[0])
		.optional() /* ! */
};

const jobCommonTrySchema = {
	try: Joi.any().range(appConfig.jobs.try_min || 1, appConfig.jobs.try_max || 3) /* ! */,
	retry_in: Joi.any().range(appConfig.jobs.retry_in_min || 1 * 60 * 1000, appConfig.jobs.retry_in_max || 60 * 60 * 1000) /* ! */
};

// Job output schemas for each type
const jobOutputConfigVideoSchema = Joi.object({
	type: Joi.string().valid("VIDEO").required() /* ! */,
	format: Joi.any()
		.constantcase()
		.valid(...VIDEO_FORMATS)
		.failover(VIDEO_FORMATS[0])
		.required() /* ! */,
	...jobOutputConfigCommonSchema,
	...jobOutputConfigCommonVideoSchema,
	...jobOutputConfigCommonAudioSchema,
	offset: Joi.any().range(0, undefined, 0).optional() /* ! */,
	duration: Joi.any().range(1, undefined, null).optional() /* ! */,
	...jobOutputConfigCommonVisualSchema,
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,
	...jobCommonTrySchema
});

const jobOutputConfigAudioSchema = Joi.object({
	type: Joi.string().valid("AUDIO").required() /* ! */,
	format: Joi.any()
		.constantcase()
		.valid(...AUDIO_FORMATS)
		.failover(AUDIO_FORMATS[0])
		.required() /* ! */,
	...jobOutputConfigCommonSchema,
	...jobOutputConfigCommonAudioSchema,
	offset: Joi.any().range(0, undefined, 0).optional() /* ! */,
	duration: Joi.any().range(1, undefined, null).optional() /* ! */,
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,
	...jobCommonTrySchema
});

const jobOutputConfigThumbnailSchema = Joi.object({
	type: Joi.string().valid("THUMBNAIL").required() /* ! */,
	format: Joi.any()
		.constantcase()
		.valid(...THUMBNAIL_FORMATS)
		.failover(THUMBNAIL_FORMATS[0])
		.required() /* ! */,
	...jobOutputConfigCommonSchema,
	offset: Joi.any().range(0, undefined, 0).optional() /* ! */,
	...jobOutputConfigCommonVisualSchema,
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,
	...jobCommonTrySchema
});

const jobOutputConfigSubtitleSchema = Joi.object({
	type: Joi.string().valid("SUBTITLE").required(),
	format: Joi.any()
		.constantcase()
		.valid(...SUBTITLE_FORMATS)
		.failover(SUBTITLE_FORMATS[0])
		.required() /* ! */,
	...jobOutputConfigCommonSchema,
	offset: Joi.any().range(0, undefined, 0).optional() /* ! */,
	duration: Joi.any().range(1, undefined, null).optional() /* ! */,
	language: Joi.string().optional(),
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,

	whisper_model: Joi.any()
		.constantcase()
		.valid(...WHISPER_MODELS)
		.failover(WHISPER_MODELS[0])
		.optional() /* ! */,
	whisper_with_cuda: Joi.boolean().optional() /* ! */,

	...jobCommonTrySchema
});

const outputConfigSchema = Joi.alternatives().try(
	jobOutputConfigVideoSchema,
	jobOutputConfigAudioSchema,
	jobOutputConfigThumbnailSchema,
	jobOutputConfigSubtitleSchema
);

export const jobSchema = Joi.object({
	priority: Joi.any().range(1, undefined, appConfig.jobs.priority || 1000) /* ! */,
	config: jobConfigSchema,
	input: jobInputSchema,
	outputs: Joi.array().items(outputConfigSchema).min(1).required(),
	destination: jobDestinationSchema.optional(),
	notification: jobNotificationSchema.optional(),
	metadata: Joi.array().items(Joi.object().pattern(Joi.string(), Joi.any())).optional(),
	...jobCommonTrySchema
});
