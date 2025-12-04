import { config } from "@voltage/config";
import { logger, getNow } from "@voltage/utils";
import { JobDownloader } from "@/worker/downloader.js";
import { JobAnalyzer } from "@/worker/analyzer.js";
import { JobThumbnailer } from "@/worker/thumbnailer.js";
import { JobProcessor } from "@/worker/processor.js";
import { JobUploader } from "@/worker/uploader.js";
import { NSFWDetector } from "@/worker/nsfw-detector.js";
import { JobContext, JobStats, JOB_PROGRESS_PER_STEP, ProcessingResult } from "@/worker/types.js";
import fs from "fs/promises";
import path from "path";

export class JobStepsService {
	private tempJobDir: string;

	constructor(tempJobDir: string) {
		this.tempJobDir = tempJobDir;
	}

	async downloadInput(job: JobContext, jobStats: JobStats): Promise<void> {
		await logger.insert("INFO", "Downloading job input...");

		const downloader = new JobDownloader(job);
		const jobInput = await downloader.download();

		try {
			await fs.access(jobInput.temp_path);
		} catch (error: Error | any) {
			jobStats.inputs_failed_count = 1;
			throw new Error(`Job input couldn't be downloaded! ${error.message || ""}`.trim());
		}

		await logger.insert("INFO", "Job input successfully downloaded!");
	}

	async analyzeInput(job: JobContext, jobStats: JobStats): Promise<void> {
		await logger.insert("INFO", "Analyzing job input...");

		const analyzer = new JobAnalyzer(job);
		const jobInputMetadata = await analyzer.analyze();

		if (!jobInputMetadata) {
			jobStats.inputs_failed_count = 1;
			throw new Error("Job input couldn't be analyzed!");
		}

		job.input = {
			...job.input,
			...jobInputMetadata,
			nsfw: false,
			classification: false
		};

		await logger.insert("INFO", "Job input successfully analyzed!");
	}

	async generatePreviewAndDetectNSFW(job: JobContext): Promise<void> {
		await logger.insert("INFO", "Generating job input preview...");

		const thumbnailer = new JobThumbnailer(job);
		const jobInputPreview = await thumbnailer.generate(config.jobs.preview);

		try {
			await fs.access(jobInputPreview.temp_path);
			await logger.insert("INFO", "Job input preview successfully generated!");

			// NSFW Detection
			const nsfwDetector = new NSFWDetector(job.input);
			const nsfwResult = await nsfwDetector.analyze(jobInputPreview.temp_path);

			if (nsfwResult) {
				job.input.nsfw = nsfwResult.nsfw;
				job.input.classification = nsfwResult.classification;
			}
		} catch (error: Error | any) {
			throw new Error(`Job input preview couldn't be generated! ${error.message || ""}`.trim());
		}
	}

	async processOutputs(job: JobContext, onProgressUpdate: (job: JobContext) => Promise<void>): Promise<number> {
		await logger.insert("INFO", "Processing job outputs...");

		let outputsProcessedCount = 0;

		for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
			if (["COMPLETED", "FAILED"].includes(job.outputs![index].status)) {
				continue;
			}

			await logger.insert("INFO", "Processing job output...", {
				output_key: job.outputs![index].key,
				output_index: job.outputs![index].index
			});

			job.outputs![index].status = "PROCESSING";
			await onProgressUpdate(job);

			try {
				const processor = new JobProcessor(job);
				job.outputs![index].outcome = await processor.process(job.outputs![index]);
				job.outputs![index].status = "PROCESSED";
				job.outputs![index].updated_at = getNow();
				job.outputs![index].duration = job.outputs![index].outcome?.duration || 0.0;

				await logger.insert("INFO", "Job output successfully processed!", {
					output_key: job.outputs![index].key,
					output_index: job.outputs![index].index
				});

				outputsProcessedCount++;
			} catch (error: Error | any) {
				job.outputs![index].outcome = { message: error.message || "Couldn't be processed!" };
				job.outputs![index].status = "FAILED";
				job.outputs![index].updated_at = getNow();

				await logger.insert("ERROR", "Failed to process job output!", {
					output_key: job.outputs![index].key,
					output_index: job.outputs![index].index,
					...error
				});
			}

			job.progress += parseFloat((JOB_PROGRESS_PER_STEP / (job.outputs?.length || 1)).toFixed(2));
			await onProgressUpdate(job);
		}

		return outputsProcessedCount;
	}

	async uploadOutputs(job: JobContext, onProgressUpdate: (job: JobContext) => Promise<void>): Promise<number> {
		await logger.insert("INFO", "Uploading job outputs...");

		let outputsUploadedCount = 0;

		for (let index = 0; index < (job.outputs?.length ?? 0); index++) {
			// Validate output file exists for PROCESSED outputs
			if (job.outputs![index].status === "PROCESSED") {
				const tempJobOutputFilePath = path.join(
					this.tempJobDir,
					`output.${job.outputs![index].index}.${(job.outputs![index].specs.format || "mp4").toLowerCase()}`
				);

				try {
					await fs.access(tempJobOutputFilePath);
				} catch {
					job.outputs![index].outcome = { message: "Output file is missing!" };
					job.outputs![index].status = "FAILED";
					job.outputs![index].updated_at = getNow();
				}
			}

			if (["COMPLETED", "FAILED"].includes(job.outputs![index].status)) {
				continue;
			}

			await logger.insert("INFO", "Uploading job output...", {
				output_key: job.outputs![index].key,
				output_index: job.outputs![index].index
			});

			job.outputs![index].status = "UPLOADING";
			job.outputs![index].updated_at = getNow();
			await onProgressUpdate(job);

			try {
				const uploader = new JobUploader(job);
				job.outputs![index].outcome = await uploader.upload(job.outputs![index]);
				job.outputs![index].status = "COMPLETED";
				job.outputs![index].updated_at = getNow();
				job.outputs![index].path = job.outputs![index].outcome?.path;
				job.outputs![index].location = job.outputs![index].outcome?.location;
				job.outputs![index].url = job.outputs![index].outcome?.url;

				await logger.insert("INFO", "Job output successfully uploaded!", {
					output_key: job.outputs![index].key,
					output_index: job.outputs![index].index
				});

				outputsUploadedCount++;
			} catch (error: Error | any) {
				job.outputs![index].outcome = { message: error.message || "Couldn't be uploaded!" };
				job.outputs![index].status = "FAILED";
				job.outputs![index].updated_at = getNow();

				await logger.insert("ERROR", "Job output couldn't be uploaded!", {
					output_key: job.outputs![index].key,
					output_index: job.outputs![index].index,
					...error
				});
			}

			job.progress += parseFloat((JOB_PROGRESS_PER_STEP / (job.outputs?.length || 1)).toFixed(2));
			await onProgressUpdate(job);
		}

		return outputsUploadedCount;
	}

	validateOutputs(job: JobContext): void {
		const jobOutputsFailed = job.outputs?.filter((output: any) => output.status !== "COMPLETED");

		if (jobOutputsFailed && jobOutputsFailed.length > 0) {
			throw new Error("Some job outputs failed!");
		}
	}
}
