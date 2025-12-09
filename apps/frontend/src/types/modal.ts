import type { Job } from "@/interfaces/job";
import type { Log } from "@/interfaces/log";
import type { Notification } from "@/interfaces/notification";
import type { Instance } from "@/interfaces/instance";
import type { JobOutput } from "@/interfaces/job";

// Generic outlet context for modal tabs
export interface OutletContext<T = unknown> {
	data?: T;
}

// Specific outlet contexts for each modal type
export interface JobOutletContext {
	job: Job;
}

export interface LogOutletContext {
	log: Log;
}

export interface NotificationOutletContext {
	notification: Notification;
}

export interface InstanceOutletContext {
	instance: Instance;
}

export interface OutputOutletContext {
	output: JobOutput;
}

export interface WorkerOutletContext {
	worker: any; // Add proper Worker type when available
}
