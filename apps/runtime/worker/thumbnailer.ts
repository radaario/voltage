import { config as appConfig } from "@voltage/core/config";
import { THUMBNAIL_FORMATS } from "@voltage/core/constants";
import { storage } from "@voltage/utils";

import { spawn } from "child_process";
import path from "path";

interface ThumbnailerOptions {
	format?: string;
	offset?: number;
	quality?: number | null;
}

export class JobThumbnailer {
	private job: any;

	private jobInputDuration: number | null;

	private tempJobDir: string;
	private tempJobInputFilePath: string;

	constructor(job: any) {
		this.job = job;

		this.jobInputDuration = this.job.input?.duration || this.job.metadata?.duration || null;

		this.tempJobDir = path.join(appConfig.temp_dir, "jobs", job.key);
		this.tempJobInputFilePath = path.join(this.tempJobDir, "input");
	}

	async generate(options: ThumbnailerOptions = {}): Promise<any> {
		if (this.job.input?.video === false) {
			return { message: "There is no video in the input file!" };
		}

		try {
			let tempJobInputPreviewFileFormat = (appConfig.jobs.preview.format as string) || "PNG"; // default PNG
			if (options?.format && THUMBNAIL_FORMATS.includes(options.format.toUpperCase() as any)) {
				tempJobInputPreviewFileFormat = options.format.toUpperCase();
			}

			const tempJobInputPreviewFilePath = path.join(this.tempJobDir, `preview.${tempJobInputPreviewFileFormat.toLowerCase()}`);

			// Calculate the middle timestamp of the video
			let offset = this.jobInputDuration ? this.jobInputDuration / 2 : 0;
			if (options.offset !== undefined) offset = options.offset;
			if (this.jobInputDuration && offset > this.jobInputDuration) offset = this.jobInputDuration;

			// Use ffmpeg to extract a frame at the middle timestamp and convert it to the desired format
			const ffmpegArgs: string[] = ["-y"];

			// Ffmpeg Threads
			if (this.job.config?.ffmpeg_threads) {
				ffmpegArgs.push("-threads", String(this.job.config?.ffmpeg_threads ?? 0));
			}

			ffmpegArgs.push(
				"-ss",
				offset.toString(),
				"-i",
				this.tempJobInputFilePath,
				"-vframes",
				"1",
				// '-vf', 'scale=640:-1', // width 640, height auto to maintain aspect ratio
				"-quality",
				(options.quality || appConfig.jobs.preview.quality || 75).toString(), // quality
				tempJobInputPreviewFilePath
			);

			await new Promise<void>((resolve, reject) => {
				let stderrData = "";

				const proc = spawn(appConfig.utils.ffmpeg.path, ffmpegArgs, { stdio: ["ignore", "pipe", "pipe"] }); // inherit || ignore

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
				storage.config(appConfig.storage);
				await storage.upload(
					tempJobInputPreviewFilePath,
					`/jobs/${this.job.key}/preview.${tempJobInputPreviewFileFormat.toLowerCase()}`
				);
			} catch (error: Error | any) {}

			// logger.console("WORKER", "INFO", "Preview generated from job input!");
			return {
				temp_path: tempJobInputPreviewFilePath,
				format: tempJobInputPreviewFileFormat,
				ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}`
			};
		} catch (error: Error | any) {
			// await logger.insert("WORKER", "ERROR", "Job input preview couldn't be generated!", { ...error });
			throw new Error(`${error.message || "Unknown error!"}`.trim());
			// throw new Error(`Job input preview couldn't be generated! ${error.message || ""}`.trim());
			// return { ...error || { message: 'Job input preview couldn't be generated!' } };
		}
	}
}
