import Header from "@/components/layout/Header/Header";
import Footer from "@/components/layout/Footer/Footer";
import LayoutAuth from "@/components/layout/Layouts/Auth/Auth";
import LayoutNoAuth from "@/components/layout/Layouts/NoAuth/NoAuth";

const Layout = () => {
	return null;
};

Layout.Auth = LayoutAuth;
Layout.NoAuth = LayoutNoAuth;
Layout.Header = Header;
Layout.Footer = Footer;

export default Layout;
