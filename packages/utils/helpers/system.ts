import { config } from "@voltage/config";
import os from "os";
import { hash, uuid } from "./crypto";

const networkInterfaces = os.networkInterfaces();

/**
 * Get instance key based on configured key method
 * @returns Instance key (hashed IP or unique key)
 */
export function getInstanceKey(): string {
	if (config.runtime.key_method === "IP_ADDRESS") {
		const ipAddress = getInstanceLocalIpAddress();
		return hash(ipAddress || uuid());
	}

	return hash(uuid());
}

/**
 * Get instance specifications (CPU, memory, OS info)
 * @returns Object containing instance specs
 */
export function getInstanceSpecs(): {
	hostname: string;
	ip_address: string | null;
	port: number;
	os_platform: string;
	os_release: string;
	cpu_core_count: number;
	cpu_frequency_mhz: number;
	cpu_usage_percent: number;
	memory_total: number;
	memory_free: number;
	memory_usage_percent: number;
	workers_per_cpu_core: number;
	workers_max: number;
} {
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

/**
 * Get local IPv4 address (non-internal)
 * @returns IP address or null if not found
 */
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

/**
 * Get average CPU frequency in MHz
 * @returns CPU frequency in MHz
 */
export function getInstanceCpuFrequencyMHz(): number {
	try {
		const cpus = os.cpus();
		if (cpus.length === 0) return 0;
		const totalSpeed = cpus.reduce((acc, cpu) => acc + cpu.speed, 0);
		return totalSpeed / cpus.length;
	} catch (error) {
		return 0;
	}
}

/**
 * Get current CPU usage percentage
 * @returns CPU usage as percentage (0-100)
 */
export function getInstanceCpuUsagePercent(): number {
	try {
		const cpus = os.cpus();
		const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
		const totalTick = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0);
		const idlePercentage = (totalIdle / totalTick) * 100;
		return parseFloat((100 - idlePercentage).toFixed(2));
	} catch (error) {
		return 0;
	}
}

/**
 * Get current memory usage percentage
 * @returns Memory usage as percentage (0-100)
 */
export function getInstanceMemoryUsagePercent(): number {
	try {
		const totalMemory = os.totalmem();
		const freeMemory = os.freemem();
		const usedMemory = totalMemory - freeMemory;
		return parseFloat(((usedMemory / totalMemory) * 100).toFixed(2));
	} catch (error) {
		return 0;
	}
}
