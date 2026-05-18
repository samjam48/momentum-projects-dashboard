# ADR 002: API-wide DELETE vs archive semantics

**Date:** 2026-05-18  
**Status:** Accepted (owner)  
**Context:** Backend refactor planning; owner decisions on Q1 and Q4

---

## Decision

**Platform rule for the HTTP API:**

| Verb / route style | Meaning |
|--------------------|---------|
| **`DELETE /{resource}/{id}`** | **Hard delete** — row removed from the database (or explicit 405/501 if hard delete is not yet implemented for that resource). |
| **`POST /{resource}/{id}/archive`** or **`PATCH`** with archive fields | **Soft archive** — row kept; `status` (or equivalent) marks archived. Use when the product “delete” control means “remove from active UI”, not “erase history”. |

**UI mapping:** A delete button that archives must call **POST/PATCH archive**, not `DELETE`.

---

## Per-resource behaviour (target)

| Resource | Archive | Hard delete |
|----------|---------|-------------|
| **Venture** | `POST /ventures/{id}/archive` | `DELETE` — **not** implemented in this refactor (no purge UI); remove deprecated DELETE-as-archive after frontend migrates |
| **Project** | `POST /projects/{id}/archive` | Same as venture |
| **Task** | `PATCH` `status: "archived"` (existing) | `DELETE /tasks/{id}` — **hard delete task**; see ADR 003 for time logs |
| **Time log** | `PATCH` archive (new) or service-only archive on task delete | `DELETE /tasks/.../time-logs/{id}` — hard delete **one** entry (user correction) |
| **Activity type** | `PATCH …/archive` (existing) | `DELETE` when unused (existing) |

---

## Project / venture migration ([ADR 001](./001-delete-archive-deprecation.md))

1. Add `POST …/archive` (canonical).
2. Keep `DELETE` as **temporary alias to archive** until frontend uses POST.
3. **After migration:** remove venture/project `DELETE` handlers (or return **405** with message) until a future **purge** feature implements true hard delete with explicit owner approval — do **not** silently turn today’s archive `DELETE` into cascading hard delete without a designed purge flow.

---

## Consequences

- Phase 2 income endpoints must follow this table (no `DELETE` = archive).
- [`docs/api-map.md`](../docs/api-map.md) becomes the contract source of truth.
- Frontend archive actions on projects/ventures switch from `DELETE` to `POST`.

---

## Status

**Accepted** — implement in backend refactor Phases D and B2 (task delete + time log archive).
