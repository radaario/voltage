import { config } from "@voltage/config";
import { hash } from "@voltage/utils";

export const authenticateFrontend = (password: string): string | null => {
	if (!config.frontend.is_authentication_required) {
		return null;
	}

	if (!password) {
		throw new Error("PASSWORD_REQUIRED");
	}

	if (password !== config.frontend.password) {
		throw new Error("PASSWORD_INVALID");
	}

	return hash(password);
};
