import { ReactNode } from "react";
import PageHeader from "./Header/Header";

interface PageProps {
	children: ReactNode;
}

const Page = ({ children }: PageProps) => {
	return <div className="space-y-6">{children}</div>;
};

Page.Header = PageHeader;

export default Page;
