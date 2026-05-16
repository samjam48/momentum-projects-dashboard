# Momentum Projects Dashboard

Momentum is a self-hosted personal dashboard for running multiple projects in one place. It combines project tracking, task management, income tracking, goals, and reporting behind a FastAPI backend and a React frontend.

## Tech Stack

- Backend: FastAPI, SQLModel, Alembic, SQLite configuration via environment settings
- Frontend: React 18, TypeScript 5, Vite 5
- Tooling: pytest, Ruff, mypy, ESLint, Vitest, Docker Compose

## Key Docs

- `docs/V1-PRD.md` for the product requirements and feature scope
- `docs/V1-TRD.md` for architecture, schema, API design, and repo structure
- `AGENTS.md` for working rules, sprint scope, and quality gates
- `plans/BACKLOG.md` for post-sprint phases and future work

## Install and Run

### Prerequisites

- Docker and Docker Compose (optional but recommended for the API on macOS)
- Node.js 20+ and npm (for the frontend when running Vite on the host)
- Python 3.12+ and a virtualenv if you run the backend without Docker
- Make (for lint and test targets)

### Recommended macOS workflow (stable)

Full `docker compose` with **both** backend and Vite in containers plus bind-mounted source and `--reload` has caused heavy file-watcher CPU and Docker Desktop instability for some setups. The default here is **API in Docker only** and **Vite on the host** proxying to `localhost:8000`.

1. From the repo root, configure env and start **only** the backend:

   ```bash
   cp .env.example .env
   docker compose up --build backend
   ```

   The backend image runs **without** `uvicorn --reload` by default to reduce watcher load. For code auto-reload inside the container (higher watcher cost on the mounted `./backend` tree), use:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.reload.yml up backend
   ```

2. In another terminal, install and run the frontend on the host:

   ```bash
   cd frontend
   npm ci
   VITE_PROXY_TARGET=http://localhost:8000 npm run dev
   ```

   Open the app at the URL Vite prints (typically `http://localhost:5173`). API requests go through the dev proxy to the container on port 8000.

Local endpoints:

- Frontend (host Vite): see terminal output from `npm run dev`
- Backend health check: `http://localhost:8000/api/v1/health`

### Optional: full Compose (smoke / parity only)

To run frontend and backend **both** in containers (useful for quick smoke checks), activate the Compose profile:

```bash
docker compose --profile full-stack up --build
```

Expect **two** bind-mounted trees (`./backend`, `./frontend`) and container-side watchers (Vite HMR; the backend container still runs **without** `--reload` unless you add `docker-compose.reload.yml`). That pairing can stress Docker Desktop on macOS; prefer the recommended workflow above for daily Phase 1.6 UI work.

Endpoints:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/api/v1/health`

### Rebuild after dependency changes

If `package.json` or backend requirements change, or the frontend container behaves oddly, tear down and rebuild with a fresh `node_modules` volume:

```bash
docker compose --profile full-stack down
docker volume rm momentum-projects-dashboard_frontend_node_modules
docker compose --profile full-stack up --build
```

If the volume name differs on your machine, list volumes with `docker volume ls` and remove the one ending in `_frontend_node_modules`.

## Verification

Run the full quality gates from the repository root:

```bash
make lint
make test
```

`make lint` runs Ruff, mypy, radon, TypeScript checking, and ESLint. `make test` runs backend pytest with coverage and frontend Vitest with coverage. Thresholds and rules are defined in `AGENTS.md`.
