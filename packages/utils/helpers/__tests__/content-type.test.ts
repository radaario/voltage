import { describe, it, expect } from "vitest";
import { guessContentType, isVideo, isImage, isAudio } from "../content-type";

describe("Content Type Helpers", () => {
	describe("guessContentType", () => {
		it("should return correct MIME type for video formats", () => {
			expect(guessContentType("video.mp4")).toBe("video/mp4");
			expect(guessContentType("movie.mkv")).toBe("video/x-matroska");
			expect(guessContentType("clip.mov")).toBe("video/quicktime");
			expect(guessContentType("file.webm")).toBe("video/webm");
			expect(guessContentType("stream.ts")).toBe("video/mp2t");
			expect(guessContentType("video.avi")).toBe("video/x-msvideo");
		});

		it("should return correct MIME type for image formats", () => {
			expect(guessContentType("photo.jpg")).toBe("image/jpeg");
			expect(guessContentType("image.jpeg")).toBe("image/jpeg");
			expect(guessContentType("picture.png")).toBe("image/png");
			expect(guessContentType("animation.gif")).toBe("image/gif");
			expect(guessContentType("vector.svg")).toBe("image/svg+xml");
			expect(guessContentType("photo.webp")).toBe("image/webp");
		});

		it("should return correct MIME type for audio formats", () => {
			expect(guessContentType("song.mp3")).toBe("audio/mpeg");
			expect(guessContentType("audio.wav")).toBe("audio/wav");
			expect(guessContentType("music.flac")).toBe("audio/flac");
			expect(guessContentType("track.aac")).toBe("audio/aac");
			expect(guessContentType("audio.m4a")).toBe("audio/mp4");
		});

		it("should return correct MIME type for streaming formats", () => {
			expect(guessContentType("playlist.m3u8")).toBe("application/vnd.apple.mpegurl");
			expect(guessContentType("manifest.mpd")).toBe("application/dash+xml");
		});

		it("should return correct MIME type for document formats", () => {
			expect(guessContentType("data.json")).toBe("application/json");
			expect(guessContentType("file.txt")).toBe("text/plain");
			expect(guessContentType("page.html")).toBe("text/html");
			expect(guessContentType("style.css")).toBe("text/css");
			expect(guessContentType("script.js")).toBe("application/javascript");
			expect(guessContentType("document.pdf")).toBe("application/pdf");
		});

		it("should handle file paths", () => {
			expect(guessContentType("/path/to/video.mp4")).toBe("video/mp4");
			expect(guessContentType("C:\\Users\\file.png")).toBe("image/png");
			expect(guessContentType("./relative/path/audio.mp3")).toBe("audio/mpeg");
		});

		it("should handle uppercase extensions", () => {
			expect(guessContentType("VIDEO.MP4")).toBe("video/mp4");
			expect(guessContentType("IMAGE.PNG")).toBe("image/png");
			expect(guessContentType("AUDIO.MP3")).toBe("audio/mpeg");
		});

		it("should return default MIME type for unknown extensions", () => {
			expect(guessContentType("file.unknown")).toBe("application/octet-stream");
			expect(guessContentType("document.xyz")).toBe("application/octet-stream");
			expect(guessContentType("noextension")).toBe("application/octet-stream");
		});

		it("should handle files without extension", () => {
			expect(guessContentType("filename")).toBe("application/octet-stream");
			expect(guessContentType("/path/to/file")).toBe("application/octet-stream");
		});

		it("should handle empty string", () => {
			expect(guessContentType("")).toBe("application/octet-stream");
		});
	});

	describe("isVideo", () => {
		it("should return true for video files", () => {
			expect(isVideo("video.mp4")).toBe(true);
			expect(isVideo("movie.mkv")).toBe(true);
			expect(isVideo("clip.webm")).toBe(true);
			expect(isVideo("file.avi")).toBe(true);
			expect(isVideo("movie.mov")).toBe(true);
		});

		it("should return false for non-video files", () => {
			expect(isVideo("image.png")).toBe(false);
			expect(isVideo("audio.mp3")).toBe(false);
			expect(isVideo("document.pdf")).toBe(false);
			expect(isVideo("data.json")).toBe(false);
		});

		it("should return false for unknown extensions", () => {
			expect(isVideo("file.unknown")).toBe(false);
		});
	});

	describe("isImage", () => {
		it("should return true for image files", () => {
			expect(isImage("photo.jpg")).toBe(true);
			expect(isImage("picture.png")).toBe(true);
			expect(isImage("animation.gif")).toBe(true);
			expect(isImage("vector.svg")).toBe(true);
			expect(isImage("image.webp")).toBe(true);
		});

		it("should return false for non-image files", () => {
			expect(isImage("video.mp4")).toBe(false);
			expect(isImage("audio.mp3")).toBe(false);
			expect(isImage("document.txt")).toBe(false);
		});

		it("should return false for unknown extensions", () => {
			expect(isImage("file.unknown")).toBe(false);
		});
	});

	describe("isAudio", () => {
		it("should return true for audio files", () => {
			expect(isAudio("song.mp3")).toBe(true);
			expect(isAudio("audio.wav")).toBe(true);
			expect(isAudio("music.flac")).toBe(true);
			expect(isAudio("track.m4a")).toBe(true);
			expect(isAudio("audio.aac")).toBe(true);
		});

		it("should return false for non-audio files", () => {
			expect(isAudio("video.mp4")).toBe(false);
			expect(isAudio("image.png")).toBe(false);
			expect(isAudio("document.pdf")).toBe(false);
		});

		it("should return false for unknown extensions", () => {
			expect(isAudio("file.unknown")).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should handle files with multiple dots", () => {
			expect(guessContentType("file.name.with.dots.mp4")).toBe("video/mp4");
			expect(guessContentType("backup.2024.12.30.png")).toBe("image/png");
		});

		it("should handle special characters in filename", () => {
			expect(guessContentType("file-name_test(1).mp4")).toBe("video/mp4");
			expect(guessContentType("image [copy].png")).toBe("image/png");
		});
	});
});
