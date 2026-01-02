import { describe, it, expect } from "vitest";
import { ConfigValidationError, validateConfig } from "../validators";

describe("Config Validators", () => {
	describe("ConfigValidationError", () => {
		it("should create an error with correct message", () => {
			const error = new ConfigValidationError("Test error");
			expect(error.message).toBe("Test error");
			expect(error.name).toBe("ConfigValidationError");
		});

		it("should be instance of Error", () => {
			const error = new ConfigValidationError("Test error");
			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(ConfigValidationError);
		});
	});

	describe("validateConfig", () => {
		const getValidConfig = () => ({
			name: "Voltage",
			version: "1.0.0",
			timezone: "UTC",
			port: 8080,
			ngnix_port: 80,
			api: {
				node_port: 8081
			},
			frontend: {
				node_port: 3000
			},
			storage: {
				type: "LOCAL" as const
			},
			database: {
				type: "SQLITE" as const,
				port: 0,
				file_name: "voltage.db"
			},
			runtime: {
				is_disabled: false,
				max_concurrent_jobs: 1,
				max_retries: 3,
				workers: {
					per_cpu_core: 1,
					busy_interval: 5000,
					busy_timeout: 10000
				},
				maintain_interval: 30000,
				online_timeout: 60000
			},
			jobs: {
				max_file_size: 1073741824,
				timeout: 3600000,
				try_min: 1,
				try_max: 3,
				try: 0,
				enqueue_limit: 10,
				process_interval: 1000,
				process_timeout: 5000
			},
			utils: {
				nsfw: {
					size: 224,
					threshold: 60
				}
			}
		});

		describe("Application validation", () => {
			it("should pass with valid config", () => {
				const config = getValidConfig();
				expect(() => validateConfig(config)).not.toThrow();
			});

			it("should throw error for empty name", () => {
				const config = getValidConfig();
				config.name = "";
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("Application name cannot be empty");
			});

			it("should throw error for empty version", () => {
				const config = getValidConfig();
				config.version = "";
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("Application version cannot be empty");
			});

			it("should throw error for empty timezone", () => {
				const config = getValidConfig();
				config.timezone = "";
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("Timezone cannot be empty");
			});
		});

		describe("Port validation", () => {
			it("should throw error for invalid port (non-integer)", () => {
				const config = getValidConfig();
				config.port = 8080.5;
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("must be an integer");
			});

			it("should throw error for port below range", () => {
				const config = getValidConfig();
				config.port = 0;
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("must be between 1 and 65535");
			});

			it("should throw error for port above range", () => {
				const config = getValidConfig();
				config.port = 70000;
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("must be between 1 and 65535");
			});

			it("should accept port 1", () => {
				const config = getValidConfig();
				config.port = 1;
				expect(() => validateConfig(config)).not.toThrow();
			});

			it("should accept port 65535", () => {
				const config = getValidConfig();
				config.port = 65535;
				expect(() => validateConfig(config)).not.toThrow();
			});
		});

		describe("Storage validation", () => {
			it("should accept LOCAL storage without additional config", () => {
				const config = getValidConfig();
				config.storage.type = "LOCAL";
				expect(() => validateConfig(config)).not.toThrow();
			});

			it("should throw error for FTP without host", () => {
				const config = getValidConfig();
				config.storage = {
					type: "FTP",
					host: "",
					username: "user",
					password: "pass",
					port: 21
				} as any;
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("VOLTAGE_STORAGE_HOST is required");
			});

			it("should throw error for FTP without username", () => {
				const config = getValidConfig();
				config.storage = {
					type: "FTP",
					host: "ftp.example.com",
					username: "",
					password: "pass",
					port: 21
				} as any;
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
				expect(() => validateConfig(config)).toThrow("VOLTAGE_STORAGE_USERNAME is required");
			});

			it("should accept valid FTP config", () => {
				const config = getValidConfig();
				config.storage = {
					type: "FTP",
					host: "ftp.example.com",
					username: "user",
					password: "pass",
					port: 21
				} as any;
				expect(() => validateConfig(config)).not.toThrow();
			});
		});

		describe("Database validation", () => {
			it("should accept SQLITE without port validation", () => {
				const config = getValidConfig();
				config.database = {
					type: "SQLITE" as const,
					port: 0,
					file_name: "voltage.db"
				};
				expect(() => validateConfig(config)).not.toThrow();
			});

			it("should throw error for non-SQLITE database with invalid port", () => {
				const config = getValidConfig();
				config.database = {
					type: "POSTGRESQL",
					port: 0
				} as any;
				expect(() => validateConfig(config)).toThrow(ConfigValidationError);
			});

			it("should accept non-SQLITE database with valid port", () => {
				const config = getValidConfig();
				config.database = {
					type: "POSTGRESQL",
					port: 5432,
					host: "localhost",
					name: "voltage",
					username: "user",
					password: "pass"
				} as any;
				expect(() => validateConfig(config)).not.toThrow();
			});
		});
	});
});
