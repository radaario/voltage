import { config } from "@voltage/config";

import os from "os";
import path from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";

moment.defaultFormat = "YYYY-MM-DD HH:mm:ss.SSS";

const networkInterfaces = os.networkInterfaces();

export function getInstanceKey(): string {
	if (config.runtime.key_method === "IP_ADDRESS") {
		const ipAddress = getInstanceLocalIpAddress();
		return hash(ipAddress || uuid());
	}

	return uukey();
}

export function getInstanceSpecs(): any {
	return {
		hostname: os.hostname(),
		ip_address: getInstanceLocalIpAddress(),
		port: config.port,
		os_platform: os.platform(),
		os_release: os.release(),
		cpu_core_count: os.cpus().length,
		cpu_frequency_mhz: getInstanceCpuFrequencyMHz(),
		cpu_usage_percent: getInstanceCpuUsagePercent(),
		memory_total: os.totalmem(),
		memory_free: os.freemem(),
		memory_usage_percent: getInstanceMemoryUsagePercent(),
		workers_per_cpu_core: config.runtime.workers.per_cpu_core,
		workers_max: config.runtime.workers.max
	};
}

export function getInstanceLocalIpAddress(): string | null {
	for (const iface of Object.values(networkInterfaces)) {
		if (!iface) continue;
		for (const addr of iface) {
			const family = String((addr as any).family);
			if (family === "IPv4" && !addr.internal) {
				return addr.address;
			}
		}
	}

	return null;
}

export function getInstanceCpuFrequencyMHz(): number {
	try {
		const cpus = os.cpus();
		if (cpus.length === 0) return 0;
		const totalSpeed = cpus.reduce((acc, cpu) => acc + cpu.speed, 0);
		return totalSpeed / cpus.length;
	} catch (error: Error | any) {}

	return 0;
}

export function getInstanceCpuUsagePercent(): number {
	try {
		const cpus = os.cpus();
		const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
		const totalTick = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0);
		const idlePercentage = (totalIdle / totalTick) * 100;
		return parseFloat((100 - idlePercentage).toFixed(2)); // Return CPU usage percentage as a two decimal float
	} catch (error: Error | any) {}

	return 0;
}

export function getInstanceMemoryUsagePercent(): number {
	try {
		const totalMemory = os.totalmem();
		const freeMemory = os.freemem();
		const usedMemory = totalMemory - freeMemory;
		return parseFloat(((usedMemory / totalMemory) * 100).toFixed(2)); // Return memory usage percentage
	} catch (error: Error | any) {}

	return 0;
}

export function uuid(): string {
	return uuidv4();
}

export function uukey(): string {
	return hash(uuidv4());
}

export function hash(data: string, algorithm: "MD5" | "SHA1" | "SHA256" | "SHA512" = "SHA1"): string {
	return crypto.createHash(algorithm).update(data).digest("hex");
}

export function getNow(format: string = "YYYY-MM-DD HH:mm:ss.SSS"): string {
	let m = moment();

	if (config.timezone && config.timezone !== "") {
		try {
			m = m.tz(config.timezone);
		} catch (error: Error | any) {
			// invalid timezone — fall back to local moment
		}
	}

	return m.format(format);
}

export function addNow(amount: number, unit: moment.unitOfTime.DurationConstructor, format: string = "YYYY-MM-DD HH:mm:ss.SSS"): string {
	let m = moment();
	if (config.timezone && config.timezone !== "") {
		try {
			m = m.tz(config.timezone);
		} catch (error: Error | any) {
			// invalid timezone — fall back to local moment
		}
	}

	return m.add(amount, unit).format(format);
}

export function subtractNow(
	amount: number,
	unit: moment.unitOfTime.DurationConstructor,
	format: string = "YYYY-MM-DD HH:mm:ss.SSS"
): string {
	let m = moment();

	if (config.timezone && config.timezone !== "") {
		try {
			m = m.tz(config.timezone);
		} catch (error: Error | any) {
			// invalid timezone — fall back to local moment
		}
	}

	return m.subtract(amount, unit).format(format);
}

// Sanitize sensitive fields from objects
export function sanitizeData(data: any, sensitiveFields: string[] = []): any {
	// Handle null or undefined
	if (data === null || data === undefined) return data;

	// Handle string - try to parse as JSON
	if (typeof data === "string") {
		try {
			const parsed = JSON.parse(data);
			return sanitizeData(parsed, sensitiveFields); // Recursively sanitize parsed data
		} catch (err) {
			return data; // Return as is if not valid JSON
		}
	}

	// Handle primitive types
	if (typeof data !== "object") return data;

	const coreSensitiveFields: string[] = config.api.sensitive_fields ? config.api.sensitive_fields.split(",").map((f) => f.trim()) : [];
	const allSensitiveFields = [...coreSensitiveFields, ...sensitiveFields];

	// Handle arrays
	if (Array.isArray(data)) {
		return data.map((item: any) => sanitizeData(item, sensitiveFields));
	}

	// Handle objects
	const sanitized: any = {};

	for (const key in data) {
		if (data.hasOwnProperty(key)) {
			// Skip sensitive fields
			if (allSensitiveFields && allSensitiveFields.includes(key)) {
				continue;
			}

			// Recursively sanitize nested objects and arrays
			sanitized[key] = sanitizeData(data[key], sensitiveFields);
		}
	}

	return sanitized;
}

export function guessContentType(filename: string): string {
	const ext = path.extname(filename).toLowerCase().replace(".", "");

	const map: Record<string, string> = {
		mp4: "video/mp4",
		mkv: "video/x-matroska",
		mov: "video/quicktime",
		webm: "video/webm",
		ts: "video/mp2t",
		avi: "video/x-msvideo",
		wmv: "video/x-ms-wmv",
		flv: "video/x-flv",
		m4v: "video/x-m4v",
		"3gp": "video/3gpp",
		"3g2": "video/3gpp2",
		ogg: "video/ogg",
		ogv: "video/ogg",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		svg: "image/svg+xml",
		webp: "image/webp",
		mp3: "audio/mpeg",
		wav: "audio/wav",
		m3u8: "application/vnd.apple.mpegurl",
		mpd: "application/dash+xml",
		json: "application/json",
		txt: "text/plain",
		html: "text/html",
		css: "text/css",
		js: "application/javascript"
	};

	return map[ext] || "application/octet-stream";
}

// Re-exports for convenience so consumers can import from '@voltage/utils'
export { logger } from "./logger";
export { storage } from "./storage";
export { database } from "./database";
