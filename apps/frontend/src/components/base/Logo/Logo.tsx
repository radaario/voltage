import { useNavigate } from "react-router-dom";

interface LogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	className?: string;
	clickable?: boolean;
}

const sizeClasses = {
	sm: "text-xl sm:text-2xl",
	md: "text-2xl sm:text-3xl",
	lg: "text-3xl sm:text-4xl",
	xl: "text-4xl sm:text-5xl"
};

function Logo({ size = "md", className = "", clickable = true }: LogoProps) {
	const navigate = useNavigate();

	const baseClasses =
		"select-none leading-none font-medium tracking-wider uppercase bg-neutral-700 dark:bg-white text-transparent bg-clip-text drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]";

	const handleClick = () => {
		if (clickable) {
			navigate("/");
		}
	};

	return (
		<h2
			onClick={handleClick}
			className={`${baseClasses} ${sizeClasses[size]} ${className} ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
			aria-label="Voltage logo text">
			VOLTAGE
		</h2>
	);
}

export default Logo;
