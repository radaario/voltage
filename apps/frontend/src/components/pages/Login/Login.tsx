import { useState } from "react";
import { isEmpty } from "lodash-es";
import { useNavigate } from "react-router-dom";
import { Layout, ScreenLoading } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import { Logo, Button, Input } from "@/components";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";

const fakeDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Login() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const { refetchConfig } = useGlobalStateContext();

	// states
	const [password, setPassword] = useState(import.meta.env.VITE_PASSWORD || "");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [sending, setSending] = useState(false);

	// actions
	const onSubmit = async (e: any) => {
		e.preventDefault();

		const focusPasswordEl = async () => {
			await fakeDelay(50);
			const passwordEl: any = document.querySelector("form input[type='password']");
			passwordEl?.focus();
		};

		// if the password is empty
		if (password === "") {
			focusPasswordEl();
			return;
		}

		setSending(true);
		try {
			await login(password);
			refetchConfig();

			// this is for refetching the config after login
			await fakeDelay(300);

			navigate("/", { replace: true });
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
		<Layout.NoAuth className="flex justify-center items-center p-4">
			<div className="w-full max-w-md">
				{/* Card Container */}
				<div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
					{/* Header Section with Gradient */}
					<div className="bg-linear-to-br from-neutral-700 to-neutral-900 dark:from-neutral-900 dark:to-black p-8 text-center">
						<div className="flex justify-center mb-4">
							<div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center">
								<LockClosedIcon className="w-8 h-8 text-white" />
							</div>
						</div>
						<Logo
							size="lg"
							variant="light"
							className="mb-2 mx-auto"
						/>
						<p className="text-neutral-300 text-sm">Enter your password to continue</p>
					</div>

					{/* Form Section */}
					<form
						onSubmit={onSubmit}
						className="p-8 space-y-6">
						{!isEmpty(errorMessage) && (
							<div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
								{errorMessage}
							</div>
						)}

						<Input
							label="Password"
							type="password"
							onChange={onChangePassword}
							placeholder="Enter your password"
							disabled={sending}
							value={password}
							autoFocus={true}
						/>

						<Button
							type="submit"
							isLoading={sending}
							className="w-full">
							Sign In
						</Button>
					</form>
				</div>

				{/* Footer Text */}
				<p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">Secured access to Voltage Dashboard</p>
			</div>
			{sending && <ScreenLoading />}
		</Layout.NoAuth>
	);
}

export default Login;
