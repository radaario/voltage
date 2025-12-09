import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

/**
 * Hash algorithms supported
 */
export type HashAlgorithm = "MD5" | "SHA1" | "SHA256" | "SHA512";

/**
 * Generate UUID v4
 * @returns UUID string
 */
export function uuid(): string {
	return uuidv4();
}

/**
 * Generate hashed UUID (uukey = uuid + hash)
 * @param algorithm Hash algorithm (default: SHA1)
 * @returns Hashed UUID
 */
export function uukey(algorithm: HashAlgorithm = "SHA1"): string {
	return hash(uuidv4(), algorithm);
}

/**
 * Hash data using specified algorithm
 * @param data Data to hash
 * @param algorithm Hash algorithm (default: SHA1)
 * @returns Hashed string
 */
export function hash(data: string, algorithm: HashAlgorithm = "SHA1"): string {
	return crypto.createHash(algorithm).update(data).digest("hex");
}
