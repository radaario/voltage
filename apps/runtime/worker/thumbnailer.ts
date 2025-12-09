import { config } from "@voltage/config";
import { storage } from "@voltage/utils";
import { spawn } from "child_process";
import path from "path";

interface ThumbnailerOptions {
	format?: string;
	offset?: number;
	quality?: number | string;
}

export class JobThumbnailer {
	private job: any;
	private tempJobDir: string;
	private tempJobInputFilePath: string;

	constructor(job: any) {
		this.job = job;
		this.tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		this.tempJobInputFilePath = path.join(this.tempJobDir, "input");
	}

	async generate(options: ThumbnailerOptions = {}): Promise<any> {
		try {
			// logger.setMetadata({ instance_key: this.job.instance_key, worker_key: this.job.worker_key, job_key: this.job.key });

			if (!this.job.input?.video) {
				return { message: "There is no video in the input file!" };
			}

			let tempJobInputPreviewFileFormat = "PNG";
			if (["PNG", "JPG", "JPEG", "WEBP", "TIFF", "BMP"].includes((options.format || "PNG").toUpperCase())) {
				tempJobInputPreviewFileFormat = (options.format || "PNG").toUpperCase();
			}

			const tempJobInputPreviewFilePath = path.join(this.tempJobDir, `preview.${tempJobInputPreviewFileFormat.toLowerCase()}`);

			// logger.console("INFO", "Generating preview from job input...");

			// Calculate the middle timestamp of the video
			let offset = this.job.input?.duration ? this.job.input.duration / 2 : 0;
			if (options.offset !== undefined) offset = options.offset;
			if (this.job.input?.duration && offset > this.job.input.duration) offset = this.job.input.duration;

			// Use ffmpeg to extract a frame at the middle timestamp and convert it to the desired format
			const ffmpegArgs = [
				"-y", // overwrite output file if exists
				"-ss",
				offset.toString(),
				"-i",
				this.tempJobInputFilePath,
				"-vframes",
				"1",
				// '-vf', 'scale=640:-1', // width 640, height auto to maintain aspect ratio
				"-quality",
				(options.quality || 75).toString(), // quality
				tempJobInputPreviewFilePath
			];

			await new Promise<void>((resolve, reject) => {
				let stderrData = "";

				const proc = spawn(config.utils.ffmpeg.path, ffmpegArgs, { stdio: ["ignore", "pipe", "pipe"] }); // inherit || ignore

				proc.stderr.on("data", (chunk) => {
					stderrData += chunk.toString();
				});

				proc.on("error", reject);

				proc.on("exit", (code) => {
					if (code === 0) resolve();
					else
						reject(
							new Error(
								`FFmpeg preview generation exited with code ${code}! ffmpeg_command: ffmpeg ${ffmpegArgs.join(" ")}; ffmpeg_stderr: ${stderrData}`
							)
						);
				});
			});

			try {
				storage.config(config.storage);
				await storage.upload(
					tempJobInputPreviewFilePath,
					`/jobs/${this.job.key}/preview.${tempJobInputPreviewFileFormat.toLowerCase()}`
				);
			} catch (error: Error | any) {}

			// logger.console("INFO", "Preview generated from job input!");
			return {
				temp_path: tempJobInputPreviewFilePath,
				format: tempJobInputPreviewFileFormat,
				ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}`
			};
		} catch (error: Error | any) {
			// await logger.insert("ERROR", "Job input preview couldn't be generated!", { ...error });
			throw new Error(`Job input preview couldn't be generated! ${error.message || ""}`.trim());
			// return { ...error || { message: 'Job input preview couldn't be generated!' } };
		}
	}
}
