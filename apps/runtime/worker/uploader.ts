import { config } from "@voltage/config";
import { DestinationSpecs } from "@voltage/config/types";

import { guessContentType } from "@voltage/utils";
// import { logger } from "@voltage/utils/logger";
import { storage } from "@voltage/utils/storage";

import path from "path";
import fs from "fs/promises";

import axios from "axios";

export async function uploadOutput(job: any, output: any): Promise<Record<string, unknown>> {
	try {
		// logger.setMetadata({ instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

		const tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		const tempJobOutputFilePath = path.join(tempJobDir, `output.${output.index}.${(output.specs.format || "mp4").toLowerCase()}`);

		// Use output's destination if available, otherwise fall back to global destination
		const destination = output?.specs?.destination || job?.destination;

		if (!destination) {
			throw new Error("No destination specified for job output!");
		}

		// OUTPUT: TYPE: CHECK
		if (
			![
				"HTTP",
				"HTTPS",
				"AWS_S3",
				"GOOGLE_CLOUD_STORAGE",
				"DO_SPACES",
				"LINODE",
				"WASABI",
				"BACKBLAZE",
				"RACKSPACE",
				"MICROSOFT_AZURE",
				"OTHER_S3",
				"FTP",
				"SFTP"
			].includes(destination.type)
		) {
			throw new Error(`Job output destination type is unsupported: ${destination.type}!`);
		}

		// DESTINATION: TYPE: HTTP & HTTPS
		if (["HTTP", "HTTPS"].includes(destination.type)) {
			if (!destination.url) {
				throw new Error("No destination specified for job output!");
			}

			const resp = await axios.request({
				url: destination.url,
				method: destination.method ?? "POST",
				headers: { "Content-Type": "application/octet-stream", ...(destination.headers ?? {}) },
				data: await fs.readFile(tempJobOutputFilePath)
			});

			return { status: resp.status, headers: resp.headers, body: resp.data };
		}

		// DESTINATION: TYPE: OTHERs
		if (!output?.specs?.path) {
			throw new Error("Path is required in output.specs for remote upload destinations!");
		}

		// Initialize storage based on destination
		const key = String(output.specs.path).replace(/^\/+/, "");
		const contentType = guessContentType(key);

		await storage.config(destination);
		await storage.upload(tempJobOutputFilePath, key, contentType);

		// Build a result similar to previous S3 uploader
		const location = (destination as any).bucket ? `s3://${(destination as any).bucket}/${key}` : key;
		const url = storage.getPublicUrl(key) || null;

		/*
		logger.console("INFO", "Job output uploaded!", {
			output_key: output.key,
			output_index: output.index,
			destinationType: destination.type,
			bucket: (destination as any).bucket,
			path: key,
			url
		});
		*/

		return { path: `/${key}`, location, url };
	} catch (error: Error | any) {
		// await logger.insert("ERROR", "Failed to upload job output!", { output_key: output.key, output_index: output.index, error });
		throw new Error(`Failed to upload job output! ${error.message || ""}`.trim());
		// return { ...error || { message: 'Failed to upload job output!' } };
	}
}
