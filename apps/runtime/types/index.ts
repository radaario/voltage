import { ChildProcess } from "child_process";

// Instance types
export interface Instance {
	key: string;
	type: "MASTER" | "SLAVE";
	status: "ONLINE" | "OFFLINE";
	specs?: string;
	outcome?: string | null;
	restart_count?: number;
	updated_at: number;
	created_at: number;
}

export interface InstanceSpecs {
	platform: string;
	arch: string;
	cpus: number;
	memory: number;
	[key: string]: any;
}

// Worker types
export interface Worker {
	key: string;
	index: number;
	instance_key: string;
	job_key: string | null;
	status: "IDLE" | "BUSY" | "TIMEOUT" | "TERMINATED";
	outcome?: string | null;
	updated_at: number;
	created_at: number;
}

export interface WorkerOutcome {
	message: string;
	exit_code?: number | null;
	exit_signal?: string | null;
	[key: string]: any;
}

export type WorkersProcessMap = Map<string, ChildProcess>;

// Job types
export interface Job {
	key: string;
	priority: number;
	status: string;
	try_count: number;
	try_max: number;
	progress?: number;
	outcome?: string | null;
	started_at?: number | null;
	analyzed_at?: number | null;
	completed_at?: number | null;
	updated_at: number;
	created_at: number;
	locked_by?: string | null;
	retry_at?: number | null;
	[key: string]: any;
}

export interface QueuedJob {
	key: string;
	priority: number;
	created_at: number;
	locked_by?: string | null;
}

// Notification types
export interface JobNotification {
	key: string;
	job_key: string;
	status: string;
	try_count: number;
	try_max: number;
	retry_at?: number | null;
	locked_by?: string | null;
	updated_at: number;
	created_at: number;
	[key: string]: any;
}
