import Header from "@/components/layout/Header/Header";
import Footer from "@/components/layout/Footer/Footer";
import { Outlet } from "react-router-dom";
import { clsx } from "@/utils";

const Layout = ({ className }: { className?: string }) => {
	return (
		<div className="layout-container">
			<Header />
			<main className={clsx("layout-main", className)}>
				<Outlet />
			</main>
			<Footer />
		</div>
	);
};

export default Layout;
