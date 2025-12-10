import { config } from "@voltage/config";
import * as tf from "@tensorflow/tfjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Jimp = require("jimp");
const nsfwjs = require("nsfwjs");

interface NSFWConfig {
	nsfw_is_disabled?: boolean;
	nsfw_model?: string;
	nsfw_size?: number;
	nsfw_type?: string;
	nsfw_threshold?: number;
}

interface NSFWResult {
	nsfw: boolean;
	classification: Record<string, number>;
}

const NSFW_MODELS = {
	MOBILE_NET_V2_MID: "MobileNetV2Mid",
	MOBILE_NET_V2: "MobileNetV2",
	INCEPTION_V3: "InceptionV3"
};

export class NSFWDetector {
	private config: NSFWConfig;

	constructor(config: NSFWConfig) {
		this.config = config;
	}

	async analyze(imagePath: string): Promise<NSFWResult | null> {
		const nsfwIsDisabled = this.config.nsfw_is_disabled || config.utils.nsfw.is_disabled;

		if (nsfwIsDisabled) {
			return null;
		}

		try {
			const modelName = this.config.nsfw_model || config.utils.nsfw.model;
			const size = this.config.nsfw_size || config.utils.nsfw.size || 299;
			const type = this.config.nsfw_type || config.utils.nsfw.type || "GRAPH";
			const threshold = this.config.nsfw_threshold || config.utils.nsfw.threshold || 0.7;

			// Select model
			let model = NSFW_MODELS.MOBILE_NET_V2_MID;
			if (modelName && Object.keys(NSFW_MODELS).includes(modelName.toUpperCase())) {
				model = NSFW_MODELS[modelName.toUpperCase() as keyof typeof NSFW_MODELS];
			}

			// Load NSFW model
			const nsfwModel = await nsfwjs.load(model, {
				size,
				type: type.toLowerCase()
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
}
