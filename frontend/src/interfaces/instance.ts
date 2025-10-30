export interface Worker {
	id: number;
	key: string;
	instance_key: string;
	job_key?: string;
	pid: number | null;
	status: string;
	created_at: string;
	updated_at: string;
}

export interface SystemInfo {
	platform?: string;
	arch?: string;
	cpus?: number;
	totalMemory?: number;
	freeMemory?: number;
	hostname?: string;
	[key: string]: any;
}

export interface Instance {
	id: number;
	key: string;
	type: "MASTER" | "SLAVE";
	status: string;
	system: SystemInfo | null;
	workers: Worker[];
	created_at: string;
	updated_at: string;
}
