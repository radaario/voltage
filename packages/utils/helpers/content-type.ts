import path from "path";

/**
 * MIME type mapping for common file extensions
 */
const MIME_TYPE_MAP: Record<string, string> = {
	// Video formats
	mp4: "video/mp4",
	mkv: "video/x-matroska",
	mov: "video/quicktime",
	webm: "video/webm",
	ts: "video/mp2t",
	avi: "video/x-msvideo",
	wmv: "video/x-ms-wmv",
	flv: "video/x-flv",
	m4v: "video/x-m4v",
	"3gp": "video/3gpp",
	"3g2": "video/3gpp2",
	ogg: "video/ogg",
	ogv: "video/ogg",

	// Image formats
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	svg: "image/svg+xml",
	webp: "image/webp",
	bmp: "image/bmp",
	ico: "image/x-icon",

	// Audio formats
	mp3: "audio/mpeg",
	wav: "audio/wav",
	flac: "audio/flac",
	aac: "audio/aac",
	m4a: "audio/mp4",
	opus: "audio/opus",
	wma: "audio/x-ms-wma",

	// Streaming formats
	m3u8: "application/vnd.apple.mpegurl",
	mpd: "application/dash+xml",

	// Text/Document formats
	json: "application/json",
	txt: "text/plain",
	html: "text/html",
	css: "text/css",
	js: "application/javascript",
	xml: "application/xml",
	pdf: "application/pdf"
};

/**
 * Guess MIME content type based on file extension
 * @param filename File name or path
 * @returns MIME type string (defaults to 'application/octet-stream')
 */
export function guessContentType(filename: string): string {
	const ext = path.extname(filename).toLowerCase().replace(".", "");
	return MIME_TYPE_MAP[ext] || "application/octet-stream";
}

/**
 * Check if file is a video based on extension
 * @param filename File name or path
 * @returns True if video file
 */
export function isVideo(filename: string): boolean {
	const contentType = guessContentType(filename);
	return contentType.startsWith("video/");
}

/**
 * Check if file is an image based on extension
 * @param filename File name or path
 * @returns True if image file
 */
export function isImage(filename: string): boolean {
	const contentType = guessContentType(filename);
	return contentType.startsWith("image/");
}

/**
 * Check if file is audio based on extension
 * @param filename File name or path
 * @returns True if audio file
 */
export function isAudio(filename: string): boolean {
	const contentType = guessContentType(filename);
	return contentType.startsWith("audio/");
}
