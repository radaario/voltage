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

import * as tf from "@tensorflow/tfjs";
import { createRequire } from "module";

database.config(config.database);

const require = createRequire(import.meta.url);
const Jimp = require("jimp");
const nsfwjs = require("nsfwjs");

async function run() {
	await logger.insert("INFO", "Worker starts running...");

	const tempJobDir = path.join(config.temp_dir, "jobs", jobKey);
	await fs.mkdir(tempJobDir, { recursive: true }).catch(() => {});

	const jobProgressForEachStep = 20.0; // Each step contributes 20% to the total progress

	let job: any = {
		key: jobKey,
		instance_key: instanceKey,
		worker_key: workerKey,
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
		job = await database.table("jobs").where("key", jobKey).first();
		if (!job) throw new Error("Job couldn't be found!");

		// JOB: STARTING
		await logger.insert("INFO", "Job found, starting processing...", { job_key: job.key });

		// JOB: PARSE
		job.instance_key = instanceKey;
		job.worker_key = workerKey;
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
		job.try_count = parseInt(job.try_count as string); // + 1;
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
			await fs.access(jobInput.temp_path);
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

		job.input = { ...job.input, ...jobInputMetadata, nsfw: false, classification: false };

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
			await fs.access(jobInputPreview.temp_path);
			await logger.insert("INFO", "Job input preview successfully generated!");

			const nsfwIsDisabled = job.input.nsfw_is_disabled || config.utils.nsfw.is_disabled;

			if (!nsfwIsDisabled) {
				try {
					const nsfwModelName = job.input.nsfw_model || config.utils.nsfw.model;
					const nsfwSize = job.input.nsfw_size || config.utils.nsfw.size || 299;
					const nsfwType = job.input.nsfw_type || config.utils.nsfw.type || "GRAPH";
					const nsfwThreshold = job.input.nsfw_threshold || config.utils.nsfw.threshold || 0.7;

					// Lazy load model - only loads on the first call
					const models: any = { MOBILE_NET_V2_MID: "MobileNetV2Mid", MOBILE_NET_V2: "MobileNetV2", INCEPTION_V3: "InceptionV3" };

					let model = models["MOBILE_NET_V2_MID"];
					if (nsfwModelName && Object.keys(models).includes(nsfwModelName.toUpperCase())) {
						model = models[nsfwModelName.toUpperCase()];
					}

					const nsfwModel = await nsfwjs.load(model, { size: nsfwSize, type: nsfwType.toLowerCase() }); // , type: "graph", backend: "tensorflow"

					// Image processing
					const image = await Jimp.Jimp.read(jobInputPreview.temp_path);
					const { width, height } = image.bitmap;

					// Convert bitmap data to tensor
					const imageData = new Uint8Array(width * height * 3);
					let offset = 0;

					image.scan(0, 0, width, height, (_x: number, _y: number, idx: number) => {
						imageData[offset++] = image.bitmap.data[idx + 0]; // R
						imageData[offset++] = image.bitmap.data[idx + 1]; // G
						imageData[offset++] = image.bitmap.data[idx + 2]; // B
					});

					const imageTensor = tf.tensor3d(imageData, [height, width, 3]);
					const predictions = await nsfwModel.classify(imageTensor);

					if (predictions) {
						job.input.classification = predictions.reduce(
							(acc: any, item: any) => {
								acc[item.className.toUpperCase()] = item.probability;
								return acc;
							},
							{} as Record<string, number>
						);

						if (job.input.classification.HENTAI >= nsfwThreshold || job.input.classification.PORN >= nsfwThreshold) {
							job.input.nsfw = true;
						}
					}

					imageTensor.dispose();
				} catch (error: Error | any) {}
			}
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
				job.outputs[index].status = "PROCESSED";
				job.outputs[index].updated_at = getNow();
				job.outputs[index].duration = job.outputs[index].outcome?.duration || 0.0;

				await logger.insert("INFO", "Job output successfully processed!", {
					output_key: job.outputs[index].key,
					output_index: job.outputs[index].index
				});

				jobOutputsProcessedCount++;
			} catch (error: Error | any) {
				job.outputs[index].outcome = { message: error.message || "Couldn't be processed!" };
				job.outputs[index].status = "FAILED";
				job.outputs[index].updated_at = getNow();

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
						job.outputs[index].outcome = { message: "Output file is missing!" };
						job.outputs[index].status = "FAILED";
						job.outputs[index].updated_at = getNow();
					}
				}

				if (["COMPLETED", "FAILED"].includes(job.outputs[index].status)) continue;

				await logger.insert("INFO", "Uploading job output...", {
					output_key: job.outputs[index].key,
					output_index: job.outputs[index].index
				});

				job.outputs[index].status = "UPLOADING";
				job.outputs[index].updated_at = getNow();
				await updateJob(job);

				try {
					job.outputs[index].outcome = await uploadOutput(job, job.outputs[index]);
					job.outputs[index].status = "COMPLETED";
					job.outputs[index].updated_at = getNow();
					job.outputs[index].path = job.outputs[index].outcome?.path;
					job.outputs[index].location = job.outputs[index].outcome?.location;
					job.outputs[index].url = job.outputs[index].outcome?.url;

					await logger.insert("INFO", "Job output successfully uploaded!", {
						output_key: job.outputs[index].key,
						output_index: job.outputs[index].index
					});

					jobOutputsUploadedCount++;
				} catch (error: Error | any) {
					job.outputs[index].outcome = { message: error.message || "Couldn't be uploaded!" };
					job.outputs[index].status = "FAILED";
					job.outputs[index].updated_at = getNow();

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
		if (job.try_count + 1 < job.try_max) {
			job.status = "RETRYING";
			// job.try_count += 1;
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

	await fs.rm(tempJobDir, { recursive: true }).catch(() => {});

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
	try {
		await database.table("instances_workers").where("key", workerKey).update({
			job_key: jobKey,
			status,
			updated_at: getNow()
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to update worker!", { error });
	}
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
