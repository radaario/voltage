import { useTheme } from "@/contexts/ThemeContext";
import radaarLogoDarkSvg from "@/assets/radaar-developed-by-dark.svg";
import radaarLogoLightSvg from "@/assets/radaar-developed-by-light.svg";

const Footer: React.FC = () => {
	const { theme } = useTheme();

	return (
		<footer className="layout-footer">
			<div className="container mx-auto px-4 py-4">
				<div className="flex items-center justify-between align-middle text-xs sm:text-sm text-gray-600 dark:text-gray-400">
					<p className="leading-relaxed">
						{new Date().getFullYear()},{" "}
						<a
							href="https://github.com/radaario/voltage"
							title="Voltage Video Encoder"
							target="_blank">
							Voltage Video Encoder
						</a>
						. MIT License.
					</p>
					<a
						href="https://www.radaar.io/"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity ml-1.5">
						<img
							src={theme === "light" ? radaarLogoDarkSvg : radaarLogoLightSvg}
							alt="Developed by RADAAR"
							className="h-6 w-auto"
						/>
					</a>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
