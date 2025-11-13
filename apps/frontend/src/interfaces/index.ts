export interface IEvent {
	key: string;
	source: string;
	environment: null | string;
	type: string;
	description: null | string;
	message: null | string;
	createdAt: string;
}

export * from "./auth";
export * from "./job";
export * from "./routes";
export * from "./instance";
export * from "./log";
export * from "./notification";
