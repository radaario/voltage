import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

// Mock dependencies
vi.mock("@voltage/core/config", () => ({
	config: {
		version: "1.0.0",
		env: "test"
	}
}));

vi.mock("@voltage/utils", () => ({
	sanitizeData: vi.fn((data) => data),
	logger: {
		insert: vi.fn().mockResolvedValue(undefined)
	},
	storage: {
		read: vi.fn(),
		getPublicUrl: vi.fn()
	}
}));

vi.mock("../../utils/response.util", () => ({
	sendSuccess: vi.fn((res, data) => {
		res.json({ success: true, data });
	}),
	sendError: vi.fn((res, status, code, message) => {
		res.status(status).json({ error: { code, message } });
	}),
	sendPaginatedSuccess: vi.fn((res, data, pagination) => {
		res.json({ success: true, data, pagination });
	})
}));

vi.mock("../../utils/pagination.util", () => ({
	getPaginationParams: vi.fn(() => ({
		limit: 10,
		page: 1,
		offset: 0
	}))
}));

vi.mock("../../services/jobs.service", () => ({
	getJob: vi.fn().mockResolvedValue({
		key: "test-job",
		status: "COMPLETED",
		progress: 100
	}),
	getJobs: vi.fn().mockResolvedValue({
		data: [
			{ key: "job1", status: "COMPLETED" },
			{ key: "job2", status: "PENDING" }
		],
		total: 2
	}),
	createJob: vi.fn().mockResolvedValue({
		key: "new-job",
		status: "PENDING"
	}),
	retryJob: vi.fn().mockResolvedValue(undefined),
	deleteJobs: vi.fn().mockResolvedValue(undefined)
}));

describe("Jobs Controller", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;

	beforeEach(() => {
		mockReq = {
			query: {},
			body: {},
			params: {}
		};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
			send: vi.fn(),
			setHeader: vi.fn()
		};
		vi.clearAllMocks();
	});

	describe("getJob", () => {
		it("should return job by key", async () => {
			const { getJob } = await import("../jobs.controller");
			const { sendSuccess } = await import("../../utils/response.util");

			mockReq.query = { job_key: "test-job" };

			await getJob(mockReq as Request, mockRes as Response);

			expect(sendSuccess).toHaveBeenCalledWith(mockRes, expect.objectContaining({ key: "test-job" }));
		});

		it("should return 404 for non-existent job", async () => {
			const { getJob } = await import("../jobs.controller");
			const { sendError } = await import("../../utils/response.util");
			const jobsService = await import("../../services/jobs.service");

			(jobsService.getJob as any).mockRejectedValueOnce(new Error("NOT_FOUND"));

			mockReq.query = { job_key: "nonexistent" };

			await getJob(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 404, "NOT_FOUND", expect.any(String));
		});

		it("should handle internal errors", async () => {
			const { getJob } = await import("../jobs.controller");
			const { sendError } = await import("../../utils/response.util");
			const jobsService = await import("../../services/jobs.service");

			(jobsService.getJob as any).mockRejectedValueOnce(new Error("Database error"));

			mockReq.query = { job_key: "test-job" };

			await getJob(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", expect.any(String));
		});
	});

	describe("getJobs", () => {
		it("should return paginated jobs list", async () => {
			const { getJobs } = await import("../jobs.controller");
			const { sendPaginatedSuccess } = await import("../../utils/response.util");

			await getJobs(mockReq as Request, mockRes as Response);

			expect(sendPaginatedSuccess).toHaveBeenCalledWith(
				mockRes,
				expect.any(Array),
				expect.objectContaining({
					limit: expect.any(Number),
					page: expect.any(Number),
					total: expect.any(Number)
				})
			);
		});

		it("should apply filters", async () => {
			const { getJobs } = await import("../jobs.controller");
			const jobsService = await import("../../services/jobs.service");

			mockReq.query = {
				status: "COMPLETED",
				instance_key: "test-instance"
			};

			await getJobs(mockReq as Request, mockRes as Response);

			expect(jobsService.getJobs).toHaveBeenCalled();
		});

		it("should handle search query", async () => {
			const { getJobs } = await import("../jobs.controller");

			mockReq.query = { q: "search term" };

			await getJobs(mockReq as Request, mockRes as Response);

			expect(mockRes.json).toHaveBeenCalled();
		});
	});

	describe("createJob", () => {
		it("should create new job", async () => {
			const { createJob } = await import("../jobs.controller");

			mockReq.body = {
				input: { type: "HTTP", url: "test.mp4" },
				outputs: [{ type: "VIDEO", format: "MP4" }]
			};

			await createJob(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(202);
			expect(mockRes.json).toHaveBeenCalled();
		});

		it("should validate required fields", async () => {
			const { createJob } = await import("../jobs.controller");
			const { sendError } = await import("../../utils/response.util");
			const jobsService = await import("../../services/jobs.service");

			(jobsService.createJob as any).mockRejectedValueOnce(new Error("REQUEST_INVALID"));

			mockReq.body = {};

			await createJob(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 400, "REQUEST_INVALID", expect.any(String));
		});

		it("should require at least one output", async () => {
			const { createJob } = await import("../jobs.controller");
			const { sendError } = await import("../../utils/response.util");
			const jobsService = await import("../../services/jobs.service");

			(jobsService.createJob as any).mockRejectedValueOnce(new Error("OUTPUT_REQUIRED"));

			mockReq.body = {
				input: { type: "HTTP", url: "test.mp4" },
				outputs: []
			};

			await createJob(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 400, "REQUEST_INVALID", expect.stringContaining("output"));
		});
	});

	describe("retryJob", () => {
		it("should retry job", async () => {
			const { retryJob } = await import("../jobs.controller");
			const { sendSuccess } = await import("../../utils/response.util");

			mockReq.query = { job_key: "test-job" };

			await retryJob(mockReq as Request, mockRes as Response);

			expect(sendSuccess).toHaveBeenCalled();
		});

		it("should require job key", async () => {
			const { retryJob } = await import("../jobs.controller");
			const { sendError } = await import("../../utils/response.util");
			const jobsService = await import("../../services/jobs.service");

			(jobsService.retryJob as any).mockRejectedValueOnce(new Error("KEY_REQUIRED"));

			await retryJob(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 400, "KEY_REQUIRED", expect.any(String));
		});

		it("should check if job can be retried", async () => {
			const { retryJob } = await import("../jobs.controller");
			const { sendError } = await import("../../utils/response.util");
			const jobsService = await import("../../services/jobs.service");

			(jobsService.retryJob as any).mockRejectedValueOnce(new Error("NOT_ALLOWED"));

			mockReq.query = { job_key: "completed-job" };

			await retryJob(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 405, "NOT_ALLOWED", expect.any(String));
		});
	});
});
