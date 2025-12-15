## Voltage Frontend

This package contains the **Voltage dashboard**, a React + TypeScript application built with Vite. It provides a web interface to:

- Monitor jobs, logs, notifications, instances, and workers
- Inspect job inputs, outputs, specs, and outcomes
- View instance and worker details, including recent activity
- Manually retry, cancel, or inspect failed jobs (depending on backend config)

The frontend talks to the Voltage API and runtime services defined in the monorepo root. Most of the configuration is done via environment variables in the root `.env` file.

---

## Getting Started

From the **repository root** we recommend using the existing pnpm scripts:

```bash
pnpm dev:frontend   # start only the frontend in dev mode
```

By default the app runs at `http://localhost:5173` and expects the API to be reachable at the URL configured in your environment (see the root README for details).

If you want to run just this package manually:

```bash
cd apps/frontend
pnpm install
pnpm dev
```

---

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- @tanstack/react-query and @tanstack/react-table

The frontend is primarily a consumer of the API; business rules and heavy lifting (FFmpeg, workers, queues) live in the backend and runtime services.
