import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import radaarLogo from "@/assets/radaar-header.webp";
import localStorage from "@/utils/localStorage";

function Header() {
	const { signOut, setOpenJsonPrettierModal } = useGlobalStateContext();

	// actions
	const handleAllRefresh = (e: any) => {
		e.preventDefault();
		const confirmStatus = confirm("Are you sure about the all clear?");
		if (confirmStatus) {
			// socket.emit(SOCKET_EVENTS.CLIENT.SEND_CLEAR);
		}
	};

	const handleOpenJsonPrettierModal = () => {
		setOpenJsonPrettierModal(true);
	};

	const handleLogout = () => {
		localStorage.remove("authToken");
		signOut();
	};

	return (
		<>
			<div className="relative flex items-center justify-evenly gap-2.5 bg-neutral-900 px-6 rounded">
				<img
					src={radaarLogo}
					alt="RADAAR"
					className="max-h-12"
				/>
				<div className="ml-auto flex flex-wrap justify-end items-center py-4 gap-5">
					<div className="ml-auto flex justify-end flex-wrap gap-1.5">
						<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"> Tıka </button>
						<button
							className="bg-neutral-800 text-white rounded-full w-10 h-10 border-none transition-colors duration-200"
							title="All Refresh"
							onClick={handleAllRefresh}>
							<i className="icon-arrows-cw" />
						</button>
						<button
							className="bg-neutral-800 text-white rounded-full w-10 h-10 border-none transition-colors duration-200"
							title="JSON Prettier"
							onClick={handleOpenJsonPrettierModal}>
							<i className="icon-file-code" />
						</button>
						<div className="block mx-1 my-auto h-7 w-px bg-neutral-700"></div>
						<button
							className="bg-neutral-800 text-white rounded-full w-10 h-10 border-none transition-colors duration-200"
							title="Sign Out"
							onClick={handleLogout}>
							<i className="icon-logout" />
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

export default Header;
