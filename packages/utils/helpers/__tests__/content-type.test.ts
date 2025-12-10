import { describe, it, expect } from "vitest";
import { guessContentType, isVideo, isImage, isAudio } from "../content-type";

describe("content-type helpers", () => {
	describe("guessContentType", () => {
		it("should detect video MIME types", () => {
			expect(guessContentType("video.mp4")).toBe("video/mp4");
			expect(guessContentType("movie.mkv")).toBe("video/x-matroska");
			expect(guessContentType("clip.mov")).toBe("video/quicktime");
			expect(guessContentType("stream.webm")).toBe("video/webm");
			expect(guessContentType("video.avi")).toBe("video/x-msvideo");
		});

		it("should detect image MIME types", () => {
			expect(guessContentType("photo.jpg")).toBe("image/jpeg");
			expect(guessContentType("image.jpeg")).toBe("image/jpeg");
			expect(guessContentType("graphic.png")).toBe("image/png");
			expect(guessContentType("animation.gif")).toBe("image/gif");
			expect(guessContentType("logo.svg")).toBe("image/svg+xml");
			expect(guessContentType("pic.webp")).toBe("image/webp");
		});

		it("should detect audio MIME types", () => {
			expect(guessContentType("song.mp3")).toBe("audio/mpeg");
			expect(guessContentType("sound.wav")).toBe("audio/wav");
			expect(guessContentType("track.flac")).toBe("audio/flac");
			expect(guessContentType("audio.aac")).toBe("audio/aac");
			expect(guessContentType("music.m4a")).toBe("audio/mp4");
		});

		it("should detect streaming formats", () => {
			expect(guessContentType("playlist.m3u8")).toBe("application/vnd.apple.mpegurl");
			expect(guessContentType("manifest.mpd")).toBe("application/dash+xml");
		});

		it("should detect document MIME types", () => {
			expect(guessContentType("data.json")).toBe("application/json");
			expect(guessContentType("text.txt")).toBe("text/plain");
			expect(guessContentType("page.html")).toBe("text/html");
			expect(guessContentType("doc.pdf")).toBe("application/pdf");
		});

		it("should handle file paths", () => {
			expect(guessContentType("/path/to/video.mp4")).toBe("video/mp4");
			expect(guessContentType("C:\\Users\\Videos\\movie.mkv")).toBe("video/x-matroska");
		});

		it("should handle uppercase extensions", () => {
			expect(guessContentType("VIDEO.MP4")).toBe("video/mp4");
			expect(guessContentType("IMAGE.PNG")).toBe("image/png");
		});

		it("should return default for unknown types", () => {
			expect(guessContentType("unknown.xyz")).toBe("application/octet-stream");
			expect(guessContentType("noext")).toBe("application/octet-stream");
		});

		it("should handle files with multiple dots", () => {
			expect(guessContentType("file.name.with.dots.mp4")).toBe("video/mp4");
		});

		it("should handle empty extension", () => {
			expect(guessContentType("file.")).toBe("application/octet-stream");
		});
	});

	describe("isVideo", () => {
		it("should return true for video files", () => {
			expect(isVideo("video.mp4")).toBe(true);
			expect(isVideo("movie.mkv")).toBe(true);
			expect(isVideo("clip.webm")).toBe(true);
			expect(isVideo("stream.avi")).toBe(true);
		});

		it("should return false for non-video files", () => {
			expect(isVideo("image.jpg")).toBe(false);
			expect(isVideo("song.mp3")).toBe(false);
			expect(isVideo("doc.pdf")).toBe(false);
			expect(isVideo("unknown.xyz")).toBe(false);
		});
	});

	describe("isImage", () => {
		it("should return true for image files", () => {
			expect(isImage("photo.jpg")).toBe(true);
			expect(isImage("graphic.png")).toBe(true);
			expect(isImage("logo.svg")).toBe(true);
			expect(isImage("pic.webp")).toBe(true);
		});

		it("should return false for non-image files", () => {
			expect(isImage("video.mp4")).toBe(false);
			expect(isImage("song.mp3")).toBe(false);
			expect(isImage("doc.pdf")).toBe(false);
			expect(isImage("unknown.xyz")).toBe(false);
		});
	});

	describe("isAudio", () => {
		it("should return true for audio files", () => {
			expect(isAudio("song.mp3")).toBe(true);
			expect(isAudio("sound.wav")).toBe(true);
			expect(isAudio("track.flac")).toBe(true);
			expect(isAudio("audio.aac")).toBe(true);
		});

		it("should return false for non-audio files", () => {
			expect(isAudio("video.mp4")).toBe(false);
			expect(isAudio("image.jpg")).toBe(false);
			expect(isAudio("doc.pdf")).toBe(false);
			expect(isAudio("unknown.xyz")).toBe(false);
		});
	});
});
