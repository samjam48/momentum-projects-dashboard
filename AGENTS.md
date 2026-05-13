**Read this before every session. Keep it short. Update CURRENT SPRINT each phase.**
---
## What This Project Is
A self-hosted personal dashboard (FastAPI + SQLModel + SQLite → React + TypeScript + Tailwind).
Full spec: `/docs/V1-PRD.md` (what/why) and `/docs/V1-TRD.md` (how/schema/stack). Read those when you need depth.
Project-specific role prompts live in `/agents/`. Use the agent file that matches the current phase of work.
---
## Hard Constraints
1. **No commits to ****`main`****.** All work on feature branches: `feat/`, `fix/`, `chore/`.
2. **No commit without passing tests when tests exist.** Run `make test` first. Do not skip or comment out failing tests. For repo bootstrap work before any tests exist, owner approval is the required verification gate.
3. **Tests before code.** Failing tests must exist before any production code is written.
4. **No business logic in routers.** Logic and DB access belong in `services/`. Routers call services and return responses.
5. **No hardcoded config.** All env-specific values in `.env`, read via `backend/app/core/config.py`.
6. **No schema changes without Alembic.** Run `alembic revision --autogenerate` — never raw SQL DDL.
7. **No ****`any`**** in TypeScript. No untyped Python.** `mypy --strict` and `tsc --noEmit` must pass clean.
8. **No ****`git push`**** without owner instruction.** Prepare the branch and commit, then stop and report.
9. **No changes outside current task scope.** If you spot something else to fix, add it to `plans/BACKLOG.md`.
10. **No secrets committed.** `.env`, `data/`, `*.db` are in `.gitignore`. Stop immediately if you accidentally stage them.
11. **Keep commits small and trackable.** Prefer one logical change per commit, even during early scaffolding.
---
## Quality Gates (must all pass before marking a task done)
```javascript
bash# Backend
ruff check .
mypy app --strict
radon cc app -n C          # No function complexity > 10
pytest --cov=app --cov-fail-under=80

# Frontend
npx tsc --noEmit
npx eslint src
npm run test -- --coverage  # ≥ 70%

```
`make lint` and `make test` run these. Use them.
---
## Current Sprint — Phase 0: Scaffolding
**Goal:** Skeleton running, nothing more. No feature code.
**Done when:**
- `docker-compose up` starts both services, no errors
- `GET /api/v1/health` returns `{"status": "ok", "version": "0.1.0"}`
- Alembic migration applies cleanly (all tables created)
- Frontend loads at `localhost:3000` with design tokens applied
- All quality gates pass on skeleton code
**In scope:** Docker Compose, FastAPI app factory, SQLModel models, Alembic setup, health endpoint, Vite + React + TS skeleton, Tailwind with design tokens, Makefile, `.env.example`, `.gitignore`, `README.md`.
**Out of scope:** Everything else. No feature routes, no chart components, no Kanban UI.
---
## Definition of Done
1. All acceptance criteria tests pass
2. All quality gates pass
3. Owner has reviewed the summary
4. Owner (not the agent) merges to `main`
