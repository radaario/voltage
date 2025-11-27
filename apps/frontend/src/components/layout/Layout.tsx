import { Outlet } from "react-router-dom";
import Header from "@/components/layout/Header/Header";
import Footer from "@/components/layout/Footer/Footer";
import { clsx } from "@/utils";

const Layout = ({ className }: { className?: string }) => {
	return (
		<div className="layout-container">
			<Layout.Header />
			<main className={clsx("layout-main", className)}>
				<Outlet />
			</main>
			<Layout.Footer />
		</div>
	);
};

const LayoutNoAuth = ({ className, children }: { className?: string; children: React.ReactNode }) => {
	return (
		<div className="layout-container">
			<Layout.Header />
			<main className={clsx("layout-main", className)}>{children}</main>
			<Layout.Footer />
		</div>
	);
};

Layout.NoAuth = LayoutNoAuth;
Layout.Header = Header;
Layout.Footer = Footer;

export default Layout;
