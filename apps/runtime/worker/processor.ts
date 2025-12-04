import { config } from "@voltage/config";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { Jimp } from "jimp";
import sharp from "sharp";

export class JobProcessor {
	private job: any;
	private tempJobDir: string;
	private tempJobInputFilePath: string;

	constructor(job: any) {
		this.job = job;
		this.tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		this.tempJobInputFilePath = path.join(this.tempJobDir, "input");
	}

	async process(output: any): Promise<any> {
		try {
			// logger.setMetadata({ instance_key: this.job.instance_key, worker_key: this.job.worker_key, job_key: this.job.key });

			// Validate and set defaults for output specs
			output.specs.type = (output.specs?.type || "VIDEO").toUpperCase();
			output.specs.format = (output.specs?.format || "MP4").toUpperCase();

			if (this.job.input?.duration && output.specs?.offset && parseInt(output.specs.offset) >= parseInt(this.job.input.duration)) {
				output.specs.offset = parseInt(this.job.input.duration) - 1;
			}

			if (this.job.input?.duration && !output.specs?.duration && output.specs?.offset && parseInt(output.specs.offset) > 0) {
				output.specs.duration = parseInt(this.job.input.duration) - parseInt(output.specs.offset || 0);
			}

			if (
				this.job.input?.duration &&
				(!output.specs?.duration ||
					parseInt(output.specs.duration) > parseInt(this.job.input.duration) - parseInt(output.specs?.offset || 0))
			) {
				output.specs.duration = parseInt(this.job.input.duration) - parseInt(output.specs.offset || 0);
			}

			// Temporary output file path
			const tempJobOutputFilePath = path.join(this.tempJobDir, `output.${output.index}.${output.specs.format.toLowerCase()}`);

			// logger.console("INFO", "Processing job output...", { output_key: output.key, output_index: output.index });

			// OUTPUT: TYPE: CHECK
			if (!["VIDEO", "AUDIO", "THUMBNAIL", "SUBTITLE"].includes(output.specs.type)) {
				throw new Error(`Job output type is unsupported: ${output.specs.type}!`);
			}

			// OUTPUT: TYPE: SUBTITLE
			if (["SUBTITLE"].includes(output.specs.type)) {
				return await this.processSubtitle(output, tempJobOutputFilePath);
			}

			// OUTPUT: TYPE: THUMBNAIL
			if (["THUMBNAIL"].includes(output.specs.type)) {
				return await this.processThumbnail(output, tempJobOutputFilePath);
			}

			// OUTPUT: TYPE: VIDEO & AUDIO
			return await this.processVideoOrAudio(output, tempJobOutputFilePath);
		} catch (error: Error | any) {
			// await logger.insert("ERROR", "Failed to process job output!", { output_key: output.key, output_index: output.index, ...error });
			throw new Error(`Failed to process job output! ${error.message || ""}!`.trim());
			// return { message: error.message || "Failed to process job output!", args };
		}
	}

	private async processSubtitle(output: any, tempJobOutputFilePath: string): Promise<any> {
		if (!this.job.input?.audio) {
			// storage.write(tempJobOutputFilePath, "There is no sound in the input file!");
			return { temp_path: tempJobOutputFilePath, message: "There is no sound in the input file!" };
		}

		const jobInputAudioFilePath = path.join(this.tempJobDir, "audio.wav");

		// Convert input to WAV
		const ffmpegArgs = ["-y", "-i", this.tempJobInputFilePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le"];

		// Offset
		if (output.specs?.offset) ffmpegArgs.push("-ss", String(output.specs.offset));

		// Duration
		if (output.specs?.duration) ffmpegArgs.push("-t", String(output.specs.duration));

		ffmpegArgs.push(jobInputAudioFilePath);

		try {
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
								`FFmpeg WAV conversion exited with code ${code}! Command: ffmpeg ${ffmpegArgs.join(" ")}; Stderr: ${stderrData}`
							)
						);
				});
			});

			// Generate subtitles using whisper-node
			const { nodewhisper } = await import("nodejs-whisper"); /* ! */

			const modelName = (output.specs?.whisper_model || config.utils.whisper.model || "BASE")
				.toLowerCase()
				.replace("_en", ".en")
				.replace("_", "-");

			await nodewhisper(path.resolve(jobInputAudioFilePath), {
				modelName: modelName,
				autoDownloadModelName: modelName,
				// removeWavFileAfterTranscription: true,
				withCuda: output.specs?.whisper_cuda || config.utils.whisper.cuda || false,
				// logger: null,
				whisperOptions: {
					outputInSrt: output.specs.format === "SRT",
					outputInVtt: output.specs.format === "VTT",
					outputInCsv: output.specs.format === "CSV",
					outputInJson: output.specs.format === "JSON",
					outputInText: output.specs.format === "TXT",
					// translateToEnglish: output.specs.translate || false,
					language: (output.specs?.language || "AUTO").toLowerCase(),
					wordTimestamps: false,
					timestamps_length: 20,
					splitOnWord: true
				}
			});

			try {
				// Move generated subtitle file to output path
				await fs.rename(path.join(this.tempJobDir, `audio.wav.${output.specs.format.toLowerCase()}`), tempJobOutputFilePath);
			} catch (error: Error | any) {
				throw new Error(
					`Failed to move generated subtitle file! ${path.join(this.tempJobDir, `audio.wav.${output.specs.format.toLowerCase()}`)} to ${tempJobOutputFilePath}. ${error.message || ""}`.trim()
				);
			}

			// logger.console("INFO", "Subtitle generated!", { output_key: output.key, output_index: output.index });

			return { temp_path: tempJobOutputFilePath, ffmpeg_args: ffmpegArgs };
		} catch (error: Error | any) {
			// await logger.insert("ERROR", "Failed to generate subtitle!", { output_key: output.key, output_index: output.index, ...error });
			throw new Error(
				`Failed to generate subtitle! ${error.message || "Unknown error occurred!"}. ffmpeg_args: ${ffmpegArgs.join(" ")}`.trim()
			);
			// return { message: error.message || "Failed to process job output!" };
		}
	}

	private async processThumbnail(output: any, tempJobOutputFilePath: string): Promise<any> {
		if (!this.job.input?.video) {
			const thubnailBuffer = await this.createBlackImageBuffer(
				output.specs.format || "JPG",
				output.specs?.width || 1920,
				output.specs?.height || 1080
			);

			try {
				await fs.writeFile(tempJobOutputFilePath, thubnailBuffer);
			} catch (err) {}

			return { temp_path: tempJobOutputFilePath, message: "There is no video in the input file!" };
		}

		const ffmpegArgs: string[] = ["-y", "-i", this.tempJobInputFilePath];

		// Offset
		if (output.specs?.offset) ffmpegArgs.push("-ss", String(output.specs.offset));

		// Image format
		ffmpegArgs.push("-quality", String(output.specs.quality || 75));

		// Extract only one frame
		ffmpegArgs.push("-vframes", "1");

		// Video filters for thumbnail
		const videoFilters = this.buildVideoFilters(output);
		if (videoFilters.length > 0) ffmpegArgs.push("-vf", videoFilters.join(","));

		ffmpegArgs.push(tempJobOutputFilePath);

		await this.runFfmpeg(ffmpegArgs);

		// logger.console("INFO", "Job output processed!", { output_key: output.key, output_index: output.index });

		return {
			temp_path: tempJobOutputFilePath,
			duration: output.specs?.duration || this.job.input?.duration || 0.0,
			ffmpeg_args: ffmpegArgs
		};
	}

	private async processVideoOrAudio(output: any, tempJobOutputFilePath: string): Promise<any> {
		const ffmpegArgs: string[] = ["-y", "-i", this.tempJobInputFilePath];

		if (["AUDIO"].includes(output.specs.type) && !this.job.input?.audio) {
			// args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-map", "0:a?", "-map", "1:a");
			ffmpegArgs.push(
				"-f",
				"lavfi",
				"-i",
				"anullsrc=channel_layout=stereo:sample_rate=44100",
				"-filter_complex",
				"[0:a][1:a]amix=inputs=2:duration=longest"
			);
		}

		// Offset
		if (output.specs?.offset) ffmpegArgs.push("-ss", String(output.specs.offset));

		// Duration
		if (output.specs?.duration) ffmpegArgs.push("-t", String(output.specs.duration));

		// Audio codec and settings
		if (this.job.input?.audio) {
			// Audio codec
			if (output.specs?.audio_codec) ffmpegArgs.push("-c:a", output.specs.audio_codec);

			// Audio bit rate
			if (output.specs?.audio_bit_rate) ffmpegArgs.push("-b:a", this.parseBitRate(output.specs.audio_bit_rate));

			// Audio sample rate
			if (output.specs?.audio_sample_rate) ffmpegArgs.push("-ar", this.parseSampleRate(output.specs.audio_sample_rate));

			// Audio channels
			if (output.specs?.audio_channels) ffmpegArgs.push("-ac", String(output.specs.audio_channels));
		}

		if (["VIDEO"].includes(output.specs.type) && this.job.input?.video) {
			// Video first frame image overlay
			if (output.specs?.video_first_frame_image_url) {
				ffmpegArgs.push("-i", output.specs.video_first_frame_image_url);
				ffmpegArgs.push(
					"-filter_complex",
					"[0:v]format=yuv420p,drawbox=0:0:iw:ih:black:t=fill:enable='eq(n,0)'[bg];[1:v]scale=w=min(iw\,in_w):h=min(ih\,in_h):force_original_aspect_ratio=decrease[scaled];[bg][scaled]overlay=(W-w)/2:(H-h)/2:enable='eq(n,0)'[v]"
				);
				ffmpegArgs.push("-map", "[v]");
			}

			// Video subtitle burn-in
			if (output.specs?.video_subtitle) {
				// ffmpegArgs.push("-vf", "subtitles=subtitle.srt:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFF,Bold=1'");
			}

			// Video codec
			if (output.specs?.video_codec) ffmpegArgs.push("-c:v", output.specs.video_codec);

			// Video bit rate
			if (output.specs?.video_bit_rate) ffmpegArgs.push("-b:v", this.parseBitRate(output.specs.video_bit_rate));

			// Video profile
			if (output.specs?.video_profile) ffmpegArgs.push("-profile:v", output.specs.video_profile);

			// Video level
			if (output.specs?.video_level) ffmpegArgs.push("-level", output.specs.video_level);

			// Video pixel format
			if (output.specs?.video_pixel_format) ffmpegArgs.push("-pix_fmt", output.specs.video_pixel_format);

			// Video frame rate
			if (output.specs?.video_frame_rate) ffmpegArgs.push("-r", this.parseFrameRate(output.specs.video_frame_rate));

			// Deinterlace
			if (output.specs?.video_deinterlace) ffmpegArgs.push("-vf", "yadif");

			// Video quality
			if (output.specs?.quality !== undefined) ffmpegArgs.push("-q:v", String(output.specs.quality));

			// Video filters
			const videoFilters = this.buildVideoFilters(output);
			if (videoFilters.length > 0) ffmpegArgs.push("-vf", videoFilters.join(","));
		}

		ffmpegArgs.push(tempJobOutputFilePath);

		await this.runFfmpeg(ffmpegArgs);

		// logger.console("INFO", "Job output processed!", { output_key: output.key, output_index: output.index });

		return {
			temp_path: tempJobOutputFilePath,
			duration: output.specs?.duration || this.job.input?.duration || 0.0,
			ffmpeg_args: ffmpegArgs
		};
	}

	private buildVideoFilters(output: any): string[] {
		const videoFilters: string[] = [];

		if (output.specs?.width && output.specs?.height) {
			const fit = (output.specs?.fit || "PAD").toUpperCase();

			switch (fit) {
				case "STRETCH":
					videoFilters.push(`scale=${output.specs.width}:${output.specs.height}`);
					break;
				case "CROP":
					videoFilters.push(
						`scale=${output.specs.width}:${output.specs.height}:force_original_aspect_ratio=increase,crop=${output.specs.width}:${output.specs.height}`
					);
					break;
				case "MAX":
					videoFilters.push(
						`scale='min(${output.specs.width},iw)':'min(${output.specs.height},ih)':force_original_aspect_ratio=decrease`
					);
					break;
				case "PAD":
				default:
					videoFilters.push(
						`scale=${output.specs.width}:${output.specs.height}:force_original_aspect_ratio=decrease,pad=${output.specs.width}:${output.specs.height}:(ow-iw)/2:(oh-ih)/2`
					);
					break;
			}
		}

		if (output.specs?.rotate) {
			switch (parseInt(output.specs.rotate)) {
				case 90:
					videoFilters.push("transpose=1");
					break;
				case -90:
					videoFilters.push("transpose=2");
					break;
				case 180:
				case -180:
					videoFilters.push("transpose=1,transpose=1");
					break;
			}
		}

		if (output.specs?.flip) {
			switch (output.specs.flip.toUpperCase()) {
				case "HORIZONTAL":
					videoFilters.push("hflip");
					break;
				case "VERTICAL":
					videoFilters.push("vflip");
					break;
				case "BOTH":
					videoFilters.push("hflip,vflip");
					break;
			}
		}

		return videoFilters;
	}

	private async runFfmpeg(args: string[]): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let stderrData = "";

			const proc = spawn(config.utils.ffmpeg.path, args, { stdio: ["ignore", "pipe", "pipe"] }); // inherit || ignore

			proc.stderr.on("data", (chunk) => {
				stderrData += chunk.toString();
			});

			proc.on("error", reject);

			proc.on("exit", (code) => {
				if (code === 0) resolve();
				else
					reject(
						new Error(
							`FFmpeg processing job output exited with code ${code}! Command: ffmpeg ${args.join(" ")}; Stderr: ${stderrData}`
						)
					);
			});
		});
	}

	private parseFrameRate(value: string | number): string {
		// Convert to string and remove spaces
		let str = String(value).replace(/\s+/g, "").toLowerCase();
		// Extract numeric part and unit
		const match = str.match(/^(\d+(?:\.\d+)?)(fps)?$/);
		if (!match) {
			return String(value);
		}
		const [, numStr] = match;
		let num = parseFloat(numStr);
		return String(num);
	}

	private parseBitRate(value: string | number): string {
		// Convert to string and remove spaces
		let str = String(value).replace(/\s+/g, "").toLowerCase();

		// Extract numeric part and unit
		const match = str.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
		if (!match) {
			return String(value);
		}

		const [, numStr, unit] = match;
		let num = parseFloat(numStr);

		// Convert to base number
		if (unit === "k") {
			num *= 1000;
		} else if (unit === "m") {
			num *= 1000000;
		}

		// Convert back to optimal unit
		if (num >= 1000000 && num % 1000000 === 0) {
			return `${num / 1000000}m`;
		} else if (num >= 1000 && num % 1000 === 0) {
			return `${num / 1000}k`;
		}

		return String(num);
	}

	private parseSampleRate(value: string | number): string {
		// Convert to string and remove spaces
		let str = String(value).replace(/\s+/g, "").toLowerCase();

		// Extract numeric part and unit
		const match = str.match(/^(\d+(?:\.\d+)?)(k|khz|hz)?$/);
		if (!match) {
			return String(value);
		}

		const [, numStr, unit] = match;
		let num = parseFloat(numStr);

		// Convert to Hz (base unit)
		if (unit === "k" || unit === "khz") {
			num *= 1000;
		}
		// if unit is "hz" or undefined, num is already in Hz

		// Return as integer Hz value (FFmpeg expects sample rate in Hz)
		// Common values: 8000, 11025, 16000, 22050, 44100, 48000, 96000, 192000
		return String(Math.round(num));
	}

	private async createBlackImageBuffer(format: string, width: number, height: number): Promise<Buffer> {
		if (format == "BMP") {
			const image = new Jimp({ width: 300, height: 530, color: 0x000000ff });
			return await image.getBuffer("image/bmp");
		}

		const image = sharp({
			create: {
				width: width || 1920,
				height: height || 1080,
				channels: 3, // RGB
				background: { r: 0, g: 0, b: 0 }
			}
		});

		switch (format) {
			case "PNG":
				return image.png({ compressionLevel: 9 }).toBuffer();
			case "WEBP":
				return image.webp({ quality: 90 }).toBuffer();
			default:
				return image.jpeg({ quality: 90 }).toBuffer();
		}
	}
}
