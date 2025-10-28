import { isArray, isPlainObject } from "lodash";

interface StorageOptions {
	defaultValue?: any;
	json?: boolean;
	boolean?: boolean;
}

class LocalStorageUtil {
	private getKeyWithExpiration(key: string): string {
		return key + "_expiresIn";
	}

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
