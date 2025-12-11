const fs = require("fs");
const path = require("path");

const rootPackage = require("../package.json");
const version = rootPackage.version;

const workspaces = ["apps/api", "apps/frontend", "apps/runtime", "packages/config", "packages/utils"];

workspaces.forEach((workspace) => {
	const pkgPath = path.join(__dirname, "..", workspace, "package.json");
	if (fs.existsSync(pkgPath)) {
		const pkg = require(pkgPath);
		pkg.version = version;
		fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
		console.log(`✓ Updated ${workspace} to v${version}`);
	}
});
