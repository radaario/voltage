import { config } from "@voltage/config";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { Jimp } from "jimp";
import sharp from "sharp";

export class JobOutputProcessor {
	private job: any;
	private output: any;

	private tempJobDir: string;
	private tempJobInputFilePath: string;
	private tempJobOutputFilePath: string;

	constructor(job: any, output: any) {
		try {
			this.job = job;
			this.output = output;

			// Validate and set defaults for output specs
			this.output.specs.type = (this.output.specs?.type || "VIDEO").toUpperCase();
			this.output.specs.format = (this.output.specs?.format || "MP4").toUpperCase();

			// Validate offset
			if (
				this.job.input?.duration &&
				this.output.specs?.offset &&
				parseInt(this.output.specs.offset) >= parseInt(this.job.input.duration)
			) {
				this.output.specs.offset = parseInt(this.job.input.duration) - 1;
			}

			if (this.output.specs?.offset && parseInt(this.output.specs.offset) <= 0) {
				this.output.specs.offset = null;
			}

			if (this.output.specs?.offset === null) {
				delete this.output.specs.offset;
			}

			// Validate duration
			if (
				this.job.input?.duration &&
				!this.output.specs?.duration &&
				this.output.specs?.offset &&
				parseInt(this.output.specs.offset) > 0
			) {
				this.output.specs.duration = parseInt(this.job.input.duration) - parseInt(this.output.specs.offset || 0);
			}

			if (
				this.job.input?.duration &&
				(!this.output.specs?.duration ||
					parseInt(this.output.specs.duration) > parseInt(this.job.input.duration) - parseInt(this.output.specs?.offset || 0))
			) {
				this.output.specs.duration = parseInt(this.job.input.duration) - parseInt(this.output.specs.offset || 0);
			}

			if (this.output.specs?.duration && parseInt(this.output.specs.duration) <= 0) {
				this.output.specs.duration = null;
			}

			if (
				this.job.input?.duration &&
				this.output.specs?.duration &&
				parseInt(this.output.specs.duration) == parseInt(this.job.input.duration)
			) {
				this.output.specs.duration = null;
			}

			if (this.output.specs?.duration === null) {
				delete this.output.specs.duration;
			}

			this.tempJobDir = path.join(config.temp_dir, "jobs", job.key);
			this.tempJobInputFilePath = path.join(this.tempJobDir, "input");

			// Temporary output file path
			this.tempJobOutputFilePath = path.join(
				this.tempJobDir,
				`output.${this.output.index}.${this.output.specs.format.toLowerCase()}`
			);
		} catch (error: Error | any) {
			throw new Error(`Failed to process job output! ${error.message || ""}!`.trim());
			// return { message: error.message || "Failed to process job output!", args };
		}
	}

	async process(): Promise<any> {
		try {
			// OUTPUT: TYPE: CHECK
			if (!["VIDEO", "AUDIO", "THUMBNAIL", "SUBTITLE"].includes(this.output.specs.type)) {
				throw new Error(`Job output type is unsupported: ${this.output.specs.type}!`);
			}

			// OUTPUT: TYPE: SUBTITLE
			if (["SUBTITLE"].includes(this.output.specs.type)) {
				return await this.processSubtitle();
			}

			// OUTPUT: TYPE: THUMBNAIL
			if (["THUMBNAIL"].includes(this.output.specs.type)) {
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
			const ffmpegArgs = ["-y", "-i", this.tempJobInputFilePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le"];

			// Offset
			if (this.output.specs?.offset) ffmpegArgs.push("-ss", String(this.output.specs.offset));

			// Duration
			if (this.output.specs?.duration) ffmpegArgs.push("-t", String(this.output.specs.duration));

			ffmpegArgs.push(jobInputAudioFilePath);

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
								`FFmpeg WAV conversion exited with code ${code}! ffmpeg_command: ffmpeg ${ffmpegArgs.join(" ")}; ffmpeg_stderr: ${stderrData}`
							)
						);
				});
			});

			// Generate subtitles using whisper-node
			const { nodewhisper } = await import("nodejs-whisper"); /* ! */

			const modelName = (this.output.specs?.whisper_model || config.utils.whisper.model || "BASE")
				.toLowerCase()
				.replace("_en", ".en")
				.replace("_", "-");

			await nodewhisper(path.resolve(jobInputAudioFilePath), {
				modelName: modelName,
				autoDownloadModelName: modelName,
				// removeWavFileAfterTranscription: true,
				withCuda: this.output.specs?.whisper_cuda || config.utils.whisper.cuda || false,
				// logger: null,
				whisperOptions: {
					outputInSrt: this.output.specs.format === "SRT",
					outputInVtt: this.output.specs.format === "VTT",
					outputInCsv: this.output.specs.format === "CSV",
					outputInJson: this.output.specs.format === "JSON",
					outputInText: this.output.specs.format === "TXT",
					// translateToEnglish: this.output.specs.translate || false,
					language: (this.output.specs?.language || "AUTO").toLowerCase(),
					wordTimestamps: false,
					timestamps_length: 20,
					splitOnWord: true
				}
			});

			try {
				// Move generated subtitle file to output path
				await fs.rename(
					path.join(this.tempJobDir, `audio.wav.${this.output.specs.format.toLowerCase()}`),
					this.tempJobOutputFilePath
				);
			} catch (error: Error | any) {
				throw new Error(
					`Failed to move generated subtitle file! ${path.join(this.tempJobDir, `audio.wav.${this.output.specs.format.toLowerCase()}`)} to ${this.tempJobOutputFilePath}. ${error.message || ""}`.trim()
				);
			}

			return { temp_path: this.tempJobOutputFilePath, ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}` };
		} catch (error: Error | any) {
			throw new Error(`Failed to generate subtitle! ${error.message || "Unknown error occurred!"}`.trim());
			// return { message: error.message || "Failed to process job output!" };
		}
	}

	private async processThumbnail(): Promise<any> {
		try {
			if (this.job.input?.video === false) {
				throw new Error("There is no video in the input file!");
			}

			const ffmpegArgs: string[] = ["-y", "-i", this.tempJobInputFilePath];

			// Offset
			if (this.output.specs?.offset) ffmpegArgs.push("-ss", String(this.output.specs.offset));

			// Image format
			ffmpegArgs.push("-quality", String(this.output.specs.quality || 75));

			// Extract only one frame
			ffmpegArgs.push("-vframes", "1");

			// Video filters for thumbnail
			const videoFilters = this.buildVideoFilters();
			if (videoFilters.length > 0) ffmpegArgs.push("-vf", videoFilters.join(","));

			ffmpegArgs.push(this.tempJobOutputFilePath);

			await this.runFfmpeg(ffmpegArgs);

			return {
				temp_path: this.tempJobOutputFilePath,
				duration: this.output.specs?.duration || this.job.input?.duration || 0.0,
				ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}`
			};
		} catch (error: Error | any) {
			const thubnailBuffer = await this.createBlackImageBuffer(
				this.output.specs.format || "JPG",
				this.output.specs?.width || 1920,
				this.output.specs?.height || 1080
			);

			try {
				await fs.writeFile(this.tempJobOutputFilePath, thubnailBuffer);
			} catch (err) {}

			return { temp_path: this.tempJobOutputFilePath, message: error.message || "Thumbnail couldn't be processed!" };
		}
	}

	private async processVideoOrAudio(): Promise<any> {
		try {
			const ffmpegArgs: string[] = ["-y", "-i", this.tempJobInputFilePath];

			if (["AUDIO"].includes(this.output.specs.type) && this.job.input?.audio === false) {
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
			if (this.output.specs?.offset) ffmpegArgs.push("-ss", String(this.output.specs.offset));

			// Duration
			if (this.output.specs?.duration) ffmpegArgs.push("-t", String(this.output.specs.duration));

			// Audio codec
			if (this.output.specs?.audio_codec) ffmpegArgs.push("-c:a", this.output.specs.audio_codec);

			// Audio bit rate
			if (this.output.specs?.audio_bit_rate) ffmpegArgs.push("-b:a", this.parseBitRate(this.output.specs.audio_bit_rate));

			// Audio sample rate
			if (this.output.specs?.audio_sample_rate) ffmpegArgs.push("-ar", this.parseSampleRate(this.output.specs.audio_sample_rate));

			// Audio channels
			if (this.output.specs?.audio_channels) ffmpegArgs.push("-ac", String(this.output.specs.audio_channels));

			if (["VIDEO"].includes(this.output.specs.type)) {
				// Video first frame image overlay
				if (this.output.specs?.video_first_frame_image_url) {
					ffmpegArgs.push("-i", this.output.specs.video_first_frame_image_url);
					ffmpegArgs.push(
						"-filter_complex",
						"[0:v]format=yuv420p,drawbox=0:0:iw:ih:black:t=fill:enable='eq(n,0)'[bg];[1:v]scale=w=min(iw\,in_w):h=min(ih\,in_h):force_original_aspect_ratio=decrease[scaled];[bg][scaled]overlay=(W-w)/2:(H-h)/2:enable='eq(n,0)'[v]"
					);
					ffmpegArgs.push("-map", "[v]");
				}

				// Video subtitle burn-in
				if (this.output.specs?.video_subtitle) {
					// ffmpegArgs.push("-vf", "subtitles=subtitle.srt:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFF,Bold=1'");
				}

				// Video codec
				if (this.output.specs?.video_codec) ffmpegArgs.push("-c:v", this.output.specs.video_codec);

				// Video bit rate
				if (this.output.specs?.video_bit_rate) ffmpegArgs.push("-b:v", this.parseBitRate(this.output.specs.video_bit_rate));

				// Video profile
				if (this.output.specs?.video_profile) ffmpegArgs.push("-profile:v", this.output.specs.video_profile);

				// Video level
				if (this.output.specs?.video_level) ffmpegArgs.push("-level", this.output.specs.video_level);

				// Video pixel format
				if (this.output.specs?.video_pixel_format) ffmpegArgs.push("-pix_fmt", this.output.specs.video_pixel_format);

				// Video frame rate
				if (this.output.specs?.video_frame_rate) ffmpegArgs.push("-r", this.parseFrameRate(this.output.specs.video_frame_rate));

				// Deinterlace
				if (this.output.specs?.video_deinterlace) ffmpegArgs.push("-vf", "yadif");

				// Video quality
				if (this.output.specs?.quality !== undefined) ffmpegArgs.push("-q:v", String(this.output.specs.quality));

				// Video filters
				const videoFilters = this.buildVideoFilters();
				if (videoFilters.length > 0) ffmpegArgs.push("-vf", videoFilters.join(","));
			}

			ffmpegArgs.push(this.tempJobOutputFilePath);

			await this.runFfmpeg(ffmpegArgs);

			return {
				temp_path: this.tempJobOutputFilePath,
				duration: this.output.specs?.duration || this.job.input?.duration || 0.0,
				ffmpeg_command: `ffmpeg ${ffmpegArgs.join(" ")}`
			};
		} catch (error: Error | any) {
			throw new Error(`Failed to process job output! ${error.message || ""}!`.trim());
		}
	}

	private buildVideoFilters(): string[] {
		const videoFilters: string[] = [];

		if (this.output.specs?.width && this.output.specs?.height) {
			const fit = (this.output.specs?.fit || "PAD").toUpperCase();

			switch (fit) {
				case "STRETCH":
					videoFilters.push(`scale=${this.output.specs.width}:${this.output.specs.height}`);
					break;
				case "CROP":
					videoFilters.push(
						`scale=${this.output.specs.width}:${this.output.specs.height}:force_original_aspect_ratio=increase,crop=${this.output.specs.width}:${this.output.specs.height}`
					);
					break;
				case "MAX":
					videoFilters.push(
						`scale='min(${this.output.specs.width},iw)':'min(${this.output.specs.height},ih)':force_original_aspect_ratio=decrease`
					);
					break;
				case "PAD":
				default:
					videoFilters.push(
						`scale=${this.output.specs.width}:${this.output.specs.height}:force_original_aspect_ratio=decrease,pad=${this.output.specs.width}:${this.output.specs.height}:(ow-iw)/2:(oh-ih)/2`
					);
					break;
			}
		}

		if (this.output.specs?.rotate) {
			switch (parseInt(this.output.specs.rotate)) {
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

		if (this.output.specs?.flip) {
			switch (this.output.specs.flip.toUpperCase()) {
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
}
