import { useState } from "react";
import { isEmpty } from "lodash-es";
import { useNavigate } from "react-router-dom";
import ScreenLoading from "@/components/composite/ScreenLoading/ScreenLoading";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header/Header";

function Login() {
	const { login } = useAuth();
	const navigate = useNavigate();

	// states
	const [password, setPassword] = useState(import.meta.env.VITE_PASSWORD || "");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [sending, setSending] = useState(false);

	// actions
	const onSubmit = async (e: any) => {
		e.preventDefault();

		const focusPasswordEl = () => {
			const passwordEl: any = document.querySelector("form input[type='password']");
			setTimeout(() => passwordEl?.focus(), 1);
		};

		// if the password is empty
		if (password === "") {
			focusPasswordEl();
			return;
		}

		setSending(true);
		try {
			const success = await login(password);
			if (success) {
				navigate("/", { replace: true });
			} else {
				setErrorMessage("Invalid password");
				setPassword("");
				focusPasswordEl();
			}
		} catch (err: any) {
			setErrorMessage(err?.message || "Login failed");
			setPassword("");
			focusPasswordEl();
		} finally {
			setSending(false);
		}
	};

	const onChangePassword = (e: any) => {
		setPassword(e.target.value || "");
	};

	return (
		<div className="layout-container">
			<Header />
			<main className="layout-main flex justify-center align-middle">
				<form
					onSubmit={onSubmit}
					className="m-auto flex flex-col items-center justify-center bg-gray-100 dark:bg-neutral-900 p-15 rounded gap-2.5 w-[500px]">
					<div className="text-2xl font-bold mb-4">Voltage Login</div>
					{!isEmpty(errorMessage) && (
						<div className="block w-full p-2.5 rounded border-4 border-red-600 text-red-600">{errorMessage}</div>
					)}
					<input
						type="password"
						onChange={onChangePassword}
						placeholder="Password"
						disabled={sending}
						value={password}
						autoFocus={true}
						className="w-full h-12 border border-gray-300 dark:border-gray-700 outline-0 rounded text-lg px-4 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white transition-colors duration-200 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
					/>
					<button
						type="submit"
						disabled={sending}
						className="ml-auto py-4 px-8 border-0 w-full rounded bg-black text-white font-bold text-lg cursor-pointer transition-colors duration-200 hover:bg-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed">
						Sign In
					</button>
					{sending && <ScreenLoading />}
				</form>
			</main>
		</div>
	);
}

export default Login;
