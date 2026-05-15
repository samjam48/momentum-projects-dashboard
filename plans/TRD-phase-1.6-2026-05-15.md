# Phase 1.6 TRD - Ventures, Project Types, Project Kanban, and Time Log Activity Types

**Status:** Signed off - owner decisions resolved  
**Owner:** Sam  
**Date:** 2026-05-15  
**Related PRD:** `plans/PRD-phase-1.6-2026-05-15.md`

---

## 1. Existing Implementation Grounding

Current implementation is Phase 1 shaped:

- Backend has `projects`, `tasks`, and `time_logs` SQLModel models and Alembic migrations.
- `Project.status` currently represents archive visibility: `active` or `archived`.
- `Task.status` represents task Kanban state: `backlog`, `in_progress`, `review`, `done`.
- `TimeLog` has `task_id`, `project_id`, `hours`, `logged_date`, `source`, `external_id`, `notes`, and Phase 1b location support.
- Routers call service functions; DB access already lives in services, matching `docs/V1-TRD.md` boundaries.
- Frontend project filtering is currently single-project selection, while the UX target is sidebar tree filtering.

Phase 1.6 must be delivered with Alembic migrations, schema/API tests before production code, and no business logic in routers.

---

## 2. Entity Model

### 2.1 Core Phase 1.6 Entities

```text
VentureCategoryLabel 1 -> many Ventures
Venture 1 -> many Projects
Project 1 -> many Tasks
Task 1 -> many Time Logs
ActivityType 1 -> many Time Logs, nullable
```

Assets, gigs, and contracts are not separate tables. A project is classified through `projects.project_type`, with no Phase 1.6 behavioural difference between types.

Tasks do not receive `task_type` or labels in Phase 1.6.

### 2.2 Tables And Columns

#### `venture_category_labels`

```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
slug        TEXT NOT NULL UNIQUE
created_at  DATETIME NOT NULL
updated_at  DATETIME NOT NULL
```

Validation:

- `name` trimmed and non-blank.
- Presentation is Title Case in the UI.
- `slug` is generated from name and unique case-insensitively.
- Seed defaults: `Hustle`, `Business`, `Investment`, `Property`, `Education`, `Hobby`.
- Labels can be renamed.
- Labels can be hard-deleted only when no ventures reference them.

#### `ventures`

```sql
id                 TEXT PRIMARY KEY
name               TEXT NOT NULL
description        TEXT
colour             TEXT
category_label_id  TEXT NOT NULL REFERENCES venture_category_labels(id)
icon               TEXT
status             TEXT NOT NULL DEFAULT 'active'
created_at         DATETIME NOT NULL
updated_at         DATETIME NOT NULL
```

Validation:

- `name` trimmed and non-blank.
- `colour` must be one of the 12 approved swatches, not arbitrary `#RRGGBB`.
- `category_label_id` defaults to the seeded `Hustle` label.
- `status`: `active`, `archived`.

Archive rule:

- Archiving a venture sets the venture to `archived` and archives every child project.
- Child projects archived by this cascade get `archived_by_venture = true`.
- Unarchiving a venture restores only child projects with `archived_by_venture = true`; projects archived before the venture cascade remain archived.

#### `projects`

```sql
venture_id           TEXT NOT NULL REFERENCES ventures(id)
icon                 TEXT
project_type         TEXT NOT NULL DEFAULT 'project'
status               TEXT NOT NULL DEFAULT 'active'
board_status         TEXT NOT NULL DEFAULT 'active'
kanban_order         INTEGER
finished             BOOLEAN NOT NULL DEFAULT FALSE
archived_by_venture  BOOLEAN NOT NULL DEFAULT FALSE
```

`status` remains archive visibility (`active` / `archived`). `board_status` handles the Project Kanban lifecycle (`idea` / `active` / `paused` / `shipped`). `finished` records completion independently from both fields.

Validation and behaviour:

- `project_type`: `project`, `asset`, `gig`, `contract`.
- `board_status`: `idea`, `active`, `paused`, `shipped`.
- `project_type` does not alter fields, task behaviour, or board behaviour in Phase 1.6.
- Setting `board_status = 'shipped'` defaults `finished = true`.
- When archiving directly, the user can set `finished`; if omitted, default to `board_status == 'shipped'`.
- Archived and finished projects count as completed history for future earnings/activity views.
- Archived and unfinished projects remain visible only in archive/history views as unfinished.
- Directly unarchiving a project clears `archived_by_venture = false`.

#### `tasks`

No Phase 1.6 schema change for task type. Existing task fields and task Kanban statuses remain unchanged.

#### `activity_types`

```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
slug        TEXT NOT NULL UNIQUE
status      TEXT NOT NULL DEFAULT 'active'
sort_order  INTEGER
created_at  DATETIME NOT NULL
updated_at  DATETIME NOT NULL
```

Validation and lifecycle:

- `name` trimmed, non-blank, max 25 characters.
- `slug` generated from name and unique case-insensitively.
- `status`: `active`, `archived`.
- Seed defaults: `planning`, `meeting`, `admin`.
- User-created examples include `coding`, `researching`, `outreach`, and `writing`.
- Activity types are editable.
- Hard delete is allowed only when unused.
- Archiving an activity type is allowed even when used; service clears `time_logs.activity_type_id` for affected rows, preserving time logs.

#### `time_logs`

```sql
activity_type_id TEXT REFERENCES activity_types(id)
```

`activity_type_id` is nullable. A null activity type displays as `uncategorised` in API/UI. `uncategorised` is a synthetic display value, not a seeded row, so the user can still create an activity type named `uncategorised` only if product copy later allows it; Phase 1.6 should reserve that display string and reject it as an activity type name.

Time log `notes` remain optional. Existing `location` remains.

---

## 3. API Contract Sketch

### 3.1 Venture Category Labels

```text
GET    /api/v1/venture-category-labels
POST   /api/v1/venture-category-labels
PATCH  /api/v1/venture-category-labels/{label_id}
DELETE /api/v1/venture-category-labels/{label_id}
```

`DELETE` hard-deletes only unused labels; otherwise return a validation error.

### 3.2 Ventures

```text
GET    /api/v1/ventures?status=&category_label_id=
POST   /api/v1/ventures
GET    /api/v1/ventures/{venture_id}
PATCH  /api/v1/ventures/{venture_id}
DELETE /api/v1/ventures/{venture_id}
PATCH  /api/v1/ventures/{venture_id}/unarchive
```

`DELETE` archives only. `VentureRead` includes `category_label_id` and expanded label display data if the frontend needs sidebar rendering without a second lookup.

### 3.3 Projects

```text
GET    /api/v1/projects?status=&venture_id=&board_status=&project_type=&finished=
POST   /api/v1/projects
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}/unarchive
PATCH  /api/v1/projects/{project_id}/board-status
```

`ProjectCreate` requires `venture_id` after migration. `ProjectRead` includes `venture_id`, `project_type`, `icon`, `status`, `board_status`, `kanban_order`, `finished`, and `archived_by_venture`.

`PATCH /projects/{id}/board-status` persists Project Kanban drag changes and applies the `shipped -> finished` default.

`DELETE /projects/{id}` archives only and accepts an optional `finished` value in the request body or query payload depending on the repo's existing DELETE conventions. If no value is provided, service defaults to `board_status == 'shipped'`.

### 3.4 Tasks

```text
GET    /api/v1/tasks?project_id=&status=&priority=
POST   /api/v1/tasks
GET    /api/v1/tasks/{task_id}
PATCH  /api/v1/tasks/{task_id}
DELETE /api/v1/tasks/{task_id}
PATCH  /api/v1/tasks/{task_id}/status
```

No `task_type` parameter or task type field is added in Phase 1.6.

### 3.5 Time Logs And Activity Types

```text
GET    /api/v1/activity-types?status=
POST   /api/v1/activity-types
PATCH  /api/v1/activity-types/{activity_type_id}
DELETE /api/v1/activity-types/{activity_type_id}
PATCH  /api/v1/activity-types/{activity_type_id}/archive
```

```text
GET  /api/v1/tasks/{task_id}/time-logs
POST /api/v1/tasks/{task_id}/time-logs
```

`TimeLogCreate` accepts optional `activity_type_id`. `TimeLogRead` returns:

```text
activity_type_id
activity_type_name
activity_type_display_name
```

For null activity types, `activity_type_name` is null and `activity_type_display_name` is `uncategorised`.

---

## 4. Frontend Architecture Impact

### 4.1 API Types And Modules

Expected TypeScript additions:

- `Venture`, `VenturePayload`, `VentureStatus`.
- `VentureCategoryLabel`, `VentureCategoryLabelPayload`.
- `ProjectType`, `ProjectBoardStatus`, and project archive/completion fields.
- `ActivityType`, `ActivityTypePayload`.
- No `TaskType`.

Expected API modules:

- `api/ventureCategoryLabels.ts`
- `api/ventures.ts`
- existing `api/projects.ts` extended for venture/project board filters, completion fields, archive/unarchive, and board-status mutation.
- existing `api/tasks.ts` unchanged for task type.
- existing `api/timeLogs.ts` extended for nullable `activity_type_id`.
- `api/activityTypes.ts`

### 4.2 State And UI Structure

Phase 1.6 likely needs to move beyond the current single `selectedProjectId` store. Recommended UI state:

- selected board mode: `tasks` or `projects`;
- expanded venture ids;
- selected project ids for filtering, default all active projects selected;
- project type filter for Project board;
- board options in localStorage;
- active dialogs for venture, venture label, project, task, and activity type creation.

This can stay local/Zustand UI state. Server-persisted preferences remain out of scope.

### 4.3 UX Components

The Planner should expect components around these boundaries after or during the Phase 1b extraction:

- `AppShell` with sidebar and top nav.
- `VentureTreeSidebar`.
- `VentureDialog`.
- `VentureCategoryLabelManager` or a label combobox inside `VentureDialog`.
- `ProjectsPage`.
- `TaskKanbanBoard`.
- `ProjectKanbanBoard`.
- `ProjectDialog`.
- `TaskDialog`.
- `ActivityTypeCombobox`.

---

## 5. Service-Layer Rules

- Routers validate request/response shapes, call services, and return data.
- Venture category label validation and delete checks live in a service.
- Venture archive/unarchive cascade rules live in `services/ventures.py`.
- Project archive, unarchive, `finished`, and board-status drag logic live in `services/projects.py`.
- Activity type creation/edit/archive/delete rules live in `services/activity_types.py`.
- Time log creation continues to recompute `Task.actual_hours` in the task/time log service.
- No task-type validation is added.

---

## 6. Migration Notes

### 6.1 Venture Category Labels

Seed:

- `Hustle`
- `Business`
- `Investment`
- `Property`
- `Education`
- `Hobby`

Use a deterministic slug for each label. The default label for created and migrated ventures is `Hustle`.

### 6.2 Ventures And Projects

The migration must preserve existing data:

1. Create seeded venture category labels.
2. Create one default active venture named `Unsorted` with category label `Hustle`.
3. Add nullable `venture_id` to `projects`.
4. Backfill all existing projects to the `Unsorted` venture.
5. Enforce non-null `venture_id` after backfill if SQLite/Alembic constraints allow it safely; otherwise enforce at service/schema level until a later table rebuild.
6. Add `project_type`, `icon`, `board_status`, `kanban_order`, `finished`, and `archived_by_venture`.
7. Existing project `status` values remain archive status.
8. Existing archived projects get `finished = false` unless `board_status` can be deterministically mapped to `shipped`.
9. Existing task/project relationships and task Kanban ordering remain unchanged.
10. If any pre-existing branch data contains `is_asset = true`, map it to `project_type = 'asset'` and do not keep the boolean.

`Unsorted` is a migration-only default name because every project must belong to a non-null venture. The user can rename it in the UI.

### 6.3 Activity Types And Time Logs

1. Create `activity_types`.
2. Seed `planning`, `meeting`, and `admin`.
3. Add nullable `time_logs.activity_type_id`.
4. Leave existing time logs with `activity_type_id = NULL`; API/UI display them as `uncategorised`.
5. Keep existing time log `notes` and `location` unchanged.

### 6.4 SQLite Caution

SQLite has limited `ALTER TABLE` support. If Alembic autogenerate cannot safely enforce a new non-null FK after backfill, use a batch/table-rebuild migration or keep service-level enforcement until a follow-up migration.

---

## 7. Testing Expectations

Planner should require failing tests before implementation:

- Venture category label seed/list/create/rename/delete service and API tests.
- Venture create/list/update/archive/unarchive service and API tests, including project cascade restoration with `archived_by_venture`.
- Project create requires venture after migration.
- Project list filters by venture, archive status, board status, project type, and finished where supported.
- Project board-status mutation persists status and order; moving to `shipped` defaults `finished = true`.
- Project archive accepts or derives `finished`.
- Existing projects are assigned to the `Unsorted` venture by migration.
- Activity type create/list/edit/archive/delete tests, including case-insensitive uniqueness and 25-character max validation.
- Time log creation accepts nullable `activity_type_id` and still recomputes `actual_hours`.
- Existing time logs display `uncategorised`.
- Archiving an activity type clears affected time log FKs and preserves logs.
- Frontend tests for sidebar venture tree, venture label selection/creation, board toggle, Project Kanban drag calls, project type filter, and time log activity combobox creation.
- Regression tests confirming no task `type` UI/API/schema is added.

Quality gates remain those in `AGENTS.md`.

---

## 8. Boundary Review

The proposed design preserves `docs/V1-TRD.md` layer boundaries:

- schema changes use Alembic;
- database access and business rules remain in services;
- routers remain thin;
- frontend API access stays in API modules/hooks;
- board/UI state stays in frontend stores/local component state unless later moved to server preferences.

No ADR is required. The final design uses normal relational tables and service-layer lifecycle rules within the existing SQLModel/Alembic/FastAPI architecture.
