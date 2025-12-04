import { useNavigate } from "react-router-dom";
import voltageLightLogoPng from "@/assets/voltage-logo-light.png";
import voltageDarkLogoPng from "@/assets/voltage-logo-dark.png";

interface LogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	variant?: "light" | "dark";
	className?: string;
	clickable?: boolean;
}

const sizeWidths = {
	sm: 100,
	md: 150,
	lg: 180,
	xl: 250
};

function Logo({ size = "md", variant = "dark", className = "", clickable = true }: LogoProps) {
	const navigate = useNavigate();

	const handleClick = () => {
		if (clickable) {
			navigate("/");
		}
	};

	return (
		<img
			src={variant === "light" ? voltageLightLogoPng : voltageDarkLogoPng}
			title="Voltage"
			alt="Voltage Video Encoder"
			onClick={handleClick}
			className={`select-none ${className} ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
			style={{ width: sizeWidths[size] }}
		/>
	);
}

export default Logo;
