import { config } from "@voltage/config";

// import { logger } from "@voltage/utils";
import { guessContentType } from "@voltage/utils";

import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

export async function analyzeInputMetadata(job: any): Promise<any[]> {
	try {
		// logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

		const tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		const tempJobInputFilePath = path.join(tempJobDir, "input");

		// logger.console("INFO", "Analyzing from job input file...");

		/* FILE: INFO: EXTRACT */
		const fileName = path.basename(job.input?.url || job.input?.path || "unknown");
		const fileExtension = path.extname(fileName).toLowerCase().replace(/^\./, "");
		const fileStats = await fs.stat(tempJobInputFilePath);
		const fileMimeType = guessContentType(fileName);

		/* FFPROBE: RUN */
		const ffprobeData = await runFfprobe(tempJobInputFilePath);

		/* METADATA: EXTRACT */
		const metadata = parseFfprobeOutput(ffprobeData, {
			file_name: fileName,
			file_extension: fileExtension,
			file_mime_type: fileMimeType,
			file_size: fileStats.size
		});

		// logger.console("INFO", "Job input successfully analyzed!");
		return metadata;
	} catch (error: Error | any) {
		// await logger.insert("ERROR", "Job input couldn't be analyzed!", { error });
		throw new Error(`Job input couldn't be analyzed! ${error.message || ""}`.trim());
	}
}

async function runFfprobe(filePath: string): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const ffprobe = spawn(config.utils.ffprobe.path, [
			"-v",
			"quiet",
			"-print_format",
			"json",
			"-show_format",
			"-show_streams",
			filePath
		]);

		let stdout = "";
		let stderr = "";

		ffprobe.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		ffprobe.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		ffprobe.on("close", (code) => {
			if (code === 0) {
				try {
					const result = JSON.parse(stdout);
					resolve(result);
				} catch (error: Error | any) {
					reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
				}
			} else {
				reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
			}
		});

		ffprobe.on("error", (error: Error | any) => {
			reject(new Error(`Failed to start ffprobe: ${error.message}`));
		});
	});
}

function parseFfprobeOutput(data: any, fileInfo: any): any[] {
	const format = data.format || {};
	const streams = data.streams || [];

	/* VIDEO & AUDIO: STREAMs: FIND */
	const videoStream = streams.find((s: any) => s.codec_type === "video");
	const audioStream = streams.find((s: any) => s.codec_type === "audio");

	/* DURATION: CALCULATION */
	const duration = parseFloat(format.duration || "0");
	const durationInTimestamp = Math.round(duration * 1000000); // Convert to microseconds

	/* VIDEO: INFO: PARSE */
	let videoInfo = { video: false } as any;

	if (videoStream) {
		const videoWidth = parseInt(videoStream.width || "0");
		const videoHeight = parseInt(videoStream.height || "0");
		const videoCodedWidth = parseInt(videoStream.coded_width || videoStream.width || "0");
		const videoCodedHeight = parseInt(videoStream.coded_height || videoStream.height || "0");

		// Calculate aspect ratio
		const videoAspectRatioDecimal = videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 0;
		const videoAspectRatio = getAspectRatio(videoAspectRatioDecimal);

		videoInfo = {
			video: true,
			video_width: videoWidth,
			video_width_coded: videoCodedWidth,
			video_height: videoHeight,
			video_height_coded: videoCodedHeight,
			video_aspect_ratio: videoAspectRatio,
			video_aspect_ratio_in_decimal: videoAspectRatioDecimal,
			video_frames: parseInt(videoStream.nb_frames || "0"),
			video_frame_rate:
				parseFloat(videoStream.r_frame_rate?.split("/")[0] || "0") / parseFloat(videoStream.r_frame_rate?.split("/")[1] || "1"),
			video_codec: videoStream.codec_name || "",
			video_profile: videoStream.profile || "",
			video_level: videoStream.level || "",
			video_bit_rate: parseInt(videoStream.bit_rate || "0"),
			video_has_b_frames: parseInt(videoStream.has_b_frames || "0"),
			video_pixel_format: videoStream.pix_fmt || "",
			video_chroma_location: videoStream.chroma_location || ""
		};
	}

	/* AUDIO: INFO: PARSE */
	let audioInfo = { audio: false } as any;

	if (audioStream) {
		audioInfo = {
			audio: true,
			audio_codec: audioStream.codec_name || "",
			audio_profile: audioStream.profile || "",
			audio_channels: parseInt(audioStream.channels || "0"),
			audio_channel_layout: audioStream.channel_layout || "",
			audio_sample_rate: parseInt(audioStream.sample_rate || "0"),
			audio_bit_rate: parseInt(audioStream.bit_rate || "0")
		};
	}

	return {
		...fileInfo,
		duration,
		duration_in_ts: durationInTimestamp,
		...videoInfo,
		...audioInfo
	};
}

function getAspectRatio(decimal: number): string {
	const commonRatios: Array<{ decimal: number; ratio: string }> = [
		{ decimal: 1.777777777777778, ratio: "16:9" },
		{ decimal: 1.333333333333333, ratio: "4:3" },
		{ decimal: 1.0, ratio: "1:1" },
		{ decimal: 2.35, ratio: "21:9" },
		{ decimal: 1.85, ratio: "1.85:1" },
		{ decimal: 2.4, ratio: "2.4:1" }
	];

	// Find the closest match
	let closest = commonRatios[0];
	let minDiff = Math.abs(decimal - closest.decimal);

	for (const ratio of commonRatios) {
		const diff = Math.abs(decimal - ratio.decimal);
		if (diff < minDiff) {
			minDiff = diff;
			closest = ratio;
		}
	}

	// If the difference is too large, return the decimal as a ratio
	if (minDiff > 0.1) {
		const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
		const precision = 1000000; // 6 decimal places
		const numerator = Math.round(decimal * precision);
		const denominator = precision;
		const divisor = gcd(numerator, denominator);
		return `${numerator / divisor}:${denominator / divisor}`;
	}

	return closest.ratio;
}
