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

- Docker and Docker Compose
- Make (for lint and test targets)

### First-time setup

From the repository root:

```bash
cp .env.example .env
docker compose up --build
```

The frontend uses a named Docker volume for `node_modules` so dependencies stay inside the container. Source code is bind-mounted for hot reload on both services.

Local endpoints:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/api/v1/health`

### Rebuild after dependency changes

If `package.json` or backend requirements change, or the frontend container behaves oddly, tear down and rebuild with a fresh `node_modules` volume:

```bash
docker compose down
docker volume rm momentum-projects-dashboard_frontend_node_modules
docker compose up --build
```

If the volume name differs on your machine, list volumes with `docker volume ls` and remove the one ending in `_frontend_node_modules`.

## Verification

Run the full quality gates from the repository root:

```bash
make lint
make test
```

`make lint` runs Ruff, mypy, radon, TypeScript checking, and ESLint. `make test` runs backend pytest with coverage and frontend Vitest with coverage. Thresholds and rules are defined in `AGENTS.md`.
