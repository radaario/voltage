import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

// Button Component Types
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?:
		| "primary"
		| "secondary"
		| "danger"
		| "warning"
		| "info"
		| "ghost"
		| "soft"
		| "outline-primary"
		| "outline-secondary"
		| "outline-danger";
	size?: "xs" | "sm" | "md" | "lg";
	isLoading?: boolean;
	iconOnly?: boolean;
	rounded?: "none" | "sm" | "md" | "lg" | "full";
	hover?:
		| "primary"
		| "secondary"
		| "danger"
		| "warning"
		| "info"
		| "ghost"
		| "soft"
		| "text-primary"
		| "text-secondary"
		| "text-danger"
		| "text-warning"
		| "text-success";
	children: React.ReactNode;
}

// Input Component Types
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	helperText?: string;
}

// Label Component Types
export type LabelSize = "sm" | "md" | "lg";
export type LabelVariant = "success" | "error" | "warning" | "info" | "gray" | "neutral" | "blue" | "purple" | "green" | "red" | "yellow";

export interface LabelProps {
	children: React.ReactNode;
	size?: LabelSize;
	variant?: LabelVariant;
	status?: string;
	statusColor?: boolean;
	hidden?: string;
	progress?: number;
	className?: string;
	icon?: boolean;
}

// Tooltip Component Types
export interface TooltipProps {
	children: React.ReactNode;
	content: string;
	placement?: "top" | "bottom" | "left" | "right";
}

// TimeAgo Component Types
export interface TimeAgoProps {
	datetime: string | Date;
	className?: string;
	showTooltip?: boolean;
}

// Pagination Component Types
export interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	itemsPerPage?: number;
	totalItems?: number;
}

// EmptyState Component Types
export interface EmptyStateProps {
	title?: string;
	message?: string;
	icon?: React.ReactNode;
	action?: React.ReactNode;
}

// LoadingOverlay Component Types
export interface LoadingOverlayProps {
	show: boolean;
	message?: string;
}

// Logo Component Types
export interface LogoProps {
	className?: string;
	showText?: boolean;
}

// Alert Component Types
export type AlertVariant = "success" | "error" | "warning" | "info";

export interface AlertProps {
	variant?: AlertVariant;
	title?: string;
	message: string;
	onClose?: () => void;
	dismissible?: boolean;
}

// MemoizedTableRow Component Types
export interface MemoizedTableRowProps<T> {
	data: T;
	columns: any[];
	onClick?: (data: T) => void;
}

// Modal Component Types
export type ConfirmModalVariant = "danger" | "warning" | "info";

export interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
	message?: React.ReactNode;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmModalVariant;
	isLoading?: boolean;
	loadingText?: string;
}

// Card Component Types
export interface JobCardProps {
	jobKey: string;
}

export interface InstanceCardProps {
	instanceKey: string;
}

export interface WorkerCardProps {
	workerKey: string;
}

export interface NotificationCardProps {
	notificationKey: string;
}

export interface JobPreviewImageProps {
	jobKey: string;
	authToken: string;
	className?: string;
	duration?: number;
	version?: string;
}

// Table Component Types
export interface JobsTableProps {
	data: any[];
	loading: boolean;
	pagination?: any;
	onPageChange?: (page: number) => void;
}

export interface InstancesTableProps {
	data: any[];
	loading: boolean;
}

export interface LogsTableProps {
	data: any[];
	loading: boolean;
	pagination?: any;
	onPageChange?: (page: number) => void;
}

export interface NotificationsTableProps {
	data: any[];
	loading: boolean;
	pagination?: any;
	onPageChange?: (page: number) => void;
}
