import { config as appConfig } from "@voltage/core/config";
import { OUTPUT_TYPES, FFMPEG_PRESETS } from "@voltage/core/constants";

import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { Jimp } from "jimp";
import sharp from "sharp";

export class JobOutputProcessor {
	private job: any;
	private jobInputDuration: number | null;
	private output: any;

	private tempJobDir: string;
	private tempJobInputFilePath: string;
	private tempJobOutputFilePath: string;

	constructor(job: any, output: any) {
		try {
			this.job = job;
			this.output = output;

			this.jobInputDuration = this.job.config?.duration || this.job.input?.duration || null;

			this.validateOutputOffset();
			this.validateOutputDuration();

			this.tempJobDir = path.join(appConfig.temp_dir, "jobs", job.key);
			this.tempJobInputFilePath = path.join(this.tempJobDir, "input");

			// Temporary output file path
			this.tempJobOutputFilePath = path.join(
				this.tempJobDir,
				`output.${this.output.index}.${this.output.config.format.toLowerCase()}`
			);
		} catch (error: Error | any) {
			throw new Error(`Failed to process job output! ${error.message || ""}!`.trim());
			// return { message: error.message || "Failed to process job output!", args };
		}
	}

	async process(): Promise<any> {
		try {
			// OUTPUT: TYPE: CHECK
			if (!OUTPUT_TYPES.includes(this.output.type.toUpperCase() as any)) {
				throw new Error(`Job output type is unsupported: ${this.output.type.toUpperCase()}!`);
			}

			// OUTPUT: TYPE: SUBTITLE
			if (["SUBTITLE"].includes(this.output.type.toUpperCase())) {
				return await this.processSubtitle();
			}

			// OUTPUT: TYPE: THUMBNAIL
			if (["THUMBNAIL"].includes(this.output.type.toUpperCase())) {
				return await this.processThumbnail();
			}

			// OUTPUT: TYPE: VIDEO & AUDIO
			return await this.processVideoOrAudio();
		} catch (error: Error | any) {
			throw new Error(`Failed to process job output! ${error.message || ""}!`.trim());
			// return { message: error.message || "Failed to process job output!", args };
		}
	}

	private async processSubtitle(): Promise<any> {
		try {
			if (this.job.input?.audio === false) {
				await fs.writeFile(this.tempJobOutputFilePath, "");
				return { temp_path: this.tempJobOutputFilePath, message: "There is no sound in the input file!" };
				// throw new Error("There is no sound in the input file!");
			}

			const jobInputAudioFilePath = path.join(this.tempJobDir, "audio.wav");

			// Convert input to WAV
			const ffmpegArgs: string[] = ["-y"];

			// Ffmpeg Threads
			const ffmpegThreads = this.outputThreads();
			if (!ffmpegThreads) ffmpegArgs.push("-threads", String(this.output.config?.threads ?? 0));

			ffmpegArgs.push("-i", this.tempJobInputFilePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le");

			// Offset
			if (this.output.config?.offset) ffmpegArgs.push("-ss", String(this.output.config.offset));

			// Duration
			if (this.output.config?.duration) ffmpegArgs.push("-t", String(this.output.config.duration));

			// Ffmpeg Preset
			const ffmpegPreset = this.outputPreset();
			if (ffmpegPreset) ffmpegArgs.push("-preset", ffmpegPreset);

			ffmpegArgs.push(jobInputAudioFilePath);

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
								`FFmpeg WAV conversion exited with code ${code}! ffmpeg_command: ffmpeg ${ffmpegArgs.join(" ")}; ffmpeg_stderr: ${stderrData}`
							)
						);
				});
			});

			// Generate subtitles using whisper-node
			const { nodewhisper } = await import("nodejs-whisper"); /* ! */

			const modelName = (
				this.output.config?.whisper_model ||
				this.job.config?.whisper_model ||
				appConfig.utils.whisper.model ||
				"BASE"
			)
				.toLowerCase()
				.replace("_en", ".en")
				.replace("_", "-");

			await nodewhisper(path.resolve(jobInputAudioFilePath), {
				modelName: modelName,
				autoDownloadModelName: modelName,
				// removeWavFileAfterTranscription: true,
				withCuda:
					this.output.config?.whisper_with_cuda ||
					this.job.config?.whisper_with_cuda ||
					appConfig.utils.whisper.with_cuda ||
					false,
				// logger: null,
				whisperOptions: {
					outputInSrt: !this.output.config.format || this.output.config.format === "SRT",
					outputInVtt: this.output.config.format === "VTT",
					outputInCsv: this.output.config.format === "CSV",
					outputInJson: this.output.config.format === "JSON",
					outputInText: this.output.config.format === "TXT",
					// translateToEnglish: this.output.config.translate || false,
					language: (this.output.config?.language || "AUTO").toLowerCase(),
					wordTimestamps: false,
					timestamps_length: 20,
					splitOnWord: true
				}
			});

			try {
				// Move generated subtitle file to output path
				await fs.rename(
					path.join(this.tempJobDir, `audio.wav.${this.output.config.format.toLowerCase()}`),
					this.tempJobOutputFilePath
				);
			} catch (error: Error | any) {
				throw new Error(
					`Failed to move generated subtitle file! ${path.join(this.tempJobDir, `audio.wav.${this.output.config.format.toLowerCase()}`)} to ${this.tempJobOutputFilePath}. ${error.message || ""}`.trim()
				);
			}

			return { temp_path: this.tempJobOutputFilePath, ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}` };
		} catch (error: Error | any) {
			throw new Error(`Failed to generate subtitle! ${error.message || "Unknown error occurred!"}`.trim());
			// return { message: error.message || "Failed to process job output!" };
		}
	}

	private async processThumbnail(): Promise<any> {
		if (this.job.input?.video === false) {
			throw new Error("There is no video in the input file!");
		}

		try {
			const ffmpegArgs: string[] = ["-y"];

			// Ffmpeg Threads
			const ffmpegThreads = this.outputThreads();
			if (!ffmpegThreads) ffmpegArgs.push("-threads", String(this.output.config?.threads ?? 0));

			ffmpegArgs.push("-i", this.tempJobInputFilePath);

			// Offset
			if (this.output.config?.offset) ffmpegArgs.push("-ss", String(this.output.config.offset));

			if (this.output.config?.image_quality || this.output.config?.quality) {
				ffmpegArgs.push(
					"-quality",
					String(this.calculateQuality(this.output.config.image_quality || this.output.config?.quality, 1, 31))
				);
			}

			// Extract only one frame
			ffmpegArgs.push("-vframes", "1");

			// Video filters for thumbnail
			const videoFilters = this.buildVideoFilters();
			if (videoFilters.length > 0) ffmpegArgs.push("-vf", videoFilters.join(","));

			// Ffmpeg Preset
			const ffmpegPreset = this.outputPreset();
			if (ffmpegPreset) ffmpegArgs.push("-preset", ffmpegPreset);

			ffmpegArgs.push(this.tempJobOutputFilePath);

			await this.runFfmpeg(ffmpegArgs);

			return {
				temp_path: this.tempJobOutputFilePath,
				duration: this.output.config?.duration || this.jobInputDuration || 0.0,
				ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}`
			};
		} catch (error: Error | any) {
			const thubnailBuffer = await this.createBlackImageBuffer(
				this.output.config.format || "JPG",
				this.output.config?.width || 1920,
				this.output.config?.height || 1080
			);

			try {
				await fs.writeFile(this.tempJobOutputFilePath, thubnailBuffer);
			} catch (err) {}

			return { temp_path: this.tempJobOutputFilePath, message: error.message || "Thumbnail couldn't be processed!" };
		}
	}

	private async processVideoOrAudio(): Promise<any> {
		try {
			const ffmpegArgs: string[] = ["-y"];

			// Ffmpeg Threads
			const ffmpegThreads = this.outputThreads();
			if (!ffmpegThreads) ffmpegArgs.push("-threads", String(this.output.config?.threads ?? 0));

			ffmpegArgs.push("-i", this.tempJobInputFilePath);

			if (["AUDIO"].includes(this.output.type) && this.job.input?.audio === false) {
				// ffmpegArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-map", "0:a?", "-map", "1:a");
				/*
				ffmpegArgs.push(
					"-f",
					"lavfi",
					"-i",
					"anullsrc=channel_layout=stereo:sample_rate=44100",
					"-filter_complex",
					"[0:a][1:a]amix=inputs=2:duration=longest"
				);
				*/

				ffmpegArgs.splice(0, ffmpegArgs.length);
				ffmpegArgs.push(
					"-f",
					"lavfi",
					"-i",
					"anullsrc=channel_layout=stereo:sample_rate=44100",
					"-t",
					String(this.output.config?.duration || this.jobInputDuration || 10.0),
					"-shortest"
				);
			}

			// if (this.job.input?.audio !== false) {
			// Offset
			if (this.output.config?.offset) ffmpegArgs.push("-ss", String(this.output.config.offset));

			// Duration
			if (this.output.config?.duration) ffmpegArgs.push("-t", String(this.output.config.duration));

			// Audio codec
			if (this.output.config?.audio_codec) ffmpegArgs.push("-c:a", this.output.config.audio_codec);

			// Audio bit rate
			if (this.output.config?.audio_bit_rate) ffmpegArgs.push("-b:a", this.parseBitRate(this.output.config.audio_bit_rate));

			// Audio sample rate
			if (this.output.config?.audio_sample_rate) ffmpegArgs.push("-ar", this.parseSampleRate(this.output.config.audio_sample_rate));

			// Audio channels
			if (this.output.config?.audio_channels) ffmpegArgs.push("-ac", String(this.output.config.audio_channels));

			// Audio quality
			if (this.output.config?.audio_quality || this.output.config?.quality) {
				ffmpegArgs.push(
					"-q:a",
					String(this.calculateQuality(this.output.config.audio_quality || this.output.config?.quality, 0, 9))
				);
			}
			// }

			if (["VIDEO"].includes(this.output.type) && this.job.input?.video === false) {
				const jobInputWidth = this.job.config?.width || this.job.input?.width || 1920;
				const jobInputHeight = this.job.config?.height || this.job.input?.height || 1080;

				ffmpegArgs.push(
					"-f",
					"lavfi",
					"-i",
					`color=c=black:s=${jobInputWidth}x${jobInputHeight}`,
					"-t",
					String(this.output.config?.duration || this.jobInputDuration || 10.0),
					"-shortest"
				);
			}

			if (["VIDEO"].includes(this.output.type)) {
				// Video first frame image overlay
				if (this.output.config?.video_first_frame_image_url) {
					ffmpegArgs.push("-i", this.output.config.video_first_frame_image_url);
					ffmpegArgs.push(
						"-filter_complex",
						"[0:v]format=yuv420p,drawbox=0:0:iw:ih:black:t=fill:enable='eq(n,0)'[bg];[1:v]scale=w=min(iw\,in_w):h=min(ih\,in_h):force_original_aspect_ratio=decrease[scaled];[bg][scaled]overlay=(W-w)/2:(H-h)/2:enable='eq(n,0)'[v]"
					);
					ffmpegArgs.push("-map", "[v]");
				}

				// Video subtitle burn-in
				/*
				if (this.output.config?.video_subtitle) {
					ffmpegArgs.push("-vf", "subtitles=subtitle.srt:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFF,Bold=1'");
				}
				*/

				// Video codec
				if (this.output.config?.video_codec) ffmpegArgs.push("-c:v", this.output.config.video_codec);

				// Video bit rate
				if (this.output.config?.video_bit_rate) ffmpegArgs.push("-b:v", this.parseBitRate(this.output.config.video_bit_rate));

				// Video profile
				if (this.output.config?.video_profile) ffmpegArgs.push("-profile:v", this.output.config.video_profile);

				// Video level
				if (this.output.config?.video_level) ffmpegArgs.push("-level", this.output.config.video_level);

				// Video pixel format
				if (this.output.config?.video_pixel_format) ffmpegArgs.push("-pix_fmt", this.output.config.video_pixel_format);

				// Video frame rate
				if (this.output.config?.video_frame_rate) ffmpegArgs.push("-r", this.parseFrameRate(this.output.config.video_frame_rate));

				// Deinterlace
				if (this.output.config?.video_deinterlace) ffmpegArgs.push("-vf", "yadif");

				// Video quality
				if (this.output.config?.video_quality || this.output.config?.quality) {
					ffmpegArgs.push(
						"-q:v",
						String(this.calculateQuality(this.output.config.video_quality || this.output.config?.quality, 0, 51))
					);
				}

				// Video filters
				const videoFilters = this.buildVideoFilters();
				if (videoFilters.length > 0) ffmpegArgs.push("-vf", videoFilters.join(","));
			}

			// Ffmpeg Preset
			const ffmpegPreset = this.outputPreset();
			if (ffmpegPreset) ffmpegArgs.push("-preset", ffmpegPreset);

			// Ffmpeg Minimum & Maximum Bit Rate
			if (this.output.config?.bit_rate_min || this.job.config?.ffmpeg_bit_rate_min) {
				if (this.output.config?.bit_rate_min) ffmpegArgs.push("-minrate", this.parseBitRate(this.output.config.bit_rate_min));
				if (this.output.config?.bit_rate_max) ffmpegArgs.push("-maxrate", this.parseBitRate(this.output.config.bit_rate_max));
				ffmpegArgs.push(
					"-bufsize",
					this.parseBitRate((this.output.config.bit_rate_max || this.job.config?.ffmpeg_bit_rate_max || 0) * 2)
				);
			}

			ffmpegArgs.push(this.tempJobOutputFilePath);

			await this.runFfmpeg(ffmpegArgs);

			return {
				temp_path: this.tempJobOutputFilePath,
				duration: this.output.config?.duration || this.jobInputDuration || 0.0,
				ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}`
			};
		} catch (error: Error | any) {
			throw new Error(`Failed to process job output! ${error.message || ""}!`.trim());
		}
	}

	private buildVideoFilters(): string[] {
		const videoFilters: string[] = [];

		if (this.output.config?.width && this.output.config?.height) {
			const fit = (this.output.config?.fit || "PAD").toUpperCase();

			switch (fit) {
				case "STRETCH":
					videoFilters.push(`scale=${this.output.config.width}:${this.output.config.height}`);
					break;
				case "CROP":
					videoFilters.push(
						`scale=${this.output.config.width}:${this.output.config.height}:force_original_aspect_ratio=increase,crop=${this.output.config.width}:${this.output.config.height}`
					);
					break;
				case "MAX":
					videoFilters.push(
						`scale='min(${this.output.config.width},iw)':'min(${this.output.config.height},ih)':force_original_aspect_ratio=decrease`
					);
					break;
				case "PAD":
				default:
					videoFilters.push(
						`scale=${this.output.config.width}:${this.output.config.height}:force_original_aspect_ratio=decrease,pad=${this.output.config.width}:${this.output.config.height}:(ow-iw)/2:(oh-ih)/2`
					);

					/*
					videoFilters.push(
						`scale=${this.output.config.width}:${this.output.config.height}:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2`
					);
					*/

					/*
					videoFilters.push(
						`scale=${this.output.config.width}:${this.output.config.height}:force_original_aspect_ratio=decrease,pad=${this.output.config.width}:${this.output.config.height}:0:0:color=black`
					);
					*/
					break;
			}
		}

		if (this.output.config?.rotate) {
			switch (parseInt(this.output.config.rotate)) {
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

		if (this.output.config?.flip) {
			switch (this.output.config.flip.toUpperCase()) {
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

			const proc = spawn(appConfig.utils.ffmpeg.path, args, { stdio: ["ignore", "pipe", "pipe"] }); // inherit || ignore

			proc.stderr.on("data", (chunk) => {
				stderrData += chunk.toString();
			});

			proc.on("error", reject);

			proc.on("exit", (code) => {
				if (code === 0) resolve();
				else
					reject(
						new Error(
							`FFmpeg processing job output exited with code ${code}! ffmpeg_command: ffmpeg ${args.join(" ")}; ffmpeg_stderr: ${stderrData}`
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

	private calculateQuality(value: number, bottom: number = 0, top: number = 100): number {
		// Map value from [0, 100] range to [bottom, top] range
		// Formula: result = bottom + (value / 100) * (top - bottom)
		// return bottom + (value / 100) * (top - bottom);
		// return parseInt(String(bottom + (value / 100) * (top - bottom)));
		return Math.round(bottom + (value / 100) * (top - bottom));
	}

	private outputThreads(): number | null {
		let threads = null;

		if (this.job.config?.ffmpeg_threads !== undefined) {
			threads = this.job.config.ffmpeg_threads;
		}

		if (this.output.config?.threads !== undefined) {
			threads = this.output.config.threads;
		}

		return threads;
	}

	private outputPreset(): string | null {
		let preset = "DEFAULT";

		const outputPreset = this.output.config?.preset || this.job.config?.ffmpeg_preset;
		if (outputPreset && FFMPEG_PRESETS.includes(outputPreset.toUpperCase())) preset = outputPreset.toUpperCase();

		return preset == "DEFAULT" ? null : preset.toLocaleLowerCase().replace("_", "");
	}

	private validateOutputOffset(): void {
		if (this.jobInputDuration && this.output.config?.offset && parseInt(this.output.config.offset) >= this.jobInputDuration) {
			this.output.config.offset = this.jobInputDuration - 1;
		}

		if (this.output.config?.offset && parseInt(this.output.config.offset) <= 0) {
			this.output.config.offset = null;
		}

		if (this.output.config?.offset === null) {
			delete this.output.config.offset;
		}
	}

	private validateOutputDuration(): void {
		if (
			this.jobInputDuration &&
			!this.output.config?.duration &&
			this.output.config?.offset &&
			parseInt(this.output.config.offset) > 0
		) {
			this.output.config.duration = this.jobInputDuration - parseInt(this.output.config.offset || 0);
		}

		if (
			this.jobInputDuration &&
			(!this.output.config?.duration ||
				parseInt(this.output.config.duration) > this.jobInputDuration - parseInt(this.output.config?.offset || 0))
		) {
			this.output.config.duration = this.jobInputDuration - parseInt(this.output.config.offset || 0);
		}

		if (this.output.config?.duration && parseInt(this.output.config.duration) <= 0) {
			this.output.config.duration = null;
		}

		if (this.jobInputDuration && this.output.config?.duration && parseInt(this.output.config.duration) == this.jobInputDuration) {
			this.output.config.duration = null;
		}

		if (this.output.config?.duration === null) {
			delete this.output.config.duration;
		}
	}
}
