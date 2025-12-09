/**
 * Copy text to clipboard
 * @param text - The text to copy
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			// Use modern clipboard API if available
			await navigator.clipboard.writeText(text);
			return true;
		} else {
			// Fallback for older browsers or non-secure contexts
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			const successful = document.execCommand("copy");
			textArea.remove();
			return successful;
		}
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		return false;
	}
};
