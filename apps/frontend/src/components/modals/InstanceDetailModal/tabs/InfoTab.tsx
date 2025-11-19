import { useOutletContext } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { useState, useEffect } from "react";

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

const getCountryFromIP = async (ip: string): Promise<string> => {
	try {
		const response = await fetch(`http://ip-api.com/json/${ip}`);
		const data = await response.json();
		return data.countryCode || "";
	} catch {
		return "";
	}
};

const InfoTab: React.FC = () => {
	const { instance } = useOutletContext<OutletContext>();
	const [countryCode, setCountryCode] = useState<string>("");

	useEffect(() => {
		if (instance?.specs?.ip_address) {
			getCountryFromIP(instance.specs.ip_address).then(setCountryCode);
		}
	}, [instance?.specs?.ip_address]);

	if (!instance) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No instance data available.</p>
			</div>
		);
	}

	const specs = instance.specs;

	return (
		<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg">
			<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
				<thead className="bg-gray-50 dark:bg-neutral-900">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Key
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Value
						</th>
					</tr>
				</thead>
				<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
					{/* Key */}
					<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
						<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">Key</td>
						<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
							<span className="font-mono text-xs">{instance.key}</span>
						</td>
					</tr>

					{/* Type */}
					{instance.type && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">Type</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{instance.type}</td>
						</tr>
					)}

					{/* Status */}
					<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
						<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">Status</td>
						<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{instance.status}</td>
					</tr>

					{/* IP Address */}
					{specs?.ip_address && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								IP Address
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								<div className="flex items-center gap-2">
									{countryCode && (
										<img
											src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
											alt={countryCode}
											className="w-4 h-auto rounded shadow-sm"
										/>
									)}
									<span className="font-mono">{specs.ip_address}</span>
								</div>
							</td>
						</tr>
					)}

					{/* Hostname */}
					{specs?.hostname && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								Hostname
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{specs.hostname}</td>
						</tr>
					)}

					{/* OS Platform */}
					{specs?.os_platform && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								OS Platform
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								{specs.os_platform}
								{specs.os_release && <span className="text-gray-500 ml-2">({specs.os_release})</span>}
							</td>
						</tr>
					)}

					{/* CPU Cores */}
					{specs?.cpu_core_count && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								CPU Cores
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{specs.cpu_core_count}</td>
						</tr>
					)}

					{/* CPU Frequency */}
					{specs?.cpu_frequency_mhz && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								CPU Frequency
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{formatMHz(specs.cpu_frequency_mhz)}</td>
						</tr>
					)}

					{/* CPU Usage */}
					{specs?.cpu_usage_percent !== undefined && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								CPU Usage
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{formatPercent(specs.cpu_usage_percent)}</td>
						</tr>
					)}

					{/* Memory Total */}
					{specs?.memory_total && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								Memory Total
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{formatBytes(specs.memory_total)}</td>
						</tr>
					)}

					{/* Memory Free */}
					{specs?.memory_free !== undefined && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								Memory Free
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{formatBytes(specs.memory_free)}</td>
						</tr>
					)}

					{/* Memory Usage */}
					{specs?.memory_usage_percent !== undefined && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								Memory Usage
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								{formatPercent(specs.memory_usage_percent)}
							</td>
						</tr>
					)}

					{/* Created At */}
					{instance.created_at && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								Created At
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{instance.created_at}</td>
						</tr>
					)}

					{/* Updated At */}
					{instance.updated_at && (
						<tr className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								Updated At
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{instance.updated_at}</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
};

export default InfoTab;
