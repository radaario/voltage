import { config } from "@voltage/config";
import { database, logger } from "@voltage/utils";
import { getNow, addNow } from "@voltage/utils";
import { createJobNotification } from "@/worker/notifier.js";
import { JobStats, JobContext, JobOutputContext } from "@/worker/types.js";
import fs from "fs/promises";
import path from "path";

export class JobLifecycleService {
	private instanceKey: string;
	private workerKey: string;
	private jobKey: string;
	private tempJobDir: string;
	private workerStatusInterval: NodeJS.Timeout | null = null;

	constructor(instanceKey: string, workerKey: string, jobKey: string) {
		this.instanceKey = instanceKey;
		this.workerKey = workerKey;
		this.jobKey = jobKey;
		this.tempJobDir = path.join(config.temp_dir, "jobs", jobKey);
	}

	async initialize(): Promise<void> {
		await fs.mkdir(this.tempJobDir, { recursive: true }).catch(() => {});
	}

	async loadJob(): Promise<JobContext> {
		const job = await database.table("jobs").where("key", this.jobKey).first();

		if (!job) {
			throw new Error("Job couldn't be found!");
		}

		await logger.insert("INFO", "Job found, starting processing...", { job_key: job.key });

		return job;
	}

	parseJob(job: any): JobContext {
		const parsedJob: JobContext = {
			...job,
			input: job.input ? JSON.parse(job.input as string) : null,
			destination: job.destination ? JSON.parse(job.destination as string) : null,
			notification: job.notification ? JSON.parse(job.notification as string) : null,
			metadata: job.metadata ? JSON.parse(job.metadata as string) : null,
			outcome: job.outcome ? JSON.parse(job.outcome as string) : null,
			status: "STARTED",
			progress: 0.0,
			started_at: getNow(),
			analyzed_at: null,
			completed_at: null,
			try_count: parseInt(job.try_count as string),
			retry_at: null,
			instance_key: this.instanceKey,
			worker_key: this.workerKey
		};

		return parsedJob;
	}

	async getOutputs(): Promise<JobOutputContext[]> {
		const outputs = await database.table("jobs_outputs").where("job_key", this.jobKey).orderBy("index", "asc");

		if (!outputs) {
			throw new Error("Job outputs couldn't be found!");
		}

		await logger.insert("INFO", "Job outputs found, starting processing...", { job_key: this.jobKey });

		return outputs.map((output: any) => ({
			...output,
			specs: output.specs ? JSON.parse(output.specs as string) : null,
			outcome: output.outcome ? JSON.parse(output.outcome as string) : null
		}));
	}

	startWorkerStatusInterval(): void {
		this.workerStatusInterval = setInterval(
			async () => {
				await this.updateWorker({ status: "BUSY", job_key: this.jobKey });
			},
			1000 // 1 second
		);
	}

	stopWorkerStatusInterval(): void {
		if (this.workerStatusInterval) {
			clearInterval(this.workerStatusInterval);
			this.workerStatusInterval = null;
		}
	}

	async updateJob(job: JobContext, params: any = {}, progressIncrement: number | null = null): Promise<void> {
		if (!job.key) return;

		if (params) {
			for (const [key, value] of Object.entries(params)) {
				(job as any)[key] = value;
			}
		}

		if (progressIncrement !== null) {
			job.progress += progressIncrement;
		}

		try {
			await database
				.table("jobs")
				.where("key", job.key)
				.update({
					...job,
					input: job.input ? JSON.stringify(job.input) : null,
					destination: job.destination ? JSON.stringify(job.destination) : null,
					notification: job.notification ? JSON.stringify(job.notification) : null,
					metadata: job.metadata ? JSON.stringify(job.metadata) : null,
					outcome: job.outcome ? JSON.stringify(job.outcome) : null,
					progress: parseFloat((job.progress || 0.0).toFixed(2)),
					updated_at: getNow()
				});

			if (params.status) {
				await createJobNotification(job, job.status);
				await logger.insert("INFO", `Job status updated to ${job.status}`, { job_key: job.key });
			}
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to update job!", { ...error });
		}
	}

	async updateJobOutput(output: JobOutputContext, params: any = {}): Promise<void> {
		if (!output.key) return;

		if (params) {
			for (const [key, value] of Object.entries(params)) {
				(output as any)[key] = value;
			}
		}

		try {
			await database
				.table("jobs_outputs")
				.where("key", output.key)
				.update({
					...output,
					specs: output.specs ? JSON.stringify(output.specs) : null,
					outcome: output.outcome ? JSON.stringify(output.outcome) : null,
					updated_at: getNow()
				});
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to update job output!", { ...error });
		}
	}

	async updateWorker(params: any = {}): Promise<void> {
		if (!this.workerKey) return;
		if (!params) return;

		try {
			await database
				.table("instances_workers")
				.where("key", this.workerKey)
				.update({ ...params, updated_at: getNow() });
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to update worker!", { ...error });
		}
	}

	async finalizeJob(job: JobContext, outputs: JobOutputContext[], jobStats: JobStats): Promise<void> {
		this.stopWorkerStatusInterval();

		// Cleanup temp directory
		await fs.rm(this.tempJobDir, { recursive: true }).catch(() => {});

		const jobOutputsCompleted = outputs?.filter((output: any) => output.status === "COMPLETED");
		const jobOutputsFailed = outputs?.filter((output: any) => output.status !== "COMPLETED");

		if (job.status === "FAILED" || jobOutputsFailed.length > 0) {
			if (job.try_count + 1 < job.try_max) {
				job.status = "RETRYING";
				job.retry_at = addNow(job.retry_in || 0, "milliseconds");
				jobStats.jobs_retried_count = 1;
			} else {
				job.status = "FAILED";

				jobStats.jobs_failed_count = 1;
				jobStats.outputs_completed_count = jobOutputsCompleted?.length || 0;
				jobStats.outputs_completed_duration =
					jobOutputsCompleted?.reduce((sum: number, output: any) => sum + (output?.outcome?.duration || 0.0), 0.0) || 0.0;
				jobStats.outputs_failed_count = jobOutputsFailed?.length || 0;
				jobStats.outputs_failed_duration =
					jobOutputsFailed?.reduce((sum: number, output: any) => sum + (output?.outcome?.duration || 0.0), 0.0) || 0.0;
			}

			await logger.insert("ERROR", "Job failed!", { ...job.outcome });
			await createJobNotification(job, job.status);
		} else {
			job.status = "COMPLETED";

			jobStats.jobs_completed_count = 1;
			jobStats.outputs_completed_count = outputs?.length || 0;
			jobStats.outputs_completed_duration =
				outputs?.reduce((sum: number, output: any) => sum + (output?.outcome?.duration || 0.0), 0.0) || 0.0;

			await logger.insert("INFO", "Job successfully completed!");
			await createJobNotification(job, job.status);
		}
	}

	exitWorker(job: JobContext): Promise<void> {
		if (job.status === "COMPLETED") {
			process.exit(0);
		} else {
			process.exit(1);
		}
	}

	getTempJobDir(): string {
		return this.tempJobDir;
	}
}
