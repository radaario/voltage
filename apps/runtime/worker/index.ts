import { config } from "@voltage/config";
import { database, logger } from "@voltage/utils";
import { JobLifecycleService } from "./job-lifecycle.service.js";
import { JobStepsService } from "./job-steps.service.js";
import { JobStats, JOB_PROGRESS_PER_STEP } from "./types.js";

database.config(config.database);

async function run() {
	await logger.insert("INFO", "Worker starts running...");

	const lifecycle = new JobLifecycleService(instanceKey, workerKey, jobKey);
	const steps = new JobStepsService(lifecycle.getTempJobDir());

	const jobStats: JobStats = {
		jobs_completed_count: 0,
		jobs_retried_count: 0,
		jobs_failed_count: 0,
		inputs_completed_count: 0,
		inputs_completed_duration: 0,
		inputs_failed_count: 0,
		inputs_failed_duration: 0,
		outputs_completed_count: 0,
		outputs_completed_duration: 0,
		outputs_failed_count: 0,
		outputs_failed_duration: 0
	};

	// Initialize
	await lifecycle.initialize();

	// Load and parse job
	const rawJob = await lifecycle.loadJob();
	let job = lifecycle.parseJob(rawJob);

	// Start worker status monitoring
	lifecycle.startWorkerStatusMonitoring();

	try {
		// Update job status to STARTED
		await lifecycle.updateJobStatus(job, "STARTED", 0);

		// Step 1: Download input
		await lifecycle.updateJobStatus(job, "DOWNLOADING", 0);
		await steps.downloadInput(job, jobStats);
		await lifecycle.updateJobStatus(job, "DOWNLOADED", JOB_PROGRESS_PER_STEP);

		// Step 2: Analyze input
		await lifecycle.updateJobStatus(job, "ANALYZING", 0);
		await steps.analyzeInput(job, jobStats);
		await lifecycle.updateJobStatus(job, "ANALYZED", JOB_PROGRESS_PER_STEP);

		// Step 3: Generate preview and detect NSFW
		await steps.generatePreviewAndDetectNSFW(job);
		await lifecycle.updateJob(job);

		// Step 4: Process outputs
		await lifecycle.updateJobStatus(job, "PROCESSING", 0);
		const outputsProcessedCount = await steps.processOutputs(job, (j) => lifecycle.updateJob(j));

		if (outputsProcessedCount > 0) {
			await lifecycle.updateJobStatus(job, "PROCESSED", 0);

			// Step 5: Upload outputs
			await lifecycle.updateJobStatus(job, "UPLOADING", 0);
			const outputsUploadedCount = await steps.uploadOutputs(job, (j) => lifecycle.updateJob(j));

			if (outputsUploadedCount > 0) {
				await lifecycle.updateJobStatus(job, "UPLOADED", 0);
			}
		}

		// Validate all outputs completed successfully
		steps.validateOutputs(job);

		// Mark as completed
		job.status = "COMPLETED";
		job.outcome = { message: "Successfully completed!" };

		// Calculate success stats
		Object.assign(jobStats, lifecycle.calculateSuccessStats(job));
	} catch (error: Error | any) {
		// Calculate failure stats
		const failureStats = lifecycle.calculateFailureStats(job);
		Object.assign(jobStats, failureStats);

		job.outcome = { message: error.message || "Unknown error occurred!" };
	}

	// Finalize job (cleanup, update stats, exit)
	await lifecycle.finalizeJob(job, jobStats);
}

// Get job key and instance key from command line arguments
const instanceKey = process.argv[2];
const workerKey = process.argv[3];
const jobKey = process.argv[4];

(async () => {
	if (!instanceKey) {
		await logger.insert("ERROR", "Instance key required!");
		process.exit(1);
	}

	logger.setMetadata({ instance_key: instanceKey });

	if (!workerKey) {
		await logger.insert("ERROR", "Worker key required!");
		process.exit(1);
	}

	logger.setMetadata({ instance_key: instanceKey, worker_key: workerKey });

	if (!jobKey) {
		await logger.insert("ERROR", "Job key required!");
		process.exit(1);
	}

	logger.setMetadata({ instance_key: instanceKey, worker_key: workerKey, job_key: jobKey });

	await run();
})();
