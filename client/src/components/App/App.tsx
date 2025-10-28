import Header from "@/components/Header/Header";
import Debugger from "@/containers/Debugger/Debugger";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { useLayoutEffect } from "react";
import SignIn from "@/components/SignIn/SignIn";

function App() {
	const { setCurrentScreenDimension, isLoggedIn } = useGlobalStateContext();

	// actions
	const updateMediaQuery = (value: number) => {
		if (value < 768) {
			setCurrentScreenDimension("mobile");
		} else if (value > 1080 && value < 1450) {
			setCurrentScreenDimension("leptop");
		} else if (value < 1080) {
			setCurrentScreenDimension("tablet");
		} else {
			setCurrentScreenDimension("desktop");
		}
	};

	// effects
	useLayoutEffect(() => {
		const containerElement: any = document.getElementById("root");
		if (!containerElement) {
			return;
		}

		const containerWidth = containerElement.clientWidth;
		updateMediaQuery(containerWidth);
		const resizeObserver = new ResizeObserver((entries) => {
			const { width = containerWidth } = (entries[0] && entries[0].contentRect) || {};
			updateMediaQuery(width);
		});
		resizeObserver.observe(containerElement);
		return () => {
			if (containerElement) {
				resizeObserver.unobserve(containerElement);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="flex flex-col p-8 h-full" id="app-container">
			{isLoggedIn ? (
				<>
					<Header />
					<main className="flex-1 relative h-[calc(100%_-_90px)]">
						<Debugger />
					</main>
				</>
			) : (
				<main className="flex-1 relative h-full">
					<SignIn />
				</main>
			)}
		</div>
	);
}

export default App;
