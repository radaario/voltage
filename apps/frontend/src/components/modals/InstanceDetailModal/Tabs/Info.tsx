import { useOutletContext } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { TableKeyValuePreview } from "@/components";

interface OutletContext {
	instance: Instance;
}

// Format helper functions
const formatBytes = (bytes: number): string => {
	const gb = bytes / 1024 ** 3;
	return `${gb.toFixed(2)} GB`;
};

const formatPercent = (value: number): string => {
	return `${value.toFixed(1)}%`;
};

const formatMHz = (mhz: number): string => {
	const ghz = mhz / 1000;
	return `${ghz.toFixed(2)} GHz`;
};

const Info: React.FC = () => {
	const { instance } = useOutletContext<OutletContext>();

	if (!instance) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No instance data available.</p>
			</div>
		);
	}

	// Prepare data with formatted specs
	const tableData = {
		key: instance.key,
		type: instance.type,
		status: instance.status,
		...(instance.specs?.ip_address && { ip_address: instance.specs.ip_address }),
		...(instance.specs?.hostname && { hostname: instance.specs.hostname }),
		...(instance.specs?.os_platform && {
			os_platform: instance.specs.os_release
				? `${instance.specs.os_platform} (${instance.specs.os_release})`
				: instance.specs.os_platform
		}),
		...(instance.specs?.cpu_core_count && { cpu_core_count: instance.specs.cpu_core_count }),
		...(instance.specs?.cpu_frequency_mhz && { cpu_frequency_mhz: formatMHz(instance.specs.cpu_frequency_mhz) }),
		...(instance.specs?.cpu_usage_percent !== undefined && { cpu_usage_percent: formatPercent(instance.specs.cpu_usage_percent) }),
		...(instance.specs?.memory_total && { memory_total: formatBytes(instance.specs.memory_total) }),
		...(instance.specs?.memory_free !== undefined && { memory_free: formatBytes(instance.specs.memory_free) }),
		...(instance.specs?.memory_usage_percent !== undefined && {
			memory_usage_percent: formatPercent(instance.specs.memory_usage_percent)
		}),
		...(instance.created_at && { created_at: instance.created_at }),
		...(instance.updated_at && { updated_at: instance.updated_at })
	};

	return <TableKeyValuePreview data={tableData} />;
};

export default Info;
