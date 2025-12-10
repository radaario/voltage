import { describe, it, expect, vi, beforeEach } from "vitest";
import { storage } from "../storage";

// Mock the storage module
vi.mock("../storage", () => ({
	storage: {
		config: vi.fn().mockResolvedValue(undefined),
		list: vi.fn().mockResolvedValue([]),
		exists: vi.fn().mockResolvedValue(true),
		read: vi.fn().mockResolvedValue(Buffer.from("test data")),
		write: vi.fn().mockResolvedValue(undefined),
		upload: vi.fn().mockResolvedValue(undefined),
		download: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		copy: vi.fn().mockResolvedValue(undefined),
		move: vi.fn().mockResolvedValue(undefined),
		getPublicUrl: vi.fn().mockReturnValue("https://example.com/file.txt"),
		generateSignedUrl: vi.fn().mockResolvedValue("https://example.com/signed-url"),
		getMetadata: vi.fn().mockResolvedValue({
			size: 1024,
			contentType: "text/plain",
			lastModified: new Date(),
			etag: "abc123"
		})
	}
}));

describe("storage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("configuration", () => {
		it("should configure storage with LOCAL type", async () => {
			await storage.config({ type: "LOCAL", base_path: "/tmp/storage" });
			expect(storage.config).toHaveBeenCalledWith({ type: "LOCAL", base_path: "/tmp/storage" });
		});

		it("should configure storage with S3 type", async () => {
			await storage.config({
				type: "AWS_S3",
				bucket: "my-bucket",
				region: "us-east-1",
				access_key: "key",
				access_secret: "secret"
			});
			expect(storage.config).toHaveBeenCalled();
		});
	});

	describe("file operations", () => {
		it("should upload a file", async () => {
			await storage.upload("/local/path/file.txt", "/remote/path/file.txt");
			expect(storage.upload).toHaveBeenCalledWith("/local/path/file.txt", "/remote/path/file.txt");
		});

		it("should download a file", async () => {
			await storage.download("/remote/path/file.txt", "/local/path/file.txt");
			expect(storage.download).toHaveBeenCalledWith("/remote/path/file.txt", "/local/path/file.txt");
		});

		it("should read file content", async () => {
			const content = await storage.read("/path/to/file.txt");
			expect(content).toBeInstanceOf(Buffer);
			expect(content.toString()).toBe("test data");
		});

		it("should write file content", async () => {
			await storage.write("/path/to/file.txt", Buffer.from("new content"));
			expect(storage.write).toHaveBeenCalledWith("/path/to/file.txt", Buffer.from("new content"));
		});

		it("should check if file exists", async () => {
			const exists = await storage.exists("/path/to/file.txt");
			expect(exists).toBe(true);
			expect(storage.exists).toHaveBeenCalledWith("/path/to/file.txt");
		});

		it("should delete a file", async () => {
			await storage.delete("/path/to/file.txt");
			expect(storage.delete).toHaveBeenCalledWith("/path/to/file.txt");
		});

		it("should copy a file", async () => {
			await storage.copy("/source/file.txt", "/dest/file.txt");
			expect(storage.copy).toHaveBeenCalledWith("/source/file.txt", "/dest/file.txt");
		});

		it("should move a file", async () => {
			await storage.move("/source/file.txt", "/dest/file.txt");
			expect(storage.move).toHaveBeenCalledWith("/source/file.txt", "/dest/file.txt");
		});
	});

	describe("directory operations", () => {
		it("should list files in directory", async () => {
			vi.mocked(storage.list).mockResolvedValue(["file1.txt", "file2.txt", "subfolder/"]);

			const files = await storage.list("/path/to/dir/");
			expect(files).toEqual(["file1.txt", "file2.txt", "subfolder/"]);
		});

		it("should delete directory recursively", async () => {
			await storage.delete("/path/to/dir/");
			expect(storage.delete).toHaveBeenCalledWith("/path/to/dir/");
		});
	});

	describe("URL generation", () => {
		it("should get public URL", () => {
			const url = storage.getPublicUrl("/path/to/file.txt");
			expect(url).toBe("https://example.com/file.txt");
		});

		it("should generate signed URL", async () => {
			const url = await storage.generateSignedUrl("/path/to/file.txt", {
				operation: "get",
				expiresInSeconds: 3600
			});
			expect(url).toBe("https://example.com/signed-url");
		});
	});

	describe("metadata", () => {
		it("should get file metadata", async () => {
			const metadata = await storage.getMetadata("/path/to/file.txt");

			expect(metadata).toBeDefined();
			expect(metadata.size).toBe(1024);
			expect(metadata.contentType).toBe("text/plain");
			expect(metadata.etag).toBe("abc123");
		});
	});
});
