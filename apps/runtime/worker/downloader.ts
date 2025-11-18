import { config } from "@voltage/config";
import { logger } from "@voltage/utils/logger";
import { storage } from "@voltage/utils/storage";

import path from "path";
import fs from "fs/promises";
import axios from "axios";

export async function downloadInput(job: any): Promise<string> {
	try {
		logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

		const tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		const tempJobInputFilePath = path.join(tempJobDir, "input");

		logger.console("INFO", "Downloading job input file...");

		if (["BASE64"].includes(job.input.type)) {
			const buffer = Buffer.from(job.input.content, "base64");

			await fs.writeFile(tempJobInputFilePath, buffer);

			logger.console("INFO", "Job input file successfully downloaded!");
			return tempJobInputFilePath;
		}

		if (["HTTP", "HTTPS"].includes(job.input.type)) {
			const auth =
				job.input.username && job.input.password
					? {
							username: job.input.username,
							password: job.input.password
						}
					: undefined;

			const resp = await axios.get<ArrayBuffer>(job.input.url, {
				responseType: "arraybuffer",
				auth
			});

			await fs.writeFile(tempJobInputFilePath, Buffer.from(resp.data));

			logger.console("INFO", "Job input file successfully downloaded!");
			return tempJobInputFilePath;
		}

		if (!["BASE64", "HTTP", "HTTPS"].includes(job.input.type)) {
			await storage.config(job.input);
			await storage.download(job.input.path, tempJobInputFilePath);

			logger.console("INFO", "Job input file successfully downloaded!");
			return tempJobInputFilePath;
		}

		throw new Error(`Unsupported input type: ${job.input.type}!`);
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Job input file couldn't be downloaded!", { error });
		throw new Error(`Job input file couldn\'t be downloaded! ${error.message || ""}`.trim());
	}
}
