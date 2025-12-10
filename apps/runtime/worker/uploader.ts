import { config } from "@voltage/config";
import { storage, guessContentType } from "@voltage/utils";
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
		this.destination = output.specs?.destination || this.job?.destination;

		if (!this.destination) {
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
			].includes(this.destination.type)
		) {
			throw new Error(`Job output destination type is unsupported: ${this.destination.type}!`);
		}

		this.tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		this.tempJobOutputFilePath = path.join(this.tempJobDir, `output.${output.index}.${(output.specs?.format || "MP4").toLowerCase()}`);
	}

	async upload(): Promise<Record<string, unknown>> {
		try {
			// DESTINATION: TYPE: HTTP & HTTPS
			if (["HTTP", "HTTPS"].includes(this.destination.type)) {
				return await this.uploadHttp();
			}

			// DESTINATION: TYPE: OTHERs
			return await this.uploadToStorage();
		} catch (error: Error | any) {
			throw new Error(`Failed to upload job output! ${error.message || ""}`.trim());
			// return { ...error || { message: 'Failed to upload job output!' } };
		}
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
		if (!this.output.specs?.path) {
			throw new Error("Path is required in output.specs for remote upload destinations!");
		}

		// Initialize storage based on destination
		const key = String(this.output.specs.path).replace(/^\/+/, "");
		const contentType = guessContentType(key);
		const acl = this.output.specs?.acl || this.output.specs?.destination?.acl || this.destination?.acl || null;
		const expires = this.output.specs?.expires || this.output.specs?.destination?.expires || this.destination?.expires || null;
		const cacheControl =
			this.output.specs?.cache_control || this.output.specs?.destination?.cache_control || this.destination?.cache_control || null;

		await storage.config(this.destination);
		await storage.upload(this.tempJobOutputFilePath, key, contentType, acl, expires, cacheControl);

		// Build a result similar to previous S3 uploader
		const location = (this.destination as any).bucket ? `s3://${(this.destination as any).bucket}/${key}` : key;
		const url = storage.getPublicUrl(key) || null;

		return { path: `/${key}`, location, url };
	}
}
