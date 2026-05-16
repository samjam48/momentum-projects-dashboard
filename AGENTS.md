**Read this before every session. Keep it short. Update CURRENT SPRINT each phase.**
---
## What This Project Is
A self-hosted personal dashboard (FastAPI + SQLModel + SQLite → React + TypeScript + Tailwind).
Full spec: `/docs/V1-PRD.md` (what/why) and `/docs/V1-TRD.md` (how/schema/stack). Read those when you need depth.
Project-specific role prompts live in `/agents/`. For a major feature or phase build, start with `/agents/orchestrator.md` — one gated agent at a time, no parallel tickets or sub-agents.
---
## Hard Constraints
1. **No commits to \****`main`**\*\*.** All work on feature branches: `feat/`, `fix/`, `chore/`.
2. **No commit without passing tests when tests exist.** Run `make test` first. Do not skip or comment out failing tests. For repo bootstrap work before any tests exist, owner approval is the required verification gate.
3. **Tests before code.** Failing tests must exist before any production code is written.
4. **No business logic in routers.** Logic and DB access belong in `services/`. Routers call services and return responses.
5. **No hardcoded config.** All env-specific values in `.env`, read via `backend/app/core/config.py`.
6. **No schema changes without Alembic.** Run `alembic revision --autogenerate` — never raw SQL DDL.
7. **No \****`any`**\*\* in TypeScript. No untyped Python.** `mypy --strict` and `tsc --noEmit` must pass clean.
8. **No \****`git push`**\*\* without owner instruction.** Prepare the branch and commit, then stop and report.
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
## Current Sprint — Phase 1.6: Ventures, Project Types, Project Kanban, Activity Types
**Goal:** Implement the signed-off Phase 1.6 domain migration: ventures and category labels, projects nested under ventures with `project_type`, a dedicated Project Kanban board, and time-log activity types.
**Status (2026-05-16):** Tickets **1.6-9** through **1.6-12** are implemented on **`feat/phase-1.6`** with per-ticket commits and Reviewer **SIGNED OFF**. Owner: run `make lint` / `make test`, review diff vs `main`, then open PR (or delegate **PR Checker** per `agents/orchestrator.md`). Reviewer mapping: **`plans/phase-1.6-reviewer-checklist.md`**.
**Ticket source:** Implement `plans/tickets-phase-1.6-2026-05-15.md` in dependency order (`1.6-1` through `1.6-12`) with per-ticket Reviewer sign-off.
**Primary references:** `plans/PRD-phase-1.6-2026-05-15.md`, `plans/TRD-phase-1.6-2026-05-15.md`, `docs/V1-PRD.md`, and `docs/V1-TRD.md`.
**Out of scope:** Task `type` / labels, time-log grouping/filter by activity type, income/goals/dashboard ship, Toggl sync, server-persisted preferences, and true hard-delete/purge UI.
---
## Definition of Done
1. All acceptance criteria tests pass
2. All quality gates pass
3. Owner has reviewed the summary
4. Owner (not the agent) merges to `main`
