import { describe, it, expect, vi } from "vitest";
import {
	getInstanceKey,
	getInstanceSpecs,
	getInstanceLocalIpAddress,
	getInstanceCpuFrequencyMHz,
	getInstanceCpuUsagePercent,
	getInstanceMemoryUsagePercent
} from "../system";

// Mock the config
vi.mock("@voltage/config", () => ({
	config: {
		port: 3000,
		runtime: {
			key_method: "IP_ADDRESS",
			workers: {
				per_cpu_core: 2,
				max: 10
			}
		}
	}
}));

describe("system helpers", () => {
	describe("getInstanceKey", () => {
		it("should generate instance key", () => {
			const key = getInstanceKey();
			expect(key).toBeTruthy();
			expect(typeof key).toBe("string");
			// Should be a hash (40 chars for SHA1)
			expect(key).toMatch(/^[0-9a-f]{40}$/i);
		});

		it("should generate consistent keys", () => {
			// Note: With IP_ADDRESS method, key should be consistent if IP doesn't change
			const key1 = getInstanceKey();
			const key2 = getInstanceKey();
			expect(key1).toBe(key2);
		});
	});

	describe("getInstanceLocalIpAddress", () => {
		it("should return IP address or null", () => {
			const ip = getInstanceLocalIpAddress();
			// Either valid IPv4 or null
			if (ip !== null) {
				expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
			} else {
				expect(ip).toBeNull();
			}
		});
	});

	describe("getInstanceCpuFrequencyMHz", () => {
		it("should return CPU frequency", () => {
			const freq = getInstanceCpuFrequencyMHz();
			expect(typeof freq).toBe("number");
			expect(freq).toBeGreaterThanOrEqual(0);
		});
	});

	describe("getInstanceCpuUsagePercent", () => {
		it("should return CPU usage percentage", () => {
			const usage = getInstanceCpuUsagePercent();
			expect(typeof usage).toBe("number");
			expect(usage).toBeGreaterThanOrEqual(0);
			expect(usage).toBeLessThanOrEqual(100);
		});
	});

	describe("getInstanceMemoryUsagePercent", () => {
		it("should return memory usage percentage", () => {
			const usage = getInstanceMemoryUsagePercent();
			expect(typeof usage).toBe("number");
			expect(usage).toBeGreaterThanOrEqual(0);
			expect(usage).toBeLessThanOrEqual(100);
		});
	});

	describe("getInstanceSpecs", () => {
		it("should return complete instance specifications", () => {
			const specs = getInstanceSpecs();

			// Validate structure
			expect(specs).toHaveProperty("hostname");
			expect(specs).toHaveProperty("ip_address");
			expect(specs).toHaveProperty("port");
			expect(specs).toHaveProperty("os_platform");
			expect(specs).toHaveProperty("os_release");
			expect(specs).toHaveProperty("cpu_core_count");
			expect(specs).toHaveProperty("cpu_frequency_mhz");
			expect(specs).toHaveProperty("cpu_usage_percent");
			expect(specs).toHaveProperty("memory_total");
			expect(specs).toHaveProperty("memory_free");
			expect(specs).toHaveProperty("memory_usage_percent");
			expect(specs).toHaveProperty("workers_per_cpu_core");
			expect(specs).toHaveProperty("workers_max");

			// Validate types
			expect(typeof specs.hostname).toBe("string");
			expect(typeof specs.port).toBe("number");
			expect(typeof specs.os_platform).toBe("string");
			expect(typeof specs.os_release).toBe("string");
			expect(typeof specs.cpu_core_count).toBe("number");
			expect(typeof specs.cpu_frequency_mhz).toBe("number");
			expect(typeof specs.cpu_usage_percent).toBe("number");
			expect(typeof specs.memory_total).toBe("number");
			expect(typeof specs.memory_free).toBe("number");
			expect(typeof specs.memory_usage_percent).toBe("number");
			expect(typeof specs.workers_per_cpu_core).toBe("number");
			expect(typeof specs.workers_max).toBe("number");

			// Validate ranges
			expect(specs.port).toBe(3000);
			expect(specs.cpu_core_count).toBeGreaterThan(0);
			expect(specs.memory_total).toBeGreaterThan(0);
			expect(specs.memory_free).toBeGreaterThanOrEqual(0);
			expect(specs.workers_per_cpu_core).toBe(2);
			expect(specs.workers_max).toBe(10);
		});

		it("should have valid memory calculations", () => {
			const specs = getInstanceSpecs();
			expect(specs.memory_free).toBeLessThanOrEqual(specs.memory_total);
			expect(specs.memory_usage_percent).toBeGreaterThanOrEqual(0);
			expect(specs.memory_usage_percent).toBeLessThanOrEqual(100);
		});

		it("should have valid CPU data", () => {
			const specs = getInstanceSpecs();
			expect(specs.cpu_usage_percent).toBeGreaterThanOrEqual(0);
			expect(specs.cpu_usage_percent).toBeLessThanOrEqual(100);
			expect(specs.cpu_frequency_mhz).toBeGreaterThanOrEqual(0);
		});
	});
});
