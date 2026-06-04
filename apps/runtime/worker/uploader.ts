import { config as appConfig } from "@voltage/core/config";
import { HTTPS_TYPES, STORAGE_S3_LIKE_TYPES, STORAGE_FTP_TYPES } from "@voltage/core/constants";
import { StorageFacade, guessContentType } from "@voltage/utils";

import path from "path";
import fs from "fs/promises";
import axios from "axios";

export class JobUploader {
	private job: any;
	private output: any;
	private destination: any;

	private tempJobDir: string;
	private tempJobOutputFilePath: string;

	constructor(job: any, output: any) {
		this.job = job;
		this.output = output;

		// Use output's destination if available, otherwise fall back to global destination
		this.destination = { ...this.job?.destination, ...this.output?.destination };

		if (!this.destination) {
			throw new Error("No destination specified for job output!");
		}

		// OUTPUT: TYPE: CHECK
		if (!["LOCAL", ...HTTPS_TYPES, ...STORAGE_S3_LIKE_TYPES, ...STORAGE_FTP_TYPES].includes(this.destination.type.toUpperCase())) {
			throw new Error(`Job output destination type is unsupported: ${this.destination.type.toUpperCase()}!`);
		}

		this.tempJobDir = path.join(appConfig.temp_dir, "jobs", job.key);
		this.tempJobOutputFilePath = path.join(this.tempJobDir, `output.${output.index}.${(output.config?.format || "MP4").toLowerCase()}`);
	}

	async upload(): Promise<Record<string, unknown>> {
		const maxRetries = 3;
		const baseDelay = 2000; // 2 seconds

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				// DESTINATION: TYPE: HTTP & HTTPS
				if (HTTPS_TYPES.includes(this.destination.type.toUpperCase())) {
					return await this.uploadHttp();
				}

				return await this.uploadToStorage();
			} catch (error: Error | any) {
				const isRetryable = this.isRetryableError(error);

				if (attempt === maxRetries || !isRetryable) {
					throw new Error(`Failed to upload job output! ${error.message || ""}`.trim());
				}

				const delay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw new Error("Failed to upload job output!");
	}

	private isRetryableError(error: Error | any): boolean {
		const retryableNames = ["InternalError", "ServiceUnavailable", "SlowDown", "RequestTimeout"];
		if (retryableNames.includes(error?.name)) return true;

		const status = error?.response?.status || error?.$metadata?.httpStatusCode;
		if (status && (status >= 500 || status === 429)) return true;

		const msg = (error?.message || "").toLowerCase();
		if (msg.includes("internal") || msg.includes("timeout") || msg.includes("econnreset")) return true;

		return false;
	}

	private async uploadHttp(): Promise<Record<string, unknown>> {
		if (!this.destination.url) {
			throw new Error("No destination specified for job output!");
		}

		const resp = await axios.request({
			url: this.destination.url,
			method: this.destination.method ?? "POST",
			headers: { "Content-Type": "application/octet-stream", ...(this.destination.headers ?? {}) },
			data: await fs.readFile(this.tempJobOutputFilePath)
		});

		/*
		const contentType = resp.headers["content-type"] || "";

		let body;

		if (["text/plain", "text/html", "application/json"].includes(contentType)) {
			body = resp.data;
		}

		return { status: resp.status, headers: resp.headers, body };
		*/

		return { status: resp.status, headers: resp.headers };
	}

	private async uploadToStorage(): Promise<Record<string, unknown>> {
		let jobOutputDestination = {
			...appConfig.storage,
			path: `jobs/${this.job.key}/${this.output.key}.${(this.output.config?.format || "MP4").toLowerCase()}`
		};

		if ([...STORAGE_S3_LIKE_TYPES, ...STORAGE_FTP_TYPES].includes(this.destination.type.toUpperCase())) {
			if (!this.destination?.path) {
				throw new Error("Path is required in output.config for remote upload destinations!");
			}

			jobOutputDestination = this.destination;
		}

		// Initialize storage based on destination
		const key = String(jobOutputDestination.path).replace(/^\/+/, "");
		const contentType = guessContentType(key);
		const acl = jobOutputDestination?.acl || undefined;
		const expires_in = jobOutputDestination?.expires_in || undefined;
		const cacheControl = jobOutputDestination?.cache_control || undefined;

		const storage = new StorageFacade();
		await storage.config(jobOutputDestination);
		await storage.upload(this.tempJobOutputFilePath, key, contentType, acl, expires_in, cacheControl);

		// Build a result similar to previous S3 uploader
		let location = key;
		let url = null;

		if (STORAGE_S3_LIKE_TYPES.includes(jobOutputDestination.type as any)) {
			location = `s3://${(jobOutputDestination as any).bucket}${(jobOutputDestination as any).base_path ? (jobOutputDestination as any).base_path : "/"}${key}`;
			url = storage.getPublicUrl(key) || null;
		} else if (STORAGE_FTP_TYPES.includes(jobOutputDestination.type as any)) {
			const storageUrl = jobOutputDestination.public_url_base
				? jobOutputDestination.public_url_base
				: `https://${jobOutputDestination.host}`;

			location = `ftp://${jobOutputDestination.host}:${(jobOutputDestination as any).port}${(jobOutputDestination as any).base_path ? (jobOutputDestination as any).base_path : "/"}${jobOutputDestination.path}`;
			url = `${storageUrl}${jobOutputDestination.base_path ? jobOutputDestination.base_path : "/"}${jobOutputDestination.path}`;
		} else if (jobOutputDestination.type === "LOCAL") {
			location = path.resolve(key);
			url = `${appConfig.url}/storage/jobs/${key}`;
		}

		return { path: `/${key}`, location, url };
	}
}
