# PRD — Backend hardening refactor (pre Phase 2 income)

**Date:** 2026-05-18  
**Status:** NEEDS OWNER (decisions recorded — schema approval for `time_logs` per ADR 003)  
**Author:** Architect Agent  
**Branch target (implementation):** `feat/backend-refactor` (or stacked `feat/backend-refactor-*` PRs per TRD)

---

## 1. Feature summary

A **minimal, incremental backend refactor** that closes the highest-priority **non-auth, non-Postgres** gaps identified in [`docs/code-review-16-05.md`](../docs/code-review-16-05.md) (§B Top 10, §E Refactor roadmap) and hardens invariants before a separate **Phase 2 — Income tracking** architect pass ([`plans/BACKLOG.md`](BACKLOG.md), [`docs/V1-PRD.md`](../docs/V1-PRD.md) §3.3).

This is **prep and hardening**, not Phase 2 schema or income endpoints.

---

## 2. Problem statement

The backend is well-layered (routers → services → SQLModel) and CI-gated (`make lint`, `make test` on `main`), but several **domain consistency** and **API semantics** issues create bug risk and friction for Phase 2:

- Task mutations do not all enforce the same “parent project (and venture) must be active” rules.
- Denormalized `time_logs.project_id` is only correct on create; task moves can desync logs.
- Business-rule failures often return **422**, overlapping Pydantic validation and complicating client handling.
- Integration coverage for **archived venture/project × task/time-log mutations** is incomplete.
- Small DRY and documentation gaps (`utc_now`, API prefix drift) add noise before new services land.

---

## 3. User outcomes

| Actor | Outcome |
|--------|---------|
| **Owner (single user, local)** | No intentional UX change for happy paths; fewer silent inconsistencies (e.g. Kanban drag on archived work). |
| **Future Phase 2 implementer** | Clear mutation guards, integrity rules, and error semantics to extend without re-auditing task/time-log paths. |
| **Frontend (`feat/frontend-refactor`)** | Stable contracts unless an explicitly coordinated status-code or route change is approved; no dependency on React Query migration for backend work. |

**User-visible behaviour:** **None by default** — except where we **fix bugs** (e.g. blocking `PATCH /tasks/{id}/status` on archived projects) that today may succeed incorrectly.

---

## 4. Goals (prioritized, evidence-ranked)

Priority reflects **severity × likelihood × Phase 2 blast radius**, verified against `backend/app/services/tasks.py`, tests, and api-map.

| P | Goal | Code-review signal | Primary classification |
|---|------|-------------------|-------------------------|
| **P0** | **Single shared task/time-log mutation guard** on all write paths | #4 | **Bug fix** + **test gap** |
| **P0** | **`time_logs.project_id` integrity** (assert + sync on task move) | #6 | **Bug fix** (move path) + **test gap** |
| **P1** | **Archive / parent-active matrix integration tests** | §E.2 | **Test gap** |
| **P2** | **HTTP status semantics** (422 vs 409/400) | #5 | **Contract change** (phased) |
| **P2** | **Centralize `utc_now`** | #8 | **DRY** |
| **P3** | **API prefix / versioning alignment** (document + optional env) | §E.2 | **Docs** (+ optional small config) |
| **P4** | **DELETE-as-archive deprecation** (only if owner approves) | #3 | **Contract change** (deprecation window) |
| **P2** | **Pagination base structure** | #7 | **Contract extension** (opt-in; backward compatible) |

---

## 5. Scope

### In scope

- Shared mutation guards in `backend/app/services/` (not routers).
- Service-level asserts and cascade for `time_logs.project_id` when `tasks.project_id` changes.
- New/extended pytest coverage (integration-style matrix for archive/parent rules).
- `backend/app/core/time.py` and import updates across models/services.
- Documented **error-code policy** and optional phased status-code changes with test updates.
- `docs/api-map.md` and `docs/database-schema.md` sync when behaviour or documented semantics change.
- Optional: `POST …/archive` routes with **dual-route deprecation** for project/venture archive (owner decision).
- Optional: frontend `api/*` status handling only when status codes change in the same release.

### Out of scope

- Authentication / authorization (#1 in code review).
- Postgres or engine migration (#10 / §E.4).
- Greenfield API rewrite or versioning scheme (`/api/v2`).
- Phase 2 income tables, endpoints, or reporting ([`plans/BACKLOG.md`](BACKLOG.md) Phase 2).
- Frontend refactor implementation ([`docs/frontend-refactor-prd-trd.md`](../docs/frontend-refactor-prd-trd.md) on `feat/frontend-refactor` — coordination only).
- Full cursor UX on every list surface (frontend can adopt incrementally).
- God-component splits (`App.tsx`) — frontend track.
- Test file renames (#9) — separate hygiene unless touched for other reasons.

---

## 6. Success metrics

| Metric | Target |
|--------|--------|
| CI | `make lint` and `make test` pass on each merged PR |
| Task guard coverage | Every mutating task/time-log service entry point calls shared guard (see TRD inventory) |
| Regression tests | Matrix tests for archived project/venture × create/patch/status/time-log paths; **no** undocumented 200 on blocked mutations |
| `time_logs.project_id` | After `PATCH` task `project_id`, all child logs match task’s project; create/update assert `log.project_id == task.project_id` |
| HTTP policy | Documented mapping; if Phase C shipped, tests assert new codes per policy table |
| Coverage | Backend coverage gate ≥ 80% maintained |
| User-visible regressions | Owner smoke: Kanban drag, task edit, time log CRUD on active projects unchanged |

---

## 7. API impact summary

| Change type | Frontend must change same release? |
|-------------|--------------------------------------|
| Task guards (409 on blocked mutations) | **No** if UI already avoids archived projects; **verify** Kanban/status paths don’t rely on silent success |
| `time_logs.project_id` sync on task move | **No** (response shape unchanged) |
| HTTP 422 → 409/400 migration | **Yes** if any UI branches on `status === 422` for business errors; today [`frontend/src/api/client.ts`](../frontend/src/api/client.ts) treats status generically — **low risk** but tests in `modules.test.tsx` hard-code 422 |
| `POST …/archive` + DELETE deprecation | **Yes** when DELETE removed; **no** during dual-route window |
| API prefix alignment | **Optional** — only if `VITE_API_BASE_URL` + path builder adopted |

Coordinate with **`feat/frontend-refactor`**: avoid coupling to React Query migration; limit coordinated diffs to `frontend/src/api/*` error handling if status codes change.

---

## 8. Data model impact

| Item | Alembic? |
|------|----------|
| `time_logs.status` (`active` \| `archived`) | **Yes** — [ADR 003](../ADR/003-time-log-archive-on-task-delete.md) |
| `time_logs.task_id` nullable | **Yes** — detach logs when task hard-deleted |
| `time_logs.project_id` | **No column change** — keep denormalized; cascade on task move (Q2) |
| Phase 2 income tables | **Out of scope** |

**Owner approved** time log archive schema via Q1 (2026-05-18).

---

## 9. Assumptions

- Single-user, local SQLite deployment remains the norm through Phase 2.
- Venture archive continues to cascade-archive active projects (`ventures.py`); guards align with that model.
- `DELETE /tasks/{id}` **hard deletes** the task and **archives** its time logs ([ADR 003](../ADR/003-time-log-archive-on-task-delete.md)).
- **API platform rule:** `DELETE` = hard delete; archive = `POST/PATCH` ([ADR 002](../ADR/002-api-delete-vs-archive-semantics.md)).
- Frontend refactor doc may live only on `feat/frontend-refactor`; backend does not block on it.

---

## 10. Owner decisions (recorded — 2026-05-18)

| # | Topic | Decision |
|---|--------|----------|
| **Q1** | Task delete vs time logs | **`DELETE /tasks/{id}`** = hard delete task. **Child time logs archived** (not deleted) — work history preserved on project ([ADR 003](../ADR/003-time-log-archive-on-task-delete.md)). **`DELETE` time-log** = hard delete single entry (user correction). |
| **Q1** | API-wide semantics | **`DELETE` = true delete**; UI “delete” that means archive uses **`POST/PATCH` archive** ([ADR 002](../ADR/002-api-delete-vs-archive-semantics.md)). |
| **Q1** | Guards on archived parent | **`delete_task`** / **`delete_time_log`** **not** blocked by archived project; create/patch/status/log create-patch **blocked** (Phase A). |
| **Q2** | Task `project_id` move | **Cascade** `time_logs.project_id` for active logs when task `project_id` changes. |
| **Q3** | HTTP status migration | **Single PR** (tickets may split underneath). |
| **Q4** | Project/venture archive | **`POST …/archive`** canonical; **`DELETE` temporary alias** during migration; then **remove** project/venture `DELETE` until true purge exists ([ADR 001](../ADR/001-delete-archive-deprecation.md), [ADR 002](../ADR/002-api-delete-vs-archive-semantics.md)). |
| **Q5** | Pagination | **Implement now** — opt-in base structure (TRD §9). |

## 11. Resolved behaviour summary

### Tasks and time logs

| User action | API | Effect on task | Effect on time logs |
|-------------|-----|----------------|---------------------|
| Archive task (UI) | `PATCH` `status: archived` | Row kept | Unchanged |
| Delete task (API) | `DELETE /tasks/{id}` | Row removed | **Archived**, `task_id` cleared, `project_id` kept |
| Delete one time log (UI) | `DELETE …/time-logs/{id}` | Unchanged | Row removed |
| Edit task / log on archived project | `PATCH` / `POST` | **409** (Phase A) | **409** |

### Projects and ventures

| User action | API (target) |
|-------------|----------------|
| Archive project/venture (UI) | `POST /{id}/archive` (then remove `DELETE` alias) |
| True purge (future) | `DELETE` when designed — out of this refactor |

---

## 12. Dependencies

- None on Phase 2 PRD/TRD.
- Soft coordination with `feat/frontend-refactor` if Phase C (HTTP codes) or Phase D (archive routes) ships.
- Implementation follows repo orchestrator / quality gates in [`AGENTS.md`](../AGENTS.md).

---

## 13. ADR references

| ADR | Topic |
|-----|--------|
| [ADR 001](../ADR/001-delete-archive-deprecation.md) | POST archive + temporary DELETE alias for projects/ventures |
| [ADR 002](../ADR/002-api-delete-vs-archive-semantics.md) | Platform rule: DELETE = hard delete |
| [ADR 003](../ADR/003-time-log-archive-on-task-delete.md) | Archive logs when task hard-deleted; schema |

Task guards, `utc_now` cascade, and pagination helpers remain service-layer (no separate ADR).

---

## 14. Recommended PR sequence (after approval)

1. **PR1 — Phase A:** Mutation guards + archive matrix tests.  
2. **PR2 — Phase B1:** Alembic `time_logs.status` + nullable `task_id`; `delete_task` archives logs; tests.  
3. **PR3 — Phase B2:** Cascade `project_id` on task move.  
4. Subsequent: pagination (F), HTTP codes (C), POST archive (D), `utc_now` (E).

---

**Status: NEEDS OWNER** — owner decisions complete; confirm sign-off on **Alembic** for ADR 003, then planner/orchestrator may ticket.
