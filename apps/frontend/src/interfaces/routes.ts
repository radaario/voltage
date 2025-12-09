import { FC } from "react";

export interface RouteType {
	path: string;
	component?: FC;
	isAuth?: boolean;
	redirectTo?: string;
	children?: Omit<RouteType, "isAuth">[];
}

export interface AuthWrapperProps {
	isAuth?: boolean;
	redirectTo?: string;
}
