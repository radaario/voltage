const Footer: React.FC = () => {
	return (
		<footer className="layout-footer">
			<div className="container mx-auto px-4 py-4">
				<div className="flex justify-between align-middle text-sm text-gray-600 dark:text-gray-400">
					<p className="leading-relaxed">
						{new Date().getFullYear()},{" "}
						<a
							href="https://github.com/radaario/voltage"
							title="RADAAR: Social Media Management Tool"
							target="_blank">
							Voltage Video Encoder
						</a>
						. MIT License.
					</p>
					<a
						href="https://www.radaar.io/"
						target="_blank"
						className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity ml-1.5">
						<img
							src="/radaar-developed-by.svg"
							alt="RADAAR"
							className="h-6 w-auto"
						/>
					</a>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
