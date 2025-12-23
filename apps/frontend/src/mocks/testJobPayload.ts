export const testJobPayload = {
	config: {
		input_analysis: true,
		preview_generation: true,
		nsfw_detection: false,
		ffmpeg_preset: "FASTER",
		whisper_model: "TINY"
	},
	input: {
		type: "HTTP",
		url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_20MB.mp4"
	},
	outputs: [
		{
			type: "VIDEO",
			name: "Video (720p)",
			path: "Big_Buck_Bunny_1080_10s_20MB.mp4",
			format: "MP4",
			preset: "SLOW",
			quality: 3,
			offset: 1,
			duration: 3,
			width: 1280,
			height: 720,
			fit: "PAD",
			rotate: 180,
			flip: "HORIZONTAL",
			video_codec: "libx264",
			video_quality: 75,
			video_bit_rate: 5000000,
			video_pixel_format: "yuv420p",
			video_frame_rate: 25,
			video_profile: "BASELINE",
			video_level: 4.0,
			video_deinterlace: true,
			video_first_frame_image_url: null,
			audio_codec: "libmp3lame",
			audio_quality: 50,
			audio_bit_rate: 128000,
			audio_sample_rate: 48000,
			audio_channels: 2,
			destination: {
				type: "HTTPS",
				method: "POST",
				url: "https://httpbin.org/post",
				headers: {
					"X-Output-Type": "720p-webm"
				}
			}
		},
		{
			type: "AUDIO",
			name: "Audio",
			path: "Big_Buck_Bunny_1080_10s_20MB.mp3",
			format: "MP3",
			audio_codec: "libmp3lame",
			audio_quality: 75,
			audio_bit_rate: 128000,
			audio_sample_rate: 48000,
			audio_channels: 2
		},
		{
			type: "THUMBNAIL",
			name: "Thumbnail (Custom)",
			path: "Big_Buck_Bunny_1080_10s_20MB.png",
			format: "PNG",
			image_quality: 75,
			width: 1280,
			height: 720,
			offset: 1
		},
		{
			type: "SUBTITLE",
			name: "Subtitle (SRT)",
			path: "Big_Buck_Bunny_1080_10s_20MB.srt",
			format: "SRT",
			whisper_model: "BASE",
			whisper_cuda: false,
			language: "AUTO"
		}
	],
	destination: {
		type: "HTTPS",
		method: "POST",
		url: "https://httpbin.org/post",
		headers: {
			"X-Output-Type": "720p-webm"
		}
	},
	notification: {
		type: "HTTPS",
		url: "https://httpbin.org/post"
	},
	metadata: {
		string: "String",
		number: 123,
		timestamp: new Date().toISOString()
	}
};
