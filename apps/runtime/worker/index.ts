import { config } from "@voltage/config";
import { database, logger, stats, getNow } from "@voltage/utils";
import { JobLifecycleService } from "@/worker/job-lifecycle.service.js";
import { JobStepsService } from "@/worker/job-steps.service.js";
import { JobStats, JOB_PROGRESS_PER_STEP } from "@/worker/types.js";

database.config(config.database);

async function run() {
	await logger.insert("INFO", "Worker starts running...");

	const lifecycle = new JobLifecycleService(instanceKey, workerKey, jobKey);
	const steps = new JobStepsService(lifecycle.getTempJobDir());

	const jobStats: JobStats = {
		jobs_completed_count: 0,
		jobs_retried_count: 0,
		jobs_failed_count: 0,
		inputs_downloaded_count: 0,
		inputs_analyzed_count: 0,
		inputs_preview_generated_count: 0,
		inputs_nsfw_detected_count: 0,
		inputs_completed_count: 0,
		inputs_completed_duration: 0,
		inputs_failed_count: 0,
		inputs_failed_duration: 0,
		outputs_processed_count: 0,
		outputs_uploaded_count: 0,
		outputs_completed_count: 0,
		outputs_completed_duration: 0,
		outputs_failed_count: 0,
		outputs_failed_duration: 0
	};

	// Initialize
	await lifecycle.initialize();

	// Load and parse job
	const rawJob = await lifecycle.loadJob();
	const job = lifecycle.parseJob(rawJob);

	const jobOutputs = await lifecycle.getOutputs();

	// Start worker status monitoring
	lifecycle.startWorkerStatusInterval();

	try {
		// Update job status to STARTED
		await lifecycle.updateJob(job, { status: "STARTED", progress: 0, started_at: getNow() });

		// Step 1: Download input
		await lifecycle.updateJob(job, { status: "DOWNLOADING" });
		await steps.downloadInput(job, jobStats);
		await lifecycle.updateJob(job, { status: "DOWNLOADED", downloaded_at: getNow() }, JOB_PROGRESS_PER_STEP);

		// Step 2: Analyze input
		if (!job.input?.analyze_is_disabled) {
			await lifecycle.updateJob(job, { status: "ANALYZING" });
			await steps.analyzeInput(job, jobStats);
		}

		// Step 3: Generate preview and detect NSFW
		if (!job.input?.generate_preview_is_disabled) {
			const jobInputPreview = await steps.generateInputPreview(job, jobStats);

			if (jobInputPreview?.temp_path) {
				await steps.detectInputNSFW(job, jobInputPreview?.temp_path, jobStats);
			}
		}

		await lifecycle.updateJob(job, { status: "ANALYZED", analyzed_at: getNow() }, JOB_PROGRESS_PER_STEP);

		jobStats.inputs_completed_count = 1;
		jobStats.inputs_completed_duration = job.input?.duration || 0.0;

		// Step 4: Process outputs
		await lifecycle.updateJob(job, { status: "PROCESSING" });

		const jobOutputsProcessedCount = await steps.processOutputs(job, jobOutputs, jobStats, async ({ job, output }) => {
			job && (await lifecycle.updateJob(job));
			output && (await lifecycle.updateJobOutput(output));
		});

		if (jobOutputsProcessedCount > 0) {
			// Step 5: Upload outputs
			await lifecycle.updateJob(job, { status: "UPLOADING" });

			const jobOutputsUploadedCount = await steps.uploadOutputs(job, jobOutputs, jobStats, async ({ job, output }) => {
				job && (await lifecycle.updateJob(job));
				output && (await lifecycle.updateJobOutput(output));
			});

			if (jobOutputsUploadedCount > 0) {
				// await lifecycle.updateJob(job, { status: "UPLOADED" });
			}
		}

		// Validate all outputs completed successfully
		steps.validateOutputs(jobOutputs);

		// Mark as complet
		job.status = "COMPLETED";
		job.outcome = { message: "Successfully completed!" };
	} catch (error: Error | any) {
		job.status = "FAILED";
		job.outcome = { message: error.message || "Unknown error occurred!" };
	}

	await lifecycle.finalizeJob(job, jobOutputs, jobStats);

	await lifecycle.updateJob(job, { progress: 100.0, completed_at: getNow() });
	await stats.update(jobStats);

	await lifecycle.exitWorker(job);
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
