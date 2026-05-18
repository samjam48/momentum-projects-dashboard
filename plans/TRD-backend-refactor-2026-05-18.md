# TRD — Backend hardening refactor (pre Phase 2 income)

**Date:** 2026-05-18  
**Status:** NEEDS OWNER (owner decisions recorded 2026-05-18 — confirm Alembic sign-off)  
**Companion:** [`plans/PRD-backend-refactor-2026-05-18.md`](PRD-backend-refactor-2026-05-18.md)  
**References:** [`docs/V1-TRD.md`](../docs/V1-TRD.md), [`docs/api-map.md`](../docs/api-map.md), [`docs/database-schema.md`](../docs/database-schema.md), [`docs/code-review-16-05.md`](../docs/code-review-16-05.md)

---

## 1. Current vs target architecture

### Current (unchanged stack)

```
Client (frontend/src/api/*)  →  FastAPI routers (thin)  →  services/*  →  SQLModel + SQLite
```

- **7 routers:** `health`, `projects`, `tasks`, `ventures`, `venture_category_labels`, `activity_types`
- **6 services:** matching domains (tasks service also owns time-log orchestration)
- **No auth**; prefix `settings.api_v1_prefix` default `/api/v1` ([`backend/app/core/config.py`](../backend/app/core/config.py))

### Target (same boundaries, tighter invariants)

| Layer | Change |
|-------|--------|
| `routers/` | Unchanged signatures unless Phase D adds `POST …/archive` |
| `services/` | Shared guards + integrity helpers; centralized clock |
| `core/time.py` | **New** — single `utc_now()` |
| `models/` | Import `utc_now` from `core/time.py` (remove per-file copies) |
| `schemas/` | No shape changes |
| `db/migrations/` | **None** for default plan |

**V1-TRD boundaries preserved:** routers stay transport-only; business rules remain in `services/`; no repository layer ([`backend-boundary-decision`](../docs/ai/skills/backend-boundary-decision.md)).

---

## 2. Issue → file mapping (classification)

| Issue | Concrete files | Type |
|-------|----------------|------|
| **#4 Task mutation guards** | [`backend/app/services/tasks.py`](../backend/app/services/tasks.py) — `create_task`, `update_task`, `update_task_status`, `create_time_log`, `update_time_log`, `delete_time_log`; compare [`projects.py`](../backend/app/services/projects.py) `update_project_board_status` venture check | **Bug fix** + **test gap** |
| **#6 `time_logs.project_id`** | [`tasks.py`](../backend/app/services/tasks.py) `create_time_log` (sets `project_id`); `update_task` (no log sync); [`models/time_log.py`](../backend/app/models/time_log.py) | **Bug fix** on move + **test gap** |
| **#5 HTTP 422 overload** | [`tasks.py`](../backend/app/services/tasks.py), [`projects.py`](../backend/app/services/projects.py), [`ventures.py`](../backend/app/services/ventures.py), [`activity_types.py`](../backend/app/services/activity_types.py), [`venture_category_labels.py`](../backend/app/services/venture_category_labels.py); tests under [`backend/app/tests/`](../backend/app/tests/) | **Contract change** |
| **§E.2 Archive matrix** | New module [`backend/app/tests/test_archive_mutation_matrix.py`](../backend/app/tests/test_archive_mutation_matrix.py) (proposed); extend [`test_tasks.py`](../backend/app/tests/test_tasks.py) | **Test gap** |
| **#8 `utc_now`** | All [`backend/app/models/*.py`](../backend/app/models/), services listed above, migration `20260515_0004` (optional leave-as-is for historical script) | **DRY** |
| **#3 DELETE archive** | [`routers/projects.py`](../backend/app/routers/projects.py), [`routers/ventures.py`](../backend/app/routers/ventures.py); [`frontend/src/api/projects.ts`](../frontend/src/api/projects.ts), [`ventures.ts`](../frontend/src/api/ventures.ts) | **Contract change** (optional) |
| **#7 Pagination** | All list routers — **no code** in this refactor | **Deferred** |
| **API prefix drift** | [`config.py`](../backend/app/core/config.py), [`frontend/src/api/client.ts`](../frontend/src/api/client.ts), all `frontend/src/api/*.ts` hardcoding `/api/v1` | **Docs** + optional config |

### Evidence: P0 guard gap

```182:198:backend/app/services/tasks.py
def update_task_status(session: Session, task_id: str, payload: TaskStatusUpdate) -> Task:
    task = _get_task_or_404(session, task_id)
    # ... no _ensure_task_project_is_active ...
    task.status = payload.status
```

`create_task` / `update_task` call `_ensure_task_project_is_active` (project `status` only). `update_task_status`, `create_time_log`, `update_time_log`, `delete_time_log` do **not**. [`test_tasks.py`](../backend/app/tests/test_tasks.py) covers **409** for `POST`/`PATCH` on archived project but **not** `PATCH …/status` or time-log mutations on archived project.

**Venture-active check:** [`projects.py`](../backend/app/services/projects.py) lines 173–177 check venture when moving board; tasks do not. After venture archive, projects are cascade-archived, so project check usually suffices; guard should still verify venture for parity and corrupt-state safety.

---

## 3. Guard design

### 3.1 New module (recommended)

**File:** `backend/app/services/task_guards.py` (or `backend/app/services/_task_guards.py`)

| Function | Responsibility |
|----------|----------------|
| `ensure_project_mutable(session, project_id) -> Project` | 404 missing project; **409** if `project.status == "archived"`; **409** if parent venture missing or `venture.status != "active"` (mirror board-status wording) |
| `ensure_task_mutable(session, task_id) -> Task` | Load task; call `ensure_project_mutable(session, task.project_id)` |

**Detail strings (align with existing):**

- Archived project: `"Archived projects cannot accept task changes."` (existing)
- Archived venture: `"Projects under archived ventures cannot accept task changes."` (parallel to board-status)

### 3.2 Call sites (mutating inventory)

| Service function | Guard today | Target |
|------------------|-------------|--------|
| `create_task` | `_ensure_task_project_is_active` | `ensure_project_mutable` on `payload.project_id` |
| `update_task` | `_ensure_task_project_is_active` on target | `ensure_task_mutable` + if `project_id` changes, cascade logs (§4) |
| `update_task_status` | **None** | `ensure_task_mutable` |
| `create_time_log` | **None** | `ensure_task_mutable` |
| `update_time_log` | **None** | `ensure_task_mutable` |
| `delete_time_log` | **None** | **Unguarded** — hard delete one log (owner Q1) |
| `delete_task` | **None** | **Unguarded** — hard delete task; **archive** child logs ([ADR 003](../ADR/003-time-log-archive-on-task-delete.md)) |
| `list_time_logs` / `get_task` / `list_tasks` | N/A | Read-only — no guard |

Replace `_ensure_task_project_is_active` with `ensure_project_mutable` and delete duplicate helper when migrated.

**Router impact:** None — same paths, stricter 409 surface.

---

## 4. `time_logs.project_id` integrity

### schema-decision (canonical)

| Option | Verdict |
|--------|---------|
| Drop `project_id`, join via `task_id` only | **Defer** — reporting convenience for Phase 2; migration + API churn |
| DB CHECK `project_id = (SELECT project_id FROM tasks …)` | **Reject** — SQLite friction; app enforcement sufficient for V1 |
| **Keep column + service enforcement** | **Recommended** |

### Service rules

1. **On create** (existing): `project_id=task.project_id`.
2. **On create/update assert:** After flush, `assert time_log.project_id == task.project_id` (or raise 500 in dev — prefer explicit `ValueError` caught in tests).
3. **On `update_task` when `project_id` in payload:** Cascade `project_id` on rows where `status = 'active'` and `task_id = task.id` (owner Q2).
4. **On `delete_task`:** Set each child log to `status = 'archived'`, `task_id = NULL`; preserve `project_id` ([ADR 003](../ADR/003-time-log-archive-on-task-delete.md)).

**Alembic (owner approved):** `time_logs.status` (`active` \| `archived`); nullable `time_logs.task_id`. Update model, `docs/database-schema.md`, autogenerate migration.

### Tests

- `test_time_log_project_id_synced_when_task_moves_project`
- `test_create_time_log_rejects_archived_project` (matrix)
- Regression: existing `test_time_logs_are_manual_sorted_and_inherit_project_id`

**Alembic:** None.

---

## 5. HTTP status semantics policy

### Current state

[`docs/api-map.md`](../docs/api-map.md) documents both Pydantic **422** and service-raised **422** for domain rules. Services use **409** for archived entity conflicts in projects/ventures/tasks (partial).

### Target policy

| Code | Use for | Examples (current → target) |
|------|---------|------------------------------|
| **422** | Request **shape** / Pydantic validation only | Invalid `TaskStatus` enum in body (unchanged — FastAPI) |
| **400** | Well-formed request, **rule violation** not conflict | Empty `TimeLogUpdate` body (`"At least one field is required."`) |
| **409** | **State conflict** / incompatible with current resource state | Archived project mutation; duplicate slug; invalid activity type for **active-only** rule? (see Q below) |
| **404** | Missing entity | Unchanged |

**Activity type “must be active”:** Today **422** in `_active_activity_type_name_or_422`. Recommend **409** (`"activity_type_id must reference an active activity type"`) — references wrong **state**, not malformed JSON.

**Board reorder validation** (unknown id, wrong column): Keep **422** if treated as invalid **payload composition**; **409** when touching archived project in order list (already 409).

### api-contract-decision

- **Extend** existing endpoints — no new resources.
- **Contract change** requires owner approval and coordinated test updates (~30 backend tests + [`frontend/src/api/modules.test.tsx`](../frontend/src/api/modules.test.tsx) 422 examples).
- Ship **Phase C** separately from guards (Phase B) to isolate risk.

### Frontend impact

- [`client.ts`](../frontend/src/api/client.ts): `ApiError.status` — no code change required if UI shows `detail` message only.
- If any component checks `error.status === 422` for business logic, update to **409** or check message — grep during Phase C.

---

## 6. Archive / parent-active matrix tests

**New file:** `backend/app/tests/test_archive_mutation_matrix.py`

| Parent state | Operation | Endpoint | Expected |
|--------------|-----------|----------|----------|
| Active project | create task | `POST /tasks` | 201 |
| Archived project | create task | `POST /tasks` | 409 |
| Archived project | patch task | `PATCH /tasks/{id}` | 409 |
| Archived project | status patch | `PATCH /tasks/{id}/status` | **409** (new) |
| Archived project | create time log | `POST …/time-logs` | **409** (new) |
| Archived project | patch time log | `PATCH …/time-logs/{id}` | **409** (new) |
| Venture archived → project cascade archived | status patch | `PATCH /tasks/{id}/status` | 409 |
| Active project | status patch | `PATCH /tasks/{id}/status` | 200 |

Reuse fixtures from [`test_tasks.py`](../backend/app/tests/test_tasks.py) (`_create_project(archived=True)`), [`test_ventures.py`](../backend/app/tests/test_ventures.py) venture archive flows.

**Existing coverage (do not duplicate):** `test_patch_archived_project_returns_conflict`, `test_board_status_move_archived_project_returns_conflict`, venture cascade tests in [`test_ventures.py`](../backend/app/tests/test_ventures.py), [`test_phase_1_6_12_regression_integration.py`](../backend/app/tests/test_phase_1_6_12_regression_integration.py).

---

## 7. `utc_now` centralization

**New:** [`backend/app/core/time.py`](../backend/app/core/time.py)

```python
def utc_now() -> datetime:
    return datetime.now(UTC)
```

**Update imports in:**

- Models: `venture_category_label`, `venture`, `project`, `task`, `time_log`, `activity_type`
- Services: `tasks`, `projects`, `ventures`, `activity_types`, `venture_category_labels`

**Leave unchanged:** Alembic `20260515_0004` local `_utc_now` (historical migration script).

**Testing:** Existing timestamp assertions continue to pass; optional injectable clock **out of scope** unless owner wants test doubles later.

---

## 8. API prefix alignment

| Component | Today |
|-----------|--------|
| Server | `MOMENTUM_API_V1_PREFIX` / `api_v1_prefix` default `/api/v1` |
| Frontend | Paths like `` `/api/v1/projects` ``; `VITE_API_BASE_URL` prepends host only |

**Target (minimal):**

1. Document in `docs/api-map.md`: production default prefix; changing env requires updating frontend base or path constant.
2. Optional follow-up: `frontend/src/api/paths.ts` with `export const API_V1 = '/api/v1'` (single edit point) — **no backend change**.

**No URL versioning initiative.**

---

## 9. Pagination — base structure (owner Q5: implement now)

### api-contract-decision

- **Extend** list endpoints with optional query params; default behaviour unchanged for existing clients.
- **No new resources**; response shape gains an opt-in wrapper.

### Contract

**Query parameters (all list routes — apply consistently):**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `limit` | int | omitted | When **omitted**, behaviour is today’s full list (same JSON array). When set, cap results (suggest max **500**, default page size **100** when paginating). |
| `cursor` | string | omitted | Opaque cursor for next page; only valid with `limit`. |

**Response shapes:**

| Request | Response `200` body |
|---------|---------------------|
| No `limit` | `list[ResourceRead]` — **unchanged** |
| `limit` present | `{ "items": ResourceRead[], "next_cursor": string \| null }` |

`next_cursor` is `null` when no further rows. Encode sort key + id (e.g. base64 of `created_at|id`) — document in `docs/api-map.md`.

**Scope for this refactor (priority order):**

1. `GET /tasks` — highest growth; nested filters already (`project_id`, `status`, `priority`)
2. `GET /projects`
3. `GET /ventures`
4. `GET /activity-types`, `GET /venture-category-labels` — smaller; same helper for consistency

**Defer nested list:** `GET /tasks/{id}/time-logs` — add same pattern when Phase 2 or UI needs it (usually bounded per task).

### Implementation sketch

| Layer | Change |
|-------|--------|
| `backend/app/schemas/pagination.py` | **New** — `PaginatedResponse[T]`, cursor encode/decode helpers |
| `backend/app/services/pagination.py` | **New** — `apply_cursor_limit(statement, limit, cursor, order_cols)` |
| Each `list_*` service | Branch: if `limit is None` → current query; else paginate |
| Routers | Optional `limit`, `cursor` query params; union response type or separate routes — prefer **one route**, FastAPI `response_model` union or document dynamic shape (simplest: always return wrapper when `limit` set only — router checks param) |
| Tests | No `limit` → existing tests pass; new tests for `limit` + `next_cursor` |
| `docs/api-map.md` | Document opt-in pagination |
| Frontend | **No change required** for default paths; [`extractProjects`](../frontend/src/api/projects.ts) already accepts `{ items: [] }` — extend same helper to tasks/ventures when adopting pages |

### Phase 2 readiness

Income entry lists can reuse `PaginatedResponse` + cursor helper without inventing a second pattern.

---

## 10. DELETE-as-archive (optional Phase D)

See [`ADR/001-delete-archive-deprecation.md`](../ADR/001-delete-archive-deprecation.md).

**Summary:** Add `POST /projects/{id}/archive` and `POST /ventures/{id}/archive`; keep `DELETE` as alias for **one release**; deprecate in OpenAPI description; remove `DELETE` only after frontend switches.

**Not required** for Phase 2 income readiness if `docs/api-map.md` clearly states semantics.

---

## 11. Phased migration

| Phase | Name | Deliverables | API breaking? |
|-------|------|--------------|---------------|
| **0** | Baseline | Inventory committed in TRD; run `make test` snapshot; no prod code | No |
| **A** | Guards | `task_guards.py`, wire all mutators; matrix tests red→green | Behaviour fix (409 where 200 possible) |
| **B1** | Time log archive + schema | Alembic; `delete_task` archives logs; model/schema | **Behaviour change** on task DELETE |
| **B2** | Project cascade | Cascade `project_id` on task move; asserts | No |
| **C** | HTTP semantics | Service status codes + test updates; api-map; optional frontend test tweaks | **Yes** (codes only, bodies same) — **owner: single PR**, tickets may split |
| **D** | Archive routes | `POST …/archive` + temporary DELETE alias; then remove DELETE; [ADR 001–002](../ADR/002-api-delete-vs-archive-semantics.md) | No during alias; frontend → POST |
| **E** | `utc_now` + prefix doc | `core/time.py`; docs/path constant | No |
| **F** | Pagination base | `schemas/pagination.py`, service helper, list endpoints (§9) | No when `limit` omitted |

**Rollback:** Each phase is revertible PR; no migrations. Phase C rollback restores 422 expectations in tests.

---

## 12. Suggested PR breakdown

| PR | Phase | Title (conventional) | Files (primary) |
|----|-------|----------------------|-----------------|
| 1 | A | `fix(tasks): unify mutation guards for status and time logs` | `services/task_guards.py`, `tasks.py`, `test_archive_mutation_matrix.py` |
| 2 | B1 | `feat(time-logs): archive logs on task delete; add status column` | Alembic, `models/time_log.py`, `tasks.py`, tests |
| 3 | B2 | `fix(tasks): cascade time_logs.project_id on task move` | `tasks.py`, `test_tasks.py` |
| 4 | C | `refactor(api): align business-rule HTTP status codes` | all `services/*`, many `tests/*`, `docs/api-map.md` |
| 5 | E | `chore(core): centralize utc_now` | `core/time.py`, models, services |
| 6 | E | `docs(api): document v1 prefix contract` | `docs/api-map.md`, optional `frontend/src/api/paths.ts` |
| 7 | D | `feat(api): POST archive routes; deprecate DELETE alias` | routers, services, frontend `projects.ts`/`ventures.ts` |
| 8 | F | `feat(api): opt-in cursor pagination for list endpoints` | pagination modules, list services/routers, tests, api-map |

**Recommended first PR:** **PR1 (Phase A)** — highest bug-risk reduction, no contract renumbering.

---

## 13. Test plan

| Area | Strategy |
|------|----------|
| Guards | New matrix module + 1–2 cases per endpoint in `test_tasks.py` |
| Integrity | Unit/integration via httpx `TestClient` |
| HTTP Phase C | Update asserted status codes only; keep `detail` strings stable where possible |
| Regression | `make test` full suite; no skipped tests |
| Manual | Owner: drag task on active board; attempt edit on archived project in archive dialog (expect UI error or 409) |

Per [`test-strategy-decision`](../docs/ai/skills/test-strategy-decision.md): integration tests for cross-entity rules; unit tests only for pure helpers if extracted.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Kanban relied on status patch against archived project | Phase A tests; frontend already filters active projects |
| Phase C breaks client assumptions on 422 | Grep frontend; ship coordinated PR or defer Phase C |
| Task move + log cascade surprises user | Rare operation; logs should follow task for reporting |
| DELETE deprecation churn | Keep optional Phase D; document-only acceptable |
| Scope creep into Phase 2 schema | Explicit out-of-scope in PRD; separate architect pass |

---

## 15. Phase 2 readiness checklist

After Phases A–C (and E):

- [ ] Task/time-log writes safe under archived parents
- [ ] `time_logs.project_id` trustworthy for venture/project rollups
- [ ] Error codes documented for new income services to copy
- [ ] No open P0 bugs from code review #4–#6
- [ ] Income architect can add `income_stream` / `income_entry` without reworking task guards

---

## 16. Files created / touched (implementation forecast)

| Action | Path |
|--------|------|
| Create | `backend/app/core/time.py` |
| Create | `backend/app/services/task_guards.py` |
| Create | `backend/app/tests/test_archive_mutation_matrix.py` |
| Create | `backend/app/schemas/pagination.py`, `backend/app/services/pagination.py` |
| Modify | `backend/app/services/tasks.py` |
| Modify | 6× `backend/app/models/*.py` (incl. `time_log.py` status + nullable `task_id`) |
| Create | Alembic revision for `time_logs` |
| Modify | 4× other `services/*.py` (utc_now) |
| Modify | `docs/api-map.md`, possibly `docs/database-schema.md` (integrity note) |
| Optional | `backend/app/routers/projects.py`, `ventures.py` |
| Optional | `frontend/src/api/paths.ts`, `projects.ts`, `ventures.ts` |

---

## 17. Owner decisions (resolved)

| # | Topic | Decision |
|---|--------|----------|
| Q1 | Task delete / logs | Hard delete task; **archive** logs ([ADR 003](../ADR/003-time-log-archive-on-task-delete.md)); `DELETE` = hard delete platform-wide ([ADR 002](../ADR/002-api-delete-vs-archive-semantics.md)) |
| Q2 | Task move | **Cascade** `project_id` on active logs |
| Q3 | HTTP status | **Single PR** |
| Q4 | Project/venture | **POST archive** + temporary DELETE alias → remove DELETE until purge ([ADR 001](../ADR/001-delete-archive-deprecation.md)) |
| Q5 | Pagination | **Implement** §9 |

**Implementation notes:** Phase 2 project-hour queries must include **archived** time logs (or explicit `status` filter). `test_delete_task_removes_task_and_manual_time_logs` must be rewritten for archive semantics.

---

**Status: NEEDS OWNER**

**Recommended first PR after approval:** PR1 — Phase A (mutation guards).

**Note:** `delete_task` test changes land in PR2 (B1) after schema migration.
