# Phase 1.6 reviewer checklist (PRD/TRD → tickets)

Use during final review of Phase 1.6. Each row ties a signed-off acceptance theme from `plans/PRD-phase-1.6-2026-05-15.md` and `plans/TRD-phase-1.6-2026-05-15.md` to the implementing ticket in `plans/tickets-phase-1.6-2026-05-15.md`. Chore tickets (`1.6-C*`) are harness stability only.

| PRD/TRD acceptance theme | Ticket(s) | Reviewer notes |
| --- | --- | --- |
| Alembic migration: new tables/columns, seeds, `Unsorted` backfill, `is_asset` → `project_type`, nullable `activity_type_id`, preserve task/project/time-log data | 1.6-1 | Spot-check empty DB vs populated upgrade; verify seeds idempotent. |
| Venture category labels: CRUD API, Title Case, slug uniqueness, delete unused only | 1.6-2 | |
| Ventures: CRUD, archive cascade, `archived_by_venture`, unarchive restores cascade only | 1.6-3 | |
| Projects: `venture_id`, types, archive vs `finished`, filters, direct vs cascade archive | 1.6-4 | |
| Project Kanban: board-status PATCH, ordering, shipped ↔ finished defaults | 1.6-5 | |
| Activity types + time logs: FK nullable, archive clears FK, list display `uncategorised` | 1.6-6 | |
| Frontend API/types/hooks for Phase 1.6 | 1.6-7 | |
| Sidebar venture tree, venture dialogs, `+ Hustle` | 1.6-8 | |
| Dev/test harness (Docker/cache/React Query) | 1.6-C1 | No product scope. |
| Backend integration tests venture-aware | 1.6-C2 | |
| Frontend QueryClient harness for App/Sidebar suites | 1.6-C3 | |
| Time-log integration tests stable post-harness | 1.6-C4 | |
| Project create/edit/archive UX, project type, venture required | 1.6-9 | |
| Project Kanban UI + project type filter | 1.6-10 | |
| Time-log UI: activity combobox, `uncategorised`, no activity grouping/filter | 1.6-11 | |
| Phase regression: no task type/labels/colour; migration/API/UI integration; archive semantics; cross-surface stale state | 1.6-12 | `crossFeatureStaleState.phase-1-6-12.test.tsx` (task Kanban ↔ summary PATCH path, time-log dialog PATCH, sidebar venture archive shell, stale storage); guards + backend `test_phase_1_6_12_regression_integration.py`. |

## Quality gates (Implementer-attested)

**Latest Implementer-run (session updating Ticket 1.6-12 review feedback):** `make test` and `make lint` both completed successfully from the repo root. Re-run them on the integration branch immediately before merge; they are not a substitute for CI.

## Known gaps / owner decisions

- **Ticket 1.6-12 edge — activity type archive while Edit task dialog is open:** Phase 1.6 **does not expose “archive activity type” in the Manage activity types shell** (only typed create + unused delete via that surface). FK clearing and preserved time-log rows after **PATCH `/activity-types/{id}/archive`** are exercised in **`backend/app/tests/test_phase_1_6_12_regression_integration.py`** (`test_archive_activity_type_nulls_fk_without_deleting_time_log_rows`). The React Query **`useActivityTypeMutations.archive`** hook invalidates **`timeLogQueryKeys.all`**, but there is intentionally no **`renderApp`** flow that archives an activity type with the Task dialog mounted; add one if product exposes archive beside delete or a harness gains a supported hook.
- **Stale localStorage / persisted sidebar selection (Phase 1b carryover):** Exercised without waiver in **`frontend/src/crossFeatureStaleState.phase-1-6-12.test.tsx`** (invalid board-display JSON; persisted IDs that resolve to zero checked projects).

## PRD §6 — acceptance shape for planner (explicit)

| Acceptance shape bullet | Ticket(s) | Notes |
| --- | --- | --- |
| No task `type` is introduced in Phase 1.6 | 1.6-1, 1.6-12 | Schema unchanged for tasks; guards in `phase-1-6-12-task-taxonomy.guard.test.ts` / backend regression. |
| Activity types are part of Phase 1.6 and apply **only** to time logs | 1.6-6, 1.6-11 | |
| Existing time logs migrate to no assigned activity type and display as `uncategorised` | 1.6-1, 1.6-6, 1.6-11 | Nullable FK; synthetic display string. |
| Project archive state, Project Kanban state, and completion state remain separate fields | 1.6-1, 1.6-4, 1.6-5, 1.6-10, 1.6-12 | `status`, `board_status`, `finished` semantics in regression/integration tests. |
| Migration creates default venture `Unsorted` with category `Hustle`; user may rename in UI | 1.6-1, 1.6-8, 1.6-9 | |

## TRD — contract/model shape mapped to tickets

| TRD theme | Ticket(s) | Notes |
| --- | --- | --- |
| Entity model: `VentureCategoryLabel`, `Venture`, extended `Project`, nullable `activity_type_id` on `time_logs`; **no** task type column | 1.6-1, 1.6-12 | |
| Tasks: existing Kanban fields unchanged; **no** `task_type` API parameter or payload field | 1.6-1, 1.6-7, 1.6-12 | Matches TRD §3.4 sketch. |
| TypeScript/API surface: `Venture`, labels, project board fields, `ActivityType`; **no** `TaskType` | 1.6-7, 1.6-12 | |
| Service-layer ownership: venture cascade in `services/ventures.py`, project archive/board in `services/projects.py`, activity types in `services/activity_types.py` | 1.6-2 — 1.6-6 | Routers remain thin. |
| `TimeLogRead` exposes activity type names; null → `uncategorised` display | 1.6-6, 1.6-11 | |

## Explicit out-of-scope (PRD §4) — must stay absent

- Task `type`, labels, semantic colour (scope guards in 1.6-12).
- Time-log grouping/filter by activity type.
- Hard-delete/purge UI for ventures, projects, tasks (archive-only patterns; time-log row delete is not entity purge).
- Income, goals, dashboard, Toggl, server-persisted preferences.

## Sign-off

- [ ] PRD/TRD themes above exercised or waived with owner note
- [ ] `make lint` and `make test` clean on the integration branch
- [ ] Ticket 1.6-12 regression suite green

**Reviewer:** _________________ **Date:** _________________
