import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { useEffect, useRef, useState } from "react";
import { isEmpty } from "lodash";
import { createPortal } from "react-dom";
import { clsx } from "@/utils";

function JSONPrettierModal() {
	const { isOpenJsonPrettierModal, setOpenJsonPrettierModal } = useGlobalStateContext();
	const textareaRef = useRef<any>(null);

	// states
	const [text, setText] = useState("");
	const [error, setError] = useState(false);

	// actions
	const handleClose = () => {
		setOpenJsonPrettierModal(false);
	};

	const handleTextChange = (e: any) => {
		setText(e.target.value || "");
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(text || "");
		textareaRef.current.focus();
	};

	const handleClear = () => {
		setText("");
		textareaRef.current.focus();
	};

	const handlePretty = () => {
		try {
			// Create edited string (enclose keys in quotes)
			const revivedText = text.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ');
			const json = JSON.parse(revivedText);
			const jsonStringify = JSON.stringify(json, null, 4);
			setText(jsonStringify);
			setError(false);
		} catch {
			setError(true);
		}
	};

	// effects
	useEffect(() => {
		const handleKeyDown = (e: any) => {
			if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
				return;
			}

			if (e.code === "Escape") {
				handleClose();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	// renders
	if (!isOpenJsonPrettierModal) {
		return null;
	}

	const ModalContent = (
		<div className="fixed inset-0 z-[9999]">
			<div className="absolute inset-0 bg-black/75 -z-10" />
			<div className="w-full h-full flex p-8 flex-col flex-wrap">
				<button
					className="absolute right-9 top-9 bg-neutral-800 border-none w-11 h-11 rounded-full flex items-center justify-center text-center cursor-pointer transition-colors duration-200 hover:bg-neutral-700 before:content-['\e826'] before:font-['font-icons'] before:text-white before:text-base"
					onClick={handleClose}
				/>
				<div className="flex flex-col min-h-[400px] w-[800px] p-8 overflow-auto m-auto rounded bg-neutral-800">
					<div className="text-xl text-gray-300 mb-4">JSON Prettier</div>
					<textarea
						ref={textareaRef}
						className={clsx("w-full h-full p-3 border-0 outline-0 text-sm text-gray-100 resize-y min-h-[inherit] bg-neutral-700 rounded transition-colors duration-200 placeholder:text-gray-500", {
							"border-2 border-red-600": error
						})}
						placeholder="Paste your code or text"
						onChange={handleTextChange}
						value={text}
					/>
					<div className="flex w-full justify-end mt-2.5 gap-2">
						<button
							className="flex flex-wrap items-center justify-center min-h-9 py-1.5 px-3 bg-neutral-600 rounded border-0 cursor-pointer transition-colors duration-200 hover:bg-neutral-500 disabled:opacity-75 disabled:cursor-not-allowed"
							title="Clear"
							disabled={isEmpty(text)}
							onClick={handleClear}>
							<i className="icon-trash text-sm mr-1 text-gray-200" />
							Clear
						</button>
						<button
							className="flex flex-wrap items-center justify-center min-h-9 py-1.5 px-3 bg-neutral-600 rounded border-0 cursor-pointer transition-colors duration-200 hover:bg-neutral-500"
							title="Copy"
							onClick={handleCopy}>
							<i className="icon-docs text-sm mr-1 text-gray-200" />
							Copy
						</button>
						<button
							className="flex flex-wrap items-center justify-center min-h-9 py-1.5 px-3 bg-neutral-600 rounded border-0 cursor-pointer transition-colors duration-200 hover:bg-neutral-500"
							title="Pretty"
							onClick={handlePretty}>
							<i className="icon-eye text-sm mr-1 text-gray-200" />
							Pretty
						</button>
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(ModalContent, document.body);
}

export default JSONPrettierModal;
