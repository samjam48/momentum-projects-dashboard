# Momentum Projects Dashboard

Momentum is a self-hosted personal dashboard for running multiple projects in one place. It combines project tracking, task management, income tracking, goals, and reporting behind a FastAPI backend and a React frontend.

## Phase 0 Status

Phase 0 is the scaffold release. The repository currently includes:

- A FastAPI backend with typed settings and a health endpoint at `/api/v1/health`
- A React 18 + TypeScript + Vite frontend scaffold
- Docker Compose for local backend and frontend development
- Backend test coverage for the health endpoint
- Project documentation, agent guidance, and backlog planning files

## Tech Stack

- Backend: FastAPI, SQLModel, Alembic, SQLite configuration via environment settings
- Frontend: React 18, TypeScript 5, Vite 5
- Tooling: pytest, Ruff, mypy, ESLint, Vitest, Docker Compose

## Key Docs

- `docs/V1-PRD.md` for the product requirements and feature scope
- `docs/V1-TRD.md` for architecture, schema, API design, and repo structure
- `AGENTS.md` for working rules, sprint scope, and quality gates
- `plans/BACKLOG.md` for post-sprint phases and future work

## Local Run Flow

```bash
cp .env.example .env
docker compose up --build
```

Local endpoints:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/api/v1/health`

## Verification Commands

```bash
cd backend && pytest
cd frontend && npm run test
cd frontend && npm run lint
```

The project rules and quality gates are defined in `AGENTS.md`.
