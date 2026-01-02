import { describe, it, expect, beforeEach, vi } from "vitest";
import { copyToClipboard } from "../clipboard";

describe("copyToClipboard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should copy text using modern clipboard API", async () => {
		// Mock modern clipboard API
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
		Object.assign(window, {
			isSecureContext: true
		});

		const text = "Test text to copy";
		const result = await copyToClipboard(text);

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
		expect(result).toBe(true);
	});

	it("should handle clipboard API errors", async () => {
		// Mock clipboard API that throws error
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockRejectedValue(new Error("Permission denied"))
			}
		});
		Object.assign(window, {
			isSecureContext: true
		});

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = await copyToClipboard("test");

		expect(result).toBe(false);
		expect(consoleSpy).toHaveBeenCalled();

		consoleSpy.mockRestore();
	});

	it("should use fallback for non-secure contexts", async () => {
		// Mock non-secure context
		Object.assign(navigator, {
			clipboard: undefined
		});
		Object.assign(window, {
			isSecureContext: false
		});

		// Mock document methods
		const mockTextArea = {
			value: "",
			style: { position: "", left: "", top: "" },
			focus: vi.fn(),
			select: vi.fn(),
			remove: vi.fn()
		};

		document.createElement = vi.fn().mockReturnValue(mockTextArea);
		document.body.appendChild = vi.fn();
		document.execCommand = vi.fn().mockReturnValue(true);

		const result = await copyToClipboard("test text");

		expect(result).toBe(true);
		expect(mockTextArea.focus).toHaveBeenCalled();
		expect(mockTextArea.select).toHaveBeenCalled();
		expect(document.execCommand).toHaveBeenCalledWith("copy");
	});

	it("should handle empty string", async () => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
		Object.assign(window, {
			isSecureContext: true
		});

		const result = await copyToClipboard("");

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith("");
		expect(result).toBe(true);
	});

	it("should handle long text", async () => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
		Object.assign(window, {
			isSecureContext: true
		});

		const longText = "a".repeat(10000);
		const result = await copyToClipboard(longText);

		expect(result).toBe(true);
	});

	it("should handle special characters", async () => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
		Object.assign(window, {
			isSecureContext: true
		});

		const specialText = "Test with\nnewlines\tand\ttabs\r\nand special chars: @#$%^&*()";
		const result = await copyToClipboard(specialText);

		expect(result).toBe(true);
	});
});
