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

			const tempJobOutputFilePath = path.join(
				this.tempJobDir,
				`output.${output.index}.${(output.specs.format || "mp4").toLowerCase()}`
			);

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
		if (!this.job.input.audio) {
			// storage.write(tempJobOutputFilePath, "There is no sound in the input file!");
			return { temp_path: tempJobOutputFilePath, message: "There is no sound in the input file!" };
		}

		const jobInputAudioFilePath = path.join(this.tempJobDir, "audio.wav");

		// Convert input to WAV
		const wavArgs = ["-y", "-i", this.tempJobInputFilePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", jobInputAudioFilePath];

		try {
			await new Promise<void>((resolve, reject) => {
				let stderrData = "";

				const proc = spawn(config.utils.ffmpeg.path, wavArgs, { stdio: ["ignore", "pipe", "pipe"] }); // inherit || ignore

				proc.stderr.on("data", (chunk) => {
					stderrData += chunk.toString();
				});

				proc.on("error", reject);

				proc.on("exit", (code) => {
					if (code === 0) resolve();
					else
						reject(
							new Error(
								`FFmpeg WAV conversion exited with code ${code}! Command: ffmpeg ${wavArgs.join(" ")}; Stderr: ${stderrData}`
							)
						);
				});
			});

			// Generate subtitles using whisper-node
			const { nodewhisper } = await import("nodejs-whisper"); /* ! */

			const outputFormat = (output.specs.format || "srt").toLowerCase();
			const modelName = (output.specs.whisper_model || config.utils.whisper.model || "BASE")
				.toLowerCase()
				.replace("_en", ".en")
				.replace("_", "-");

			await nodewhisper(path.resolve(jobInputAudioFilePath), {
				modelName: modelName,
				autoDownloadModelName: modelName,
				// removeWavFileAfterTranscription: true,
				withCuda: output.specs.whisper_cuda || config.utils.whisper.cuda || false,
				// logger: null,
				whisperOptions: {
					outputInSrt: outputFormat === "srt",
					outputInVtt: outputFormat === "vtt",
					outputInCsv: outputFormat === "csv",
					outputInJson: outputFormat === "json",
					outputInText: outputFormat === "txt",
					// translateToEnglish: output.specs.translate || false,
					language: (output.specs.language || "auto").toLowerCase(),
					wordTimestamps: false,
					timestamps_length: 20,
					splitOnWord: true
				}
			});

			try {
				// Move generated subtitle file to output path
				await fs.rename(path.join(this.tempJobDir, `audio.wav.${outputFormat}`), tempJobOutputFilePath);
			} catch (error: Error | any) {
				throw new Error(
					`Failed to move generated subtitle file! ${path.join(this.tempJobDir, `audio.wav.${outputFormat}`)} to ${tempJobOutputFilePath}. ${error.message || ""}`.trim()
				);
			}

			// logger.console("INFO", "Subtitle generated!", { output_key: output.key, output_index: output.index });

			return { temp_path: tempJobOutputFilePath, ffmpeg_args: wavArgs };
		} catch (error: Error | any) {
			// await logger.insert("ERROR", "Failed to generate subtitle!", { output_key: output.key, output_index: output.index, ...error });
			throw new Error(
				`Failed to generate subtitle! ${error.message || "Unknown error occurred!"}. ffmpeg_args: ${wavArgs.join(" ")}`.trim()
			);
			// return { message: error.message || "Failed to process job output!" };
		}
	}

	private async processThumbnail(output: any, tempJobOutputFilePath: string): Promise<any> {
		if (!this.job.input.video) {
			const thubnailBuffer = await this.createBlackImageBuffer(
				output.specs.format || "JPG",
				output.specs.width || 1920,
				output.specs.height || 1080
			);

			try {
				await fs.writeFile(tempJobOutputFilePath, thubnailBuffer);
			} catch (err) {}

			return { temp_path: tempJobOutputFilePath, message: "There is no video in the input file!" };
		}

		const args: string[] = ["-y", "-i", this.tempJobInputFilePath];

		if (output.specs.duration > this.job.input.duration) {
			output.specs.duration = this.job.input.duration;
		}

		if (!output.specs.duration && this.job.input.duration) {
			output.specs.duration = this.job.input.duration - (output.specs.offset || 0);
		}

		if (output.specs.offset) {
			args.push("-ss", String(output.specs.offset));
		}

		if (output.specs.duration) args.push("-t", String(output.specs.duration));

		args.push("-quality", String(output.specs.quality || 75));
		args.push("-vframes", "1");

		// Video filters for thumbnail
		const videoFilters = this.buildVideoFilters(output);
		if (videoFilters.length > 0) {
			args.push("-vf", videoFilters.join(","));
		}

		args.push(tempJobOutputFilePath);

		await this.runFfmpeg(args);

		// logger.console("INFO", "Job output processed!", { output_key: output.key, output_index: output.index });

		return { temp_path: tempJobOutputFilePath, duration: output.specs.duration || this.job.input.duration || 0.0, ffmpeg_args: args };
	}

	private async processVideoOrAudio(output: any, tempJobOutputFilePath: string): Promise<any> {
		const args: string[] = ["-y", "-i", this.tempJobInputFilePath];

		if (["AUDIO"].includes(output.specs.type)) {
			// args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-map", "0:a?", "-map", "1:a");
			args.push(
				"-f",
				"lavfi",
				"-i",
				"anullsrc=channel_layout=stereo:sample_rate=44100",
				"-filter_complex",
				"[0:a][1:a]amix=inputs=2:duration=longest"
			);
		}

		if (output.specs.duration > this.job.input.duration) {
			output.specs.duration = this.job.input.duration;
		}

		if (!output.specs.duration && this.job.input.duration) {
			output.specs.duration = this.job.input.duration - (output.specs.offset || 0);
		}

		if (output.specs.offset) {
			args.push("-ss", String(output.specs.offset));
		}

		if (output.specs.duration) args.push("-t", String(output.specs.duration));

		// Audio codec and settings
		if (this.job.input.audio) {
			if (output.specs.audio_codec) args.push("-c:a", output.specs.audio_codec);
			if (output.specs.audio_bitrate) args.push("-b:a", output.specs.audio_bitrate);
			if (output.specs.audio_sample_rate) args.push("-ar", String(output.specs.audio_sample_rate));
			if (output.specs.audio_channels) args.push("-ac", String(output.specs.audio_channels));
		}

		if (["VIDEO"].includes(output.specs.type) && this.job.input.video) {
			// Video first frame
			if (output.specs.video_first_frame_image_url) {
				args.push("-i", output.specs.video_first_frame_image_url);
				args.push(
					"-filter_complex",
					"[0:v]format=yuv420p,drawbox=0:0:iw:ih:black:t=fill:enable='eq(n,0)'[bg];[1:v]scale=w=min(iw\,in_w):h=min(ih\,in_h):force_original_aspect_ratio=decrease[scaled];[bg][scaled]overlay=(W-w)/2:(H-h)/2:enable='eq(n,0)'[v]"
				);
				args.push("-map", "[v]");
			}

			// Video subtitle burn-in
			if (output.specs.video_subtitle) {
				// args.push("-vf", "subtitles=subtitle.srt:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFF,Bold=1'");
			}

			// Video codec and bitrate
			if (output.specs.video_codec) args.push("-c:v", output.specs.video_codec);
			if (output.specs.video_bitrate) args.push("-b:v", output.specs.video_bitrate);

			// Video profile and level
			if (output.specs.video_vprofile) args.push("-profile:v", output.specs.video_vprofile);
			if (output.specs.video_level) args.push("-level", output.specs.video_level);

			// Video pixel format
			if (output.specs.video_pix_fmt) args.push("-pix_fmt", output.specs.video_pix_fmt);

			// Video frame rate
			if (output.specs.video_fps) args.push("-r", String(output.specs.video_fps));

			// Deinterlace
			if (output.specs.video_deinterlace) args.push("-vf", "yadif");

			if (output.specs.quality !== undefined) {
				args.push("-q:v", String(output.specs.quality));
			}

			// Video filters
			const videoFilters = this.buildVideoFilters(output);
			if (videoFilters.length > 0) {
				args.push("-vf", videoFilters.join(","));
			}
		}

		args.push(tempJobOutputFilePath);

		await this.runFfmpeg(args);

		// logger.console("INFO", "Job output processed!", { output_key: output.key, output_index: output.index });

		return { temp_path: tempJobOutputFilePath, duration: output.specs.duration || this.job.input.duration || 0.0, ffmpeg_args: args };
	}

	private buildVideoFilters(output: any): string[] {
		const videoFilters: string[] = [];

		if (output.specs.width && output.specs.height) {
			const fit = output.specs.fit || "PAD";
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

		if (output.specs.rotate) {
			switch (output.specs.rotate) {
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

		if (output.specs.flip) {
			switch (output.specs.flip) {
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
