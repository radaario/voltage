/**
 * Fetches country information from an IP address using the ip-api.com service
 * @param ip - The IP address to lookup
 * @returns An object containing country name and country code, or null if the lookup fails
 *
 * @example
 * const info = await getCountryFromIP("8.8.8.8");
 * // { country: "United States", countryCode: "US" }
 */
export const getCountryFromIP = async (ip: string): Promise<{ country: string; countryCode: string } | null> => {
	try {
		const response = await fetch(`http://ip-api.com/json/${ip}`);
		const data = await response.json();
		if (data.status === "success") {
			return {
				country: data.country || "",
				countryCode: data.countryCode || ""
			};
		}
		return null;
	} catch (error) {
		console.error("Failed to fetch country from IP:", error);
		return null;
	}
};
