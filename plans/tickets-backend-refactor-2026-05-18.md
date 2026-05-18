# Backend Hardening Refactor Tickets

**Date:** 2026-05-18  
**Status:** SIGNED OFF (owner planning package 2026-05-18)  
**Branch target:** `feat/backend-refactor` (stacked sub-branches `feat/backend-refactor-*` per phase optional)  
**Companion docs:** [`plans/PRD-backend-refactor-2026-05-18.md`](PRD-backend-refactor-2026-05-18.md), [`plans/TRD-backend-refactor-2026-05-18.md`](TRD-backend-refactor-2026-05-18.md), ADR [001](../ADR/001-delete-archive-deprecation.md)–[003](../ADR/003-time-log-archive-on-task-delete.md)

---

## Scope Notes

### In scope

- Shared task/time-log mutation guards in `backend/app/services/` (not routers).
- Alembic migration for `time_logs.status` and nullable `time_logs.task_id` ([ADR 003](../ADR/003-time-log-archive-on-task-delete.md)).
- `delete_task` hard-deletes task and archives child time logs; `delete_time_log` hard-deletes one entry.
- Cascade `time_logs.project_id` on active logs when task `project_id` changes (owner Q2).
- Archive / parent-active integration matrix tests.
- HTTP status realignment (422 → 409/400) in **one PR** — tickets BR-7 through BR-10 may split commits underneath.
- `POST /projects/{id}/archive` and `POST /ventures/{id}/archive` with temporary `DELETE` alias; frontend switches to POST ([ADR 001](../ADR/001-delete-archive-deprecation.md), [ADR 002](../ADR/002-api-delete-vs-archive-semantics.md)).
- Opt-in cursor pagination base for list endpoints (TRD §9; owner Q5).
- `backend/app/core/time.py` centralization and API prefix documentation.
- `docs/api-map.md` and `docs/database-schema.md` sync when behaviour or documented semantics change.

### Out of scope

- Authentication / authorization (code-review #1).
- Postgres or engine migration.
- Phase 2 income tables, endpoints, or reporting schema.
- Frontend refactor implementation on `feat/frontend-refactor` except coordinated archive client (BR-14) and optional Phase C test tweaks (BR-10).
- `GET /tasks/{id}/time-logs` pagination (defer per TRD §9).
- True hard-delete / purge UI for projects or ventures.
- Test file bulk renames (code-review #9) unless a touched file is already being edited.
- React Query migration or `App.tsx` decomposition.

### Coordination with `feat/frontend-refactor`

- **BR-10 / BR-14:** If Phase C (HTTP codes) or Phase D (archive routes) merges before or with frontend work, grep `frontend/src` for `status === 422` business-error assumptions; update `frontend/src/api/modules.test.tsx` in BR-10 only when status assertions break.
- Do **not** block backend refactor on React Query or workspace controller extraction.
- `extractProjects` `{ items: [] }` branch in `frontend/src/api/projects.ts` becomes meaningful after BR-16; no frontend change required until UI adopts `limit`.

---

## Planning Decisions Applied

- **`schema-decision`:** Keep denormalized `time_logs.project_id`; enforce in services (assert on create/update; cascade on task move). Add `time_logs.status` (`active` \| `archived`) and nullable `task_id` via Alembic — no drop-column migration in this refactor.
- **`api-contract-decision`:** Extend existing endpoints only. Platform rule: `DELETE` = hard delete; archive = `POST`/`PATCH` ([ADR 002](../ADR/002-api-delete-vs-archive-semantics.md)). Pagination is opt-in (`limit` omitted → unchanged array response). Phase C is a contract change (status codes only; preserve `detail` strings where possible).
- **`test-strategy-decision`:** Integration tests via httpx `TestClient` for cross-entity rules; new `test_archive_mutation_matrix.py` for the guard matrix; unit tests only if pure helpers are extracted (pagination cursor encode/decode). Tests before production code per ticket.
- **`backend-boundary-decision`:** Guards and integrity in `services/`; routers stay thin; no repository layer. New modules: `task_guards.py`, `schemas/pagination.py`, `services/pagination.py`, `core/time.py`.

---

## Assumptions

- Single-user local SQLite remains the deployment model through Phase 2.
- Venture archive continues to cascade-archive active projects; `ensure_project_mutable` treats cascade-archived projects as archived.
- `DELETE /tasks/{id}` returns **204**; behaviour change is persistence of archived logs, not response shape.
- `list_time_logs` for an existing task returns **active** logs only after BR-4 (archived detached logs are not listed under a live task).
- `_recompute_actual_hours` sums only **active** logs still attached to the task (`task_id` set, `status = active`).
- Phase C ships as **one merged PR** to `feat/backend-refactor` even when implemented across tickets BR-7–BR-10.
- BR-15 (remove project/venture `DELETE` archive alias) runs only after BR-14 is merged and verified; may be a follow-up commit on the same branch.
- Owner has approved Alembic for ADR 003 (recorded 2026-05-18).

---

## Ticket Ordering Rationale

1. **BR-1 → BR-2 (Phase A):** Failing matrix tests lock guard behaviour before `task_guards.py` wiring — highest bug-risk reduction without schema churn.
2. **BR-3 → BR-4 (Phase B1):** Schema + `delete_task` semantics depend on guards existing; tests must fail before migration and service changes.
3. **BR-5 → BR-6 (Phase B2):** `project_id` cascade builds on B1 model (`status` column) and guarded `update_task`.
4. **BR-7 → BR-10 (Phase C):** HTTP status migration after behaviour fixes are green — single PR scope; tasks → other services → docs/tests → optional frontend test tweaks.
5. **BR-11 → BR-12 (Phase E):** `utc_now` and prefix docs are low-risk and independent of contract routes; placed before Phase D to avoid churn in files Phase C already touched.
6. **BR-13 → BR-15 (Phase D):** POST archive routes and DELETE alias first; frontend POST switch; then remove DELETE alias per ADR 001.
7. **BR-16 → BR-17 (Phase F):** Pagination last — no blocker for prior phases; reuses stable list services.

---

## Phase C — Single PR Grouping

Tickets **BR-7**, **BR-8**, **BR-9**, and **BR-10** belong to the **same HTTP status realignment PR** (owner Q3). Do not merge Phase C to `main` until all four tickets pass targeted tests and full `make test`.

---

## Ticket BR-1

### Title

Archive Mutation Matrix — Failing Tests

### Work Type

Test-only

### TRD Phase

**A** — Mutation guards (tests first)

### Primary Files

- **Create:** `backend/app/tests/test_archive_mutation_matrix.py`
- **Extend:** `backend/app/tests/test_tasks.py` (only if a minimal duplicate case is needed; prefer matrix file)
- **Reuse fixtures:** `_create_project`, `_create_task` patterns from `test_tasks.py`; venture archive helpers from `test_ventures.py`

### Reuse / Extend

- Services under test (not modified yet): `backend/app/services/tasks.py` — `create_task`, `update_task`, `update_task_status`, `create_time_log`, `update_time_log`
- Existing coverage to avoid duplicating: `test_patch_archived_project_returns_conflict`, board-status archived cases in `test_projects_board_status.py`, venture cascade in `test_ventures.py`

### Acceptance Criteria

- Add **failing** integration tests (httpx `TestClient`) before any guard implementation:
  | Parent state | Operation | Endpoint | Expected |
  |--------------|-----------|----------|----------|
  | Active project | create task | `POST /api/v1/tasks` | **201** |
  | Archived project | create task | `POST /api/v1/tasks` | **409** |
  | Archived project | patch task | `PATCH /api/v1/tasks/{id}` | **409** |
  | Archived project | status patch | `PATCH /api/v1/tasks/{id}/status` | **409** |
  | Archived project | create time log | `POST …/time-logs` | **409** |
  | Archived project | patch time log | `PATCH …/time-logs/{id}` | **409** |
  | Venture archived (project cascade archived) | status patch | `PATCH /api/v1/tasks/{id}/status` | **409** |
  | Active project | status patch | `PATCH /api/v1/tasks/{id}/status` | **200** |
- Assert response `detail` strings match TRD §3.1 targets where already defined (`"Archived projects cannot accept task changes."`; venture wording for archived venture).
- Add **passing** tests (document current behaviour) that **`DELETE /api/v1/tasks/{id}`** and **`DELETE …/time-logs/{id}`** succeed (**204**) when parent project is **archived** (owner guard exception — unguarded delete paths).
- Do not change production code in this ticket.

### Edge Cases

- Task already `status=archived` on active project: status patch may still be **200** (not blocked by project guard) — matrix row optional; do not fail BR-2 if out of scope.
- Time-log patch on wrong `task_id` remains **404**, not matrix scope.
- Tests must use API prefix consistent with existing suite (`/api/v1/...`).

---

## Ticket BR-2

### Title

Task Mutation Guards Module and Wiring

### Work Type

Backend

### TRD Phase

**A** — Mutation guards

### Primary Files

- **Create:** `backend/app/services/task_guards.py`
- **Modify:** `backend/app/services/tasks.py` — replace `_ensure_task_project_is_active` with shared guards; wire all mutators per TRD §3.2
- **Remove:** `_ensure_task_project_is_active` when fully migrated

### Reuse / Extend

- Mirror venture check from `backend/app/services/projects.py` (`update_project_board_status` archived-venture message).
- Keep `_ensure_parent_chain_allows_archived_leave_kanban` in `update_task_status` (orthogonal to mutable guard).
- Call sites: `create_task`, `update_task`, `update_task_status`, `create_time_log`, `update_time_log` → guarded; `delete_task`, `delete_time_log` → **not** guarded.

### Acceptance Criteria

- Implement `ensure_project_mutable(session, project_id) -> Project`: **404** missing project; **409** archived project; **409** missing or archived parent venture (wording parallel to board-status).
- Implement `ensure_task_mutable(session, task_id) -> Task`: load task; delegate to `ensure_project_mutable` for `task.project_id`.
- Wire guarded paths; **BR-1 matrix tests pass**.
- Existing `test_tasks.py` archived-project POST/PATCH **409** tests continue to pass without duplication regression.
- `mypy --strict`, `ruff`, radon CC ≤ 10 on new/changed functions.
- No router changes.

### Edge Cases

- Project with `venture_id=None`: skip venture check (same as board-status).
- `update_task` with `project_id` change: guard target project via `ensure_project_mutable` on resolved id before apply (cascade is BR-6).
- Do not guard read paths: `list_tasks`, `get_task`, `list_time_logs`.

---

## Ticket BR-3

### Title

Time Log Archive Schema and Delete-Task Tests

### Work Type

Test-only

### TRD Phase

**B1** — Alembic + archive logs on task delete (tests first)

### Primary Files

- **Modify:** `backend/app/tests/test_tasks.py` — rewrite `test_delete_task_removes_task_and_manual_time_logs`
- **Add:** tests for archived log persistence, `task_id` null, `project_id` preserved
- **Optional:** migration smoke test if repo pattern exists for Alembic revisions

### Reuse / Extend

- ADR 003 behaviour table
- Existing `_create_manual_time_log` helpers in `test_tasks.py`

### Acceptance Criteria

- Add **failing** tests before production/schema work:
  - `DELETE /api/v1/tasks/{id}` → **204**; task GET → **404**.
  - Child manual time log row **still exists** in DB with `status='archived'`, `task_id IS NULL`, `project_id` unchanged (verify via direct DB/session fixture or service-level assertion pattern used elsewhere in suite).
  - `GET /api/v1/tasks/{id}/time-logs` → **404** after task delete (task gone).
  - `DELETE …/time-logs/{log_id}` on active task still **hard-deletes** row (**204**); row absent from DB.
  - `list_time_logs` for task with one active and one manually archived log (if archive via service only — else defer archived-list case to BR-4) returns only **active** logs in response body count.
- Rename/repurpose `test_delete_task_removes_task_and_manual_time_logs` to behaviour-based name reflecting archive semantics.
- Do not add Alembic revision in this ticket.

### Edge Cases

- Task with zero time logs: delete still **204**.
- Multiple logs: all archived, all `task_id` cleared.
- Delete task on archived project: must remain **204** (unguarded).

---

## Ticket BR-4

### Title

Time Log Status Migration and Delete-Task Archive

### Work Type

Backend

### TRD Phase

**B1**

### Primary Files

- **Create:** Alembic revision (autogenerate) for `time_logs.status`, nullable `time_logs.task_id`
- **Modify:** `backend/app/models/time_log.py`, `backend/app/services/tasks.py` (`delete_task`, `create_time_log`, `list_time_logs`, `_recompute_actual_hours`)
- **Modify:** `docs/database-schema.md`, `docs/api-map.md` (`DELETE /tasks/{id}` semantics)

### Reuse / Extend

- `TimeLog` model: default `status='active'` for new rows
- `delete_task`: replace `session.delete(time_log)` loop with archive + `task_id=None`
- ADR 003 service rules

### Acceptance Criteria

- Alembic revision applied in dev/test; `time_logs.status` (`active` \| `archived`), `task_id` nullable.
- `create_time_log` sets `status='active'`.
- `delete_task` hard-deletes task; archives all child logs per ADR 003.
- `list_time_logs` returns only logs where `status='active'` and `task_id` matches task.
- `_recompute_actual_hours` sums hours only for active logs attached to task.
- **BR-3 tests pass**.
- Update `docs/database-schema.md` (§5 `time_logs`, delete rules) and `docs/api-map.md` task DELETE description (no longer “deletes time logs”).
- No change to `TimeLogRead` response shape required unless tests need `status` — prefer omitting from API unless owner requests exposure.

### Edge Cases

- Existing rows backfilled to `status='active'` in migration.
- Orphan prevention: archived logs after delete must not violate FK (nullable `task_id`).
- Activity type and hours fields preserved on archived logs.

---

## Ticket BR-5

### Title

Time Log Project ID Cascade Tests

### Work Type

Test-only

### TRD Phase

**B2** — Cascade `project_id` on task move (tests first)

### Primary Files

- **Add:** `backend/app/tests/test_tasks.py` (or matrix file) — `test_time_log_project_id_synced_when_task_moves_project`, assert-on-create tests

### Reuse / Extend

- Existing `test_time_logs_are_manual_sorted_and_inherit_project_id` (regression must pass after BR-6)
- Two-project fixtures from existing project helpers

### Acceptance Criteria

- Add **failing** tests before production code:
  - Create task on project A with active time log; `PATCH` task `project_id` to project B → log `project_id` equals B.
  - Log with `status='archived'` (set up via task delete archive path or direct DB) on same task: after move, archived log **keeps** original `project_id` (only **active** logs cascade).
  - `create_time_log` on task: after flush, `time_log.project_id == task.project_id` (integration-level; may use API POST).
- Do not implement cascade in this ticket.

### Edge Cases

- Task move to archived project: blocked by BR-2 (**409**) — test uses active target project only.
- Multiple active logs: all updated atomically in one `update_task` commit.

---

## Ticket BR-6

### Title

Time Log Project ID Integrity and Cascade

### Work Type

Backend

### TRD Phase

**B2**

### Primary Files

- **Modify:** `backend/app/services/tasks.py` — `update_task` (cascade), `create_time_log`, `update_time_log` (post-flush assert)
- **Modify:** `docs/database-schema.md` (integrity note on denormalized `project_id`)

### Reuse / Extend

- TRD §4 service rules 2–3
- `ensure_task_mutable` before `update_task` body

### Acceptance Criteria

- On `update_task` when `project_id` changes: `UPDATE` all child `time_logs` where `task_id=task.id` and `status='active'` to new `project_id`.
- On `create_time_log` / `update_time_log`: after flush, enforce `time_log.project_id == task.project_id` (raise explicit error — prefer `ValueError` or internal 500 only if assert pattern exists; document choice in PR).
- **BR-5 tests pass**; existing time-log sort/inherit test passes.
- `docs/database-schema.md` documents cascade + assert policy.

### Edge Cases

- `project_id` unchanged in PATCH: no log updates.
- Partial `TaskUpdate` without `project_id`: no cascade.
- Archived logs from prior task delete on another task N/A.

---

## Ticket BR-7

### Title

HTTP Status Semantics — Tasks and Activity Types

### Work Type

Backend

### TRD Phase

**C** — HTTP 422→409/400 (**single PR** with BR-8–BR-10)

### Primary Files

- **Modify:** `backend/app/services/tasks.py`, `backend/app/services/activity_types.py`
- **Modify:** `backend/app/tests/test_tasks.py`, `test_activity_types_and_time_logs_phase_1_6_6.py`, related task/activity tests asserting old **422**

### Reuse / Extend

- TRD §5 policy table
- Rename `_active_activity_type_name_or_422` → `_active_activity_type_name_or_409` (or keep name with 409 inside)

### Acceptance Criteria

- **Tasks:** Empty `TimeLogUpdate` body → **400** (`"At least one field is required."`). Inactive/missing activity type on create/update → **409** (same detail string).
- **Activity types:** Duplicate name/slug, reserved slug, in-use delete → **409** where today service uses **422** for state/rule conflicts (per TRD §5).
- Update **only** tests for endpoints touched in this ticket; leave other services for BR-8.
- Pydantic shape errors remain **422** (FastAPI default).
- No `detail` string changes unless required for accuracy.

### Edge Cases

- `activity_type_id: null` on PATCH log remains valid where supported today.
- Board/order payload validation **not** in this ticket (stays **422** in projects).

---

## Ticket BR-8

### Title

HTTP Status Semantics — Projects, Ventures, Labels

### Work Type

Backend

### TRD Phase

**C** (**single PR**)

### Primary Files

- **Modify:** `backend/app/services/projects.py`, `ventures.py`, `venture_category_labels.py`
- **Modify:** `backend/app/tests/test_projects_board_status.py`, `test_projects_phase_1_6_4.py`, `test_ventures.py`, `test_venture_category_labels.py`, `test_phase_1_6_migration_groundwork.py` (only if asserting business **422**)

### Reuse / Extend

- TRD §5: board reorder unknown id / wrong column → keep **422**; archived entity in order list → **409** (already)

### Acceptance Criteria

- Reclassify business-rule **422** to **409** or **400** per TRD §5 for venture labels (duplicate slug, label in use), venture update rules, and any project service domain conflicts not covered by board-order payload rules.
- **Board-status** `order` validation failures (unknown id, duplicate id, empty order, wrong column) remain **422**.
- All updated tests in listed files pass with new status codes.
- Coordinate with BR-7 so combined Phase C diff is merge-ready.

### Edge Cases

- `category_label_id` JSON `null` on venture update: confirm **422** vs **400** per TRD — document chosen code in api-map during BR-9.
- Archived venture create project: remains **409** (or **404** where today — do not change without test evidence).

---

## Ticket BR-9

### Title

HTTP Status Policy Docs and Test Sweep

### Work Type

Backend

### TRD Phase

**C** (**single PR** — completion gate)

### Primary Files

- **Modify:** `docs/api-map.md` — status code policy table (§ global errors + per-route notes)
- **Grep/fix:** remaining `backend/app/tests/**` expecting business **422** from Phase C services

### Reuse / Extend

- TRD §5 target policy
- PRD §7 frontend impact note

### Acceptance Criteria

- `docs/api-map.md` documents: **422** = Pydantic/shape only; **400** = well-formed rule violation; **409** = state conflict; examples aligned with implemented codes.
- Full backend test run for Phase C passes (`pytest` scoped then `make test` at handoff).
- Grep `backend/app/services` for `HTTP_422_UNPROCESSABLE_ENTITY` — remaining uses justified (payload composition) or migrated.
- Phase C PR ready for owner review: **no partial merge** of BR-7/8 without BR-9.

### Edge Cases

- FastAPI validation errors still use default JSON shape — document distinction from service `HTTPException`.
- Do not change frontend production code in this ticket.

---

## Ticket BR-10

### Title

Frontend API Module Tests — HTTP Status Alignment

### Work Type

Test-only (frontend)

### TRD Phase

**C** (**single PR** — optional if grep clean)

### Primary Files

- **Modify:** `frontend/src/api/modules.test.tsx` (lines asserting `status: 422` for business errors)

### Reuse / Extend

- `frontend/src/api/client.ts` — generic `ApiError.status` (no production change required)

### Acceptance Criteria

- Grep `frontend/src` for `422` business-error branching; update **tests only** where Phase C changed backend codes exercised by module tests.
- If module tests only cover Pydantic **422**, leave unchanged and note in PR.
- `npx tsc --noEmit` and targeted `npm run test` for touched file pass.

### Edge Cases

- Do not migrate React Query or change `projects.ts` / `ventures.ts` archive verb (BR-14).
- Skip ticket if zero test updates required — document “N/A” in PR description.

---

## Ticket BR-11

### Title

Centralize UTC Clock Helper

### Work Type

Backend

### TRD Phase

**E** — `utc_now` centralization

### Primary Files

- **Create:** `backend/app/core/time.py`
- **Modify:** `backend/app/models/*.py` (venture, project, task, time_log, activity_type, venture_category_label), `backend/app/services/tasks.py`, `projects.py`, `ventures.py`, `activity_types.py`, `venture_category_labels.py`
- **Leave unchanged:** `backend/app/db/migrations/versions/20260515_0004*.py` historical `_utc_now`

### Reuse / Extend

- TRD §7 snippet

### Acceptance Criteria

- Single `utc_now() -> datetime` in `core/time.py` (UTC).
- All listed models and services import from `app.core.time`; remove duplicate local definitions (`_utc_now` in tasks service included).
- Existing timestamp-related tests pass without behaviour change.
- No injectable clock / test double (out of scope).

### Edge Cases

- `tasks.py` may keep `_utc_today()` if it delegates to centralized `utc_now`.
- Watch circular imports: models must not import services.

---

## Ticket BR-12

### Title

API v1 Prefix Contract Documentation

### Work Type

Backend + docs (optional minimal frontend)

### TRD Phase

**E** — API prefix docs

### Primary Files

- **Modify:** `docs/api-map.md` (prefix / env section)
- **Optional create:** `frontend/src/api/paths.ts` with `export const API_V1 = '/api/v1'`
- **Reference:** `backend/app/core/config.py` (`api_v1_prefix`), `frontend/src/api/client.ts`

### Reuse / Extend

- TRD §8

### Acceptance Criteria

- Document: server default `/api/v1` via `MOMENTUM_API_V1_PREFIX`; frontend hardcodes paths; changing env requires coordinated path/base update.
- Optional: add `paths.ts` and re-export constant **without** mass-updating every API module (follow-up allowed) OR document deferral in PR.
- No backend URL change in this ticket.

### Edge Cases

- Do not break `VITE_API_BASE_URL` host-only prepending pattern.

---

## Ticket BR-13

### Title

POST Archive Routes and DELETE Alias

### Work Type

Backend

### TRD Phase

**D** — POST archive routes

### Primary Files

- **Modify:** `backend/app/routers/projects.py`, `ventures.py`
- **Modify:** `backend/app/services/projects.py`, `ventures.py` (single `archive_*` entry if not already)
- **Modify:** `backend/app/tests/test_projects_phase_1_6_4.py`, `test_ventures.py`
- **Modify:** `docs/api-map.md`, ADR 001 implementation notes

### Reuse / Extend

- ADR 001: `POST /api/v1/projects/{project_id}/archive`, `POST /api/v1/ventures/{venture_id}/archive`
- Existing DELETE handlers delegate to same service functions (**204**)

### Acceptance Criteria

- Add **POST** archive routes; **DELETE** remains alias with **identical** domain behaviour during migration window.
- OpenAPI/route docstrings note DELETE deprecation per ADR 001.
- Tests: POST and DELETE archive return same status and side effects (project optional body on POST matches DELETE).
- Venture cascade archive on venture archive unchanged.
- **No** project/venture true hard delete introduced.

### Edge Cases

- Idempotent archive on already-archived venture (**204**).
- Project archive with `ProjectArchive` body optional fields preserved.

---

## Ticket BR-14

### Title

Frontend Archive Client — POST Migration

### Work Type

Frontend

### TRD Phase

**D**

### Primary Files

- **Modify:** `frontend/src/api/projects.ts` (`archiveProject`), `frontend/src/api/ventures.ts` (venture archive)
- **Modify:** related frontend tests if archive calls are asserted

### Reuse / Extend

- BR-13 POST routes
- ADR 002 UI mapping

### Acceptance Criteria

- `archiveProject` and venture archive use **`POST …/archive`** instead of `DELETE`.
- Existing UI behaviour unchanged (archive dialog, board flows).
- Frontend tests updated; `npx tsc --noEmit`, eslint on touched files.
- Coordinate merge with BR-13 so POST exists before client ships.

### Edge Cases

- Do not remove DELETE calls from tests until BR-15; backend alias still works if frontend merges first on feature branch.
- No React Query migration.

---

## Ticket BR-15

### Title

Remove Project and Venture DELETE Archive Alias

### Work Type

Backend

### TRD Phase

**D** (completion)

### Primary Files

- **Modify:** `backend/app/routers/projects.py`, `ventures.py` — remove or **405** DELETE archive handlers
- **Modify:** `docs/api-map.md`, ADR 001 status
- **Modify:** backend tests that relied on DELETE archive

### Reuse / Extend

- ADR 001 step 4 — remove DELETE until purge designed
- BR-14 must be on branch/main before this ships

### Acceptance Criteria

- `DELETE /projects/{id}` and `DELETE /ventures/{id}` no longer perform archive (**405** with clear `detail` OR route removed — owner prefers **405** message per ADR 002 “not implemented”).
- `POST …/archive` is the only archive path.
- Tests updated; grep frontend for `DELETE` archive — must be clean.
- Document in `docs/api-map.md`.

### Edge Cases

- External scripts using DELETE archive: breaking change acceptable after alias window.
- Tasks `DELETE` unchanged (hard delete).

---

## Ticket BR-16

### Title

Pagination Schemas and Service Helper

### Work Type

Backend

### TRD Phase

**F** — Pagination base

### Primary Files

- **Create:** `backend/app/schemas/pagination.py`, `backend/app/services/pagination.py`
- **Tests:** unit tests for cursor encode/decode and `apply_cursor_limit` (new small test file acceptable)

### Reuse / Extend

- TRD §9 contract: `limit`, `cursor`, `PaginatedResponse`, `next_cursor`

### Acceptance Criteria

- Implement `PaginatedResponse[T]` (or equivalent typed dict) with `items` and `next_cursor: str | None`.
- Cursor encode/decode documented (e.g. `created_at|id` base64); stable ordering helper `apply_cursor_limit(statement, limit, cursor, order_cols)`.
- Unit tests: round-trip cursor; empty page; `next_cursor` null on last page.
- **No router wiring** in this ticket.

### Edge Cases

- `limit` max **500**; default page size **100** when paginating (enforce in helper or router — document).
- Invalid cursor → **400** or **422** (pick one, document in BR-17).

---

## Ticket BR-17

### Title

Opt-In List Endpoint Pagination

### Work Type

Backend

### TRD Phase

**F**

### Primary Files

- **Modify:** `list_tasks`, `list_projects`, `list_ventures`, `list_activity_types`, `list_labels` in services; matching routers
- **Modify:** `docs/api-map.md`
- **Tests:** per-list pagination tests; confirm existing list tests without `limit` unchanged

### Reuse / Extend

- BR-16 helpers
- TRD §9 priority order: tasks, projects, ventures, activity-types, venture-category-labels
- `frontend/src/api/projects.ts` `extractProjects` already supports `{ items }` — no frontend change required

### Acceptance Criteria

- Query params `limit` (optional int), `cursor` (optional string, valid only with `limit`).
- **No `limit`:** response body unchanged (`list[ResourceRead]`).
- **With `limit`:** `{ "items": [...], "next_cursor": string | null }`.
- Apply to: `GET /tasks`, `GET /projects`, `GET /ventures`, `GET /activity-types`, `GET /venture-category-labels`.
- **Defer:** `GET /tasks/{id}/time-logs`.
- New tests: first page, second page via `next_cursor`, no `limit` regression.
- `docs/api-map.md` updated per route.

### Edge Cases

- Existing filters (`project_id`, `status`, venture filters) compose with pagination.
- `limit=0` or over max → **422** validation.
- Sort order must match cursor encoding columns (`created_at`, `id` unless route differs — document per resource).

---

## Resolved Decisions and Scope Guard

| Topic | Decision |
|-------|----------|
| Task delete | Hard delete task; archive child logs ([ADR 003](../ADR/003-time-log-archive-on-task-delete.md)) |
| Time log delete | Hard delete single entry |
| DELETE vs archive platform-wide | [ADR 002](../ADR/002-api-delete-vs-archive-semantics.md) |
| Project/venture archive | POST canonical; DELETE alias then remove ([ADR 001](../ADR/001-delete-archive-deprecation.md)) |
| Guards on delete | `delete_task` / `delete_time_log` **not** blocked by archived parent |
| HTTP status PR | **Single PR** for BR-7–BR-10 |
| Pagination | Opt-in; default lists unchanged |
| Phase 2 income | Out of scope |

If implementation discovers a guard gap on a mutating path not listed in TRD §3.2, stop and add a ticket amendment before wiring.

---

## Final Status

SIGNED OFF
