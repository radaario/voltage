import { isArray, isPlainObject } from "lodash-es";

interface StorageOptions {
	defaultValue?: any;
	json?: boolean;
	boolean?: boolean;
}

/**
 * A utility class for managing browser localStorage with additional features
 * like expiration times and automatic JSON parsing/stringification.
 */
class LocalStorageUtil {
	/**
	 * Generates the expiration key name for a given storage key
	 * @param key - The base key name
	 * @returns The expiration key name (key_expiresIn)
	 */
	private getKeyWithExpiration(key: string): string {
		return key + "_expiresIn";
	}

	/**
	 * Removes an item from localStorage along with its expiration data
	 * @param key - The key to remove
	 * @returns True if successful, false if an error occurred
	 */
	public remove(key: string): boolean {
		try {
			localStorage.removeItem(key);
			localStorage.removeItem(this.getKeyWithExpiration(key));
		} catch (err) {
			console.warn(`remove: Error removing key [${key}] from localStorage: ${err}`);
			return false;
		}
		return true;
	}

	/**
	 * Retrieves an item from localStorage with support for expiration and type conversion
	 * @param key - The key to retrieve
	 * @param params - Optional parameters for parsing the value
	 * @param params.defaultValue - Default value to return if key doesn't exist
	 * @param params.json - Parse the value as JSON
	 * @param params.boolean - Parse the value as boolean
	 * @returns The retrieved value, or null if expired/not found
	 */
	public get(key: string, params?: StorageOptions): any {
		let expiresIn = localStorage.getItem(this.getKeyWithExpiration(key));

		if (expiresIn) {
			const now = Date.now();

			if (expiresIn === undefined || expiresIn === null) {
				expiresIn = "0";
			}

			const expiresInNumber = Math.abs(parseInt(expiresIn, 10));

			if (expiresInNumber < now) {
				this.remove(key);
				return null;
			}
		}

		try {
			const value = localStorage.getItem(key);

			if (!!params?.json) {
				return JSON.parse(value!);
			} else if (!!params?.boolean) {
				if (value === "1" || value === "true") {
					return true;
				}

				if (value === "0" || value === "false") {
					return false;
				}

				return !!value || params?.defaultValue;
			}

			return value || params?.defaultValue;
		} catch (err) {
			console.warn(`get: Error reading key [${key}] from localStorage: ${err}`);
			return null;
		}
	}

	/**
	 * Stores an item in localStorage with optional expiration time
	 * Automatically stringifies objects and arrays to JSON
	 * @param key - The key to store the value under
	 * @param value - The value to store (will be stringified if object/array)
	 * @param expires - Optional expiration time in seconds (defaults to 24 hours if provided without value)
	 * @returns True if successful, false if an error occurred
	 */
	public set(key: string, value: any, expires?: number): boolean {
		try {
			if (isPlainObject(value) || isArray(value)) {
				value = JSON.stringify(value);
			}

			localStorage.setItem(key, value);

			if (expires !== undefined && expires !== null) {
				expires = 24 * 60 * 60; // default: seconds for 1 day

				const now = Date.now();
				const schedule = now + expires * 1000;

				localStorage.setItem(this.getKeyWithExpiration(key), schedule.toString());
			}
		} catch (err) {
			console.warn(`set: Error setting key [${key}] in localStorage: ${err}`);
			return false;
		}
		return true;
	}
}

export default new LocalStorageUtil();
