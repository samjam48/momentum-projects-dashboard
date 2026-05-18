# ADR 001: DELETE-as-archive deprecation strategy

**Date:** 2026-05-18  
**Status:** Accepted (owner) — aligned with [ADR 002](./002-api-delete-vs-archive-semantics.md)  
**Context:** [`docs/code-review-16-05.md`](../docs/code-review-16-05.md) #3; owner Q4

---

## Context

`DELETE /api/v1/projects/{id}` and `DELETE /api/v1/ventures/{id}` perform **soft archive** (set `status` to `archived`), not row deletion. This matches product behaviour but conflicts with common HTTP semantics and tooling expectations.

The frontend mirrors DELETE today:

- [`frontend/src/api/projects.ts`](../frontend/src/api/projects.ts) — `archiveProject` uses `DELETE`
- [`frontend/src/api/ventures.ts`](../frontend/src/api/ventures.ts) — same

[`docs/api-map.md`](../docs/api-map.md) already documents the caveat.

---

## Decision

Adopt a **deprecation-safe dual-route** period, then align with **DELETE = hard delete** ([ADR 002](./002-api-delete-vs-archive-semantics.md)):

1. **Add** canonical archive routes:
   - `POST /api/v1/projects/{project_id}/archive` — optional body `ProjectArchive` (same as today’s DELETE body)
   - `POST /api/v1/ventures/{venture_id}/archive` — no body
2. **Keep** existing venture/project `DELETE` handlers as **temporary aliases to archive** (not hard delete) until frontend uses POST.
3. **Document** deprecation: `DELETE` on projects/ventures will **not** remain archive forever.
4. **After frontend migration:** **Remove** project/venture `DELETE` routes (or return **405**) until a future **purge** feature implements true hard delete with explicit design — **do not** auto-convert the old archive `DELETE` into cascading hard delete in this refactor.

**Tasks:** `DELETE /tasks/{id}` is already true hard delete for the task; time logs are archived per [ADR 003](./003-time-log-archive-on-task-delete.md).

---

## Alternatives considered

| Alternative | Why not (for this refactor) |
|-------------|----------------------------|
| **Document only** | Zero churn; acceptable if owner declines Phase D — **default if no appetite for route work** |
| **Breaking switch DELETE → 405** | Breaks clients immediately; bad for local scripts |
| **`PATCH` with `{ "status": "archived" }` only** | Projects already block PATCH on archived; archive via PATCH on active is plausible but blurs “archive” vs “edit” and still doesn’t fix DELETE misconception |
| **Keep DELETE forever** | No work; leaves REST mismatch permanent |

---

## Consequences

### Positive

- Clearer semantics for future integrations (Phase 2 income, exports)
- Aligns with existing action routes (`/unarchive`, `/board-status`)

### Negative

- Two ways to archive during deprecation window
- Coordinated frontend + backend + api-map update

### Neutral

- Task `DELETE` hard-deletes task only; logs archived ([ADR 003](./003-time-log-archive-on-task-delete.md)).

---

## Implementation notes (when approved)

- Routers: delegate both DELETE and POST to `archive_project` / `archive_venture` in services (no logic duplication — single service entry).
- Responses: retain **204** for DELETE; **204** or **200** with body for POST — **recommend 204** for parity (owner pick).
- Tests: assert POST and DELETE behave identically during alias period.
- Frontend: switch `archiveProject` / venture archive to POST; keep integration tests on both until DELETE removed.

---

## Status

**Accepted** — implement Phase D; coordinate frontend archive calls to POST.
