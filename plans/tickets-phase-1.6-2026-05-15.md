# Phase 1.6 Tickets — Ventures, Project Types, Project Kanban, and Time Log Activity Types

## Scope Notes

- Phase 1.6 introduces the domain migration from `Project -> Task` to `Venture -> Project -> Task`, while preserving existing project, task, Kanban, and manual time-log workflows.
- Projects stay in one table and use `project_type = project | asset | gig | contract`; Phase 1.6 does not add behavioural differences by type.
- Tasks do not receive a `type`, label, semantic colour, or repeatable-task model in this phase.
- Time log activity types apply only to time logs. The time-log list remains date ordered; no activity-type grouping or filtering ships in Phase 1.6.
- Backend tickets must follow the project rule of failing tests before production code, with routers kept thin and DB/business logic in services.
- Frontend tickets must use typed API modules/hooks, avoid `any`, and keep user-facing copy product-like rather than implementation-oriented.

## Assumptions

- Phase 1b shell, modal, sidebar, task board, summary table, and time-log UX are the baseline into which Phase 1.6 is integrated.
- `projects.status` remains archive visibility (`active | archived`); Project Kanban lifecycle uses `board_status`.
- The default migration venture is named `Unsorted`, uses the seeded `Hustle` venture category label, and can be renamed by the user after migration.
- Existing branch data may contain `is_asset`; if present, the migration maps `is_asset = true` to `project_type = asset` and does not keep the boolean as an active API/UI field.
- `uncategorised` is a synthetic display value for time logs with no active activity type, not a seeded activity type row.

## Ticket Ordering Rationale

1. **1.6-1** creates the database and model foundation so all later API and UI work has stable fields and deterministic migrated data.
2. **1.6-2** ships venture category labels first because ventures require a label and dialogs need label options.
3. **1.6-3** ships ventures and archive cascade rules before project UI can rely on venture ownership.
4. **1.6-4** extends project lifecycle contracts after ventures exist.
5. **1.6-5** adds the dedicated project board mutation once project lifecycle fields are available.
6. **1.6-6** adds activity type and time-log backend behaviour independently of project-board UI.
7. **1.6-7** establishes frontend types/API hooks before feature components consume the new contracts.
8. **1.6-8** makes the sidebar venture tree and venture CRUD usable before project creation is moved into venture context.
9. **1.6-C1** hardens the local dev stack and reduces frontend cache/render churn after Docker Desktop instability on macOS bind mounts (no feature scope).
10. **1.6-C2** migrates legacy backend and frontend integration tests to Phase 1.6 venture-aware fixtures so `make test` is trustworthy again (no feature scope).
11. **1.6-C3** completes the frontend QueryClient test-harness migration for legacy App/Sidebar suites so `make test` can exercise Phase 1.6 UI paths reliably.
12. **1.6-C4** stabilizes legacy time-log integration tests after the harness migration so remaining frontend reds represent real product regressions rather than stale async expectations.
13. **1.6-9** updates project create/edit/archive UX to require ventures and expose project types.
14. **1.6-10** activates the Project Kanban board and project type filter after project lifecycle APIs and project dialogs are in place.
15. **1.6-11** updates time-log UI for activity types after backend contracts and shared frontend API hooks exist.
16. **1.6-12** performs phase-level regression, migration, and scope-guard hardening after the implementation tickets are complete.
17. **1.6-13** (post–1.6-12 polish) aligns Task Kanban title hover, Project Kanban card/column visuals and drag affordance, and venture sidebar chrome with the signed-off shell aesthetic.
18. **1.6-14** (post–1.6-12 polish) unifies Archived ventures vs Archived projects UI, restore affordances, confirmation, detail views, and dismiss behaviour.

---

## Ticket 1.6-1

### Title

Backend Migration and Model Groundwork

### Acceptance Criteria

- Add failing backend tests or migration checks that prove seeded venture category labels, default `Unsorted` venture backfill, project field defaults, and nullable time-log activity type behaviour before production code is written.
- Add Alembic migration(s) for `venture_category_labels`, `ventures`, and `activity_types`.
- Extend `projects` with `venture_id`, `icon`, `project_type`, `board_status`, `kanban_order`, `finished`, and `archived_by_venture`.
- Extend `time_logs` with nullable `activity_type_id`.
- Seed venture category labels exactly: `Hustle`, `Business`, `Investment`, `Property`, `Education`, `Hobby`.
- Seed activity types exactly: `planning`, `meeting`, `admin`.
- Create one active default venture named `Unsorted` with category label `Hustle`.
- Backfill all existing projects to the `Unsorted` venture.
- Preserve existing `projects.status` values as archive visibility and do not reinterpret them as Project Kanban statuses.
- Default `project_type` to `project`, except map any pre-existing `is_asset = true` branch data to `project_type = asset`.
- Default `board_status` to `active`, `finished` to `false`, and `archived_by_venture` to `false`.
- Leave existing time logs with `activity_type_id = NULL`; do not create an `uncategorised` database row.
- Add or update typed SQLModel models and request/response schema types for the new tables and columns.
- Keep DB access and migration-specific data manipulation out of routers.

### Edge Cases

- SQLite cannot safely enforce non-null `projects.venture_id` with a simple `ALTER TABLE`; use a batch/table rebuild or explicitly document and test service/schema enforcement until a later rebuild.
- Running migrations on an empty database still creates seeds and a single `Unsorted` venture without duplicate rows.
- Running migrations on a populated database preserves tasks, task Kanban order, project archive status, and time-log notes/location.
- Seed creation is deterministic and idempotent across local/test databases.
- Existing archived projects remain archived and default `finished = false` unless already deterministically marked shipped by branch data.

---

## Ticket 1.6-2

### Title

Venture Category Label Service and API

### Acceptance Criteria

- Write failing service and API tests for listing, creating, renaming, and deleting venture category labels before implementation.
- Implement typed service functions for label validation, slug generation, case-insensitive uniqueness, rename, and unused-only delete.
- Implement thin router endpoints:
  - `GET /api/v1/venture-category-labels`
  - `POST /api/v1/venture-category-labels`
  - `PATCH /api/v1/venture-category-labels/{label_id}`
  - `DELETE /api/v1/venture-category-labels/{label_id}`
- Label names are trimmed, must be non-blank, and are displayed to the frontend as Title Case.
- Slugs are generated deterministically from normalized names and enforce case-insensitive uniqueness.
- Listing returns seeded labels and user-created labels in a deterministic order suitable for combobox/select UI.
- Delete hard-deletes only labels that are not referenced by any venture.
- API schemas expose only typed fields needed by the UI: `id`, `name`, `slug`, timestamps, and any usage metadata needed for disabling delete.

### Edge Cases

- Creating `hustle`,  `Hustle` , or `HUSTLE` when `Hustle` exists returns a validation error.
- Renaming a label to a blank string, duplicate name, or punctuation-only slug returns a validation error.
- Deleting a label used by one or more ventures returns a validation error and leaves ventures unchanged.
- Deleting a non-existent label returns `404`.
- Renaming a seeded label is allowed if uniqueness rules pass; seeds are defaults, not immutable system rows.

---

## Ticket 1.6-3

### Title

Venture CRUD and Archive Cascade

### Acceptance Criteria

- Write failing service and API tests for venture create/list/detail/update/archive/unarchive, including archive cascade restoration via `archived_by_venture`.
- Implement typed venture service functions for create, list filters, update, archive, and unarchive.
- Implement thin router endpoints:
  - `GET /api/v1/ventures?status=&category_label_id=`
  - `POST /api/v1/ventures`
  - `GET /api/v1/ventures/{venture_id}`
  - `PATCH /api/v1/ventures/{venture_id}`
  - `DELETE /api/v1/ventures/{venture_id}`
  - `PATCH /api/v1/ventures/{venture_id}/unarchive`
- Venture create/update accepts name, description, colour, category label, and optional icon.
- Venture name is trimmed and non-blank.
- Venture colour, when supplied, must be one of the approved 12 swatches from `plans/phase-1.5-ux.md`.
- Venture category defaults to seeded `Hustle` when omitted by the client.
- Default venture list returns active ventures only; archived ventures are available with `status=archived`.
- `DELETE /ventures/{id}` archives the venture and archives all active child projects.
- Projects archived by this venture cascade are marked `archived_by_venture = true`.
- Unarchiving a venture restores only child projects with `archived_by_venture = true`, then clears that flag.
- Projects that were already archived before the venture archive remain archived when the venture is restored.
- Venture reads include enough category label data for sidebar rendering without forcing a second request per row.

### Edge Cases

- Archiving an already archived venture is idempotent and does not flip `archived_by_venture` on projects that were previously archived directly.
- Unarchiving an active venture is idempotent and does not mutate project state.
- Creating or updating with an unknown `category_label_id` returns `404` or a validation error consistently with existing API conventions.
- Updating archived ventures is blocked or narrowly allowed only where existing project archive semantics allow it; tests document the chosen behaviour.
- Venture archive cascade runs in one transaction so partial project archive state cannot be committed.

---

## Ticket 1.6-4

### Title

Project Venture Ownership, Type, Archive, and Completion API

### Acceptance Criteria

- Write failing service and API tests covering project create/update/list/archive/unarchive with required venture ownership, `project_type`, `finished`, and `archived_by_venture`.
- Extend typed project schemas and services so `ProjectCreate` requires a valid active `venture_id` after migration.
- Extend `GET /api/v1/projects` filters to support `status`, `venture_id`, `board_status`, `project_type`, and `finished` where supported by the TRD.
- Extend `ProjectRead` responses with `venture_id`, `icon`, `project_type`, `status`, `board_status`, `kanban_order`, `finished`, and `archived_by_venture`.
- Allow project create/edit to set `project_type` to exactly `project`, `asset`, `gig`, or `contract`.
- Preserve Phase 1 task behaviour regardless of `project_type`; no task validation or UI logic may branch by type.
- Allow project create/edit to set `icon` and initial `board_status`.
- Keep `status` as archive visibility only (`active | archived`).
- Direct project archive accepts an optional `finished` value; if omitted, service defaults `finished` to `true` only when `board_status == shipped`.
- Directly unarchiving a project restores `status = active` and clears `archived_by_venture = false`.
- Project archive/unarchive and completion rules live in `services/projects.py`, not routers.

### Edge Cases

- Creating a project without `venture_id`, with an archived venture, or with an unknown venture returns a validation error or `404` per existing conventions.
- Invalid `project_type` or `board_status` values return validation errors.
- Filtering by multiple fields combines filters with logical AND.
- Directly archiving a project under an active venture does not set `archived_by_venture = true`.
- Directly unarchiving a project whose parent venture is archived is blocked to avoid active child projects under archived ventures.
- Legacy clients that omit `project_type` still create default `project` rows if all other required fields are valid.

---

## Ticket 1.6-5

### Title

Project Kanban Status and Ordering Backend

### Acceptance Criteria

- Write failing backend tests for Project Kanban drag mutations before implementation.
- Implement `PATCH /api/v1/projects/{project_id}/board-status` as a thin router calling a project service function.
- Mutation accepts a target `board_status` (`idea`, `active`, `paused`, `shipped`) and optional order payload matching the existing task Kanban order pattern.
- Persist `board_status`, `kanban_order`, and `updated_at` for the moved project.
- Moving a project to `shipped` defaults `finished = true` unless the service contract explicitly receives a valid override.
- Moving a project out of `shipped` does not automatically clear `finished`; completion is an independent history flag after being set.
- Project board list queries return active projects ordered deterministically by `board_status`, `kanban_order`, then a stable fallback.
- Reuse existing Kanban service patterns where practical without coupling project lifecycle to task status logic.

### Edge Cases

- Reordering within a column updates order without changing `finished`.
- Moving an archived project on the Project Kanban returns `409`.
- Moving a project whose parent venture is archived returns `409`.
- Duplicate or missing `kanban_order` values are rendered and repaired deterministically on next explicit reorder.
- Failed multi-card order updates do not leave a partially reordered column.

---

## Ticket 1.6-6

### Title

Activity Type Service, API, and Time Log Contract

### Acceptance Criteria

- Write failing service and API tests for activity type create/list/edit/archive/delete and time-log create/read with nullable activity type before implementation.
- Implement typed activity type service functions for validation, slug generation, case-insensitive uniqueness, list filters, rename, archive, and unused-only hard delete.
- Implement thin router endpoints:
  - `GET /api/v1/activity-types?status=`
  - `POST /api/v1/activity-types`
  - `PATCH /api/v1/activity-types/{activity_type_id}`
  - `DELETE /api/v1/activity-types/{activity_type_id}`
  - `PATCH /api/v1/activity-types/{activity_type_id}/archive`
- Activity type names are trimmed, non-blank, max 25 characters, and case-insensitively unique.
- Reserve `uncategorised` as a display value; user-created activity type names matching it case-insensitively are rejected in Phase 1.6.
- Listing returns active activity types by default and supports archived list via `status=archived`.
- Hard delete succeeds only when no time logs reference the activity type.
- Archiving an activity type is allowed when used and clears `time_logs.activity_type_id` for affected rows in one transaction.
- Extend `POST /api/v1/tasks/{task_id}/time-logs` to accept optional `activity_type_id`.
- Extend time-log reads with `activity_type_id`, `activity_type_name`, and `activity_type_display_name`.
- For null or cleared activity type references, return `activity_type_name = null` and `activity_type_display_name = "uncategorised"`.
- Preserve existing time-log behaviours: positive hours validation, `project_id` inherited from task, `source = manual`, actual-hours recomputation, notes optional, location preserved, list sorted by date descending then created date descending.

### Edge Cases

- Creating `Planning`,  `planning` , or `PLANNING` when `planning` exists returns a validation error.
- Creating or renaming to more than 25 characters returns a validation error.
- Creating a time log with an unknown or archived `activity_type_id` returns a validation error.
- Deleting a used activity type returns a validation error and does not clear logs; archiving is the lifecycle action that clears references.
- Archiving an already archived activity type is idempotent.
- Existing logs with null activity type continue to render as `uncategorised` without data loss.

---

## Ticket 1.6-7

### Title

Frontend API Types, Hooks, and Query Keys

### Acceptance Criteria

- Write or update frontend tests for new API modules and hook consumers before wiring feature UI where practical.
- Add typed frontend API modules for `ventureCategoryLabels`, `ventures`, and `activityTypes`.
- Extend the existing `projects` API module for venture filters, project type, board status, archive completion fields, unarchive, and project board-status mutation.
- Extend the existing `timeLogs` API module for optional `activity_type_id` and returned activity type display fields.
- Define TypeScript types for `Venture`, `VenturePayload`, `VentureStatus`, `VentureCategoryLabel`, `VentureCategoryLabelPayload`, `ProjectType`, `ProjectBoardStatus`, `ActivityType`, and `ActivityTypePayload`.
- Do not add any `TaskType`, task label, or task semantic colour type.
- Add TanStack Query hooks/query keys for labels, ventures, active/archive venture lists, activity types, project board lists, and mutations.
- Mutation success invalidates the minimum relevant query keys so sidebar, board, dialogs, and time-log lists stay in sync.
- Keep board options and expanded/sidebar selection state in local UI state or `localStorage`; do not create server-persisted preferences.
- Maintain `tsc --noEmit` and ESLint compliance with no `any`.

### Edge Cases

- API validation errors preserve typed error details for dialogs and combobox create flows.
- Missing optional fields such as `icon`, `description`, `activity_type_name`, or `location` do not crash renderers.
- Stale query data after archive/unarchive is invalidated so active and archive views do not show the same entity simultaneously.
- Existing `localStorage` board option values from Phase 1b are tolerated without forcing a reset.
- Generated frontend types do not expose `is_asset` as a current field.

---

## Ticket 1.6-8

### Title

Venture Tree Sidebar and Venture Dialogs

### Acceptance Criteria

- Write frontend tests for venture tree rendering, expand/collapse, project checkbox filtering, venture create/edit dialog, category label selection/creation, and archive entry points before implementation.
- Replace the Phase 1b venture scaffold with an active sidebar tree grouped by active ventures.
- Each venture row shows name, colour, category label display, expand/collapse affordance, and child project count where useful.
- Child project rows keep Phase 1b checkbox behaviour: multi-select filtering, all active projects selected by default, and persisted selection where already supported.
- Clicking a venture title opens a `VentureDialog` for edit.
- `+ Hustle` opens the venture create dialog with default category label `Hustle`.
- Venture create/edit dialog includes name, description, colour swatch picker, category label combobox/select, and optional icon if supported by the backend.
- Category label UI allows selecting existing labels and creating a new label using the label API.
- Archive action is available as a secondary/destructive action at the bottom of the venture edit dialog.
- Archiving a venture removes it and its cascaded active projects from the default tree after mutation success.
- Archive link in the sidebar can show archived ventures and archived projects in the existing archive dialog pattern.
- Sidebar empty state guides the user to create a venture before creating projects.

### Edge Cases

- A venture with no child projects renders expanded state cleanly with an empty child message or no child rows.
- Creating a label with duplicate casing surfaces validation inline and leaves the venture form open.
- Archiving the currently selected venture resets project filter state to a valid active selection.
- Unarchiving a venture restores projects archived by the cascade and refreshes the default tree.
- Archived ventures do not appear in the active sidebar, even if active project query data is stale.
- Loading state does not render dead checkboxes or misleading project rows.

---

## Chore 1.6-C1

### Title

Dev Stack Stability and Frontend Query Churn Reduction

### Type

Chore (no new product features). Run through the agent ticket loop after **1.6-8** and before **1.6-9**. Do not mix with **1.6-9+** feature tickets in one implementation pass.

### Background

Full `docker compose up` on macOS (Vite in-container + bind-mounted `./frontend`, uvicorn `--reload` on `./backend`, SQLite under `./backend/data`) has caused Docker Desktop VM instability, high file-watcher CPU, and occasional Desktop crashes—especially under heavy parallel test/agent load. **Backend-in-Docker + frontend-on-host** (`VITE_PROXY_TARGET=http://localhost:8000`, `npm run dev`) has been validated as stable for normal Phase 1.6 UI work. This chore documents that workflow and reduces avoidable frontend refetch/render churn from TanStack Query (post **1.6-7**) and a known `App.tsx` render-time state pattern.

### Acceptance Criteria

#### 1. Docker / local dev stack (stability)

- Document the **recommended default dev workflow** for macOS: backend via Compose (or backend-only service), frontend via host `npm run dev` with API proxy to `localhost:8000`.
- Document **full Compose** (frontend + backend in containers) as optional smoke/parity only, with explicit caveats about bind mounts and file watchers.
- Add a **backend-only Compose path** (profile, override file, or documented command) so developers can run `docker compose up` for the API without starting the Vite container—without duplicating unrelated service definitions.
- Where the repo controls it, reduce container watcher load for the documented backend-only path (e.g. do not require `uvicorn --reload` for the recommended Docker backend command if a separate documented full-reload path remains available).
- Do not increase Docker Desktop memory limits in repo config; fixes must work within existing Desktop constraints.

#### 2. TanStack Query invalidation storms (medium priority)

- Narrow mutation `invalidateQueries` scope so routine edits do not refetch unrelated surfaces:
  - Category label mutations must refresh venture list data used for sidebar label display (not only the label list).
  - Activity type mutations must invalidate affected time-log query keys when display names can go stale.
  - Project mutations must invalidate project list **and** project board query keys where board data exists.
- Avoid blanket invalidation that refetches archived venture/project queries while archive UI is closed, where practical (e.g. enable or mount archived queries only when `ArchiveDialog` is open).
- Preserve correct UI after archive/unarchive; add or update targeted tests in `modules.test.tsx` (or equivalent) proving the minimum invalidation keys fire.

#### 3. `setState` during render in `App.tsx` (correctness)

- Remove `setOptimisticTasks` / `setKanbanMutationError` calls from the render body (currently keyed off `storedProjectIdsKey` and `tasksQuery.data` reference changes).
- Reimplement the same behaviour in `useEffect` (or equivalent) so Kanban optimistic state clears when filters or server task data change, without violating React render rules.
- Add or extend a frontend test that would fail if render-time `setState` is reintroduced during filter/task data churn (Kanban or filter interaction path).

#### 4. Stable `reload` in `queryUtils.ts` (performance)

- Memoize `reload` in `toQueryState` (e.g. `useCallback` tied to `query.refetch`) so consumers like `Sidebar` do not get a new function identity every render.
- Remove dead or misleading arguments passed into hooks that no longer accept reload callbacks (e.g. `useVentureMutations(reloadVenturesAndProjects)` if the hook uses internal invalidation only).
- No change to public hook contracts beyond stabilizing `reload`; `tsc --noEmit` and ESLint remain clean.

### Out of Scope

- New venture, project, board, or activity-type product behaviour (**1.6-9+**).
- Migrating `test_tasks.py` / `test_projects.py` (see **Chore 1.6-C2**).
- Fixing all `App.1b*` archive-tab tests (see **Chore 1.6-C2**).
- Increasing Docker Desktop RAM, resetting owner machines, or requiring a specific Docker Desktop version.

### Edge Cases

- Backend-only Compose must still run migrations and serve `/api/v1` on port 8000 as today.
- Narrower invalidation must not leave sidebar venture labels stale after label rename/delete.
- Moving optimistic task reset to `useEffect` must not reintroduce Kanban flicker or stale optimistic cards after successful status PATCH.
- Documented dev commands work on a clean clone after `npm ci` / backend venv install without hardcoded owner paths.

### Verification (Implementer / Reviewer)

- Owner can run documented **backend-only Docker + host frontend** flow and use ventures, labels, and archive without Vite-in-Docker.
- Targeted frontend tests for query invalidation and `App` optimistic behaviour pass.
- `make lint` on touched frontend files passes; no `any` introduced.

---

## Chore 1.6-C2

### Title

Legacy Test Migration — Venture-Aware Project Fixtures and Integration Harness

### Type

Chore (no new product features). Run through the agent ticket loop after **Chore 1.6-C1** and before **1.6-9**. Do not mix with feature tickets in one implementation pass.

### Background

After Phase 1.6, `POST /api/v1/projects` requires `venture_id`. Legacy suites **`test_tasks.py`** (22 failures) and **`test_projects.py`** (13 failures) still call helpers that create projects without a venture, failing immediately with `422` (`Field required` on `venture_id`). **`make test` runs `test-backend` first**; when those 35 tests fail, the Makefile may never reach the frontend suite.

Frontend integration tests using `renderApp()` render `<App />` without `QueryClientProvider` while production uses TanStack Query (**1.6-7**), causing widespread `No QueryClient set` failures in `App.1b4` / `App.1b5` (and similar) if run in isolation. Some **1.6-8** archive UI tests still expect an **Archived tasks** tab; the product archive dialog now has **Archived ventures** and **Archived projects** only.

Backend coverage (~86% with failing legacy tests) comes from new Phase 1.6 API tests on the branch, not from the broken helpers—the failing legacy tests add almost no regression signal until fixed.

### Acceptance Criteria

#### Backend — venture-aware helpers

- Update shared project-creation helpers in **`backend/app/tests/test_tasks.py`** and **`backend/app/tests/test_projects.py`** (and `conftest.py` if shared fixtures belong there) so every project create:
  - Creates or reuses a valid **active** venture first (e.g. via API or test DB helper aligned with `test_ventures.py` / `test_projects_phase_1_6_4.py` patterns).
  - Passes `venture_id` on `POST /api/v1/projects`.
- All **35** previously failing tests in those two modules pass without weakening assertions (still expect `201` where creation should succeed).
- No production schema or API changes unless a test reveals a real bug; prefer test-only fixture fixes.

#### Frontend — integration harness

- Wrap **`renderApp` / `renderAppBare`** in `frontend/src/test/renderApp.tsx` with the same `QueryClientProvider` / test client pattern used in `modules.test.tsx` and `QueryProvider.tsx` so `App` and descendants using TanStack hooks mount correctly.
- Confirm **`App.test.tsx`** Ticket 3 and other venture-tree tests still pass after harness change.

#### Frontend — archive dialog test alignment (**1.6-8**)

- Update or remove **`App.1b4`** / **`App.1b5`** expectations that require an **Archived tasks** tab or `GET /api/v1/tasks?status=archived` from the archive dialog, aligning tests with current product behaviour (ventures + archived projects tabs only).
- Preserve coverage for task archive from the **task edit modal** and other **1.6-8**-relevant archive flows where the product still supports them.
- Do not reintroduce an Archived tasks tab in product UI as part of this chore unless the owner explicitly expands scope.

#### Quality gates

- `cd backend && pytest` (or `make test-backend`) passes with no failures in `test_tasks.py` or `test_projects.py`.
- `cd frontend && CI=true npm run test` passes for touched `App.1b4` / `App.1b5` (and any other files fixed by the harness change); document any remaining pre-existing failures separately in the handoff without hiding new regressions.
- `make lint` passes for touched files.

### Out of Scope

- Docker dev stack documentation (**Chore 1.6-C1**).
- New tickets **1.6-9** through **1.6-12** feature work.
- Rewriting the entire `App.1b*` suite beyond what the harness and archive-tab alignment require.
- Backend migration or Alembic changes.

### Edge Cases

- Helpers work on empty DB and on DBs with seeded `Unsorted` venture from migration.
- Archived-project and archived-venture scenarios in legacy tests use valid venture ownership rules from **1.6-4**.
- `QueryClient` in tests is isolated per test where needed to avoid cross-test cache leakage (match existing `QueryProvider` / `modules.test.tsx` patterns).
- Tests do not depend on execution order across files.

### Verification (Implementer / Reviewer)

- `make test-backend`: **125** backend tests collected, **0** failures (or document any unrelated pre-existing failures explicitly).
- `make test` completes both backend and frontend recipes when owner runs full gate.
- Handoff lists before/after failure counts and confirms the 35 backend failures were addressed by fixture migration, not by deleting tests.

---

## Chore 1.6-C3

### Title

Frontend Test Harness Completion — QueryClient Coverage for Legacy App and Sidebar Suites

### Type

Chore (no new product features). Run through the agent ticket loop after **Chore 1.6-C2** and before **1.6-9**. Do not mix with feature tickets in one implementation pass.

### Background

After **1.6-C2**, backend tests pass again and the `renderApp()` harness covers the archive-dialog slices that were blocking that chore. Full `make test` still fails in legacy frontend suites that render `<App />` or `<Sidebar />` directly without the shared TanStack Query test wrapper. Current failures in **`AppShell.test.tsx`** and **`Sidebar.phase-1-6-8.test.tsx`** are not product regressions; they fail immediately with `No QueryClient set, use QueryClientProvider to set one`.

These suites now exercise query-backed components introduced by **1.6-7** and **1.6-8**, so the old “raw render” pattern no longer matches production wiring. Until those tests use the shared provider pattern, `make test` continues to report avoidable frontend failures and obscures genuine UI regressions.

### Acceptance Criteria

#### Frontend — shared QueryClient test harness

- Update legacy frontend tests that directly render query-backed surfaces without a provider so they use the shared QueryClient test pattern already established in `frontend/src/test/renderApp.tsx`, `frontend/src/test/QueryProvider.tsx`, and `frontend/src/api/modules.test.tsx`.
- At minimum, migrate:
  - **`frontend/src/components/layout/AppShell.test.tsx`**
  - **`frontend/src/components/layout/Sidebar.phase-1-6-8.test.tsx`**
- If any additional Phase 1b / 1.6 suites fail for the same `No QueryClient set` reason during this chore, migrate them in the same pass rather than leaving a second harness-only ticket behind.
- Prefer one shared helper or wrapper pattern over per-file ad hoc provider setup where practical.
- Preserve the existing behavioural intent of the tests; this chore changes test harness wiring, not product scope.

#### Frontend — venture/tree regression coverage remains meaningful

- `AppShell.test.tsx` still asserts the original shell/page-layout expectations after the wrapper change.
- `Sidebar.phase-1-6-8.test.tsx` still covers venture-tree rendering, expand/collapse, default project selection, venture create/edit entry points, archive dialog entry points, and active-tree removal after venture archive.
- Query-backed tests do not rely on cross-test cache leakage; QueryClient state remains isolated per test or per render helper.

#### Quality gates

- `make test` no longer fails on `No QueryClient set` errors in the migrated suites.
- `cd frontend && CI=true npm run test` passes for the touched harness and suite files, or any unrelated remaining failures are documented explicitly in the handoff.
- `make lint` passes for touched files.

### Out of Scope

- Backend fixture work already covered by **Chore 1.6-C2**.
- Rewriting archive, time-log, or board assertions unrelated to QueryClient/provider wiring.
- New venture, project, board, or activity-type product behaviour.

### Edge Cases

- Tests that intentionally assert the failure mode without a provider may remain, but they must not poison suite-level stderr or cause false negatives in surrounding tests.
- Shared test helpers must not hide fetch mocks, localStorage setup, or store resets that individual suites still need to control explicitly.
- Adding the provider must not accidentally auto-fetch archived data or mutate local UI state in ways the test did not previously need to account for.

### Verification (Implementer / Reviewer)

- Handoff lists which files were migrated from raw `render(...)` to the shared query-aware test wrapper.
- Handoff confirms the prior `No QueryClient set` failures are gone.
- Reviewer verifies the change is harness-only unless a tiny shared test utility adjustment was required.

---

## Chore 1.6-C4

### Title

Legacy Time-Log Frontend Test Stabilization

### Type

Chore (no new product features). Run through the agent ticket loop after **Chore 1.6-C3** and before **1.6-9**. Do not mix with feature tickets in one implementation pass.

### Background

Once the remaining QueryClient harness failures are removed, full `make test` still exposes legacy time-log test drift in **`App.1b6.test.tsx`** and related app-level suites such as **`App.test.tsx`**. Current failures include timeouts while waiting for time logs to load, assertions that run before log rows appear, and missing controls such as the delete action because the test is asserting against an intermediate loading state rather than the settled dialog.

These failures are different from the QueryClient/provider problem. They may be stale test expectations, async timing mistakes, or a genuine product regression in time-log rendering/refresh. They should be isolated and resolved before **1.6-9+** so the remaining phase work runs against a trustworthy frontend suite.

### Acceptance Criteria

#### Frontend — time-log integration test alignment

- Investigate the remaining failing time-log tests after **Chore 1.6-C3** is green and classify each as:
  - stale test timing/assertion,
  - stale expectation after signed-off UI changes, or
  - genuine product regression.
- At minimum, address the failing slices currently surfacing in:
  - **`frontend/src/App.1b6.test.tsx`**
  - **`frontend/src/App.test.tsx`** time-log integration coverage
- Tests wait for time-log data and controls at the correct lifecycle point instead of asserting against transient loading states.
- Delete/update/create time-log tests assert against the current accessible UI affordances and refreshed derived-hour values after the relevant network round-trip completes.
- If a genuine product bug is revealed, fix the minimum production code required and keep the scope strictly limited to restoring signed-off Phase 1b / 1.6 behaviour.

#### Frontend — preserve regression value ahead of 1.6-11

- Existing manual time-log behaviours from Phase 1b remain covered:
  - load logs when the task dialog opens,
  - create via POST,
  - delete via DELETE,
  - refresh actual hours and related derived fields after mutation,
  - display existing notes/detail rows once data has loaded.
- Do not pre-implement **1.6-11** activity-type UI as part of this chore.
- Do not weaken the suite by deleting the failing time-log scenarios outright unless the behaviour is explicitly obsolete and replaced with an equivalent assertion.

#### Quality gates

- After **Chore 1.6-C3**, `make test` passes the remaining time-log-related frontend slices touched by this chore.
- `cd frontend && CI=true npm run test` passes for touched `App.1b6` / `App.test` files, or any unrelated remaining failures are documented explicitly in the handoff.
- `make lint` passes for touched files.

### Out of Scope

- QueryClient/provider migration already covered by **Chore 1.6-C3**.
- Activity-type combobox and display work reserved for **1.6-11**.
- Backend time-log API changes unless a failing frontend test proves a real regression already within current phase scope.

### Edge Cases

- Tests must not pass only because mocked time-log fetches are skipped; they need to prove the UI handles the loading-to-loaded transition.
- If deletion controls are conditionally rendered, tests must cover the state that legitimately exposes them rather than reaching into hidden DOM.
- If a timing issue comes from optimistic UI or dialog state reset, the fix must not introduce brittle `setTimeout`-style waits.

### Verification (Implementer / Reviewer)

- Handoff lists the exact before/after failing assertions for each time-log test fixed.
- Handoff states whether each fix was test-only or required production code.
- Reviewer verifies no premature **1.6-11** scope expansion was introduced.

---

## Ticket 1.6-9

### Title

Project Create, Edit, Archive, and Type UX

### Acceptance Criteria

- Write frontend tests for project creation from venture context, project edit fields, project type selection, archive completion prompt, and validation handling before implementation.
- Remove any root-level active `+ Project` creation path; projects are created inside a venture context.
- From a venture row or empty venture state, expose a create-project action with that venture preselected.
- Project create/edit dialog includes venture, name, description, colour swatch picker, optional icon, project type, and board status.
- Project type selector offers exactly `project`, `asset`, `gig`, and `contract`; default is `project`.
- Selecting a non-default project type changes only classification and display, not task fields or behaviour.
- Project create requires a venture and blocks submission if no active venture exists.
- Project edit allows moving a project to another active venture.
- Project archive flow prompts or provides a control for `finished`; if omitted by user flow, it respects the backend default of shipped projects finishing.
- Project unarchive is available from archive UI when parent venture is active.
- Dialog and list copy uses product terms only; no implementation text, sprint IDs, or API jargon.

### Edge Cases

- Launching create from a venture row keeps that venture selected even if other data refetches.
- Attempting to create a project while all ventures are archived shows a clear empty state and link to create/unarchive a venture.
- Changing project type on an existing project does not move it between boards or affect existing tasks.
- Archiving the only project selected in the sidebar resets filters to remaining active projects or an empty state.
- Attempting to unarchive a project under an archived venture is blocked with clear copy.
- Existing projects migrated to `Unsorted` are editable and can be moved to a newly created venture.

---

## Ticket 1.6-10

### Title

Project Kanban Board and Project Type Filter

### Acceptance Criteria

- Write frontend tests for the Tasks | Projects toggle, Project Kanban columns, drag persistence, type filter, empty states, and failed-drag rollback before implementation.
- Activate the Projects page `Tasks | Projects` toggle so Tasks shows the existing Task Kanban and Projects shows the new Project Kanban.
- Project board columns are exactly `Idea`, `Active`, `Paused`, and `Shipped`.
- Project cards show project colour dot, project name, status badge, type indicator when `project_type` is not `project`, and one default metric such as open task count if available.
- Project board lists all active project types together by default.
- Add a project type filter supporting all, `project`, `asset`, `gig`, and `contract`.
- Sidebar venture/project selection scopes the Project Kanban consistently with the Task Kanban.
- Dragging a project within or across columns calls `PATCH /api/v1/projects/{id}/board-status` and persists status/order.
- Failed board-status persistence rolls back optimistic UI and surfaces an error without duplicating cards.
- Moving a project into Shipped reflects the backend `finished = true` default in subsequent reads.
- Project board respects existing board options/localStorage patterns where relevant, without introducing server-persisted preferences.

### Edge Cases

- Empty Project Kanban columns remain visible and valid drop targets.
- Filtering to a type with no projects shows an empty state that preserves the filter controls.
- Dragging is disabled while project board data is loading or a mutation is in flight.
- Clicking a project title/card opens project edit without starting drag.
- Archived projects and projects under archived ventures are excluded from the active Project Kanban.
- Stale board option values from the task board do not hide required project card identity fields.

---

## Ticket 1.6-11

### Title

Time Log Activity Type Combobox and List UX

### Acceptance Criteria

- Write frontend tests for activity type combobox search, inline create, time-log create/edit display, `uncategorised` rendering, archived-cleared activity types, and date ordering before implementation.
- Update the add/edit time-log form to use activity type as the primary label input.
- Activity type selector is a searchable combobox populated from active activity types.
- Typing filters existing activity types case-insensitively.
- When no match exists, the dropdown shows a single `Create activity` option.
- Creating an activity from the combobox calls the activity type API, selects the created type, and preserves the rest of the time-log form.
- Enforce max 25-character activity type validation in UI and display server validation errors inline.
- Time-log notes remain optional and are used for specifics.
- Time-log location remains available and displayed in the list row.
- Time-log list rows display activity type as the bold primary row label.
- Time logs with null or cleared activity type display `uncategorised`.
- Time-log list remains date ordered; no grouping or filtering by activity type is introduced.
- Activity type management affordances for rename/archive/delete are available where consistent with existing UI patterns, or linked from the combobox if a compact management surface is needed.

### Edge Cases

- Existing migrated logs render `uncategorised` without requiring user action.
- Creating `Planning` when `planning` exists selects the existing activity or surfaces duplicate validation; it must not create a duplicate.
- Creating `uncategorised` as an activity type is rejected with clear copy.
- Archiving an activity type currently shown on logs refreshes affected rows to `uncategorised`.
- Deleting a used activity type surfaces the backend validation error and leaves logs unchanged.
- Combobox search with whitespace-only input does not offer an invalid create action.
- Date ordering remains stable when multiple logs share the same logged date.

---

## Ticket 1.6-12

### Title

Phase 1.6 Integration, Regression, and Scope Guards

### Acceptance Criteria

- Add or update regression tests confirming no task `type`, task labels, or task semantic colour field exists in backend models, schemas, API payloads, frontend types, or UI.
- Add migration regression coverage for populated databases: existing projects attach to `Unsorted`, branch `is_asset` data maps to `project_type = asset`, existing time logs remain nullable and display `uncategorised`, and existing tasks keep status/order.
- Add integration coverage for venture archive cascade through the UI/API path: archive venture, hide child projects, unarchive venture, restore only cascade-archived projects.
- Add integration coverage for project archive vs Project Kanban shipped vs `finished` semantics.
- Add integration coverage for activity type archive clearing time-log FKs and preserving time-log rows.
- Verify archive UI distinguishes archived ventures, archived projects, and existing archived task patterns without introducing hard-delete/purge UI.
- Verify project type filter, sidebar venture selection, task board, project board, task summary table, project dialogs, and time-log dialogs work together without stale state after mutations.
- Update docs only if implementation discovers a signed-off PRD/TRD ambiguity; otherwise do not expand scope.
- Run the repository quality gates required by `AGENTS.md` for touched areas and record results in the ticket handoff.
- Prepare a reviewer checklist mapping each Phase 1.6 PRD/TRD acceptance shape item to the ticket that implemented it.

### Edge Cases

- Databases with no projects still get seeds and can create the first venture/project cleanly.
- Databases with only archived projects do not produce active sidebar rows after migration.
- A venture archive cascade over mixed active and already archived child projects restores only the correct subset.
- Activity type archive during an open task dialog refreshes the dialog without losing unsaved unrelated edits.
- `localStorage` containing stale Phase 1b board/filter state cannot crash the app after the venture tree is introduced.
- Owner quality-gate runs may reveal unrelated pre-existing failures; record them separately and do not hide Phase 1.6 regressions.

---

## Ticket 1.6-13

### Title

Post–Phase 1.6 UX Polish — Task Board Title Hover, Project Kanban Cards, and Venture Sidebar

### Type

Polish (no new domain features). Implement after **1.6-12** is signed off on `main` or as a follow-on branch from **`feat/phase-1.6`**. Does not change API contracts unless a bug fix is strictly required for interaction wiring.

### Background

Owner review surfaced small visual and interaction inconsistencies relative to the task board and archive patterns already in the app. Reference screenshots (workspace assets): task card title hover, project kanban column/cards, ventures sidebar.

### Acceptance Criteria

#### Task Kanban — title hover (Image 1)

- On hover, the task card **title** shows **underline only** (link-style emphasis). Remove the solid **pill / background fill** behind the title on hover so behaviour matches “clickable bold text,” not a button.

#### Project Kanban — cards and columns (Image 2)

- **Card title** matches the task card title pattern: **bold, clickable text** with **underline on hover**; no pill-shaped button fill or faux-button background for the title.
- Remove the per-card **lifecycle pill** (e.g. “Active”) and the **dedicated drag-handle control** from the card chrome.
- The **entire project card** is the drag surface (same interaction model as task cards): appropriate **grab / grabbing** cursor while dragging is possible; title click still opens project edit **without** starting a drag (activation distance / pointer separation as on task cards).
- Below the title, show **only the numeric count** of **active** (non-archived / in-scope) open tasks for that project — **no** trailing label such as “open tasks” / “open task” unless product copy elsewhere already requires it; default to **number only** per owner direction.
- **Column headers** (`Idea`, `Active`, `Paused`, `Shipped`) use the **same coloured pill treatment** as task Kanban column/status headers (reuse tokens / components where practical for consistency).

#### Ventures sidebar — venture row chrome (Image 3)

- **Expand / collapse** control is **compact**: primary affordance is a **bold chevron** — **`>`** to expand, **`<`** when expanded (or equivalent single-glyph chevron per design system), **not** a large “Collapse” pill. Preserve existing **hover** behaviour where practical: **darker colour** and **slight upward motion** on hover (match current animation feel; duration/easing may stay as today).
- **Add project** moves to the **bottom of that venture’s project list** (after listed projects). Present as **small clickable text** **`+ project`** (casing per `docs/patterns.md`), not a full-width brown oblong button.
- The **vertical colour accent** beside the venture name extends the **full vertical extent** of that venture block: venture header row **and** the nested project list **and** the **`+ project`** row, so the stripe reads as one continuous venture region.

### Edge Cases

- Keyboard and screen-reader users: collapse control remains focusable and has an accessible name (e.g. “Expand venture” / “Collapse venture”) even if the visible control is only a chevron.
- Drag-from-whole-card must not regress **click-to-edit** on the title; keep existing pointer-sensor activation distance or equivalent.
- Very long venture or project names must not break the extended colour stripe layout (truncate or wrap consistently with sidebar rules).

### Out of Scope

- New archive flows, new board columns, project type semantics, or server-persisted preferences.
- Rewriting unrelated sidebar filters or venture CRUD dialogs beyond what is listed above.

### Verification

- Visual spot-check against the three reference images after implementation.
- RTL or smoke tests updated if existing tests assert on removed class names, roles, or copy (“Collapse”, “Add project”, drag handle test ids).

---

## Ticket 1.6-14

### Title

Post–Phase 1.6 UX Polish — Archive Ventures and Archive Projects Consistency

### Type

Polish (no new domain features). Implement after **1.6-12** (may ship with or after **1.6-13** depending on branch strategy).

### Background

**Archived ventures** and **Archived projects** tabs should read as one archive experience: same tab chrome, list row layout, restore affordance, and detail/dismiss behaviour. Reference screenshots: archived ventures list vs archived projects list.

### Acceptance Criteria

#### Visual parity between tabs

- **Archived projects** tab label styling matches **Archived ventures**: **no** extra pill / brown background on the selected tab that the ventures tab does not use; both tabs share the **same** selected and unselected styles.
- List rows use a **consistent** layout pattern across both tabs (typography, spacing, hover row treatment).

#### Restore affordance and confirmation

- Replace primary-row **Unarchive** pill buttons with **right-aligned** plain text control **`restore`** (clickable link / text-button styling consistent with app patterns, not a filled oblong).
- Activating **`restore`** opens a **confirmation** step (modal or alert dialog) asking the user to confirm before calling the unarchive API — copy is product-facing, not implementation jargon.
- **Archived ventures** rows expose the same **`restore`** text affordance (right-aligned) where restoration is allowed by business rules.

#### Detail views and navigation stack

- Clicking an **archived venture** row opens a **detail** view for that venture (same level of inspection as archived projects already support — fields the product considers useful for read-only review).
- **Dismiss detail**: **Cancel**, **backdrop click**, or equivalent **returns to the archive list** on the **same tab** the user was viewing (**Archived ventures** or **Archived projects**), **not** to the main project board or another top-level route. Match or improve the behaviour already expected for archived **projects** so both entity types behave the same.

### Edge Cases

- If restore is **not allowed** (e.g. parent venture still archived for a project), surface inline error after confirm per existing API errors; do not leave the confirmation dialog in an indeterminate state.
- Loading and error states during restore remain accessible (focus return, `aria-busy` or live region if already used elsewhere).

### Out of Scope

- Hard-delete / purge UI, bulk restore, or new archive reasons.
- Backend rule changes beyond what existing unarchive endpoints already enforce.

### Verification

- Manual walkthrough: both archive tabs, restore confirm + cancel, open venture detail and dismiss via cancel and backdrop.
- Update or add RTL tests if `ArchiveDialog` structure, roles, or copy assertions changed.

---
