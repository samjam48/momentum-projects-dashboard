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
## Current Sprint — Phase 1b: UX / IA Foundation
**Goal:** Refactor the Phase 1 frontend onto the app shell, design tokens, and Projects page layout defined in `plans/phase-1.5-ux.md`, without changing backend schema.
**Done when:**
- App shell delivers top nav, sidebar scaffold, and Projects page with toolbar + full-width task Kanban + summary table below
- shadcn/ui primitives and `tokens.css` are wired; terracotta palette tokens are in use
- Project/task modal UX, sidebar filtering, and Linear-density Kanban cards ship per tickets `1b-2` and `1b-3`
- Owner cleanup feedback in Phase 1.5 §11 ships per tickets `1b-4` and `1b-5` (Projects page polish; task modal, time logs, archive)
- Phase 1 workflows (CRUD, filter, drag-and-drop, time logs) remain functional on the new layout
- All quality gates pass for the Phase 1b implementation
**In scope:** Tickets `1b-1` through `1b-5` in `plans/tickets-phase-1b-ux-2026-05-14.md` — shell, modals, Kanban, plus §11 cleanup (archive dialog, Lucide icons, App.tsx extraction, modal blur-save, time-log sub-modal).
**Out of scope:** Venture entity, asset flag, project Kanban board, income/goals/dashboard pages, server-persisted preferences, settings purge, and schema migrations (Phase 1.6+).
---
## Definition of Done
1. All acceptance criteria tests pass
2. All quality gates pass
3. Owner has reviewed the summary
4. Owner (not the agent) merges to `main`
