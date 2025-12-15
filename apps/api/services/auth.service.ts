import { appConfig } from "@voltage/config";
import { hash } from "@voltage/utils";

export const authenticateFrontend = (password: string): string | null => {
	if (!appConfig.frontend.is_authentication_required) {
		return null;
	}

	if (!password) {
		throw new Error("PASSWORD_REQUIRED");
	}

	if (password !== appConfig.frontend.password) {
		throw new Error("PASSWORD_INVALID");
	}

	return hash(password);
};
