import { Instance, Worker } from "@/interfaces/instance";

/**
 * Get a human-readable name for an instance based on its hostname
 * If multiple instances have the same hostname, append an index
 */
export const getInstanceName = (instances: Instance[], instance: Instance): string => {
	const hostname = instance.specs?.hostname || "Unknown";
	const sameHostname = instances.filter((i) => i.specs?.hostname === hostname);

	if (sameHostname.length === 1) return hostname;

	const index = sameHostname.findIndex((i) => i.key === instance.key) + 1;
	return `${hostname} #${index}`;
};

/**
 * Get instance name for a worker
 */
export const getInstanceNameForWorker = (instances: Instance[], worker: Worker): string => {
	const instance = instances.find((i) => i.key === worker.instance_key);
	if (!instance) return "Unknown Instance";
	return getInstanceName(instances, instance);
};

/**
 * Get a human-readable name for a worker based on its position among instance workers
 */
export const getWorkerName = (workers: Worker[], worker: Worker): string => {
	// Get all workers from the same instance
	const instanceWorkers = workers.filter((w) => w.instance_key === worker.instance_key);

	// Sort by created_at to ensure consistent ordering
	const sortedWorkers = [...instanceWorkers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

	const index = sortedWorkers.findIndex((w) => w.key === worker.key) + 1;
	return `Worker #${index}`;
};

/**
 * Get a consistent color for an instance based on its key
 * Uses hash to ensure same instance always gets same color
 */
export const getInstanceColor = (instanceKey: string): string => {
	const colors = ["blue", "green", "purple", "orange", "pink", "indigo", "cyan", "teal"];

	// Simple hash function
	const hash = instanceKey.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

	return colors[hash % colors.length];
};

/**
 * Get Tailwind color classes for instance badge
 */
export const getInstanceColorClasses = (instanceKey: string): string => {
	const color = getInstanceColor(instanceKey);

	const colorMap: Record<string, string> = {
		blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
		green: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
		purple: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
		orange: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
		pink: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800",
		indigo: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800",
		cyan: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",
		teal: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800"
	};

	return colorMap[color] || colorMap.blue;
};

/**
 * Get a lighter dot color for workers (child of instance color)
 */
export const getWorkerDotColor = (instanceKey: string): string => {
	const color = getInstanceColor(instanceKey);
	return `bg-${color}-400`;
};

/**
 * Get a human-readable name for a job from its input
 * Priority: file_name > url (last segment) > path (last segment)
 */
export const getJobName = (job: { input?: { file_name?: string; url?: string; path?: string } } | null | undefined): string | null => {
	// if no job or no input, return null
	if (!job || !job?.input) {
		return null;
	}

	// 1. find input.file_name
	if (job.input?.file_name) {
		return job.input.file_name;
	}

	// 2. find input.url
	if (job.input?.url) {
		const urlSegments = job.input.url.split("/");
		const lastSegment = urlSegments[urlSegments.length - 1];
		if (lastSegment) return lastSegment;
	}

	// 3. find input.path
	if (job.input?.path) {
		const pathSegments = job.input.path.split("/");
		const lastSegment = pathSegments[pathSegments.length - 1];
		if (lastSegment) return lastSegment;
	}

	return null;
};
