import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock AWS SDK and other dependencies
vi.mock("@aws-sdk/client-s3", () => ({
	S3Client: vi.fn(() => ({})),
	GetObjectCommand: vi.fn(),
	PutObjectCommand: vi.fn(),
	CopyObjectCommand: vi.fn(),
	DeleteObjectCommand: vi.fn(),
	DeleteObjectsCommand: vi.fn(),
	HeadObjectCommand: vi.fn(),
	ListObjectsV2Command: vi.fn()
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: vi.fn().mockResolvedValue("https://signed-url.example.com")
}));

vi.mock("basic-ftp", () => ({
	Client: vi.fn(() => ({
		access: vi.fn().mockResolvedValue(undefined),
		close: vi.fn()
	}))
}));

vi.mock("ssh2-sftp-client", () => ({
	default: vi.fn(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		end: vi.fn()
	}))
}));

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn().mockResolvedValue(Buffer.from("test")),
		writeFile: vi.fn().mockResolvedValue(undefined),
		unlink: vi.fn().mockResolvedValue(undefined),
		mkdir: vi.fn().mockResolvedValue(undefined),
		readdir: vi.fn().mockResolvedValue([]),
		stat: vi.fn().mockResolvedValue({ size: 100, mtime: new Date() })
	}
}));

vi.mock("../logger", () => ({
	logger: {
		console: vi.fn()
	}
}));

describe("Storage Module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should export storage instance", async () => {
		const { storage } = await import("../storage");
		expect(storage).toBeDefined();
	});

	it("should have config method", async () => {
		const { storage } = await import("../storage");
		expect(typeof storage.config).toBe("function");
	});

	it("should configure with LOCAL storage type", async () => {
		const { storage } = await import("../storage");

		await expect(
			storage.config({
				type: "LOCAL",
				base_path: "/tmp/test"
			})
		).resolves.not.toThrow();
	});

	it("should have list method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.list).toBe("function");
	});

	it("should have exists method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.exists).toBe("function");
	});

	it("should have read method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.read).toBe("function");
	});

	it("should have write method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.write).toBe("function");
	});

	it("should have upload method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.upload).toBe("function");
	});

	it("should have download method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.download).toBe("function");
	});

	it("should have delete method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.delete).toBe("function");
	});

	it("should have copy method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.copy).toBe("function");
	});

	it("should have move method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.move).toBe("function");
	});

	it("should have getPublicUrl method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.getPublicUrl).toBe("function");
	});

	it("should have generateSignedUrl method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.generateSignedUrl).toBe("function");
	});

	it("should have getMetadata method", async () => {
		const { storage } = await import("../storage");

		await storage.config({
			type: "LOCAL",
			base_path: "/tmp/test"
		});

		expect(typeof storage.getMetadata).toBe("function");
	});

	it("should export StorageConfigOptions interface", async () => {
		const module = await import("../storage");
		expect(module).toHaveProperty("storage");
	});

	it("should export StorageDriver interface", async () => {
		const module = await import("../storage");
		expect(module).toHaveProperty("storage");
	});
});
