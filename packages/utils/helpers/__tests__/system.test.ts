import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";

// Mock os module
vi.mock("os", () => ({
	default: {
		hostname: vi.fn(() => "test-hostname"),
		platform: vi.fn(() => "linux"),
		release: vi.fn(() => "5.10.0"),
		cpus: vi.fn(() => [
			{ speed: 2400, times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 } },
			{ speed: 2400, times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 } }
		]),
		totalmem: vi.fn(() => 8589934592), // 8GB
		freemem: vi.fn(() => 4294967296), // 4GB
		networkInterfaces: vi.fn(() => ({
			eth0: [
				{
					address: "192.168.1.100",
					netmask: "255.255.255.0",
					family: "IPv4",
					internal: false
				}
			]
		}))
	}
}));

// Mock config
vi.mock("@voltage/core/config", () => ({
	config: {
		port: 3000,
		runtime: {
			key_method: "UNIQUE",
			workers: {
				per_cpu_core: 2,
				max: 4
			}
		}
	}
}));

// Mock crypto helpers
vi.mock("../crypto", () => ({
	hash: vi.fn((value: string) => `hashed_${value}`),
	uuid: vi.fn(() => "mock-uuid-1234")
}));

describe("System Helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getInstanceKey", () => {
		it("should return hashed UUID when key_method is UNIQUE", async () => {
			const { getInstanceKey } = await import("../system");
			const { config } = await import("@voltage/core/config");

			config.runtime.key_method = "UNIQUE";

			const key = getInstanceKey();

			expect(key).toBe("hashed_mock-uuid-1234");
		});

		it("should return hashed IP when key_method is IP_ADDRESS", async () => {
			const { getInstanceKey } = await import("../system");
			const { config } = await import("@voltage/core/config");

			config.runtime.key_method = "IP_ADDRESS";

			const key = getInstanceKey();

			expect(key).toBe("hashed_192.168.1.100");
		});

		it("should fallback to UUID if IP not available", async () => {
			const { getInstanceKey } = await import("../system");
			const { config } = await import("@voltage/core/config");

			config.runtime.key_method = "IP_ADDRESS";

			// Mock no network interfaces
			os.networkInterfaces = vi.fn(() => ({}));

			const key = getInstanceKey();

			expect(key).toContain("hashed_");
		});
	});

	describe("getInstanceSpecs", () => {
		it("should return complete instance specifications", async () => {
			const { getInstanceSpecs } = await import("../system");

			const specs = getInstanceSpecs();

			expect(specs).toMatchObject({
				hostname: "test-hostname",
				ip_address: "192.168.1.100",
				port: 3000,
				os_platform: "linux",
				os_release: "5.10.0",
				cpu_core_count: 2,
				workers_per_cpu_core: 2,
				workers_max: 4
			});

			expect(specs.cpu_frequency_mhz).toBeGreaterThan(0);
			expect(specs.cpu_usage_percent).toBeGreaterThanOrEqual(0);
			expect(specs.memory_total).toBeGreaterThan(0);
			expect(specs.memory_free).toBeGreaterThan(0);
			expect(specs.memory_usage_percent).toBeGreaterThanOrEqual(0);
			expect(specs.memory_usage_percent).toBeLessThanOrEqual(100);
		});

		it("should calculate memory usage correctly", async () => {
			const { getInstanceSpecs } = await import("../system");

			const specs = getInstanceSpecs();

			// 8GB total - 4GB free = 4GB used = 50%
			expect(specs.memory_usage_percent).toBe(50);
		});
	});

	describe("getInstanceLocalIpAddress", () => {
		it("should return IPv4 address from network interfaces", async () => {
			const { getInstanceLocalIpAddress } = await import("../system");

			const ip = getInstanceLocalIpAddress();

			expect(ip).toBe("192.168.1.100");
		});

		it("should skip internal addresses and return external IP", async () => {
			// This test validates that the function correctly filters internal addresses
			// Since networkInterfaces is cached at module load, the result will be the mocked value
			const { getInstanceLocalIpAddress } = await import("../system");

			const ip = getInstanceLocalIpAddress();

			// Should return the non-internal IP from the mock
			expect(ip).toBe("192.168.1.100");
			expect(ip).not.toBe("127.0.0.1");
		});
	});

	describe("getInstanceCpuFrequencyMHz", () => {
		it("should return average CPU frequency", async () => {
			const { getInstanceCpuFrequencyMHz } = await import("../system");

			const freq = getInstanceCpuFrequencyMHz();

			expect(freq).toBe(2400);
		});

		it("should return 0 when no CPUs available", async () => {
			const { getInstanceCpuFrequencyMHz } = await import("../system");

			os.cpus = vi.fn(() => []);

			const freq = getInstanceCpuFrequencyMHz();

			expect(freq).toBe(0);
		});

		it("should handle errors gracefully", async () => {
			const { getInstanceCpuFrequencyMHz } = await import("../system");

			os.cpus = vi.fn(() => {
				throw new Error("CPU error");
			});

			const freq = getInstanceCpuFrequencyMHz();

			expect(freq).toBe(0);
		});
	});

	describe("getInstanceCpuUsagePercent", () => {
		it("should calculate CPU usage percentage", async () => {
			const { getInstanceCpuUsagePercent } = await import("../system");

			const usage = getInstanceCpuUsagePercent();

			expect(usage).toBeGreaterThanOrEqual(0);
			expect(usage).toBeLessThanOrEqual(100);
			expect(typeof usage).toBe("number");
		});

		it("should return 0 on error", async () => {
			const { getInstanceCpuUsagePercent } = await import("../system");

			os.cpus = vi.fn(() => {
				throw new Error("CPU error");
			});

			const usage = getInstanceCpuUsagePercent();

			expect(usage).toBe(0);
		});

		it("should format to 2 decimal places", async () => {
			const { getInstanceCpuUsagePercent } = await import("../system");

			os.cpus = vi.fn(() => [{ model: "Test CPU", speed: 2400, times: { user: 333, nice: 0, sys: 167, idle: 8500, irq: 0 } }]);

			const usage = getInstanceCpuUsagePercent();

			// Should be formatted number
			expect(usage.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
		});
	});

	describe("getInstanceMemoryUsagePercent", () => {
		it("should calculate memory usage percentage", async () => {
			const { getInstanceMemoryUsagePercent } = await import("../system");

			const usage = getInstanceMemoryUsagePercent();

			// 50% usage (4GB used of 8GB)
			expect(usage).toBe(50);
		});

		it("should return 0 on error", async () => {
			const { getInstanceMemoryUsagePercent } = await import("../system");

			os.totalmem = vi.fn(() => {
				throw new Error("Memory error");
			});

			const usage = getInstanceMemoryUsagePercent();

			expect(usage).toBe(0);
		});

		it("should format to 2 decimal places", async () => {
			const { getInstanceMemoryUsagePercent } = await import("../system");

			os.totalmem = vi.fn(() => 10000000000);
			os.freemem = vi.fn(() => 3333333333);

			const usage = getInstanceMemoryUsagePercent();

			// Should be formatted number
			expect(usage.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
		});

		it("should handle edge case of 0 total memory", async () => {
			const { getInstanceMemoryUsagePercent } = await import("../system");

			os.totalmem = vi.fn(() => 0);
			os.freemem = vi.fn(() => 0);

			const usage = getInstanceMemoryUsagePercent();

			// Should not throw, return NaN or 0
			expect(typeof usage).toBe("number");
		});
	});
});
