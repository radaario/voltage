import { config } from "@voltage/config";
import { storage } from "@voltage/utils";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
// import { Z_UNKNOWN } from "zlib";

export class JobDownloader {
	private job: any;
	private tempJobDir: string;
	private tempJobInputFilePath: string;

	constructor(job: any) {
		this.job = job;
		this.tempJobDir = path.join(config.temp_dir, "jobs", job.key);
		this.tempJobInputFilePath = path.join(this.tempJobDir, "input");
	}

	async download(): Promise<{ temp_path: string }> {
		try {
			if (!this.job.input) {
				throw new Error("No input specified for job!");
			}

			if (["BASE64"].includes(this.job.input?.type)) {
				return await this.downloadBase64();
			}

			if (["HTTP", "HTTPS"].includes(this.job.input?.type)) {
				return await this.downloadHttp();
			}

			if (!["BASE64", "HTTP", "HTTPS"].includes(this.job.input?.type)) {
				return await this.downloadFromStorage();
			}

			throw new Error(`Unsupported job input type: ${this.job.input?.type || "UNKNOWN"}!`);
		} catch (error: Error | any) {
			throw new Error(`${error.message || "Unknown error!"}`.trim());
			// throw new Error(`Job input couldn't be downloaded! ${error.message || ""}`.trim());
		}
	}

	private async downloadBase64(): Promise<{ temp_path: string }> {
		if (!this.job.input?.content) throw new Error("No base64 content found for job input!");
		const buffer = Buffer.from(this.job.input.content, "base64");
		await fs.writeFile(this.tempJobInputFilePath, buffer);
		return { temp_path: this.tempJobInputFilePath };
	}

	private async downloadHttp(): Promise<{ temp_path: string }> {
		const auth =
			this.job.input?.username && this.job.input?.password
				? {
						username: this.job.input.username,
						password: this.job.input.password
					}
				: undefined;

		const resp = await axios.get<ArrayBuffer>(this.job.input.url, {
			responseType: "arraybuffer",
			auth
		});

		await fs.writeFile(this.tempJobInputFilePath, Buffer.from(resp.data));
		return { temp_path: this.tempJobInputFilePath };
	}

	private async downloadFromStorage(): Promise<{ temp_path: string }> {
		if (!this.job.input?.path) throw new Error("No path specified for job input!");
		await storage.config(this.job.input);
		await storage.download(this.job.input.path, this.tempJobInputFilePath);
		return { temp_path: this.tempJobInputFilePath };
	}
}
