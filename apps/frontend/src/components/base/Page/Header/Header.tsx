import { ReactNode, useEffect, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button, Tooltip } from "@/components";

interface PageHeaderProps {
	title: string;
	onRefresh?: () => void;
	isRefreshing?: boolean;
	children?: ReactNode;
}

export function PageHeader({ title, onRefresh, isRefreshing = false, children }: PageHeaderProps) {
	const [isSpinning, setIsSpinning] = useState(false);

	useEffect(() => {
		if (!isRefreshing) {
			setIsSpinning(true);

			const timer = setTimeout(() => {
				setIsSpinning(false);
			}, 1000);

			return () => clearTimeout(timer);
		}
	}, [isRefreshing]);

	return (
		<div className="flex flex-row flex-wrap justify-between items-start sm:items-center gap-4">
			<div className="flex items-center gap-3">
				<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{title}</h3>
				{onRefresh && (
					<Tooltip content="Reload">
						<Button
							variant="ghost"
							size="md"
							iconOnly
							className="mt-1"
							onClick={onRefresh}
							disabled={isRefreshing}>
							<ArrowPathIcon className={`h-5 w-5 ${isSpinning ? "animate-spin" : ""}`} />
						</Button>
					</Tooltip>
				)}
			</div>
			{children && <div className="flex sm:flex-row gap-3 w-auto">{children}</div>}
		</div>
	);
}

export default PageHeader;
