import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import type { Instance } from "@/interfaces/instance";

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
		// Use ip-api.com - free, no API key needed
		const response = await fetch(`http://ip-api.com/json/${ip}`);
		const data = await response.json();
		return data.countryCode || "";
	} catch {
		return "";
	}
};

const InstanceDetailModal: React.FC = () => {
	const { instanceKey } = useParams<{ instanceKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const [isAnimating, setIsAnimating] = useState(false);

	// Fetch instances and find the specific one
	const { data: instancesData, isLoading } = useQuery<{ data: Instance[] }>({
		queryKey: ["instances", authToken],
		queryFn: async () => {
			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/instances?token=${authToken}`);
			if (!response.ok) {
				throw new Error("Failed to fetch instances");
			}
			return response.json();
		},
		enabled: !!instanceKey && !!authToken
	});

	const instance = instancesData?.data?.find((inst) => inst.key === instanceKey);

	const [countryCode, setCountryCode] = useState<string>("");

	// Fetch country code from IP
	useEffect(() => {
		if (instance?.system?.ip_address) {
			getCountryFromIP(instance.system.ip_address).then(setCountryCode);
		}
	}, [instance?.system?.ip_address]);

	useEffect(() => {
		// Get scrollbar width before hiding
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = "hidden";
		document.body.style.paddingRight = `${scrollbarWidth}px`;
		// Trigger animation after render
		setTimeout(() => setIsAnimating(true), 10);

		return () => {
			document.body.style.overflow = "unset";
			document.body.style.paddingRight = "";
		};
	}, []);

	const handleClose = () => {
		setIsAnimating(false);
		setTimeout(() => {
			navigate("/instances");
		}, 300);
	};

	const ModalContent = (
		<div className="fixed inset-0 z-50 overflow-y-auto">
			{/* Backdrop */}
			<div
				className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isAnimating ? "opacity-100" : "opacity-0"
				}`}
				onClick={handleClose}
			/>

			{/* Modal Container */}
			<div className="flex min-h-full items-center justify-center p-4">
				{/* Modal Panel */}
				<div
					className={`relative w-full max-w-4xl h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-xl z-10 transition-all duration-300 ${
						isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
					}`}
					onClick={(e) => e.stopPropagation()}>
					{/* Header */}
					<div className="shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
						<div>
							<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Instance Details</h3>
							{instance && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{instance.key}</p>}
						</div>
						<button
							type="button"
							onClick={handleClose}
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
							<XMarkIcon className="h-6 w-6" />
						</button>
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto p-6">
						{isLoading ? (
							<div className="flex justify-center items-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
							</div>
						) : !instance ? (
							<div className="text-center py-12">
								<p className="text-gray-500 dark:text-gray-400">Instance not found</p>
							</div>
						) : (
							<div className="space-y-6">
								{/* System Information */}
								{instance.system && (
									<div>
										<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Information</h4>

										{/* Grid Layout for System Info */}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											{/* IP Address with Country Flag */}
											{instance.system.ip_address && (
												<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
													<div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
														IP Address
													</div>
													<div className="flex items-center gap-2">
														{countryCode && (
															<img
																src={`https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`}
																alt={countryCode}
																className="rounded shadow-sm"
																onError={(e) => {
																	(e.target as HTMLImageElement).style.display = "none";
																}}
															/>
														)}
														<span className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
															{instance.system.ip_address}
														</span>
													</div>
												</div>
											)}

											{/* OS Platform */}
											{instance.system.os_platform && (
												<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
													<div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
														Operating System
													</div>
													<div className="text-lg font-semibold text-gray-900 dark:text-white">
														{instance.system.os_platform}
														{instance.system.os_release && (
															<span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
																{instance.system.os_release}
															</span>
														)}
													</div>
												</div>
											)}

											{/* CPU Info */}
											{instance.system.cpu_core_count && (
												<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
													<div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
														CPU
													</div>
													<div className="space-y-1">
														<div className="text-lg font-semibold text-gray-900 dark:text-white">
															{instance.system.cpu_core_count} Cores
														</div>
														{instance.system.cpu_frequency_mhz && (
															<div className="text-sm text-gray-600 dark:text-gray-300">
																{formatMHz(instance.system.cpu_frequency_mhz)}
															</div>
														)}
														{instance.system.cpu_usage_percent !== undefined && (
															<div className="flex items-center gap-2 mt-2">
																<div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
																	<div
																		className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all"
																		style={{
																			width: `${Math.min(instance.system.cpu_usage_percent, 100)}%`
																		}}
																	/>
																</div>
																<span className="text-sm font-medium text-gray-900 dark:text-white">
																	{formatPercent(instance.system.cpu_usage_percent)}
																</span>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Memory Info */}
											{instance.system.memory_total && (
												<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
													<div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
														Memory
													</div>
													<div className="space-y-1">
														<div className="text-lg font-semibold text-gray-900 dark:text-white">
															{formatBytes(instance.system.memory_total)}
														</div>
														{instance.system.memory_free && (
															<div className="text-sm text-gray-600 dark:text-gray-300">
																Free: {formatBytes(instance.system.memory_free)}
															</div>
														)}
														{instance.system.memory_usage_percent !== undefined && (
															<div className="flex items-center gap-2 mt-2">
																<div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
																	<div
																		className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all"
																		style={{
																			width: `${Math.min(instance.system.memory_usage_percent, 100)}%`
																		}}
																	/>
																</div>
																<span className="text-sm font-medium text-gray-900 dark:text-white">
																	{formatPercent(instance.system.memory_usage_percent)}
																</span>
															</div>
														)}
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Workers */}
								{instance.workers && instance.workers.length > 0 && (
									<div>
										<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workers</h4>
										<div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
											<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
												<thead className="bg-gray-50 dark:bg-gray-900">
													<tr>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
															Worker Key
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
															Status
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
															PID
														</th>
													</tr>
												</thead>
												<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
													{instance.workers.map((worker) => (
														<tr
															key={worker.key}
															className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
															<td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
																{worker.key}
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
																{worker.status}
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
																{worker.pid || "N/A"}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(ModalContent, document.body);
};

export default InstanceDetailModal;
