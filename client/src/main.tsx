import ReactDOM from "react-dom/client";
import App from "@/components/App/App.tsx";
import "@/utils/moment";
import "@/index.css";
import { GlobalStateProvider } from "@/contexts/GlobalStateContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<GlobalStateProvider>
		<App />
	</GlobalStateProvider>
);
