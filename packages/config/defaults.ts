import os from "os";
import path from "path";

const isWindows = os.platform() === "win32";
const cpuCoresCount = os.cpus().length;

// Base paths
export const getAppDir = () => path.resolve(process.cwd(), "../..");

// System defaults
export const SYSTEM_DEFAULTS = {
	isWindows,
	cpuCoresCount,
	ffmpegPath: isWindows ? "C:\\ffmpeg\\bin\\ffmpeg" : "ffmpeg",
	ffprobePath: isWindows ? "C:\\ffmpeg\\bin\\ffprobe" : "ffprobe"
};

// Application defaults
export const APP_DEFAULTS = {
	name: "VOLTAGE",
	version: "1.1.0",
	env: "local",
	protocol: "http",
	host: "localhost",
	port: 8080,
	path: "/",
	nginxPort: 8080,
	timezone: "UTC"
};

// Storage defaults
export const STORAGE_DEFAULTS = {
	type: "LOCAL",
	endpoint: "",
	accessKey: "",
	accessSecret: "",
	region: "",
	bucket: "",
	host: "",
	username: "",
	password: "",
	secure: false
};

// Database defaults
export const DATABASE_DEFAULTS = {
	type: "SQLITE",
	host: "localhost",
	port: 3306,
	username: "root",
	password: "",
	name: "voltage",
	tablePrefix: "",
	fileName: "db.sqlite",
	cleanupInterval: 60 * 60 * 1000 // 1 hour
};

// Runtime defaults
export const RUNTIME_DEFAULTS = {
	isDisabled: false,
	keyMethod: "IP_ADDRESS",
	maintainInterval: 10 * 1000, // 10 seconds
	onlineTimeout: 15 * 1000, // 15 seconds
	purgeAfter: 60 * 1000, // 1 minute
	workers: {
		perCpuCore: 1,
		busyInterval: 1 * 1000, // 1 second
		busyTimeout: 5 * 60 * 1000, // 5 minutes
		idleAfter: 10 * 1000 // 10 seconds
	}
};

// API defaults
export const API_DEFAULTS = {
	isDisabled: false,
	nodePort: 4000,
	key: null,
	requestBodyLimit: 0,
	sensitiveFields: "password,access_secret"
};

// Frontend defaults
export const FRONTEND_DEFAULTS = {
	isDisabled: false,
	nodePort: 3000,
	password: null,
	dataRefetchInterval: 10000, // 10 seconds
	datetimeFormat: "YYYY-MM-DD HH:mm:ss",
	localStorage: {
		prefix: null
	}
};

// Stats defaults
export const STATS_DEFAULTS = {
	retention: 365 * 24 * 60 * 60 * 1000 // 365 days
};

// Logs defaults
export const LOGS_DEFAULTS = {
	isDisabled: false,
	retention: 60 * 60 * 1000 // 1 hour
};

// Jobs defaults
export const JOBS_DEFAULTS = {
	queueTimeout: 5 * 60 * 1000, // 5 minutes
	processInterval: 1 * 1000, // 1 second
	processTimeout: 30 * 60 * 1000, // 30 minutes
	enqueueOnReceive: true,
	enqueueLimit: 10,
	retention: 24 * 60 * 60 * 1000, // 24 hours
	tryMin: 1,
	tryMax: 3,
	tryCount: 3,
	retryInMin: 1 * 60 * 1000, // 1 minute
	retryInMax: 60 * 60 * 1000, // 60 minutes
	retryIn: 1 * 60 * 1000, // 1 minute
	preview: {
		format: "PNG",
		quality: 75
	},
	outputs: {
		processInterval: 10 * 1000 // 10 seconds
	},
	notifications: {
		processInterval: 1 * 1000, // 1 second
		processLimit: 10,
		notifyOn: "RECEIVED,COMPLETED,FAILED,TIMEOUT",
		notifyOnAlloweds:
			"RECEIVED,PENDING,RETRYING,QUEUED,STARTED,DOWNLOADING,DOWNLOADED,ANALYZING,ANALYZED,PROCESSING,PROCESSED,UPLOADING,UPLOADED,COMPLETED,CANCELLED,DELETED,FAILED,TIMEOUT",
		timeout: 10 * 1000, // 10 seconds
		timeoutMax: 30 * 1000, // 30 seconds
		try: 3,
		tryMax: 3,
		retryIn: 1 * 60 * 1000, // 1 minute
		retryInMax: 60 * 60 * 1000 // 60 minutes
	}
};

// Utils defaults
export const UTILS_DEFAULTS = {
	nsfw: {
		isDisabled: false,
		model: "MOBILE_NET_V2_MID",
		size: 299,
		type: "GRAPH",
		threshold: 0.7
	},
	whisper: {
		model: "BASE",
		cuda: false
	}
};
