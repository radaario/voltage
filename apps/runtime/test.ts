import * as tf from "@tensorflow/tfjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// @ts-ignore - ESM import issues
const Jimp = require("jimp");
// @ts-ignore - nsfwjs has module resolution issues with ESM
const nsfwjs = require("nsfwjs");

export async function classifyImage(path: string) {
	// Jimp ile resmi yükle
	const image = await Jimp.Jimp.read(path);
	const { width, height } = image.bitmap;

	// Bitmap data'yı tensöre çevir
	const imageData = new Uint8Array(width * height * 3);
	let offset = 0;

	image.scan(0, 0, width, height, (_x: number, _y: number, idx: number) => {
		imageData[offset++] = image.bitmap.data[idx + 0]; // R
		imageData[offset++] = image.bitmap.data[idx + 1]; // G
		imageData[offset++] = image.bitmap.data[idx + 2]; // B
	});

	const imageTensor = tf.tensor3d(imageData, [height, width, 3]);

	const model = await nsfwjs.load();
	const predictions = await model.classify(imageTensor);

	imageTensor.dispose();
	return predictions;
} // Test
(async () => {
	const results = await classifyImage("./test.jpg");
	console.log(results);
})();
