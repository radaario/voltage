import { FFMPEG_PRESETS, NSFW_MODELS, NSFW_TYPES, WHISPER_MODELS } from "@voltage/config";
import { JobRequest, appConfig } from "@voltage/config";
import { formatToUpperSnakeCase, parsePercent } from "@voltage/utils";
import Joi from "joi";
import JoiExt from "@/utils/joi.util";

// Config schema with defaults
const jobConfigSchema = Joi.object({
	analyze_input: Joi.boolean().default(appConfig.jobs.analyze_input || true),
	generate_preview: Joi.boolean().default(appConfig.jobs.generate_preview || true),
	detect_nsfw: Joi.boolean().default(appConfig.jobs.detect_nsfw || true),

	ffprobe_general_attributes: Joi.string().default(appConfig.utils.ffprobe.general_attributes || null),
	ffprobe_video_attributes: Joi.string().default(appConfig.utils.ffprobe.video_attributes || null),
	ffprobe_audio_attributes: Joi.string().default(appConfig.utils.ffprobe.audio_attributes || null),

	ffmpeg_preset: JoiExt.string()
		.validWithDefault(FFMPEG_PRESETS, appConfig.utils.ffmpeg.preset || FFMPEG_PRESETS[0])
		.formatter(formatToUpperSnakeCase),
	ffmpeg_quality: Joi.number()
		.min(0)
		.max(100)
		.default(appConfig.utils.ffmpeg.quality || 75)
		.custom(parsePercent),

	nsfw_model: Joi.string()
		.valid(...NSFW_MODELS)
		.default(appConfig.utils.nsfw.model || NSFW_MODELS[0])
		.custom(formatToUpperSnakeCase),
	nsfw_size: Joi.number().default(appConfig.utils.nsfw.size || 224),
	nsfw_type: Joi.string()
		.valid(...NSFW_TYPES)
		.default(appConfig.utils.nsfw.type || NSFW_TYPES[0])
		.custom(formatToUpperSnakeCase),
	nsfw_threshold: Joi.number()
		.min(0)
		.max(100)
		.default(appConfig.utils.nsfw.threshold || 75)
		.custom(parsePercent),

	whisper_model: Joi.string()
		.valid(...WHISPER_MODELS)
		.default(appConfig.utils.whisper.model || WHISPER_MODELS[0])
		.custom(formatToUpperSnakeCase),
	whisper_with_cuda: Joi.boolean().default(appConfig.utils.whisper.with_cuda)
}).optional();

// Input schemas for each type
const base64InputSchema = Joi.object({
	type: Joi.string().valid("BASE64").required(),
	content: Joi.string().required(),
	name: Joi.string().optional()
});

const httpInputSchema = Joi.object({
	type: Joi.string().valid("HTTP", "HTTPS").required(),
	username: Joi.string().optional(),
	password: Joi.string().optional(),
	url: Joi.string().uri().required(),
	name: Joi.string().optional()
});

const s3InputSchema = Joi.object({
	type: Joi.string()
		.valid("AWS_S3", "GOOGLE_CLOUD_STORAGE", "DO_SPACES", "LINODE", "WASABI", "BACKBLAZE", "RACKSPACE", "MICROSOFT_AZURE", "OTHER_S3")
		.required(),
	access_key: Joi.string().required(),
	access_secret: Joi.string().required(),
	region: Joi.string().required(),
	bucket: Joi.string().required(),
	path: Joi.string().required(),
	name: Joi.string().optional()
});

const ftpInputSchema = Joi.object({
	type: Joi.string().valid("FTP", "SFTP").required(),
	host: Joi.string().required(),
	username: Joi.string().optional(),
	password: Joi.string().optional(),
	path: Joi.string().required(),
	name: Joi.string().optional()
});

const inputSchema = Joi.alternatives().try(base64InputSchema, httpInputSchema, s3InputSchema, ftpInputSchema);

// Destination schemas
const httpDestinationSchema = Joi.object({
	type: Joi.string().valid("HTTP", "HTTPS").required(),
	method: Joi.string().valid("POST", "PUT").default("POST"),
	headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
	url: Joi.string().uri().required()
});

const s3DestinationSchema = Joi.object({
	type: Joi.string()
		.valid("AWS_S3", "GOOGLE_CLOUD_STORAGE", "DO_SPACES", "LINODE", "WASABI", "BACKBLAZE", "RACKSPACE", "MICROSOFT_AZURE", "OTHER_S3")
		.required(),
	endpoint: Joi.string().optional(),
	access_key: Joi.string().required(),
	access_secret: Joi.string().required(),
	region: Joi.string().required(),
	bucket: Joi.string().required(),
	acl: Joi.string().optional(),
	expires: Joi.number().optional(),
	cache_control: Joi.string().optional()
});

const ftpDestinationSchema = Joi.object({
	type: Joi.string().valid("FTP", "SFTP").required(),
	host: Joi.string().required(),
	port: Joi.number().optional(),
	username: Joi.string().required(),
	password: Joi.string().required(),
	secure: Joi.boolean().optional()
});

const destinationSchema = Joi.alternatives().try(httpDestinationSchema, s3DestinationSchema, ftpDestinationSchema);

// Notification schemas
const httpNotificationSchema = Joi.object({
	type: Joi.string().valid("HTTP", "HTTPS").required(),
	method: Joi.string().valid("GET", "POST", "PUT").default("POST"),
	headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
	url: Joi.string().uri().required(),
	notify_on: Joi.array().items(Joi.string()).optional(),
	timeout: Joi.number().default(appConfig.jobs.notifications.timeout).max(appConfig.jobs.notifications.timeout_max),
	try: Joi.number().default(appConfig.jobs.notifications.try).max(appConfig.jobs.notifications.try_max),
	retry_in: Joi.number().default(appConfig.jobs.notifications.retry_in).max(appConfig.jobs.notifications.retry_in_max)
});

const snsNotificationSchema = Joi.object({
	type: Joi.string().valid("AWS_SNS").required(),
	access_key: Joi.string().required(),
	access_secret: Joi.string().required(),
	region: Joi.string().required(),
	topic: Joi.string().required(),
	notify_on: Joi.array().items(Joi.string()).optional(),
	timeout: Joi.number().default(appConfig.jobs.notifications.timeout).max(appConfig.jobs.notifications.timeout_max),
	try: Joi.number().default(appConfig.jobs.notifications.try).max(appConfig.jobs.notifications.try_max),
	retry_in: Joi.number().default(appConfig.jobs.notifications.retry_in).max(appConfig.jobs.notifications.retry_in_max)
});

const notificationSchema = Joi.alternatives().try(httpNotificationSchema, snsNotificationSchema);

// Output schemas for each type
const videoOutputSchema = Joi.object({
	type: Joi.string().valid("VIDEO").required(),
	format: Joi.string().required(),
	name: Joi.string().optional(),
	path: Joi.string().optional(),
	video_codec: Joi.string().optional(),
	video_bit_rate: Joi.alternatives(Joi.number(), Joi.string()).optional(),
	video_pixel_format: Joi.string().optional(),
	video_frame_rate: Joi.alternatives(Joi.number(), Joi.string()).optional(),
	video_profile: Joi.string().optional(),
	video_level: Joi.string().optional(),
	video_deinterlace: Joi.boolean().optional(),
	audio_codec: Joi.string().optional(),
	audio_bit_rate: Joi.alternatives(Joi.number(), Joi.string()).optional(),
	audio_sample_rate: Joi.number().optional(),
	audio_channels: Joi.number().optional(),
	offset: Joi.number().optional(),
	duration: Joi.number().optional(),
	width: Joi.number().optional(),
	height: Joi.number().optional(),
	quality: Joi.number().min(1).max(100).optional(),
	fit: Joi.string().valid("PAD", "STRETCH", "CROP", "MAX").optional(),
	rotate: Joi.number().valid(90, -90, 180, -180).optional(),
	flip: Joi.string().valid("HORIZONTAL", "VERTICAL", "BOTH").optional(),
	acl: Joi.string().optional(),
	expires: Joi.number().optional(),
	cache_control: Joi.string().optional(),
	destination: Joi.object().optional(),
	ffmpeg_preset: Joi.string().optional(),
	ffmpeg_quality: Joi.number().optional()
});

const audioOutputSchema = Joi.object({
	type: Joi.string().valid("AUDIO").required(),
	format: Joi.string().required(),
	name: Joi.string().optional(),
	path: Joi.string().optional(),
	audio_codec: Joi.string().optional(),
	audio_bit_rate: Joi.alternatives(Joi.number(), Joi.string()).optional(),
	audio_sample_rate: Joi.number().optional(),
	audio_channels: Joi.number().optional(),
	offset: Joi.number().optional(),
	duration: Joi.number().optional(),
	acl: Joi.string().optional(),
	expires: Joi.number().optional(),
	cache_control: Joi.string().optional(),
	destination: Joi.object().optional(),
	ffmpeg_preset: Joi.string().optional(),
	ffmpeg_quality: Joi.number().optional()
});

const thumbnailOutputSchema = Joi.object({
	type: Joi.string().valid("THUMBNAIL").required(),
	format: Joi.string().required(),
	name: Joi.string().optional(),
	path: Joi.string().optional(),
	offset: Joi.number().optional(),
	width: Joi.number().optional(),
	height: Joi.number().optional(),
	quality: Joi.number().min(1).max(100).optional(),
	fit: Joi.string().valid("PAD", "STRETCH", "CROP", "MAX").optional(),
	rotate: Joi.number().valid(90, -90, 180, -180).optional(),
	flip: Joi.string().valid("HORIZONTAL", "VERTICAL", "BOTH").optional(),
	acl: Joi.string().optional(),
	expires: Joi.number().optional(),
	cache_control: Joi.string().optional(),
	destination: Joi.object().optional(),
	ffmpeg_preset: Joi.string().optional(),
	ffmpeg_quality: Joi.number().optional()
});

const subtitleOutputSchema = Joi.object({
	type: Joi.string().valid("SUBTITLE").required(),
	format: Joi.string().required(),
	name: Joi.string().optional(),
	path: Joi.string().optional(),
	language: Joi.string().optional(),
	model: Joi.string().optional(),
	acl: Joi.string().optional(),
	expires: Joi.number().optional(),
	cache_control: Joi.string().optional(),
	destination: Joi.object().optional(),
	ffmpeg_preset: Joi.string().optional(),
	ffmpeg_quality: Joi.number().optional(),
	whisper_model: Joi.string().optional(),
	whisper_with_cuda: Joi.boolean().optional()
});

const outputSchema = Joi.alternatives().try(videoOutputSchema, audioOutputSchema, thumbnailOutputSchema, subtitleOutputSchema);

export const createJobSchema: Joi.ObjectSchema<JobRequest> = Joi.object<JobRequest>({
	priority: Joi.number().integer().min(1).default(1000),
	config: jobConfigSchema,
	input: inputSchema,
	outputs: Joi.array().items(outputSchema).min(1).required(),
	destination: destinationSchema.optional(),
	notification: notificationSchema.optional(),
	metadata: Joi.array().items(Joi.object().pattern(Joi.string(), Joi.any())).optional(),
	try_max: Joi.number()
		.integer()
		.min(appConfig.jobs.try_min)
		.max(appConfig.jobs.try_max)
		.default(appConfig.jobs.try_count || 3),
	retry_in: Joi.number()
		.integer()
		.min(appConfig.jobs.retry_in_min)
		.max(appConfig.jobs.retry_in_max)
		.default(appConfig.jobs.retry_in || 60000)
});
