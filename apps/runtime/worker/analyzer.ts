import { config as appConfig } from "@voltage/core";
import { guessContentType } from "@voltage/utils";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

const constantInfoProps = {
	duration: {
		type: "INTEGER",
		name: "duration"
	},
	width: {
		type: "INTEGER",
		name: "width"
	},
	height: {
		type: "INTEGER",
		name: "height"
	},
	coded_width: {
		type: "INTEGER",
		name: "width_coded"
	},
	coded_height: {
		type: "INTEGER",
		name: "height_coded"
	},
	nb_frames: {
		type: "INTEGER",
		name: "frames_count"
	},
	r_frame_rate: {
		type: "FRAME_RATE",
		name: "frame_rate"
	},
	avg_frame_rate: {
		type: "FRAME_RATE",
		name: "frame_rate_average"
	},
	codec_type: {
		type: "STRING_UPPERCASE",
		name: "type"
	},
	codec_name: {
		type: "STRING",
		name: "codec"
	},
	bit_rate: {
		type: "INTEGER",
		name: "bit_rate"
	},
	has_b_frames: {
		type: "INTEGER",
		name: "has_b_frames"
	},
	pix_fmt: {
		type: "STRING",
		name: "pixel_format"
	},
	chroma_location: {
		type: "STRING",
		name: "chroma_location"
	},
	channels: {
		type: "INTEGER",
		name: "channels"
	},
	channel_layout: {
		type: "STRING",
		name: "channel_layout"
	},
	sample_rate: {
		type: "INTEGER",
		name: "sample_rate"
	}
};

export class JobAnalyzer {
	private job: any;
	private tempJobDir: string;
	private tempJobInputFilePath: string;

	constructor(job: any) {
		this.job = job;
		this.tempJobDir = path.join(appConfig.temp_dir, "jobs", job.key);
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
			const metadata = {
				file_name: fileName || null,
				file_extension: fileExtension || null,
				file_mime_type: fileMimeType || null,
				file_size: fileStats.size || null,
				...this.parseData(ffprobeData)
			};

			return metadata;
		} catch (error: Error | any) {
			throw new Error(`${error.message || "Unknown error!"}`.trim());
			// throw new Error(`Job input couldn't be analyzed! ${error.message || ""}`.trim());
		}
	}

	private async runFfprobe(): Promise<any> {
		return new Promise((resolve, reject) => {
			const ffprobeArgs = ["-v", "quiet"];

			ffprobeArgs.push("-print_format", "json");

			let ffprobeProps = "";

			if (appConfig.utils.ffprobe.general_attributes) {
				ffprobeProps = `format=${appConfig.utils.ffprobe.general_attributes.toLocaleLowerCase()}`;
			}

			if (appConfig.utils.ffprobe.video_attributes || appConfig.utils.ffprobe.audio_attributes) {
				const commonProps = ["codec_type"];

				const videoProps = String(appConfig.utils.ffprobe.video_attributes)
					.split(",")
					.map((p) => this.convertProp(p));

				const audioProps = String(appConfig.utils.ffprobe.audio_attributes)
					.split(",")
					.map((p) => this.convertProp(p));

				const streamsProps = [...new Set([...commonProps, ...videoProps, ...audioProps])].filter((p) => p.trim() !== "");

				ffprobeProps = ffprobeProps ? ffprobeProps + ":" + `stream=${streamsProps.join(",").toLocaleLowerCase()}` : "";
			}

			if (ffprobeProps) ffprobeArgs.push("-show_entries", ffprobeProps);

			if (!appConfig.utils.ffprobe.general_attributes) {
				ffprobeArgs.push("-show_format");
			}

			if (!appConfig.utils.ffprobe.video_attributes && !appConfig.utils.ffprobe.audio_attributes) {
				ffprobeArgs.push("-show_streams");
			}

			ffprobeArgs.push(this.tempJobInputFilePath);

			const ffprobe = spawn(appConfig.utils.ffprobe.path, ffprobeArgs, { stdio: ["ignore", "pipe", "pipe"] });

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
								`Failed to parse FFProbe output: ${error.message}! Command: ffprobe ${ffprobeArgs.join(" ")}; Stderr: ${stderr}`
							)
						);
					}
				} else {
					reject(new Error(`FFProbe failed with code ${code}! Command: ffprobe ${ffprobeArgs.join(" ")}; Stderr: ${stderr}`));
				}
			});

			ffprobe.on("error", (error: Error | any) => {
				reject(new Error(`Failed to start FFProbe: ${error.message}`));
			});
		});
	}

	private parseData(data: any): any {
		const format = data.format || {};
		const streams = data.streams || [];

		// VIDEO & AUDIO: STREAMs: FIND
		const videoStream = streams.find((s: any) => s.codec_type === "video");
		const audioStream = streams.find((s: any) => s.codec_type === "audio");

		/* VIDEO: INFO: PARSE */
		let videoInfo = { video: false } as any;

		if (videoStream) {
			videoInfo = {
				video: true,
				...this.parseInfo(videoStream, "video")
			};
		}

		/* AUDIO: INFO: PARSE */
		let audioInfo = { audio: false } as any;

		if (audioStream) {
			audioInfo = {
				audio: true,
				...this.parseInfo(audioStream, "audio")
			};
		}

		return {
			...this.parseInfo(format),
			...videoInfo,
			...audioInfo
		};
	}

	private parseInfo(data: any, prefix: string = ""): any {
		const _data: any = {};

		for (const prop_key in data) {
			const prop_value: any = data[prop_key];

			if (prop_value === null || prop_value === undefined) {
				continue;
			}

			if (constantInfoProps.hasOwnProperty(prop_key)) {
				const constant = (constantInfoProps as any)[prop_key];

				if (constant.type === "INTEGER") {
					_data[`${prefix ? prefix + "_" : ""}${constant.name}`] = parseInt(prop_value);
				} else if (constant.type === "FRAME_RATE") {
					_data[`${prefix ? prefix + "_" : ""}${constant.name}`] =
						parseFloat(prop_value?.split("/")[0] || "0") / parseFloat(prop_value?.split("/")[1] || "1");
				} else if (constant.type === "STRING_UPPERCASE") {
					_data[`${prefix ? prefix + "_" : ""}${constant.name}`] = String(prop_value).toUpperCase();
				} else if (constant.type === "STRING") {
					_data[`${prefix ? prefix + "_" : ""}${constant.name}`] = String(prop_value);
				}
			} else {
				_data[`${prefix ? prefix + "_" : ""}${prop_key.toLocaleLowerCase()}`] = prop_value;
			}
		}

		// duration
		const durationKey = prefix ? `${prefix}_duration` : "duration";
		if (_data[durationKey]) {
			_data[`${prefix ? prefix + "_" : ""}duration_in_ts`] = Math.round(_data[durationKey] * 1000000);
		}

		// aspect ratio
		const widthKey = prefix ? `${prefix}_width` : "width";
		const heightKey = prefix ? `${prefix}_height` : "height";
		if (_data[widthKey] && _data[heightKey]) {
			const videoAspectRatioDecimal = _data[widthKey] / _data[heightKey];
			_data[`${prefix ? prefix + "_" : ""}aspect_ratio`] = this.getAspectRatio(videoAspectRatioDecimal);
			_data[`${prefix ? prefix + "_" : ""}aspect_ratio_in_decimal`] = videoAspectRatioDecimal;
		}

		// clean up
		delete _data.video_type;
		delete _data.audio_type;

		return _data;
	}

	private convertProp(key: string): string {
		key = key.toLocaleLowerCase();

		const constantProps = {
			bitrate: "bit_rate",
			framerate: "r_frame_rate",
			frame_rate: "r_frame_rate",
			frame_rate_avg: "avg_frame_rate",
			frame_rate_average: "avg_frame_rate",
			codec: "codec_name",
			type: "codec_type",
			pixel_format: "pix_fmt",
			samplerate: "sample_rate",
			width_coded: "coded_width",
			height_coded: "coded_height",
			frames: "nb_frames",
			frame_count: "nb_frames"
		};

		if (constantProps.hasOwnProperty(key)) {
			key = (constantProps as any)[key];
		}

		return key;
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
