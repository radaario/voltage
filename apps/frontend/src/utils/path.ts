/**
 * Extract the filename from a full path
 * @param path - Full path string (e.g., "publishing/scheduler/posts/.../file.mp4")
 * @returns Just the filename (e.g., "file.mp4")
 */
export const getFilenameFromPath = (path: string | undefined | null): string => {
	if (!path) return "";

	// Handle both forward slashes and backslashes
	const parts = path.replace(/\\/g, "/").split("/");
	return parts[parts.length - 1] || path;
};
