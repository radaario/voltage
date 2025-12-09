import { guessContentType } from "./index";
import { logger } from "./logger";

import fs from "fs/promises";
import fssync from "fs";
import path from "path";

import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
	CopyObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	ObjectCannedACL
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Client as FTPClient } from "basic-ftp";
import SFTPClient from "ssh2-sftp-client";

export type StorageType =
	| "LOCAL"
	| "OTHER_S3"
	| "AWS_S3"
	| "GOOGLE_CLOUD_STORAGE"
	| "DO_SPACES"
	| "LINODE"
	| "WASABI"
	| "BACKBLAZE"
	| "RACKSPACE"
	| "MICROSOFT_AZURE"
	| "FTP"
	| "SFTP";

export interface StorageConfigOptions {
	type?: StorageType;
	// Common
	endpoint?: string; // custom S3-compatible endpoint
	access_key?: string;
	access_secret?: string;
	region?: string; // required for most S3 providers
	bucket?: string; // required for non-LOCAL
	base_path?: string; // LOCAL base folder or FTP/SFTP remote path prefix
	force_path_style?: boolean; // path-style URLs for some providers
	public_url_base?: string; // base for public URL construction (optional override)
	// FTP/SFTP specific
	host?: string; // FTP/SFTP server hostname
	port?: number; // FTP/SFTP server port (21 for FTP, 22 for SFTP by default)
	username?: string; // FTP/SFTP username
	password?: string; // FTP/SFTP password
	secure?: boolean; // Use FTPS (explicit TLS) for FTP
}

export interface ObjectMetadata {
	size?: number;
	contentType?: string | null;
	lastModified?: Date | null;
	etag?: string | null;
	raw?: any;
}

export interface StorageDriver {
	config(options?: StorageConfigOptions): Promise<void>;
	list(prefix?: string): Promise<string[]>; // returns object keys relative to root/base
	exists(key: string): Promise<boolean>;
	read(key: string): Promise<Buffer>;
	write(key: string, data: Buffer | string, contentType?: string, acl?: string, expires?: string, cacheControl?: string): Promise<void>;
	upload(localFilePath: string, key: string, contentType?: string, acl?: string, expires?: string, cacheControl?: string): Promise<void>;
	download(key: string, localFilePath: string): Promise<void>;
	copy(srcKey: string, destKey: string): Promise<void>;
	move(srcKey: string, destKey: string): Promise<void>;
	delete(keyOrPrefix: string): Promise<void>; // if endsWith('/') treat as prefix
	getPublicUrl(key: string): string | null;
	generateSignedUrl(key: string, opts?: { operation?: "get" | "put"; expiresInSeconds?: number; contentType?: string }): Promise<string>;
	getMetadata(key: string): Promise<ObjectMetadata>;
}

// Utility: ensure directory exists
async function ensureDir(dirPath: string) {
	await fs.mkdir(dirPath, { recursive: true });
}

function normalizePath(key: string): string {
	return key.replace(/^\/+/, "");
}

class LocalStorageDriver implements StorageDriver {
	private basePath!: string;

	async config(options?: StorageConfigOptions): Promise<void> {
		this.basePath = options?.base_path ? normalizePath(options?.base_path) : path.resolve("./storage");
		await ensureDir(this.basePath);
		logger.console("INFO", "Local storage initialized!", { basePath: this.basePath });
	}

	// Prefix provided key with configured basePath (if any)
	private withBasePath(key: string): string {
		const k = normalizePath(key);
		if (!this.basePath) return k;
		return `${this.basePath}/${k}`;
	}

	// Remove basePath prefix from a full S3 key for returning keys relative to base
	private stripBasePath(fullKey: string): string {
		if (!this.basePath) return fullKey;
		if (fullKey === this.basePath) return "";
		return fullKey.startsWith(this.basePath + "/") ? fullKey.slice(this.basePath.length + 1) : fullKey;
	}

	async list(prefix = ""): Promise<string[]> {
		const base = this.withBasePath(prefix);
		if (!fssync.existsSync(base)) return [];
		const results: string[] = [];

		const walk = async (dir: string, rel: string) => {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			for (const e of entries) {
				const absPath = path.join(dir, e.name);
				const relPath = path.join(rel, e.name).replace(/\\/g, "/");
				if (e.isDirectory()) {
					await walk(absPath, relPath);
				} else {
					results.push(relPath);
				}
			}
		};

		await walk(base, prefix.replace(/^\/+/, ""));
		return results;
	}

	async exists(key: string): Promise<boolean> {
		try {
			await fs.access(this.withBasePath(key));
			return true;
		} catch {
			return false;
		}
	}

	async read(key: string): Promise<Buffer> {
		return fs.readFile(this.withBasePath(key));
	}

	async write(
		key: string,
		data: Buffer | string,
		contentType?: string,
		acl?: string,
		expires?: string,
		cacheControl?: string
	): Promise<void> {
		// contentType ignored for local
		const filePath = this.withBasePath(key);
		await ensureDir(path.dirname(filePath));
		await fs.writeFile(filePath, typeof data === "string" ? Buffer.from(data) : data);
	}

	async upload(
		localFilePath: string,
		key: string,
		contentType?: string,
		acl?: string,
		expires?: string,
		cacheControl?: string
	): Promise<void> {
		const dest = this.withBasePath(key);
		await ensureDir(path.dirname(dest));
		await fs.copyFile(localFilePath, dest);
	}

	async download(key: string, localFilePath: string): Promise<void> {
		const src = this.withBasePath(key);
		await ensureDir(path.dirname(localFilePath));
		await fs.copyFile(src, localFilePath);
	}

	async copy(srcKey: string, destKey: string): Promise<void> {
		const src = this.withBasePath(srcKey);
		const dest = this.withBasePath(destKey);
		await ensureDir(path.dirname(dest));
		await fs.copyFile(src, dest);
	}

	async move(srcKey: string, destKey: string): Promise<void> {
		const src = this.withBasePath(srcKey);
		const dest = this.withBasePath(destKey);
		await ensureDir(path.dirname(dest));
		await fs.rename(src, dest);
	}

	async delete(keyOrPrefix: string): Promise<void> {
		const p = this.withBasePath(keyOrPrefix);
		if (keyOrPrefix.endsWith("/")) {
			// delete folder recursively
			if (fssync.existsSync(p)) {
				await fs.rm(p, { recursive: true, force: true });
			}
			return;
		}
		if (fssync.existsSync(p)) await fs.unlink(p);
	}

	getPublicUrl(key: string): string | null {
		// For local, we cannot reliably construct a public URL; return null
		return null;
	}

	async generateSignedUrl(_key: string): Promise<string> {
		throw new Error("Signed URLs are not supported for LOCAL storage");
	}

	async getMetadata(key: string): Promise<ObjectMetadata> {
		const fp = this.withBasePath(key);
		const st = await fs.stat(fp);
		return {
			size: st.size,
			contentType: guessContentType(key),
			lastModified: st.mtime,
			etag: null,
			raw: st
		};
	}
}

type S3LikeType = Exclude<StorageType, "LOCAL">;

class S3StorageDriver implements StorageDriver {
	private client!: S3Client;
	private type!: S3LikeType;
	private endpoint?: string;
	private region?: string;
	private bucket?: string;
	private basePath?: string; // acts as key prefix within the bucket
	private forcePathStyle?: boolean;
	private publicUrlBase?: string;

	async config(options?: StorageConfigOptions): Promise<void> {
		this.type = options?.type as S3LikeType;
		this.endpoint = options?.endpoint;
		this.region = options?.region;
		this.bucket = options?.bucket;
		this.basePath = (options?.base_path || "").replace(/^\/+|\/+$/g, "");
		this.forcePathStyle = options?.force_path_style;
		this.publicUrlBase = options?.public_url_base;

		const accessKeyId = options?.access_key;
		const secretAccessKey = options?.access_secret;

		const clientConfig: any = {
			region: this.region,
			credentials:
				accessKeyId && secretAccessKey
					? {
							accessKeyId,
							secretAccessKey
						}
					: undefined
		};

		// Endpoint resolution (align with existing uploader.ts behavior)
		if (!this.endpoint) {
			switch (this.type) {
				case "OTHER_S3":
					// if (!this.endpoint) throw new Error('Endpoint is required for OTHER_S3 type');
					break;
				case "AWS_S3":
					break;
				case "GOOGLE_CLOUD_STORAGE":
					this.endpoint = "https://storage.googleapis.com";
					break;
				case "DO_SPACES":
					this.endpoint = `https://${this.region}.digitaloceanspaces.com`;
					break;
				case "LINODE":
					this.endpoint = `https://${this.region}.linodeobjects.com`;
					break;
				case "WASABI":
					this.endpoint = `https://s3.${this.region}.wasabisys.com`;
					break;
				case "BACKBLAZE":
					this.endpoint = `https://s3.${this.region}.backblazeb2.com`;
					break;
				case "RACKSPACE":
					if (!this.endpoint) this.endpoint = `https://storage101.${this.region}.clouddrive.com/v1`;
					break;
				case "MICROSOFT_AZURE":
					if (!this.endpoint) this.endpoint = `https://${this.bucket}.blob.core.windows.net`;
					break;
			}
		}

		if (this.endpoint) {
			clientConfig.endpoint = this.endpoint;
			if (typeof this.forcePathStyle === "boolean") {
				clientConfig.forcePathStyle = this.forcePathStyle;
			}
		}

		this.client = new S3Client(clientConfig);
		logger.console("INFO", "S3-like storage initialized!", {
			type: this.type,
			bucket: this.bucket,
			region: this.region,
			endpoint: this.endpoint
		});
	}

	// Prefix provided key with configured basePath (if any)
	private withBasePath(key: string): string {
		const k = normalizePath(key);
		if (!this.basePath) return k;
		return `${this.basePath}/${k}`;
	}

	// Remove basePath prefix from a full S3 key for returning keys relative to base
	private stripBasePath(fullKey: string): string {
		if (!this.basePath) return fullKey;
		if (fullKey === this.basePath) return "";
		return fullKey.startsWith(this.basePath + "/") ? fullKey.slice(this.basePath.length + 1) : fullKey;
	}

	async list(prefix = ""): Promise<string[]> {
		const keys: string[] = [];
		let ContinuationToken: string | undefined = undefined;
		const Prefix = this.withBasePath(prefix);
		do {
			const out: any = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix, ContinuationToken }));
			(out.Contents || []).forEach((o: any) => {
				if (o.Key) keys.push(this.stripBasePath(o.Key));
			});
			ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
		} while (ContinuationToken);
		return keys;
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.withBasePath(key) }));
			return true;
		} catch {
			return false;
		}
	}

	async read(key: string): Promise<Buffer> {
		const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.withBasePath(key) }));
		const chunks: Uint8Array[] = [];
		const body: any = res.Body;
		for await (const chunk of body) chunks.push(chunk);
		return Buffer.concat(chunks);
	}

	async write(
		key: string,
		data: Buffer | string,
		contentType?: string,
		accessControlList?: string,
		expires?: string,
		cacheControl?: string
	): Promise<void> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: this.withBasePath(key),
				Body: typeof data === "string" ? Buffer.from(data) : data,
				ContentType: contentType || guessContentType(key),
				ACL: this.validateACL(accessControlList),
				Expires: this.validateDate(expires),
				CacheControl: cacheControl
			})
		);
	}

	async upload(
		localFilePath: string,
		key: string,
		contentType?: string,
		accessControlList?: string,
		expires?: string,
		cacheControl?: string
	): Promise<void> {
		const stream = fssync.createReadStream(localFilePath);
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: this.withBasePath(key),
				Body: stream,
				ContentType: contentType || guessContentType(key),
				ACL: this.validateACL(accessControlList),
				Expires: this.validateDate(expires),
				CacheControl: cacheControl
			})
		);
	}

	async download(key: string, localFilePath: string): Promise<void> {
		const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.withBasePath(key) }));
		await ensureDir(path.dirname(localFilePath));
		const write = fssync.createWriteStream(localFilePath);
		await new Promise<void>((resolve, reject) => {
			(res.Body as any).pipe(write);
			write.on("finish", () => resolve());
			write.on("error", reject);
		});
	}

	async copy(srcKey: string, destKey: string): Promise<void> {
		const src = `${this.bucket}/${this.withBasePath(srcKey)}`;
		await this.client.send(
			new CopyObjectCommand({
				Bucket: this.bucket,
				Key: this.withBasePath(destKey),
				CopySource: encodeURI(src)
			})
		);
	}

	async move(srcKey: string, destKey: string): Promise<void> {
		await this.copy(srcKey, destKey);
		await this.delete(srcKey);
	}

	async delete(keyOrPrefix: string): Promise<void> {
		const rel = normalizePath(keyOrPrefix);

		if (rel.endsWith("/")) {
			// delete all under prefix (relative to basePath)
			const toDelete = await this.list(rel); // returns relative keys
			if (toDelete.length === 0) return;
			// Batch delete up to 1000
			for (let i = 0; i < toDelete.length; i += 1000) {
				const chunk = toDelete.slice(i, i + 1000).map((k) => ({ Key: this.withBasePath(k) }));
				await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: chunk } }));
			}
			return;
		}

		await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.withBasePath(rel) }));
	}

	getPublicUrl(key: string): string | null {
		const k = this.withBasePath(key);
		if (this.publicUrlBase) return `${this.publicUrlBase.replace(/\/$/, "")}/${k}`;

		// Attempt to construct a reasonable virtual-hosted URL
		if (this.endpoint) {
			// If endpoint includes protocol, strip trailing slashes
			const base = this.endpoint.replace(/\/$/, "");
			// Prefer virtual hosted if endpoint host is not an IP and not path-style enforced
			if (!this.forcePathStyle) {
				try {
					const u = new URL(base);
					return `${u.protocol}//${this.bucket}.${u.host}/${k}`;
				} catch {
					return `${base}/${this.bucket}/${k}`;
				}
			}
			return `${base}/${this.bucket}/${k}`;
		}
		// Default AWS pattern
		return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${k}`;
	}

	async generateSignedUrl(
		key: string,
		opts?: { operation?: "get" | "put"; expiresInSeconds?: number; contentType?: string }
	): Promise<string> {
		const operation = opts?.operation || "get";
		const expiresIn = Math.max(1, Math.min(7 * 24 * 3600, opts?.expiresInSeconds || 3600));
		if (operation === "get") {
			const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: this.withBasePath(key) });
			return getSignedUrl(this.client, cmd, { expiresIn });
		} else {
			const cmd = new PutObjectCommand({
				Bucket: this.bucket,
				Key: this.withBasePath(key),
				ContentType: opts?.contentType || guessContentType(key)
			});
			return getSignedUrl(this.client, cmd, { expiresIn });
		}
	}

	async getMetadata(key: string): Promise<ObjectMetadata> {
		const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.withBasePath(key) }));
		return {
			size: head.ContentLength,
			contentType: head.ContentType || null,
			lastModified: head.LastModified || null,
			etag: head.ETag || null,
			raw: head
		};
	}

	private validateACL(acl?: string): ObjectCannedACL | undefined {
		if (!acl) return ObjectCannedACL.public_read;

		const normalizedACL = acl.toLowerCase().replace(/_/g, "-");

		const aclMap: Record<string, ObjectCannedACL> = {
			private: ObjectCannedACL.private,
			"public-read": ObjectCannedACL.public_read,
			"public-read-write": ObjectCannedACL.public_read_write,
			"authenticated-read": ObjectCannedACL.authenticated_read,
			"aws-exec-read": ObjectCannedACL.aws_exec_read,
			"bucket-owner-read": ObjectCannedACL.bucket_owner_read,
			"bucket-owner-full-control": ObjectCannedACL.bucket_owner_full_control
		};

		return aclMap[normalizedACL] || ObjectCannedACL.public_read;
	}

	private validateDate(date?: string): Date | undefined {
		if (!date) return undefined;
		const parsed = new Date(date);
		if (isNaN(parsed.getTime())) return undefined;
		return parsed;
	}
}

type FTPLikeType = Extract<StorageType, "FTP" | "SFTP">;

class FTPStorageDriver implements StorageDriver {
	private type!: FTPLikeType;
	private host?: string;
	private port?: number;
	private username?: string;
	private password?: string;
	private secure?: boolean;
	private basePath?: string;
	private publicUrlBase?: string;

	private ftpClient?: FTPClient;
	private sftpClient?: SFTPClient;

	async config(options?: StorageConfigOptions): Promise<void> {
		this.type = options?.type as FTPLikeType;
		this.host = options?.host;
		this.username = options?.username || "anonymous";
		this.password = options?.password || "";
		this.secure = options?.secure ?? false;
		this.basePath = (options?.base_path || "").replace(/^\/+|\/+$/g, "");
		this.publicUrlBase = options?.public_url_base;

		if (this.type === "FTP") {
			this.port = options?.port || 21;
			this.ftpClient = new FTPClient();
			this.ftpClient.ftp.verbose = false;
		} else if (this.type === "SFTP") {
			this.port = options?.port || 22;
			this.sftpClient = new SFTPClient();
		}

		logger.console("INFO", "FTP/SFTP storage initialized!", { type: this.type, host: this.host, port: this.port, secure: this.secure });
	}

	private async connect(): Promise<void> {
		if (this.type === "FTP" && this.ftpClient) {
			if (this.ftpClient.closed) {
				await this.ftpClient.access({
					host: this.host,
					port: this.port,
					user: this.username,
					password: this.password,
					secure: this.secure
				});
			}
		} else if (this.type === "SFTP" && this.sftpClient) {
			try {
				// Check if connection is alive by trying to get current directory
				await this.sftpClient.cwd();
			} catch {
				// Connection is closed, reconnect
				await this.sftpClient.connect({
					host: this.host,
					port: this.port,
					username: this.username,
					password: this.password
				});
			}
		}
	}

	private async disconnect(): Promise<void> {
		if (this.type === "FTP" && this.ftpClient) {
			this.ftpClient.close();
		} else if (this.type === "SFTP" && this.sftpClient) {
			await this.sftpClient.end();
		}
	}

	private withBasePath(key: string): string {
		const k = normalizePath(key);
		if (!this.basePath) return `/${k}`;
		return `/${this.basePath}/${k}`;
	}

	private stripBasePath(fullKey: string): string {
		if (!this.basePath) return fullKey.replace(/^\/+/, "");
		const prefix = `/${this.basePath}/`;
		return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey.replace(/^\/+/, "");
	}

	async list(prefix = ""): Promise<string[]> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(prefix);
			const results: string[] = [];

			if (this.type === "FTP" && this.ftpClient) {
				const walk = async (dir: string) => {
					try {
						const list = await this.ftpClient!.list(dir);
						for (const item of list) {
							const itemPath = `${dir}/${item.name}`.replace(/\/+/g, "/");
							if (item.isDirectory) {
								await walk(itemPath);
							} else if (item.isFile) {
								results.push(this.stripBasePath(itemPath));
							}
						}
					} catch (error: Error | any) {
						// Directory doesn't exist or is not accessible
					}
				};
				await walk(remotePath);
			} else if (this.type === "SFTP" && this.sftpClient) {
				const walk = async (dir: string) => {
					try {
						const list = await this.sftpClient!.list(dir);
						for (const item of list) {
							const itemPath = `${dir}/${item.name}`.replace(/\/+/g, "/");
							if (item.type === "d") {
								await walk(itemPath);
							} else if (item.type === "-") {
								results.push(this.stripBasePath(itemPath));
							}
						}
					} catch (error: Error | any) {
						// Directory doesn't exist or is not accessible
					}
				};
				await walk(remotePath);
			}

			return results;
		} finally {
			await this.disconnect();
		}
	}

	async exists(key: string): Promise<boolean> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(key);

			if (this.type === "FTP" && this.ftpClient) {
				try {
					await this.ftpClient.size(remotePath);
					return true;
				} catch {
					return false;
				}
			} else if (this.type === "SFTP" && this.sftpClient) {
				return (await this.sftpClient.exists(remotePath)) !== false;
			}
			return false;
		} finally {
			await this.disconnect();
		}
	}

	async read(key: string): Promise<Buffer> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(key);
			const tempFile = path.join(path.resolve("./storage"), "temp", `ftp_${Date.now()}_${path.basename(key)}`);
			await ensureDir(path.dirname(tempFile));

			if (this.type === "FTP" && this.ftpClient) {
				await this.ftpClient.downloadTo(tempFile, remotePath);
			} else if (this.type === "SFTP" && this.sftpClient) {
				await this.sftpClient.get(remotePath, tempFile);
			}

			const data = await fs.readFile(tempFile);
			await fs.unlink(tempFile);
			return data;
		} finally {
			await this.disconnect();
		}
	}

	async write(
		key: string,
		data: Buffer | string,
		contentType?: string,
		acl?: string,
		expires?: string,
		cacheControl?: string
	): Promise<void> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(key);
			const remoteDir = path.dirname(remotePath).replace(/\\/g, "/");

			// Ensure remote directory exists
			if (this.type === "FTP" && this.ftpClient) {
				await this.ftpClient.ensureDir(remoteDir);
			} else if (this.type === "SFTP" && this.sftpClient) {
				await this.sftpClient.mkdir(remoteDir, true);
			}

			const tempFile = path.join(path.resolve("./storage"), "temp", `ftp_${Date.now()}_${path.basename(key)}`);
			await ensureDir(path.dirname(tempFile));
			await fs.writeFile(tempFile, typeof data === "string" ? Buffer.from(data) : data);

			if (this.type === "FTP" && this.ftpClient) {
				await this.ftpClient.uploadFrom(tempFile, remotePath);
			} else if (this.type === "SFTP" && this.sftpClient) {
				await this.sftpClient.put(tempFile, remotePath);
			}

			await fs.unlink(tempFile);
		} finally {
			await this.disconnect();
		}
	}

	async upload(
		localFilePath: string,
		key: string,
		contentType?: string,
		acl?: string,
		expires?: string,
		cacheControl?: string
	): Promise<void> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(key);
			const remoteDir = path.dirname(remotePath).replace(/\\/g, "/");

			// Ensure remote directory exists
			if (this.type === "FTP" && this.ftpClient) {
				await this.ftpClient.ensureDir(remoteDir);
			} else if (this.type === "SFTP" && this.sftpClient) {
				await this.sftpClient.mkdir(remoteDir, true);
			}

			if (this.type === "FTP" && this.ftpClient) {
				await this.ftpClient.uploadFrom(localFilePath, remotePath);
			} else if (this.type === "SFTP" && this.sftpClient) {
				await this.sftpClient.put(localFilePath, remotePath);
			}
		} finally {
			await this.disconnect();
		}
	}

	async download(key: string, localFilePath: string): Promise<void> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(key);
			await ensureDir(path.dirname(localFilePath));

			if (this.type === "FTP" && this.ftpClient) {
				await this.ftpClient.downloadTo(localFilePath, remotePath);
			} else if (this.type === "SFTP" && this.sftpClient) {
				await this.sftpClient.get(remotePath, localFilePath);
			}
		} finally {
			await this.disconnect();
		}
	}

	async copy(srcKey: string, destKey: string): Promise<void> {
		// FTP/SFTP don't have native copy, so download and upload
		const data = await this.read(srcKey);
		await this.write(destKey, data);
	}

	async move(srcKey: string, destKey: string): Promise<void> {
		await this.connect();
		try {
			const srcPath = this.withBasePath(srcKey);
			const destPath = this.withBasePath(destKey);
			const destDir = path.dirname(destPath).replace(/\\/g, "/");

			// Ensure destination directory exists
			if (this.type === "FTP" && this.ftpClient) {
				await this.ftpClient.ensureDir(destDir);
				await this.ftpClient.rename(srcPath, destPath);
			} else if (this.type === "SFTP" && this.sftpClient) {
				await this.sftpClient.mkdir(destDir, true);
				await this.sftpClient.rename(srcPath, destPath);
			}
		} finally {
			await this.disconnect();
		}
	}

	async delete(keyOrPrefix: string): Promise<void> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(keyOrPrefix);

			if (keyOrPrefix.endsWith("/")) {
				// Delete directory recursively
				if (this.type === "FTP" && this.ftpClient) {
					await this.ftpClient.removeDir(remotePath);
				} else if (this.type === "SFTP" && this.sftpClient) {
					await this.sftpClient.rmdir(remotePath, true);
				}
			} else {
				// Delete single file
				if (this.type === "FTP" && this.ftpClient) {
					await this.ftpClient.remove(remotePath);
				} else if (this.type === "SFTP" && this.sftpClient) {
					await this.sftpClient.delete(remotePath);
				}
			}
		} finally {
			await this.disconnect();
		}
	}

	getPublicUrl(key: string): string | null {
		const k = normalizePath(key);
		if (this.publicUrlBase) {
			return `${this.publicUrlBase.replace(/\/$/, "")}/${this.basePath ? this.basePath + "/" : ""}${k}`;
		}

		// Construct default URL
		const protocol = this.type === "FTP" ? (this.secure ? "ftps" : "ftp") : "sftp";
		return `${protocol}://${this.host}:${this.port}/${this.basePath ? this.basePath + "/" : ""}${k}`;
	}

	async generateSignedUrl(
		_key: string,
		_opts?: { operation?: "get" | "put"; expiresInSeconds?: number; contentType?: string }
	): Promise<string> {
		throw new Error("Signed URLs are not supported for FTP/SFTP storage");
	}

	async getMetadata(key: string): Promise<ObjectMetadata> {
		await this.connect();
		try {
			const remotePath = this.withBasePath(key);

			if (this.type === "FTP" && this.ftpClient) {
				const size = await this.ftpClient.size(remotePath);
				const modifiedAt = await this.ftpClient.lastMod(remotePath);
				return {
					size,
					contentType: guessContentType(key),
					lastModified: modifiedAt || null,
					etag: null,
					raw: { size, modifiedAt }
				};
			} else if (this.type === "SFTP" && this.sftpClient) {
				const stat = await this.sftpClient.stat(remotePath);
				return {
					size: stat.size,
					contentType: guessContentType(key),
					lastModified: new Date(stat.modifyTime),
					etag: null,
					raw: stat
				};
			}

			throw new Error("FTP client not initialized!");
		} finally {
			await this.disconnect();
		}
	}
}

// Facade
class StorageFacade implements StorageDriver {
	private driver: StorageDriver | null = null;
	private type: StorageType | null = null;

	async config(options?: StorageConfigOptions): Promise<void> {
		this.type = options?.type as StorageType;

		if (this.type === "LOCAL") {
			this.driver = new LocalStorageDriver();
		} else if (this.type === "FTP" || this.type === "SFTP") {
			this.driver = new FTPStorageDriver();
		} else {
			this.driver = new S3StorageDriver();
		}

		await this.driver.config({
			type: this.type,
			endpoint: options?.endpoint,
			access_key: options?.access_key,
			access_secret: options?.access_secret,
			region: options?.region,
			bucket: options?.bucket,
			base_path: options?.base_path,
			force_path_style: options?.force_path_style,
			public_url_base: options?.public_url_base,
			host: options?.host,
			port: options?.port,
			username: options?.username,
			password: options?.password,
			secure: options?.secure
		});
	}

	private assertReady() {
		if (!this.driver) throw new Error("Storage is not initialized. Call storage.config() first.");
	}

	list(prefix?: string): Promise<string[]> {
		this.assertReady();
		return this.driver!.list(prefix);
	}
	exists(key: string): Promise<boolean> {
		this.assertReady();
		return this.driver!.exists(key);
	}
	read(key: string): Promise<Buffer> {
		this.assertReady();
		return this.driver!.read(key);
	}
	write(key: string, data: Buffer | string, contentType?: string, acl?: string, expires?: string, cacheControl?: string): Promise<void> {
		this.assertReady();
		return this.driver!.write(key, data, contentType, acl, expires, cacheControl);
	}
	upload(localFilePath: string, key: string, contentType?: string, acl?: string, expires?: string, cacheControl?: string): Promise<void> {
		this.assertReady();
		return this.driver!.upload(localFilePath, key, contentType, acl, expires, cacheControl);
	}
	download(key: string, localFilePath: string): Promise<void> {
		this.assertReady();
		return this.driver!.download(key, localFilePath);
	}
	copy(srcKey: string, destKey: string): Promise<void> {
		this.assertReady();
		return this.driver!.copy(srcKey, destKey);
	}
	move(srcKey: string, destKey: string): Promise<void> {
		this.assertReady();
		return this.driver!.move(srcKey, destKey);
	}
	delete(keyOrPrefix: string): Promise<void> {
		this.assertReady();
		return this.driver!.delete(keyOrPrefix);
	}
	getPublicUrl(key: string): string | null {
		this.assertReady();
		return this.driver!.getPublicUrl(key);
	}
	generateSignedUrl(key: string, opts?: { operation?: "get" | "put"; expiresInSeconds?: number; contentType?: string }): Promise<string> {
		this.assertReady();
		return this.driver!.generateSignedUrl(key, opts);
	}
	getMetadata(key: string): Promise<ObjectMetadata> {
		this.assertReady();
		return this.driver!.getMetadata(key);
	}
}

export const storage = new StorageFacade();

export default storage;
