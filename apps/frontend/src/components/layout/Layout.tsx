import { Outlet } from "react-router-dom";
import Header from "@/components/layout/Header/Header";
import Footer from "@/components/layout/Footer/Footer";

const Layout: React.FC = () => {
	return (
		<div className="layout-container">
			<Header />
			<main className="layout-main">
				<Outlet />
			</main>
			<Footer />
		</div>
	);
};

export default Layout;
