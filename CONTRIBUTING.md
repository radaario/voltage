# Contributing to Voltage

🙏 First off, thank you for your interest in contributing to Voltage!

Voltage is an open-source, self-hosted video encoding API service. We welcome contributions of all kinds — bug reports, feature requests, documentation improvements, and code changes.

---

## How to Contribute

### 1. Reporting Bugs

- Use GitHub Issues to report problems
- Include clear reproduction steps
- Provide environment details (OS, Node.js version, database/storage type, etc.)
- Attach logs or screenshots when possible

### 2. Requesting Features

- Open an issue with a clear title (optionally prefixed with `[FEATURE]`)
- Describe the use case and why it is important
- Explain the expected behavior
- If possible, suggest an API or UX proposal

### 3. Submitting Pull Requests

1. **Fork** the repository
2. **Create** a feature branch:
    - `git checkout -b feature/AmazingFeature`
3. **Commit** your changes with a clear message:
    - `git commit -m "feat: add AmazingFeature"`
4. **Push** to your fork:
    - `git push origin feature/AmazingFeature`
5. **Open** a Pull Request against the `main` branch

Please make sure your PR:

- Focuses on a single feature or fix
- Includes tests when applicable
- Updates documentation (README, docs, comments) if behavior changes

---

## Coding Standards

- Use **TypeScript** across the monorepo
- Follow the existing code style and formatting (Prettier, ESLint/TS config)
- Keep functions and modules small and focused
- Prefer explicit types over `any`
- Avoid introducing new runtime dependencies unless necessary

Before opening a PR, run the relevant checks (from the repo root):

```bash
pnpm lint
pnpm test
pnpm typecheck
```

(If some of these scripts are not available yet, just run what exists and mention it in the PR.)

---

## Development Workflow (Monorepo)

This project is organized as a pnpm workspace with multiple apps and packages. Common commands from the repo root:

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm build

# Start all services in development mode
pnpm dev

# Or start individual apps
pnpm dev:api
pnpm dev:runtime
pnpm dev:frontend
```

Check each app's README or package.json for more specific commands.

---

## Community & Conduct

By participating in this project, you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

If you have questions about contributing or want to propose larger changes, feel free to open a discussion or an issue on GitHub.

Thank you for helping make Voltage better! ⚡
