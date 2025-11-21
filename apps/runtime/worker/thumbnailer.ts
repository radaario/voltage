import { config } from "@voltage/config";

// import { logger } from "@voltage/utils/logger";
import { storage } from "@voltage/utils/storage";

import { spawn } from "child_process";
import path from "path";

export async function generateInputPreview(job: any, options: any): Promise<any> {
	try {
		// logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

		const tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		const tempJobInputFilePath = path.join(tempJobDir, "input");
		const tempJobInputPreviewFilePath = path.join(tempJobDir, `preview.${(options.format || "webp").toLowerCase()}`);

		// logger.console("INFO", "Generating preview from job input...");

		// Calculate the middle timestamp of the video
		let offset = (job.input.duration || 0) / 2;
		if (options.offset !== undefined) offset = options.offset;
		if (job.input.duration && offset > job.input.duration) offset = job.input.duration;

		// Use ffmpeg to extract a frame at the middle timestamp and convert to webp
		const args = [
			"-y", // overwrite output file if exists
			"-ss",
			offset.toString(),
			"-i",
			tempJobInputFilePath,
			"-vframes",
			"1",
			// '-vf', 'scale=640:-1', // width 640, height auto to maintain aspect ratio
			"-quality",
			(options.quality || 75).toString(), // webp quality
			tempJobInputPreviewFilePath
		];

		await new Promise<void>((resolve, reject) => {
			const proc = spawn(config.utils.ffmpeg.path, args, { stdio: "ignore" }); // inherit
			proc.on("error", reject);
			proc.on("exit", (code) => {
				if (code === 0) resolve();
				else reject(new Error(`Ffmpeg preview generation exited with code ${code}`));
			});
		});

		storage.config(config.storage);
		await storage.upload(tempJobInputPreviewFilePath, `/jobs/${job.key}/preview.${(options.format || "webp").toLowerCase()}`);

		// logger.console("INFO", "Preview generated from job input!");
		return { path: tempJobInputPreviewFilePath };
	} catch (error: Error | any) {
		// await logger.insert("ERROR", "Job input preview couldn't be generated!", { error });
		throw new Error(`Job input preview couldn't be generated! ${error.message || ""}`.trim());
		// return { ...error || { message: 'Job input preview couldn't be generated!' } };
	}
}
