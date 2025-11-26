import { config } from "@voltage/config";

import { database, logger, stats } from "@voltage/utils";
import { getNow, addNow } from "@voltage/utils";

import { downloadInput } from "./downloader";
import { analyzeInputMetadata } from "./analyzer";
import { generateInputPreview } from "./thumbnailer";
import { processOutput } from "./processor";
import { uploadOutput } from "./uploader";
import { createJobNotification } from "./notifier";

import path from "path";
import fs from "fs/promises";

// import * as tf from '@tensorflow/tfjs-node';

database.config(config.database);

async function run() {
	await logger.insert("INFO", "Worker starts running...");

	const tempJobDir = path.join(config.temp_dir, "jobs", job_key);
	await fs.mkdir(tempJobDir, { recursive: true }).catch(() => {});

	const jobProgressForEachStep = 20.0; // Each step contributes 20% to the total progress

	let job: any = {
		key: job_key,
		instance_key,
		worker_key,
		status: "STARTED",
		progress: 0.0,
		try_max: 1,
		try_count: 0
	};

	let jobStats = {
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

	try {
		await updateWorkerStatus("BUSY");

		// JOB: SELECT
		job = await database.table("jobs").where("key", job_key).first();
		if (!job) throw new Error("Job couldn't be found!");

		// JOB: STARTING
		await logger.insert("INFO", "Job found, starting processing...", { job_key: job.key });

		// JOB: PARSE
		job.instance_key = instance_key;
		job.worker_key = worker_key;
		job.input = job.input ? JSON.parse(job.input as string) : null;
		job.outputs = job.outputs ? JSON.parse(job.outputs as string) : null;
		job.destination = job.destination ? JSON.parse(job.destination as string) : null;
		job.notification = job.notification ? JSON.parse(job.notification as string) : null;
		job.metadata = job.metadata ? JSON.parse(job.metadata as string) : null;
		job.outcome = job.outcome ? JSON.parse(job.outcome as string) : null;
		job.status = "STARTED";
		job.progress = 0.0;
		job.started_at = getNow();
		job.completed_at = null;
		job.try_count = parseInt(job.try_count as string) + 1;
		job.retry_at = null;

		await updateJob(job);
		await createJobNotification(job, job.status);

		// JOB: OUTPUTs: PARSE
		for (let index = 0; index < job.outputs.length; index++) {
			if (typeof job.outputs[index].specs === "object") job.outputs[index].specs = JSON.stringify(job.outputs[index].specs);
			job.outputs[index].specs = job.outputs[index].specs ? JSON.parse(job.outputs[index].specs) : null;
		}

		let jobOutputsProcessedCount = 0;
		let jobOutputsUploadedCount = 0;

		// JOB: INPUT: DOWNLOADING
		await logger.insert("INFO", "Downloading job input...");

		job.status = "DOWNLOADING";

		await updateJob(job);
		await createJobNotification(job, job.status);
		// await updateWorkerStatus("BUSY");

		const jobInput = await downloadInput(job);

		try {
			await fs.access(jobInput.path);
		} catch (error: Error | any) {
			// JOB: STATs: UPDATE
			jobStats.inputs_failed_count = 1;

			throw new Error(`Job input couldn't be downloaded! ${error.message || ""}`.trim());
		}

		// JOB: INPUT: DOWNLOADED
		await logger.insert("INFO", "Job input successfully downloaded!");

		job.status = "DOWNLOADED";
		job.progress += jobProgressForEachStep;

		await updateJob(job);
		await createJobNotification(job, job.status);

		// JOB: INPUT: ANALYZING
		await logger.insert("INFO", "Analyzing job input...");

		job.status = "ANALYZING";

		await updateJob(job);
		await createJobNotification(job, job.status);
		// await updateWorkerStatus("BUSY");

		const jobInputMetadata = await analyzeInputMetadata(job);
		if (!jobInputMetadata) {
			// JOB: STATs: UPDATE
			jobStats.inputs_failed_count = 1;

			throw new Error("Job input couldn't be analyzed!");
		}

		job.input = { ...job.input, ...jobInputMetadata };

		// JOB: INPUT: ANALYZED
		await logger.insert("INFO", "Job input successfully analyzed!");

		job.status = "ANALYZED";
		job.progress += jobProgressForEachStep;

		await updateJob(job);
		await createJobNotification(job, job.status);

		// JOB: INPUT: PREVIEW GENERATING
		await logger.insert("INFO", "Generating job input preview...");

		const jobInputPreview = await generateInputPreview(job, config.jobs.preview);

		try {
			await fs.access(jobInputPreview.path);
			await logger.insert("INFO", "Job input preview successfully generated!");

			/* ! */
			/*
			async function fn() {
				const nsfwjs = await import('nsfwjs');
				const model = await nsfwjs.load();
				const img = await fs.readFile(jobInputPreview);
				const image = await tf.node.decodeImage(img, 3) as tf.Tensor3D;
				const predictions = await model.classify(image);
				image.dispose(); // Tensor memory must be managed explicitly (it is not sufficient to let a tf.Tensor go out of scope for its memory to be released).
				console.log("predictions", predictions);
			}

			fn();
			*/
		} catch (error: Error | any) {
			throw new Error(`Job input preview couldn't be generated! ${error.message || ""}`.trim());
		}

		// JOB: PROCESSING
		await logger.insert("INFO", "Processing job outputs...");

		job.status = "PROCESSING";

		await updateJob(job);
		await createJobNotification(job, job.status);
		// await updateWorkerStatus("BUSY");

		// JOB: OUTPUTs: PROCESSING
		for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
			if (["COMPLETED", "FAILED"].includes(job.outputs[index].status)) continue;

			await logger.insert("INFO", "Processing job output...", {
				output_key: job.outputs[index].key,
				output_index: job.outputs[index].index
			});

			job.outputs[index].status = "PROCESSING";
			await updateJob(job);

			try {
				job.outputs[index].outcome = await processOutput(job, job.outputs[index]);
				job.outputs[index].duration = job.outputs[index].outcome?.duration || 0.0;
				job.outputs[index].status = "PROCESSED";

				await logger.insert("INFO", "Job output successfully processed!", {
					output_key: job.outputs[index].key,
					output_index: job.outputs[index].index
				});

				jobOutputsProcessedCount++;
			} catch (error: Error | any) {
				job.outputs[index].status = "FAILED";
				job.outputs[index].outcome = { message: error.message || "Couldn't be processed!" };

				await logger.insert("ERROR", "Failed to process job output!", {
					output_key: job.outputs[index].key,
					output_index: job.outputs[index].index,
					error: error.message
				});
			}

			job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

			await updateJob(job);
			// await updateWorkerStatus("BUSY");
		}

		if (jobOutputsProcessedCount > 0) {
			// JOB: PROCESSED
			await logger.insert("INFO", "Job outputs successfully processed!");

			job.status = "PROCESSED";

			await updateJob(job);
			await createJobNotification(job, job.status);

			// JOB: OUTPUTs: UPLOADING
			await logger.insert("INFO", "Uploading job outputs...");

			job.status = "UPLOADING";

			await updateJob(job);
			await createJobNotification(job, job.status);
			// await updateWorkerStatus("BUSY");

			for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
				if (job.outputs[index].status == "PROCESSED") {
					const tempJobOutputFilePath = path.join(
						tempJobDir,
						`output.${job.outputs[index].index}.${(job.outputs[index].specs.format || "mp4").toLowerCase()}`
					);

					try {
						await fs.access(tempJobOutputFilePath);
					} catch {
						job.outputs[index].status = "FAILED";
						job.outputs[index].outcome = { message: "Output file is missing!" };
					}
				}

				if (["COMPLETED", "FAILED"].includes(job.outputs[index].status)) continue;

				await logger.insert("INFO", "Uploading job output...", {
					output_key: job.outputs[index].key,
					output_index: job.outputs[index].index
				});

				job.outputs[index].status = "UPLOADING";
				await updateJob(job);

				try {
					job.outputs[index].outcome = await uploadOutput(job, job.outputs[index]);
					job.outputs[index].path = job.outputs[index].outcome?.path;
					job.outputs[index].location = job.outputs[index].outcome?.location;
					job.outputs[index].url = job.outputs[index].outcome?.url;
					job.outputs[index].status = "COMPLETED";

					await logger.insert("INFO", "Job output successfully uploaded!", {
						output_key: job.outputs[index].key,
						output_index: job.outputs[index].index
					});

					jobOutputsUploadedCount++;
				} catch (error: Error | any) {
					job.outputs[index].status = "FAILED";
					job.outputs[index].outcome = { message: error.message || "Couldn't be uploaded!" };

					await logger.insert("ERROR", "Job output couldn't be uploaded!", {
						output_key: job.outputs[index].key,
						output_index: job.outputs[index].index,
						error: error.message
					});
				}

				job.progress += parseFloat((jobProgressForEachStep / job.outputs.length).toFixed(2));

				await updateJob(job);
				// await updateWorkerStatus("BUSY");
			}

			if (jobOutputsUploadedCount > 0) {
				// JOB: UPLOADED
				await logger.insert("INFO", "Job outputs successfully uploaded!");

				job.status = "UPLOADED";

				await updateJob(job);
				await createJobNotification(job, job.status);
			}
		}

		// JOB: OUTPUTs: CHECK FAILED
		const jobOutputsFailed = job.outputs?.filter((output: any) => output.status !== "COMPLETED");
		if (jobOutputsFailed.length > 0) throw new Error("Some job outputs failed!");

		job.status = "COMPLETED";
		job.outcome = { message: "Successfully completed!" };

		// JOB: STATs: UPDATE
		jobStats.jobs_completed_count = 1;
		jobStats.inputs_completed_count = 1;
		jobStats.inputs_completed_duration = job.input?.duration || 0.0;
		jobStats.outputs_completed_count = job.outputs?.length || 0;
		jobStats.outputs_completed_duration =
			job.outputs?.reduce((sum: number, output: any) => sum + (output?.duration || 0.0), 0.0) || 0.0;
	} catch (error: Error | any) {
		if (job.try_count < job.try_max) {
			job.status = "RETRYING";
			job.retry_at = addNow(job.retry_in || 0, "milliseconds");

			// JOB: STATs: UPDATE
			jobStats.jobs_retried_count = 1;
		} else {
			const jobOutputsCompleted = job.outputs?.filter((output: any) => output.status === "COMPLETED");
			const jobOutputsFailed = job.outputs?.filter((output: any) => output.status !== "COMPLETED");

			job.status = "FAILED";
			job.outcome = { message: error.message || "Unknown error occurred!" };

			// JOB: STATs: UPDATE
			jobStats.jobs_failed_count = 1;
			jobStats.outputs_completed_count = jobOutputsCompleted?.length || 0;
			jobStats.outputs_completed_duration =
				jobOutputsCompleted?.reduce((sum: number, output: any) => sum + (output?.duration || 0.0), 0.0) || 0.0;
			jobStats.outputs_failed_count = jobOutputsFailed?.length || 0;
			jobStats.outputs_failed_duration =
				jobOutputsFailed?.reduce((sum: number, output: any) => sum + (output?.duration || 0.0), 0.0) || 0.0;
		}
	}

	job.progress = 100.0;
	job.completed_at = getNow();

	// await fs.rm(tempJobDir, { recursive: true }).catch(() => {});

	await updateJob(job);
	// await updateWorkerStatus('IDLE');
	await stats.update(jobStats);

	if (job.status === "COMPLETED") {
		await logger.insert("INFO", "Job successfully completed!");
		await createJobNotification(job, job.status);
		process.exit(0);
	} else {
		await logger.insert("ERROR", "Job failed!", { error: job.outcome });
		await createJobNotification(job, job.status);
		process.exit(1);
	}
}

async function updateJob(job: any): Promise<void> {
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
				progress: parseFloat(job.progress || 0.0).toFixed(2),
				updated_at: getNow()
			});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to update job!", { error });
	}
}

async function updateWorkerStatus(status: string): Promise<void> {
	if (!worker_key) return;

	try {
		await database.table("instances_workers").where("key", worker_key).update({
			job_key,
			status,
			updated_at: getNow()
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to update worker!", { error });
	}
}

// Get job key and instance key from command line arguments
const instance_key = process.argv[2];
const worker_key = process.argv[3];
const job_key = process.argv[4];

(async () => {
	if (!instance_key) {
		await logger.insert("ERROR", "Instance key required!");
		process.exit(1);
	}

	logger.setMetadata({ instance_key });

	if (!worker_key) {
		await logger.insert("ERROR", "Worker key required!");
		process.exit(1);
	}

	logger.setMetadata({ instance_key, worker_key });

	if (!job_key) {
		await logger.insert("ERROR", "Job key required!");
		process.exit(1);
	}

	logger.setMetadata({ instance_key, worker_key, job_key });

	await run();
})();
