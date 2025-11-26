import { Alert } from "@/components";

interface ErrorAlertProps {
	error?: Error | unknown;
	errors?: (Error | unknown)[];
	defaultMessage?: string;
}

export function ErrorAlert({ error, errors, defaultMessage = "An error occurred" }: ErrorAlertProps) {
	const errorList = errors || (error ? [error] : []);
	const firstError = errorList.find((e) => e !== null && e !== undefined);

	if (!firstError) return null;

	const message = firstError instanceof Error ? firstError.message : defaultMessage;

	return <Alert variant="error">{message}</Alert>;
}

export default ErrorAlert;
