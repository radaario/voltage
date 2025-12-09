import Header from "@/components/layout/Header/Header";
import Footer from "@/components/layout/Footer/Footer";
import { clsx } from "@/utils";

const LayoutNoAuth = ({ className, children }: { className?: string; children: React.ReactNode }) => {
	return (
		<div className="layout-container">
			<Header />
			<main className={clsx("layout-main", className)}>{children}</main>
			<Footer />
		</div>
	);
};

export default LayoutNoAuth;
