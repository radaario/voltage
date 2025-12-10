import { config } from "@voltage/config";
import { guessContentType } from "@voltage/utils";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

interface FileInfo {
	file_name: string;
	file_extension: string;
	file_mime_type: string;
	file_size: number;
}

export class JobAnalyzer {
	private job: any;
	private tempJobDir: string;
	private tempJobInputFilePath: string;

	constructor(job: any) {
		this.job = job;
		this.tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		this.tempJobInputFilePath = path.join(this.tempJobDir, "input");
	}

	async analyze(): Promise<any> {
		try {
			// FILE: INFO: EXTRACT
			const fileName = path.basename(this.job.input?.url || this.job.input?.path || "unknown");
			const fileExtension = path.extname(fileName).toLowerCase().replace(/^\./, "");
			const fileStats = await fs.stat(this.tempJobInputFilePath);
			const fileMimeType = guessContentType(fileName);

			// FFPROBE: RUN
			const ffprobeData = await this.runFfprobe();

			// METADATA: EXTRACT
			const metadata = this.parseFfprobeOutput(ffprobeData, {
				file_name: fileName,
				file_extension: fileExtension,
				file_mime_type: fileMimeType,
				file_size: fileStats.size
			});

			return metadata;
		} catch (error: Error | any) {
			throw new Error(`${error.message || "Unknown error!"}`.trim());
			// throw new Error(`Job input couldn't be analyzed! ${error.message || ""}`.trim());
		}
	}

	private async runFfprobe(): Promise<any> {
		return new Promise((resolve, reject) => {
			const args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", this.tempJobInputFilePath];

			const ffprobe = spawn(config.utils.ffprobe.path, args, { stdio: ["ignore", "pipe", "pipe"] });

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
						reject(
							new Error(
								`Failed to parse FFProbe output: ${error.message}! Command: ffprobe ${args.join(" ")}; Stderr: ${stderr}`
							)
						);
					}
				} else {
					reject(new Error(`FFProbe failed with code ${code}! Command: ffprobe ${args.join(" ")}; Stderr: ${stderr}`));
				}
			});

			ffprobe.on("error", (error: Error | any) => {
				reject(new Error(`Failed to start FFProbe: ${error.message}`));
			});
		});
	}

	private parseFfprobeOutput(data: any, fileInfo: FileInfo): any {
		const format = data.format || {};
		const streams = data.streams || [];

		// VIDEO & AUDIO: STREAMs: FIND
		const videoStream = streams.find((s: any) => s.codec_type === "video");
		const audioStream = streams.find((s: any) => s.codec_type === "audio");

		// DURATION: CALCULATION
		const duration = format.duration ? parseFloat(format.duration) : null;
		const durationInTimestamp = duration ? Math.round(duration * 1000000) : null; // Convert to microseconds

		/* VIDEO: INFO: PARSE */
		let videoInfo = { video: false } as any;

		if (videoStream) {
			const videoWidth = videoStream.width ? parseInt(videoStream.width) : null;
			const videoHeight = videoStream.height ? parseInt(videoStream.height) : null;
			const videoCodedWidth = videoStream.coded_width ? parseInt(videoStream.coded_width) : videoWidth;
			const videoCodedHeight = videoStream.coded_height ? parseInt(videoStream.coded_height) : videoHeight;

			// Calculate aspect ratio
			const videoAspectRatioDecimal = videoWidth && videoHeight ? videoWidth / videoHeight : null;
			const videoAspectRatio = videoAspectRatioDecimal ? this.getAspectRatio(videoAspectRatioDecimal) : null;

			videoInfo = {
				video: true,
				video_width: videoWidth,
				video_width_coded: videoCodedWidth,
				video_height: videoHeight,
				video_height_coded: videoCodedHeight,
				video_aspect_ratio: videoAspectRatio,
				video_aspect_ratio_in_decimal: videoAspectRatioDecimal,
				video_frames: videoStream.nb_frames ? parseInt(videoStream.nb_frames) : null,
				video_frame_rate: videoStream.r_frame_rate
					? parseFloat(videoStream.r_frame_rate?.split("/")[0] || "0") /
						parseFloat(videoStream.r_frame_rate?.split("/")[1] || "1")
					: null,
				video_codec: videoStream.codec_name || null,
				video_profile: videoStream.profile || null,
				video_level: videoStream.level || null,
				video_bit_rate: videoStream.bit_rate ? parseInt(videoStream.bit_rate) : null,
				video_has_b_frames: videoStream.has_b_frames ? parseInt(videoStream.has_b_frames) : null,
				video_pixel_format: videoStream.pix_fmt || null,
				video_chroma_location: videoStream.chroma_location || null
			};
		}

		/* AUDIO: INFO: PARSE */
		let audioInfo = { audio: false } as any;

		if (audioStream) {
			audioInfo = {
				audio: true,
				audio_codec: audioStream.codec_name || null,
				audio_profile: audioStream.profile || null,
				audio_channels: audioStream.channels ? parseInt(audioStream.channels) : null,
				audio_channel_layout: audioStream.channel_layout || null,
				audio_sample_rate: audioStream.sample_rate ? parseInt(audioStream.sample_rate) : null,
				audio_bit_rate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : null
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

	private getAspectRatio(decimal: number): string {
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
}
