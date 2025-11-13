module.exports = {
	root: true,
	env: {
		browser: true,
		es2020: true,
		node: true
	},
	extends: [
		"eslint:recommended",
		"plugin:react/recommended",
		"plugin:react/jsx-runtime",
		"plugin:react-hooks/recommended",
		"plugin:jsx-a11y/recommended",
		"plugin:@typescript-eslint/recommended",
		"eslint-config-prettier"
	],
	ignorePatterns: ["dist", "build", ".eslintrc.cjs"],
	parserOptions: { ecmaVersion: "latest", sourceType: "module" },
	settings: {
		react: {
			version: "detect"
		},
		"import/resolver": {
			node: {
				paths: ["src"],
				extensions: [".js", ".jsx", ".ts", ".tsx"]
			}
		}
	},
	plugins: ["react-refresh"],
	rules: {
		// general
		"default-case": 0,
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/ban-ts-comment": "off",
		"react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
		"react/react-in-jsx-scope": "off",
		"no-unused-vars": [
			"error",
			{
				vars: "all",
				args: "after-used",
				ignoreRestSiblings: true,
				argsIgnorePattern: "^_"
			}
		],
		// eqeqeq: "off",
		// "jsx-a11y/anchor-is-valid": "warn",
		// "import/no-anonymous-default-export": "off",
		"react-hooks/exhaustive-deps": "off",
		"jsx-a11y/alt-text": "off"
		// "no-restricted-imports": ["error", { paths: [].concat(...restrictedPaths) }],
	}
};
