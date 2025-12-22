import { config as appConfig } from "@voltage/core/config";
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
	VIDEO_PROFILES,
	VIDEO_LEVELS,
	AUDIO_FORMATS,
	AUDIO_CHANNELS,
	THUMBNAIL_FORMATS,
	SUBTITLE_FORMATS,
	FIT_MODES,
	ROTATE_MODES,
	FLIP_MODES,
	FFPROBE_GENERAL_ATTRIBUTES,
	FFPROBE_VIDEO_ATTRIBUTES,
	FFPROBE_AUDIO_ATTRIBUTES,
	NOTIFICATION_NOTIFY_ON_TYPES,
	NOTIFICATION_NOTIFY_ON_DEFAULT
} from "@voltage/core/constants";

import { Joi } from "@/utils/joi.util";

const ffprobeGeneralAttributesDefault = appConfig.utils?.ffprobe?.general_attributes
	? appConfig.utils?.ffprobe?.general_attributes.split(",")
	: [];

const ffprobeVideoAttributesDefault = appConfig.utils?.ffprobe?.video_attributes
	? appConfig.utils?.ffprobe?.video_attributes.split(",")
	: [];

const ffprobeAudioAttributesDefault = appConfig.utils?.ffprobe?.audio_attributes
	? appConfig.utils?.ffprobe?.audio_attributes.split(",")
	: [];

const jobNotificationNotifyOnDefault = appConfig.jobs?.notifications?.notify_on
	? appConfig.jobs.notifications.notify_on.split(",")
	: NOTIFICATION_NOTIFY_ON_DEFAULT;

// Job config schema with defaults
const jobConfigSchema = Joi.object({
	input_analysis: Joi.boolean()
		.default(appConfig.jobs.input_analysis ?? true)
		.failover(appConfig.jobs.input_analysis ?? true) /* ! */,
	preview_generation: Joi.boolean()
		.default(appConfig.jobs.preview_generation ?? true)
		.failover(appConfig.jobs.preview_generation ?? true) /* ! */,
	nsfw_detection: Joi.boolean()
		.default(appConfig.jobs.nsfw_detection ?? false)
		.failover(appConfig.jobs.nsfw_detection ?? false) /* ! */,

	// FFprobe Configs
	ffprobe_general_attributes: Joi.array()
		.items(Joi.any().constantcase().validOrFallback(FFPROBE_GENERAL_ATTRIBUTES))
		.default(ffprobeGeneralAttributesDefault || [])
		.failover(ffprobeGeneralAttributesDefault || [])
		.allow(null)
		.sparse(true)
		.compact() /* ! */,
	ffprobe_video_attributes: Joi.array()
		.items(Joi.any().constantcase().validOrFallback(FFPROBE_VIDEO_ATTRIBUTES))
		.default(ffprobeVideoAttributesDefault || [])
		.failover(ffprobeVideoAttributesDefault || [])
		.allow(null)
		.sparse(true)
		.compact() /* ! */,
	ffprobe_audio_attributes: Joi.array()
		.items(Joi.any().constantcase().validOrFallback(FFPROBE_AUDIO_ATTRIBUTES))
		.default(ffprobeAudioAttributesDefault || [])
		.failover(ffprobeAudioAttributesDefault || [])
		.allow(null)
		.sparse(true)
		.compact() /* ! */,

	// FFMPEG Configs
	ffmpeg_preset: Joi.any().constantcase().validOrDefault(FFMPEG_PRESETS, appConfig.utils.ffmpeg.preset) /* ! */,
	ffmpeg_quality: Joi.number()
		.range(0, 100)
		.default(appConfig.utils.ffmpeg.quality ?? null)
		.failover(appConfig.utils.ffmpeg.quality ?? null)
		.allow(null) /* ! */,

	// NSFW Detection Configs
	nsfw_model: Joi.string().constantcase().validOrDefault(NSFW_MODELS, appConfig.utils.nsfw.model) /* ! */,
	nsfw_size: Joi.number()
		.range(64, 1024)
		.default(appConfig.utils.nsfw.size || 224)
		.failover(appConfig.utils.nsfw.size || 224) /* ! */,
	nsfw_type: Joi.string().constantcase().validOrDefault(NSFW_TYPES, appConfig.utils.nsfw.type) /* ! */,
	nsfw_threshold: Joi.number()
		.range(0, 100)
		.default(appConfig.utils.nsfw.threshold || 75)
		.failover(appConfig.utils.nsfw.threshold || 75) /* ! */,

	// Whisper Configs
	whisper_model: Joi.string().constantcase().validOrDefault(WHISPER_MODELS, appConfig.utils.whisper.model) /* ! */,
	whisper_with_cuda: Joi.boolean()
		.default(appConfig.utils.whisper.with_cuda || false)
		.failover(appConfig.utils.whisper.with_cuda || false) /* ! */
});

// Job input schemas for each type
const jobInputHttpSchema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...HTTPS_TYPES)
		.required() /* ! */,
	method: Joi.string().uppercase().constantcase().valid("GET", "POST", "PUT").default("GET").failover("GET") /* ! */,
	agent: Joi.string().failover(null).allow(null) /* ! */,
	headers: Joi.object().pattern(Joi.string().failover("_undefined"), Joi.any().failover(null).allow(null)) /* ! */,
	params: Joi.object().pattern(Joi.string().failover("_undefined"), Joi.any().failover(null).allow(null)) /* ! */,
	username: Joi.string().failover(null).allow(null) /* ! */,
	password: Joi.string().failover(null).allow(null) /* ! */,
	url: Joi.string().uri().required() /* ! */
});

const jobInputS3LikeSchema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...STORAGE_S3_LIKE_TYPES)
		.required() /* ! */,
	endpoint: Joi.string().failover(null).allow(null) /* ! */,
	access_key: Joi.string().required() /* ! */,
	access_secret: Joi.string().required() /* ! */,
	region: Joi.string().required() /* ! */,
	bucket: Joi.string().required() /* ! */,
	path: Joi.string().required() /* ! */
});

const jobInputFtpSchema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...STORAGE_FTP_TYPES)
		.required() /* ! */,
	host: Joi.string().required() /* ! */,
	port: Joi.number().range(1, 65535).default(21).failover(21) /* ! */,
	username: Joi.string().default("anonymous").failover("anonymous") /* ! */,
	password: Joi.string().default(null).failover(null).allow(null) /* ! */,
	secure: Joi.boolean().default(false).failover(false) /* ! */,
	path: Joi.string().required() /* ! */
});

const jobInputBase64Schema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...BASE64_TYPES)
		.required() /* ! */,
	content: Joi.string().required() /* ! */
});

const jobInputSchema = Joi.alternatives().try(jobInputHttpSchema, jobInputS3LikeSchema, jobInputFtpSchema, jobInputBase64Schema);

// Job destination schemas
const jobDestinationLocalSchema = Joi.object({
	type: Joi.string().uppercase().constantcase().valid("LOCAL").required() /* ! */
});

const jobDestinationHttpSchema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...HTTPS_TYPES)
		.required() /* ! */,
	method: Joi.string().uppercase().constantcase().valid("GET", "POST", "PUT").default("POST").failover("POST") /* ! */,
	agent: Joi.string().failover(null).allow(null) /* ! */,
	headers: Joi.object().pattern(Joi.string().failover("_undefined"), Joi.any().failover(null).allow(null)) /* ! */,
	params: Joi.object().pattern(Joi.string().failover("_undefined"), Joi.any().failover(null).allow(null)) /* ! */,
	username: Joi.string().failover(null).allow(null) /* ! */,
	password: Joi.string().failover(null).allow(null) /* ! */,
	url: Joi.string().uri().required() /* ! */
});

const jobDestinationS3LikeSchema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...STORAGE_S3_LIKE_TYPES)
		.required() /* ! */,
	endpoint: Joi.string().failover(null).allow(null) /* ! */,
	access_key: Joi.string().required() /* ! */,
	access_secret: Joi.string().required() /* ! */,
	region: Joi.string().required() /* ! */,
	bucket: Joi.string().required() /* ! */,
	acl: Joi.string().constantcase().validOrDefault(STORAGE_S3_LIKE_ACLS),
	expires_in: Joi.number().failover(null).allow(null),
	cache_control: Joi.string().failover(null).allow(null)
});

const jobDestinationFtpSchema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...STORAGE_FTP_TYPES)
		.required(),
	host: Joi.string().required() /* ! */,
	port: Joi.number().range(1, 65535).default(21).failover(21) /* ! */,
	username: Joi.string().default("anonymous").failover("anonymous") /* ! */,
	password: Joi.string().default(null).failover(null).allow(null) /* ! */,
	secure: Joi.boolean().default(false).failover(false) /* ! */
});

const jobDestinationSchema = Joi.alternatives().try(
	jobDestinationLocalSchema,
	jobDestinationHttpSchema,
	jobDestinationS3LikeSchema,
	jobDestinationFtpSchema
);

// Job notification schemas
const jobNotificationCommonSchema = {
	notify_on: Joi.array()
		.items(Joi.any().constantcase().validOrFallback(NOTIFICATION_NOTIFY_ON_TYPES))
		.default(jobNotificationNotifyOnDefault || [])
		.failover(jobNotificationNotifyOnDefault || [])
		.allow(null)
		.sparse(true)
		.compact() /* ! */,
	timeout: Joi.number()
		.range(0, appConfig.jobs.notifications.timeout_max || 10 * 1000)
		.default(appConfig.jobs.notifications.timeout || 10 * 1000)
		.failover(appConfig.jobs.notifications.timeout || 10 * 1000) /* ! */,
	try: Joi.number()
		.range(appConfig.jobs.notifications.try_min || 1, appConfig.jobs.notifications.try_max || 3)
		.default(appConfig.jobs.notifications.try_max || 3)
		.failover(appConfig.jobs.notifications.try_max || 3) /* ! */,
	retry_in: Joi.number()
		.range(appConfig.jobs.notifications.retry_in_min || 1 * 60 * 1000, appConfig.jobs.notifications.retry_in_max || 60 * 60 * 1000)
		.default(appConfig.jobs.notifications.retry_in || 1 * 60 * 1000)
		.failover(appConfig.jobs.notifications.retry_in || 1 * 60 * 1000) /* ! */
};

const jobNotificationHttpSchema = Joi.object({
	type: Joi.string()
		.uppercase()
		.constantcase()
		.valid(...HTTPS_TYPES)
		.required() /* ! */,
	method: Joi.string().uppercase().constantcase().valid("GET", "POST", "PUT").default("POST").failover("POST") /* ! */,
	agent: Joi.string().failover(null).allow(null) /* ! */,
	headers: Joi.object().pattern(Joi.string().failover("_undefined"), Joi.any().failover(null).allow(null)) /* ! */,
	params: Joi.object().pattern(Joi.string().failover("_undefined"), Joi.any().failover(null).allow(null)) /* ! */,
	username: Joi.string().failover(null).allow(null) /* ! */,
	password: Joi.string().failover(null).allow(null) /* ! */,
	url: Joi.string().uri().required() /* ! */,
	...jobNotificationCommonSchema
});

const jobNotificationAwsSnsSchema = Joi.object({
	type: Joi.string().uppercase().constantcase().valid("AWS_SNS").required() /* ! */,
	access_key: Joi.string().required() /* ! */,
	access_secret: Joi.string().required() /* ! */,
	region: Joi.string().required() /* ! */,
	topic: Joi.string().required() /* ! */,
	...jobNotificationCommonSchema
});

const jobNotificationSchema = Joi.alternatives().try(jobNotificationHttpSchema, jobNotificationAwsSnsSchema);

// Job output common schemas
const jobOutputConfigCommonSchema = {
	name: Joi.string().failover(null).allow(null) /* ! */,
	priority: Joi.number()
		.range(1, undefined)
		.default(appConfig.jobs.priority || 1000)
		.failover(appConfig.jobs.priority || 1000) /* ! */,
	path: Joi.string() /* ! */
};

const jobOutputConfigCommonVisualSchema = {
	width: Joi.number().range(1, 7680).failover(null).allow(null) /* ! */,
	height: Joi.number().range(1, 7680).failover(null).allow(null) /* ! */,
	quality: Joi.number().range(0, 100).failover(null).allow(null) /* ! */,
	fit: Joi.string().constantcase().validOrFallback(FIT_MODES, FIT_MODES[0]).failover(FIT_MODES[0]) /* ! */,
	rotate: Joi.number().validOrFallback(ROTATE_MODES, null).failover(null).allow(null) /* ! */,
	flip: Joi.string().constantcase().validOrFallback(FLIP_MODES, null).failover(null).allow(null) /* ! */
};

const jobOutputConfigCommonFileSchema = {
	acl: Joi.string()
		.constantcase()
		.validOrFallback(STORAGE_S3_LIKE_ACLS, STORAGE_S3_LIKE_ACLS[0])
		.failover(STORAGE_S3_LIKE_ACLS[0]) /* ! */,
	expires_in: Joi.number().failover(null).allow(null) /* ! */,
	cache_control: Joi.string().failover(null).allow(null) /* ! */
};

const jobOutputConfigCommonFfmpegSchema = {
	ffmpeg_preset: Joi.any().constantcase().validOrFallback(FFMPEG_PRESETS, FFMPEG_PRESETS[0]).failover(FFMPEG_PRESETS[0]) /* ! */,
	ffmpeg_quality: Joi.number()
		.range(0, 100)
		.failover(appConfig.utils.ffmpeg.quality ?? null)
		.allow(null) /* ! */
};

const jobOutputConfigCommonVideoSchema = {
	video_first_frame_image_url: Joi.string().uri().failover(null).allow(null) /* ! */,
	video_quality: Joi.number().range(0, 100).failover(null).allow(null) /* ! */,
	video_codec: Joi.string().failover(null).allow(null) /* ! */,
	video_bit_rate: Joi.any().bitrate().failover(null).allow(null) /* ! */,
	video_pixel_format: Joi.string().failover(null).allow(null) /* ! */,
	video_frame_rate: Joi.any().framerate().failover(null).allow(null),
	video_profile: Joi.string().constantcase().validOrFallback(VIDEO_PROFILES, null).failover(null).allow(null) /* ! */,
	video_level: Joi.string().constantcase().validOrFallback(VIDEO_LEVELS, null).failover(null).allow(null) /* ! */,
	video_deinterlace: Joi.boolean().failover(true).allow(null) /* ! */
};

const jobOutputConfigCommonAudioSchema = {
	audio_quality: Joi.number().range(0, 100).failover(null).allow(null) /* ! */,
	audio_codec: Joi.string().failover(null).allow(null) /* ! */,
	audio_bit_rate: Joi.any().bitrate().failover(null).allow(null) /* ! */,
	audio_sample_rate: Joi.any().samplerate().failover(null).allow(null) /* ! */,
	audio_channels: Joi.any().constantcase().validOrFallback(AUDIO_CHANNELS, null).failover(null).allow(null) /* ! */
};

const jobCommonTrySchema = {
	try: Joi.number()
		.range(appConfig.jobs.try_min || 1, appConfig.jobs.try_max || 3)
		.default(appConfig.jobs.try_max || 3)
		.failover(appConfig.jobs.try_max || 3) /* ! */,
	retry_in: Joi.number()
		.range(appConfig.jobs.retry_in_min || 1 * 60 * 1000, appConfig.jobs.retry_in_max || 60 * 60 * 1000)
		.default(appConfig.jobs.retry_in || 1 * 60 * 1000)
		.failover(appConfig.jobs.retry_in || 1 * 60 * 1000) /* ! */
};

// Job output schemas for each type
const jobOutputConfigVideoSchema = Joi.object({
	type: Joi.string().uppercase().constantcase().valid("VIDEO").required() /* ! */,
	format: Joi.string().constantcase().validOrFallback(VIDEO_FORMATS, VIDEO_FORMATS[0]).failover(VIDEO_FORMATS[0]).required() /* ! */,
	...jobOutputConfigCommonSchema,
	...jobOutputConfigCommonVideoSchema,
	...jobOutputConfigCommonAudioSchema,
	offset: Joi.number().range(0, undefined).failover(0) /* ! */,
	duration: Joi.number().range(1, undefined).failover(null).allow(null) /* ! */,
	...jobOutputConfigCommonVisualSchema,
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,
	...jobCommonTrySchema
});

const jobOutputConfigAudioSchema = Joi.object({
	type: Joi.string().uppercase().constantcase().valid("AUDIO").required() /* ! */,
	format: Joi.string().constantcase().validOrFallback(AUDIO_FORMATS, AUDIO_FORMATS[0]).failover(AUDIO_FORMATS[0]).required() /* ! */,
	...jobOutputConfigCommonSchema,
	...jobOutputConfigCommonAudioSchema,
	offset: Joi.number().range(0, undefined).failover(0) /* ! */,
	duration: Joi.number().range(1, undefined).failover(null).allow(null) /* ! */,
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,
	...jobCommonTrySchema
});

const jobOutputConfigThumbnailSchema = Joi.object({
	type: Joi.string().uppercase().constantcase().valid("THUMBNAIL").required() /* ! */,
	format: Joi.string()
		.constantcase()
		.validOrFallback(THUMBNAIL_FORMATS, THUMBNAIL_FORMATS[0])
		.failover(THUMBNAIL_FORMATS[0])
		.required() /* ! */,
	...jobOutputConfigCommonSchema,
	offset: Joi.number().range(0, undefined).failover(0) /* ! */,
	...jobOutputConfigCommonVisualSchema,
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,
	...jobCommonTrySchema
});

const jobOutputConfigSubtitleSchema = Joi.object({
	type: Joi.string().uppercase().constantcase().valid("SUBTITLE").required() /* ! */,
	format: Joi.string()
		.constantcase()
		.validOrFallback(SUBTITLE_FORMATS, SUBTITLE_FORMATS[0])
		.failover(SUBTITLE_FORMATS[0])
		.required() /* ! */,
	...jobOutputConfigCommonSchema,
	offset: Joi.number().range(0, undefined).failover(0) /* ! */,
	duration: Joi.number().range(1, undefined).failover(null).allow(null) /* ! */,
	language: Joi.string().optional().failover(null).allow(null) /* ! */,
	destination: jobDestinationSchema.optional(),
	...jobOutputConfigCommonFileSchema,
	...jobOutputConfigCommonFfmpegSchema,

	whisper_model: Joi.string()
		.constantcase()
		.validOrFallback(WHISPER_MODELS, appConfig.utils.whisper.model || WHISPER_MODELS[0])
		.failover(appConfig.utils.whisper.model || WHISPER_MODELS[0]) /* ! */,
	whisper_with_cuda: Joi.boolean().failover(appConfig.utils.whisper.with_cuda || false) /* ! */,

	...jobCommonTrySchema
});

const outputConfigSchema = Joi.alternatives().try(
	jobOutputConfigVideoSchema,
	jobOutputConfigAudioSchema,
	jobOutputConfigThumbnailSchema,
	jobOutputConfigSubtitleSchema
);

export const jobSchema = Joi.object({
	priority: Joi.number()
		.range(1, undefined)
		.default(appConfig.jobs.priority || 1000)
		.failover(appConfig.jobs.priority || 1000) /* ! */,
	config: jobConfigSchema,
	input: jobInputSchema,
	outputs: Joi.array().items(outputConfigSchema).min(1).required() /* ! */,
	destination: jobDestinationSchema.optional() /* ! */,
	notification: jobNotificationSchema.optional() /* ! */,
	metadata: Joi.array()
		.items(Joi.object().pattern(Joi.string().failover("_undefined"), Joi.any().failover(null).allow(null)))
		.optional(),
	...jobCommonTrySchema
});
