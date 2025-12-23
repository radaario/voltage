import { config as appConfig } from "@voltage/core/config";
import { NSFW_MODELS, NSFW_TYPES } from "@voltage/core/constants";

import * as tf from "@tensorflow/tfjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");
const nsfwjs = require("nsfwjs");

interface NSFWResult {
	nsfw: boolean;
	classification: Record<string, number>;
}

export class NSFWDetector {
	private job: any;

	constructor(job: any) {
		this.job = job;
	}

	async analyze(imagePath: string): Promise<NSFWResult | null> {
		if (!imagePath) return null;

		try {
			let model = appConfig.utils.nsfw.model || "MOBILE_NET_V2";
			if (this.job.config?.nsfw_model && NSFW_MODELS.includes(this.job.config.nsfw_model.toUpperCase() as any)) {
				model = this.job.config.nsfw_model.toUpperCase();
			}

			const size = this.job.config.nsfw_size || appConfig.utils.nsfw.size || 224;

			let type = appConfig.utils.nsfw.type || "GRAPH";
			if (this.job.config?.nsfw_type && NSFW_TYPES.includes(this.job.config.nsfw_type.toUpperCase() as any)) {
				type = this.job.config.nsfw_type.toUpperCase();
			}

			const threshold = (this.job.config.nsfw_threshold || appConfig.utils.nsfw.threshold || 70) / 100;

			// Load NSFW model
			const nsfwModel = await nsfwjs.load(this.sanitizeModel(model), {
				size,
				type: this.sanitizeType(type)
			});

			// Process image
			const image = await Jimp.Jimp.read(imagePath);
			const { width, height } = image.bitmap;

			// Convert bitmap data to tensor
			const imageData = new Uint8Array(width * height * 3);
			let offset = 0;

			image.scan(0, 0, width, height, (_x: number, _y: number, idx: number) => {
				imageData[offset++] = image.bitmap.data[idx + 0]; // R
				imageData[offset++] = image.bitmap.data[idx + 1]; // G
				imageData[offset++] = image.bitmap.data[idx + 2]; // B
			});

			const imageTensor = tf.tensor3d(imageData, [height, width, 3]);
			const predictions = await nsfwModel.classify(imageTensor);

			const result: NSFWResult = {
				nsfw: false,
				classification: {}
			};

			if (predictions) {
				result.classification = predictions.reduce(
					(acc: Record<string, number>, item: any) => {
						acc[item.className.toUpperCase()] = item.probability;
						return acc;
					},
					{} as Record<string, number>
				);

				if (result.classification.HENTAI >= threshold || result.classification.PORN >= threshold) {
					result.nsfw = true;
				}
			}

			// Cleanup
			imageTensor.dispose();

			return result;
		} catch (error: Error | any) {
			throw new Error(`${error.message || "Unknown error!"}`.trim());
			// throw new Error(`NSFW analysis for job input failed! ${error.message || ""}`.trim());
			// return null;
		}
	}

	private sanitizeModel(model: string): string {
		switch (model.toUpperCase()) {
			case "MOBILE_NET_V2_MID":
				return "MobileNetV2Mid";
			case "INCEPTION_V3":
				return "InceptionV3";
			default:
				return "MobileNetV2";
		}
	}

	private sanitizeType(type: string): string {
		switch (type.toUpperCase()) {
			case "LITE":
				return "lite";
			default:
				return "graph";
		}
	}
}
