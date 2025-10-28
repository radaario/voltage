import { useState } from "react";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import localStorage from "@/utils/localStorage";
import { isEmpty } from "lodash-es";
import radaarLogo from "@/assets/radaar-header.webp";
import ScreenLoading from "@/components/ScreenLoading/ScreenLoading";

function SignIn() {
	const { setAuthToken, setLoggedIn } = useGlobalStateContext();

	// states
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState(null);
	const [sending, setSending] = useState(false);

	// actions
	const onSubmit = async (e: any) => {
		e.preventDefault();

		// if the password is empty
		if (password === "") {
			const passwordEl: any = document.querySelector(".sign form input[type='password']");
			if (passwordEl) {
				passwordEl.focus();
			}
			return;
		}

		setSending(true);
		try {
			const response = await fetch(import.meta.env.VITE_APP_URL + import.meta.env.VITE_APP_BASE + "/dashboard/sign/in", {
				method: "post",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					password
				})
			});
			const responseJson = await response.json();

			if (responseJson.status && responseJson.data?.token) {
				setAuthToken(responseJson.token);
				localStorage.set("authToken", responseJson.data?.token);
				setLoggedIn(true);
			} else {
				setErrorMessage(responseJson.message || null);
				setPassword("");
				setLoggedIn(false);
			}

			setSending(false);
		} catch {
			setSending(false);
		}
	};

	const onChangePassword = (e: any) => {
		setPassword(e.target.value || "");
	};

	return (
		<div className="absolute inset-0 bg-[var(--color-background-secondary)] rounded w-full flex items-center justify-center">
			<form onSubmit={onSubmit} className="flex flex-col items-center justify-center gap-2.5 w-[360px]">
				<img
					src={radaarLogo}
					alt="RADAAR"
					className="absolute left-8 top-5"
				/>
				<div className="text-2xl font-bold mb-4">Welcome to Debugger</div>
				{!isEmpty(errorMessage) && <div className="block w-full p-2.5 rounded border-4 border-red-600 text-red-600">{errorMessage}</div>}
				<input
					type="password"
					onChange={onChangePassword}
					placeholder="Password"
					disabled={sending}
					value={password}
					className="w-full h-12 border-0 outline-0 rounded text-lg px-4 bg-[var(--color-background-tertiary)] text-white transition-colors duration-200 focus:bg-[var(--color-background-tertiary)]"
				/>
				<button
					type="submit"
					disabled={sending}
					className="ml-auto py-4 px-8 border-0 w-full rounded bg-black text-white font-bold text-lg cursor-pointer transition-colors duration-200 hover:bg-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed">
					Sign In
				</button>
				{sending && <ScreenLoading />}
			</form>
		</div>
	);
}

export default SignIn;
