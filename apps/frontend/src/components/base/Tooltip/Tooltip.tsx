import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ReactNode } from "react";

interface TooltipProps {
	children: ReactNode;
	content: string | ReactNode;
	side?: "top" | "right" | "bottom" | "left";
	disableHoverableContent?: boolean;
	delayDuration?: number;
}

function Tooltip({ content, side = "top", delayDuration = 200, disableHoverableContent = true, children }: TooltipProps) {
	// If no content is provided, just return the children without the tooltip
	if (!content || content === "") {
		return children;
	}

	return (
		<TooltipPrimitive.Provider
			delayDuration={delayDuration}
			disableHoverableContent={disableHoverableContent}>
			<TooltipPrimitive.Root>
				<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
				<TooltipPrimitive.Portal>
					<TooltipPrimitive.Content
						side={side}
						sideOffset={5}
						className="z-[9999] overflow-hidden rounded-md bg-gray-900 dark:bg-neutral-700 px-3 py-1.5 text-xs font-medium text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
						{content}
						<TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-neutral-700" />
					</TooltipPrimitive.Content>
				</TooltipPrimitive.Portal>
			</TooltipPrimitive.Root>
		</TooltipPrimitive.Provider>
	);
}

export default Tooltip;
