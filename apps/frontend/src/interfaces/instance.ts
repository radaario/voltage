// Common outcome structure for workers, jobs, notifications, etc.
export interface Outcome {
	status?: "SUCCESSFUL" | "FAILED" | "SKIPPED" | string;
	http_status_code?: number;
	error?: {
		message?: string;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface Worker {
	[key: string]: unknown;
	id: number;
	key: string;
	index: number;
	instance_key: string;
	job_key?: string;
	status: string;
	outcome?: Outcome | null;
	created_at: string;
	updated_at: string;
}

export interface InstanceSpecs {
	hostname: string;
	ip_address: string | null;
	port: number;
	os_platform: string;
	os_release: string;
	cpu_core_count: number;
	cpu_frequency_mhz: number;
	cpu_usage_percent: number;
	memory_total: number;
	memory_free: number;
	memory_usage_percent: number;
	workers_per_cpu_core: number;
	workers_max: number;
}

export interface InstanceSystem {
	hostname?: string;
	platform?: string;
	arch?: string;
	version?: string;
	[key: string]: unknown;
}

export interface Instance {
	id: number;
	key: string;
	type: "MASTER" | "SLAVE";
	status: string;
	outcome: Outcome | null;
	system: InstanceSystem | null;
	specs: InstanceSpecs | null;
	workers: Worker[];
	restart_count?: number;
	created_at: string;
	updated_at: string;
}
