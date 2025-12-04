import { config } from "@voltage/config";
import { database, logger, stats } from "@voltage/utils";
import { getNow, addNow } from "@voltage/utils";
import { createJobNotification } from "@/worker/notifier.js";
import { JobContext, JobStats, JOB_PROGRESS_PER_STEP } from "@/worker/types.js";
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
			instance_key: this.instanceKey,
			worker_key: this.workerKey,
			input: job.input ? JSON.parse(job.input as string) : null,
			outputs: job.outputs ? JSON.parse(job.outputs as string) : null,
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
			retry_at: null
		};

		// Parse output specs
		if (parsedJob.outputs) {
			for (let index = 0; index < parsedJob.outputs.length; index++) {
				if (typeof parsedJob.outputs[index].specs === "object") {
					parsedJob.outputs[index].specs = JSON.stringify(parsedJob.outputs[index].specs);
				}
				parsedJob.outputs[index].specs = parsedJob.outputs[index].specs ? JSON.parse(parsedJob.outputs[index].specs) : null;
			}
		}

		return parsedJob;
	}

	startWorkerStatusMonitoring(): void {
		this.workerStatusInterval = setInterval(
			async () => {
				await this.updateWorkerStatus("BUSY", this.jobKey);
			},
			1000 // 1 second
		);
	}

	stopWorkerStatusMonitoring(): void {
		if (this.workerStatusInterval) {
			clearInterval(this.workerStatusInterval);
			this.workerStatusInterval = null;
		}
	}

	async updateJobStatus(job: JobContext, status: string, progressIncrement: number = 0): Promise<void> {
		job.status = status;
		job.progress += progressIncrement;

		await this.updateJob(job);
		await createJobNotification(job, status);
		await logger.insert("INFO", `Job status updated to ${status}`, { job_key: job.key });
	}

	async updateJob(job: JobContext): Promise<void> {
		if (!job.key) return;

		try {
			await database
				.table("jobs")
				.where("key", job.key)
				.update({
					...job,
					input: job.input ? JSON.stringify(job.input) : null,
					outputs: job.outputs ? JSON.stringify(job.outputs) : null,
					destination: job.destination ? JSON.stringify(job.destination) : null,
					notification: job.notification ? JSON.stringify(job.notification) : null,
					metadata: job.metadata ? JSON.stringify(job.metadata) : null,
					outcome: job.outcome ? JSON.stringify(job.outcome) : null,
					progress: parseFloat((job.progress || 0.0).toFixed(2)),
					updated_at: getNow()
				});
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to update job!", { ...error });
		}
	}

	async updateWorkerStatus(status: string, jobKey: string | null = null): Promise<void> {
		try {
			await database.table("instances_workers").where("key", this.workerKey).update({
				job_key: jobKey,
				status,
				updated_at: getNow()
			});
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to update worker!", { ...error });
		}
	}

	async finalizeJob(job: JobContext, jobStats: JobStats): Promise<void> {
		job.progress = 100.0;
		job.completed_at = getNow();

		// Cleanup temp directory
		await fs.rm(this.tempJobDir, { recursive: true }).catch(() => {});

		// Update job and stats
		await this.updateJob(job);
		this.stopWorkerStatusMonitoring();
		await stats.update(jobStats);

		if (job.status === "COMPLETED") {
			await logger.insert("INFO", "Job successfully completed!");
			await createJobNotification(job, job.status);
			process.exit(0);
		} else {
			await logger.insert("ERROR", "Job failed!", { ...job.outcome });
			await createJobNotification(job, job.status);
			process.exit(1);
		}
	}

	calculateFailureStats(job: JobContext): Partial<JobStats> {
		if (job.try_count + 1 < job.try_max) {
			job.status = "RETRYING";
			job.retry_at = addNow(job.retry_in || 0, "milliseconds");

			return {
				jobs_retried_count: 1
			};
		} else {
			const jobOutputsCompleted = job.outputs?.filter((output: any) => output.status === "COMPLETED");
			const jobOutputsFailed = job.outputs?.filter((output: any) => output.status !== "COMPLETED");

			job.status = "FAILED";

			return {
				jobs_failed_count: 1,
				outputs_completed_count: jobOutputsCompleted?.length || 0,
				outputs_completed_duration:
					jobOutputsCompleted?.reduce((sum: number, output: any) => sum + (output?.duration || 0.0), 0.0) || 0.0,
				outputs_failed_count: jobOutputsFailed?.length || 0,
				outputs_failed_duration: jobOutputsFailed?.reduce((sum: number, output: any) => sum + (output?.duration || 0.0), 0.0) || 0.0
			};
		}
	}

	calculateSuccessStats(job: JobContext): Partial<JobStats> {
		return {
			jobs_completed_count: 1,
			inputs_completed_count: 1,
			inputs_completed_duration: job.input?.duration || 0.0,
			outputs_completed_count: job.outputs?.length || 0,
			outputs_completed_duration: job.outputs?.reduce((sum: number, output: any) => sum + (output?.duration || 0.0), 0.0) || 0.0
		};
	}

	getTempJobDir(): string {
		return this.tempJobDir;
	}
}
