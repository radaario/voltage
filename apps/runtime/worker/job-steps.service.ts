import { config } from "@voltage/config";
import { logger, getNow } from "@voltage/utils";
import { JobDownloader } from "@/worker/downloader.js";
import { JobAnalyzer } from "@/worker/analyzer.js";
import { JobThumbnailer } from "@/worker/thumbnailer.js";
import { JobOutputProcessor } from "@/worker/processor.js";
import { JobUploader } from "@/worker/uploader.js";
import { NSFWDetector } from "@/worker/nsfw-detector.js";
import { JobStats, JobContext, JobOutputContext, JOB_PROGRESS_PER_STEP } from "@/worker/types.js";
import fs from "fs/promises";
import path from "path";

export class JobStepsService {
	private tempJobDir: string;
	private intervalRef: any = null;

	constructor(tempJobDir: string) {
		this.tempJobDir = tempJobDir;
	}

	private startJobOutputInterval(callback: any) {
		this.intervalRef = setInterval(() => callback?.(), config.jobs.outputs.process_interval || 5000);
	}

	private stopJobOutputInterval() {
		clearInterval(this.intervalRef);
	}

	async downloadInput(job: JobContext, jobStats: JobStats): Promise<void> {
		await logger.insert("INFO", "Downloading job input...");

		const downloader = new JobDownloader(job);
		const jobInput = await downloader.download();

		try {
			await fs.access(jobInput.temp_path);
			jobStats.inputs_downloaded_count = 1;
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
			classification: {}
		};

		jobStats.inputs_analyzed_count = 1;

		await logger.insert("INFO", "Job input successfully analyzed!");
	}

	async generateInputPreview(job: JobContext, jobStats: JobStats): Promise<any> {
		await logger.insert("INFO", "Generating job input preview...");

		const thumbnailer = new JobThumbnailer(job);
		const jobInputPreview = await thumbnailer.generate(config.jobs.preview);

		try {
			await fs.access(jobInputPreview.temp_path);
			jobStats.inputs_preview_generated_count = 1;
			await logger.insert("INFO", "Job input preview successfully generated!");
			return jobInputPreview;
		} catch (error: Error | any) {
			throw new Error(`Job input preview couldn't be generated! ${error.message || ""}`.trim());
		}

		return null;
	}

	async detectInputNSFW(job: JobContext, jobInputPreviewPath: string, jobStats: JobStats): Promise<any> {
		if (!jobInputPreviewPath) return null;

		await logger.insert("INFO", "Detecting job input NSFW...");

		try {
			await fs.access(jobInputPreviewPath);

			// NSFW Detection
			const nsfwDetector = new NSFWDetector(job.input);
			const nsfwResult = await nsfwDetector.analyze(jobInputPreviewPath);

			if (nsfwResult) {
				jobStats.inputs_nsfw_detected_count = 1;
				job.input.nsfw = nsfwResult.nsfw;
				job.input.classification = nsfwResult.classification;
			}

			return nsfwResult;
		} catch (error: Error | any) {
			// throw new Error(`Job input preview couldn't be generated! ${error.message || ""}`.trim());
		}

		return null;
	}

	async processOutputs(
		job: JobContext,
		outputs: JobOutputContext[],
		jobStats: JobStats,
		onProgressUpdate: ({ job, output }: any) => void
	): Promise<number> {
		await logger.insert("INFO", "Processing job outputs...");

		let outputsProcessedCount = 0;

		for (let index = 0; index < outputs.length; index++) {
			if (["COMPLETED", "FAILED"].includes(outputs[index].status)) {
				continue;
			}

			await logger.insert("INFO", "Processing job output...", {
				output_key: outputs[index].key,
				output_index: outputs[index].index
			});

			outputs[index].status = "PROCESSING";
			outputs[index].started_at = getNow();
			outputs[index].completed_at = null;
			outputs[index].updated_at = getNow();

			await onProgressUpdate({ output: outputs[index] });

			try {
				this.startJobOutputInterval(() => onProgressUpdate({ job, output: outputs[index] }));

				const processor = new JobOutputProcessor(job, outputs[index]);
				const processResult = await processor.process();

				outputs[index].outcome = { ...outputs[index].outcome, ...processResult };
				outputs[index].status = "PROCESSED";
				outputs[index].updated_at = getNow();

				jobStats.outputs_processed_count = (jobStats.outputs_processed_count || 0) + 1;

				await logger.insert("INFO", "Job output successfully processed!", {
					output_key: outputs[index].key,
					output_index: outputs[index].index
				});

				outputsProcessedCount++;
			} catch (error: Error | any) {
				outputs[index].outcome = { ...outputs[index].outcome, message: error.message || "Couldn't be processed!" };
				outputs[index].status = "FAILED";
				outputs[index].updated_at = getNow();

				await logger.insert("ERROR", "Failed to process job output!", {
					output_key: outputs[index].key,
					output_index: outputs[index].index,
					...error
				});
			}

			this.stopJobOutputInterval();

			outputs[index].processed_at = getNow();

			job.status = "PROCESSED";
			job.progress += parseFloat((JOB_PROGRESS_PER_STEP / (outputs?.length || 1)).toFixed(2));

			await onProgressUpdate({ job, output: outputs[index] });
		}

		return outputsProcessedCount;
	}

	async uploadOutputs(
		job: JobContext,
		outputs: JobOutputContext[],
		jobStats: JobStats,
		onProgressUpdate: ({ job, output }: any) => void
	): Promise<number> {
		await logger.insert("INFO", "Uploading job outputs...");

		let outputsUploadedCount = 0;

		for (let index = 0; index < outputs.length; index++) {
			// Validate output file exists for PROCESSED outputs
			if (outputs[index].status === "PROCESSED") {
				const tempJobOutputFilePath = path.join(
					this.tempJobDir,
					`output.${outputs[index].index}.${(outputs[index].specs.format || "MP4").toLowerCase()}`
				);

				try {
					await fs.access(tempJobOutputFilePath);
				} catch {
					outputs[index].outcome = { ...outputs[index].outcome, message: "Output file is missing!" };
					outputs[index].status = "FAILED";
					outputs[index].updated_at = getNow();
				}
			}

			if (["COMPLETED", "FAILED"].includes(outputs[index].status)) {
				continue;
			}

			await logger.insert("INFO", "Uploading job output...", {
				output_key: outputs[index].key,
				output_index: outputs[index].index
			});

			outputs[index].status = "UPLOADING";
			outputs[index].updated_at = getNow();
			await onProgressUpdate({ output: outputs[index] });

			try {
				this.startJobOutputInterval(() => onProgressUpdate({ job, output: outputs[index] }));

				const uploader = new JobUploader(job, outputs[index]);
				const uploadResult = await uploader.upload();

				outputs[index].outcome = { ...outputs[index].outcome, ...uploadResult };
				outputs[index].status = "COMPLETED";
				outputs[index].updated_at = getNow();

				jobStats.outputs_uploaded_count = (jobStats.outputs_uploaded_count || 0) + 1;

				await logger.insert("INFO", "Job output successfully uploaded!", {
					output_key: outputs[index].key,
					output_index: outputs[index].index
				});

				outputsUploadedCount++;
			} catch (error: Error | any) {
				outputs[index].outcome = { ...outputs[index].outcome, message: error.message || "Couldn't be uploaded!" };
				outputs[index].status = "FAILED";
				outputs[index].updated_at = getNow();

				await logger.insert("ERROR", "Job output couldn't be uploaded!", {
					output_key: outputs[index].key,
					output_index: outputs[index].index,
					...error
				});
			}

			this.stopJobOutputInterval();

			outputs[index].uploaded_at = getNow();
			outputs[index].completed_at = getNow();

			job.status = "UPLOADED";
			job.progress += parseFloat((JOB_PROGRESS_PER_STEP / (outputs?.length || 1)).toFixed(2));

			await onProgressUpdate({ job, output: outputs[index] });
		}

		return outputsUploadedCount;
	}

	validateOutputs(outputs: JobOutputContext[]): void {
		const jobOutputsFailed = outputs?.filter((output: JobOutputContext) => output.status !== "COMPLETED");

		if (jobOutputsFailed && jobOutputsFailed.length > 0) {
			throw new Error("Some job outputs failed!");
		}
	}
}
