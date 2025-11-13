const Footer: React.FC = () => {
	return (
		<footer className="layout-footer">
			<div className="container mx-auto px-4 py-4">
				<div className="flex justify-center text-sm text-gray-600 dark:text-gray-400">
					<p>@ {new Date().getFullYear()} Voltage Video Decoder. All rights reserved.</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
