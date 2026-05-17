# Phase 1 Tickets — Projects + Tasks + Kanban

## Scope Notes
- Phase 1 covers the first end-to-end project and task workflow only: projects CRUD, tasks CRUD, Kanban, task modal, manual time logs, and project filtering.
- The `GET /api/v1/projects/{id}/summary` route and any per-project income or goal metrics are deferred. They depend on Phase 2 and Phase 3 data that does not exist yet.
- Tailwind/design-token gaps from Phase 0 are a dependency risk, not new scope. Phase 1 may only do the minimum wiring needed to render these screens with the existing token approach.

## Assumptions
- Archived projects are read-only in Phase 1. They remain retrievable by ID for data integrity, but they are excluded from default UI selectors and default list views.
- `DELETE /api/v1/tasks/{id}` is a hard delete in Phase 1 and removes that task's manual time logs in the same transaction.
- The Phase 1 task workspace includes both the Kanban board and the summary table described in `docs/V1-PRD.md`.

## Ticket 1 — Backend Projects CRUD And Archive

### Acceptance Criteria
- Add an Alembic migration for the `projects` table using the Phase 1 schema from `docs/V1-TRD.md`: `id`, `name`, `description`, `colour`, `status`, `created_at`, and `updated_at`.
- Implement typed backend models, schemas, services, and routers for `GET /api/v1/projects`, `POST /api/v1/projects`, `GET /api/v1/projects/{id}`, `PATCH /api/v1/projects/{id}`, and `DELETE /api/v1/projects/{id}`.
- `POST /api/v1/projects` requires a non-empty `name`; `description` and `colour` are optional; a successful create returns `status: "active"` with generated UUID and timestamps.
- `GET /api/v1/projects` supports `status=active` and `status=archived`; when the query parameter is omitted, only active projects are returned.
- `GET /api/v1/projects/{id}` returns both active and archived projects by ID.
- `PATCH /api/v1/projects/{id}` updates only `name`, `description`, and `colour`; `id`, `created_at`, and `status` are not editable through this route.
- `DELETE /api/v1/projects/{id}` performs a soft archive by setting `status` to `archived` and updating `updated_at`; it does not delete the row or detach related tasks/time logs.
- Project `colour`, when provided, must match a seven-character hex string in the `#RRGGBB` format.
- Routers remain thin: validation, archive behavior, and query filtering live in `services/`, not in route handlers.

### Edge Cases
- Creating or updating a project with a blank or whitespace-only `name` returns a validation error.
- Creating or updating a project with an invalid `colour` value returns a validation error.
- Requesting or archiving a non-existent project returns `404`.
- Patching an archived project returns `409` because archived projects are read-only in Phase 1.
- Repeating `DELETE /api/v1/projects/{id}` on an already archived project is idempotent and does not create duplicate side effects.

## Ticket 2 — Backend Tasks, Status Workflow, And Manual Time Logs

### Acceptance Criteria
- Add an Alembic migration for the `tasks` and `time_logs` tables using the Phase 1 schema from `docs/V1-TRD.md`, including `kanban_order`, `completed_date`, and `project_id` on `time_logs`.
- Implement typed backend models, schemas, services, and routers for `GET /api/v1/tasks`, `POST /api/v1/tasks`, `GET /api/v1/tasks/{id}`, `PATCH /api/v1/tasks/{id}`, `DELETE /api/v1/tasks/{id}`, `PATCH /api/v1/tasks/{id}/status`, `GET /api/v1/tasks/{id}/time-logs`, and `POST /api/v1/tasks/{id}/time-logs`.
- `POST /api/v1/tasks` requires an existing active `project_id` and a non-empty `title`; it accepts optional `description`, `status`, `priority`, `target_date`, and `estimated_hours`; default values are `status: "backlog"` and `priority: "medium"`.
- Allowed task statuses are exactly `backlog`, `in_progress`, `review`, and `done`. Allowed priorities are exactly `low`, `medium`, `high`, and `urgent`.
- `GET /api/v1/tasks` supports `project_id`, `status`, and `priority` filters; when multiple filters are supplied they combine with logical AND.
- `PATCH /api/v1/tasks/{id}` updates editable task fields but does not allow the client to write `actual_hours` directly.
- `actual_hours` is always derived from `SUM(time_logs.hours)` for that task and is returned on task detail and task list responses.
- When a task is created or updated with `status: "done"`, or when `PATCH /api/v1/tasks/{id}/status` moves a task into `done`, the backend auto-sets `completed_date` to the current UTC calendar date if it was previously unset.
- When a task moves from `done` back to any non-done status, the backend clears `completed_date`.
- `PATCH /api/v1/tasks/{id}/status` updates only the Kanban-specific fields needed by drag/drop: `status`, `kanban_order`, `completed_date`, and `updated_at`.
- `POST /api/v1/tasks/{id}/time-logs` requires `hours`, `logged_date`, and optional `notes`; new time logs are stored with `source: "manual"` and inherit `project_id` from the parent task, not from client input.
- `GET /api/v1/tasks/{id}/time-logs` returns only logs for the requested task and sorts them by `logged_date` descending, then `created_at` descending.
- `DELETE /api/v1/tasks/{id}` hard-deletes the task and its manual time logs in one transaction.

### Edge Cases
- Creating or updating a task with an unknown `project_id` returns `404`.
- Creating or updating a task against an archived project returns `409`.
- Invalid `status` or `priority` values return a validation error.
- `estimated_hours` may be omitted, but when supplied it cannot be negative.
- Manual time logs reject `hours <= 0`.
- Posting a time log to a non-existent task returns `404`.
- Moving a task within the same status column updates order without changing `completed_date`.
- Client-supplied `actual_hours`, `completed_date`, or `project_id` on time-log create are ignored or rejected so the backend remains the source of truth.

## Ticket 3 — Frontend Project Management And Shared Data Layer

### Acceptance Criteria
- Add typed frontend API modules and query/mutation hooks for Phase 1 project, task, and time-log routes without using `any`.
- The Phase 1 UI exposes create, edit, list, and archive flows for projects; exact control placement may vary, but each flow must be reachable without manual URL editing.
- Project create and edit forms expose `name`, `description`, and `colour`, and they surface server-side validation failures inline.
- Active projects are rendered with their colour tag where the UI shows project identity.
- Archiving a project removes it from the default active-project list, the project filter options, and any project selector used to create or edit tasks.
- The project filter supports one specific active project or an all-projects view, and its state is shared by both the Kanban board and the summary table.
- Project create, edit, and archive mutations invalidate or refresh the relevant queries so the UI stays consistent without a full-page reload.
- If no active projects exist, the task creation flow is blocked with a clear prompt to create a project first.

### Edge Cases
- The all-projects filter remains available even when there is only one active project.
- A project name or colour validation failure does not clear the form state.
- If a project is archived while it is selected in the filter, the UI falls back to the all-projects view.
- Archived projects remain hidden from default selectors even if the backend detail route can still return them by ID.

## Ticket 4 — Frontend Task Summary Table, Task Modal, And Manual Time Logs

### Acceptance Criteria
- The Phase 1 task workspace includes a summary table that lists tasks across all active projects and can be sorted client-side by target date, priority, and project name.
- The UI exposes a create-task flow and an edit-task flow using a task modal or equivalent dialog surface.
- The task form includes `title`, `description`, `project`, `status`, `priority`, `target_date`, and `estimated_hours`.
- The task detail surface shows read-only `actual_hours` and `completed_date` values returned by the backend.
- The task detail surface lists manual time logs for the selected task and allows adding a new manual time log with `logged_date`, `hours`, and `notes`.
- A successful task create or update refreshes both the summary table and the Kanban board so they stay consistent with the backend.
- A successful manual time-log entry refreshes the selected task detail and any task list/card display that shows `actual_hours`.
- The shared project filter applies to the summary table and to the task creation defaults or selectors consistently.

### Edge Cases
- Attempting to create a task without any active projects shows a blocking empty-state message instead of a broken form.
- Sorting handles missing `target_date` values without crashing and keeps the ordering deterministic.
- Validation errors for blank task title, invalid enum values, or invalid hours remain visible until corrected.
- Double-submitting the task form or time-log form does not create duplicate records.

## Ticket 5 — Frontend Kanban Board With Persisted Drag And Drop

### Acceptance Criteria
- Build the Phase 1 Kanban board with `@dnd-kit` using exactly four status columns: Backlog, In Progress, Review, and Done.
- Each column renders tasks filtered from the shared project filter and ordered by `kanban_order` ascending.
- Dragging a card within the same column persists the updated order through the backend and preserves that order after a refresh.
- Dragging a card to a different column persists the new status and order through `PATCH /api/v1/tasks/{id}/status`.
- Moving a task into Done results in the backend-generated `completed_date` being visible when the task is reopened; moving it back out of Done clears that date.
- Task cards display enough context to distinguish work in the all-projects view: task title, priority, project name/colour, target date when present, and derived actual hours when present.
- Empty columns remain visible and valid drop targets.
- Failed drag persistence rolls the UI back to the last confirmed server state and surfaces an error instead of leaving the board in a mismatched optimistic state.

### Edge Cases
- Reordering a column with a single card is a no-op and does not trigger a broken update.
- Switching the project filter while a board refetch is in flight does not duplicate or strand cards in the wrong column.
- A task returned without `kanban_order` is still rendered deterministically until the first explicit reorder persists.
- Dragging is unavailable while the board's required task data has not loaded, and the UI presents a non-broken loading or empty state.
