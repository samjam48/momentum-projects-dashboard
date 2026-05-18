# ADR 003: Archive time logs when task is hard-deleted

**Date:** 2026-05-18  
**Status:** Accepted (owner)  
**Context:** Owner Q1 — work recorded in time logs must survive task removal

---

## Context

Today `delete_task` **hard-deletes** the task and **all** related `time_logs` rows ([`backend/app/services/tasks.py`](../backend/app/services/tasks.py)).

**Owner principle:** Time logs represent work actually done; deleting an unfinished or unwanted task must not destroy that history by default.

**Constraint:** `DELETE /tasks/{id}` remains **hard delete** for the task row ([ADR 002](./002-api-delete-vs-archive-semantics.md)).

---

## Decision

On **`DELETE /tasks/{id}`**:

1. **Hard delete** the `tasks` row.
2. For each related `time_logs` row: **archive** (do not `session.delete`):
   - Set `status = 'archived'`
   - Set `task_id = NULL` (detach from deleted task; requires nullable FK)
   - Preserve `project_id`, hours, dates, activity type, notes, etc., for reporting

**Default** = archive. No opt-out in v1 of this refactor unless owner later adds `?purge_logs=true` for admin purge (out of scope).

**`DELETE /tasks/{id}/time-logs/{log_id}`** remains **hard delete** of a single log (explicit user correction in the task dialog).

Optional future: **`PATCH /tasks/{id}/time-logs/{log_id}`** with archive — only if product needs “remove log from UI” without erasing history; not required for this refactor.

---

## Schema (Alembic required — owner approved)

| Change | Reason |
|--------|--------|
| `time_logs.status` `String`, default `'active'`, values `active` \| `archived` | Archive without row delete |
| `time_logs.task_id` **nullable** | FK to deleted task must be cleared |

**Indexes / queries:** List endpoints for time logs (when added) default to `status=active`. Phase 2 rollups include archived logs where product requires “all work done” totals — document in Phase 2 PRD.

**No `archived_at` column in v1** — optional later; `status` + existing `created_at` suffice.

---

## Service rules

| Operation | Behaviour |
|-----------|-----------|
| `create_time_log` | `status=active`, `task_id` set |
| `delete_time_log` | Hard delete one row |
| `delete_task` | Hard delete task; archive all child logs |
| `update_task` `project_id` change | Cascade `project_id` on **active** logs (PRD Q2) |
| `ensure_task_mutable` | Does not apply to `delete_task` (task removal allowed under archived project to drop task while keeping logs on project) |

---

## API / frontend impact

- **Response:** `DELETE /tasks/{id}` stays **204**; no body change.
- **Behaviour change:** Logs remain in DB — project-level hour totals that sum `time_logs` by `project_id` must include archived logs unless filters exclude them (define in service helpers for Phase 2).
- **GET `/tasks/{id}/time-logs`:** 404 after task delete (task gone); archived logs queried via future project/report APIs.
- **Frontend:** If/when hard-delete task is wired, no change to time-log list on deleted task; optional toast “Time entries kept on project” (product copy).

---

## Alternatives rejected

| Alternative | Why rejected |
|-------------|--------------|
| Soft-delete task instead of hard delete | Owner requires hard delete for task |
| Keep `task_id` pointing at deleted task | Violates FK / orphan reference |
| Hard delete logs with task | Owner: loses work history |
| Archive task instead of delete | Conflates archive with delete; owner separated these |

---

## Status

**Accepted** — implement in refactor Phase **B2** (after guards Phase A; may combine with schema migration PR).
