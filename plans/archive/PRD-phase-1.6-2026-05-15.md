# Phase 1.6 PRD - Ventures, Project Types, Project Kanban, and Time Log Activity Types

**Status:** Signed off - owner decisions resolved  
**Owner:** Sam  
**Date:** 2026-05-15  
**Related docs:** `docs/V1-PRD.md`, `docs/V1-TRD.md`, `plans/phase-1.5-ux.md`, `plans/BACKLOG.md`

---

## 1. Current Understanding

Phase 1 shipped the functional Project -> Task workflow. Phase 1b reshapes that workflow into the target shell: Projects page default, sidebar scaffold, full-width task Kanban, summary table below, modal-based edits, and board options on the current Project -> Task schema.

Phase 1.6 is the first domain migration toward the V1 target model:

```text
Venture -> Project -> Task -> Time Log
```

This phase introduces ventures as the top-level organising unit, extends projects so they belong to ventures and carry a `project_type`, adds a separate Project Kanban board, and upgrades manual time logs with reusable activity types. The Projects page keeps the Phase 1b shape, but the Tasks | Projects toggle becomes fully active.

Tasks do **not** get a `type`, label, or semantic colour field in Phase 1.6. The owner explicitly deferred task typing because future repeatable-task semantics may change the model. Only time logs receive `activity_type`.

---

## 2. User Outcomes

- The user can group all projects under named ventures such as a business, hustle, investment, property, education area, or hobby.
- The user can manage custom venture category labels, including renaming and deleting labels that are not in use.
- The user can classify projects as `project`, `asset`, `gig`, or `contract` without changing their Phase 1.6 behaviour.
- The user can manage project lifecycle on a dedicated Project Kanban board with Idea, Active, Paused, and Shipped columns.
- The user can tell whether an archived project was completed or left unfinished through the `finished` flag.
- The user can still manage tasks on the Task Kanban board and summary table, filtered by the sidebar venture/project tree.
- The user can classify time logs by reusable activity type, use optional notes for specifics, and see `uncategorised` when no activity type is assigned.
- Existing Phase 1 projects, tasks, and time logs remain accessible after migration through a deterministic default venture.

---

## 3. In Scope

- Venture CRUD and archive via API and UI.
- Venture fields: name, description, colour, category label, optional icon, archive status, timestamps.
- Venture category label management: user-defined strings, Title Case presentation, seed defaults including `Hustle`, `Business`, `Investment`, `Property`, `Education`, and `Hobby`.
- Sidebar venture tree: expandable venture rows, child project filters, `+ Hustle` create action, Archive link.
- Project schema/API extension: `venture_id`, `project_type`, optional `icon`, `board_status`, `kanban_order`, `finished`, and `archived_by_venture`.
- Project create/edit UX updated to require venture context and support project type selection.
- Project Kanban board on Projects page, separate from Task Kanban.
- Project board statuses: `idea`, `active`, `paused`, `shipped`.
- Project archive behaviour: archive state remains separate from board state; `finished` records whether archived work should count as completed history.
- Venture archive cascade: archiving a venture archives all child projects; unarchiving restores only projects archived by that venture cascade.
- Activity type model/API/UI for time logs.
- Activity type defaults: `planning`, `meeting`, `admin`; users may add values such as `coding`, `researching`, `outreach`, and `writing`.
- Time log list rows display activity type as the primary label, keep `location`, and keep notes optional.
- Data migration: create one default venture named `Unsorted`, category label `Hustle`, and assign existing projects to it; existing time logs display as `uncategorised`.
- Backend boundaries preserved: routers stay thin; validation and DB operations live in schemas/services/models/migrations.

---

## 4. Out Of Scope

- Task `type`, task labels, repeatable-task modelling, or semantic task colours.
- Filtering or grouping time logs by activity type in Phase 1.6.
- Income stream CRUD implementation, even though later income streams will be venture-first.
- Goals implementation, even though future goals can attach to ventures and/or projects.
- Dashboard widgets, reports, chart catalogues, project hub pages, and dark mode.
- Server-persisted board options or user settings.
- Toggl sync.
- Hard-delete/purge UI for projects, ventures, tasks, or time logs.
- Implementation tickets.

---

## 5. Core UX Flows

### 5.1 Venture Creation

The user clicks `+ Hustle` in the sidebar, opens a Dialog, enters name, description, colour, category label, and optional icon, then saves. The new venture appears in the sidebar expanded by default with no child projects. `Hustle` is the default category label, but the user can pick or create another label.

### 5.2 Venture Category Labels

Venture category labels are user-defined strings displayed in Title Case. Phase 1.6 seeds `Hustle`, `Business`, `Investment`, `Property`, `Education`, and `Hobby`. Users can rename labels and delete labels that are not used by any venture. Deleting a label in use is blocked until ventures are moved to another label.

### 5.3 Venture Editing And Archive

The user clicks the venture title in the sidebar to open an edit Dialog. Archive is a secondary/destructive action at the bottom. Archived ventures disappear from the default tree and are available through Archive.

Archiving a venture automatically archives all child projects. Projects that were live at the time of the venture archive are marked `archived_by_venture = true`. When the venture is unarchived, those projects are unarchived too. Projects that were already archived before the venture archive stay archived.

### 5.4 Project Creation Within Venture

Projects are created in a venture context, not from a root-level project action. The create Project Dialog includes venture, name, description, colour, optional icon, project type, and initial board status. If launched from a venture row, the venture is preselected.

The Project board shows all project types together, with a filter for `project`, `asset`, `gig`, and `contract`.

### 5.5 Project Board And Archive Completion

The Projects page toolbar has a Tasks | Projects toggle. The Project board shows only project cards grouped by Idea, Active, Paused, and Shipped. Dragging a project persists status and order. It does not mix tasks and projects in the same board.

When a project reaches the Shipped column, it defaults to `finished = true`. The user can also mark a project as finished while archiving it. Archived projects with `finished = true` count as completed history for future earnings/activity views; archived projects with `finished = false` are treated as unfinished.

### 5.6 Activity Types For Time Logs

The time log row uses `activity_type` as the primary row label instead of a title. Notes remain optional and carry specific detail. `location` remains available on the time log.

The add/edit time log form uses a searchable combobox: typing filters existing activity types, and when no match exists the dropdown shows a single `Create activity` option. Creating an activity type from the combobox adds it to the reusable list.

The time log list remains date ordered in Phase 1.6. There is no grouping or filtering by activity type.

---

## 6. Acceptance Shape For Planner

Planner can proceed with Phase 1.6 tickets. The plan is owner-approved with these boundary rules:

- No task `type` is introduced in Phase 1.6.
- Activity types are part of Phase 1.6 and apply only to time logs.
- Existing time logs migrate to no assigned activity type and display as `uncategorised`.
- Project archive state, Project Kanban state, and completion state are separate fields.
- The migration creates one default venture named `Unsorted` with category label `Hustle`; the user may rename it in the UI.

No ADR is required for the final design because it is a normal schema/domain extension under the existing SQLModel/Alembic/FastAPI architecture.

---

## 7. Resolved Owner Decisions

1. Time log activity types are part of Phase 1.6.
2. Tasks do not receive `type` or labels in Phase 1.6; only time logs have `activity_type`.
3. Activity type defaults are `planning`, `meeting`, and `admin`.
4. Activity type names are globally unique case-insensitively and max 25 characters.
5. Activity types are editable, archivable, and hard-deletable only when unused.
6. Archived activity types clear or leave nullable FK references; UI displays `uncategorised` for time logs without an activity type.
7. Existing time logs migrate to `uncategorised` display.
8. Time log notes remain optional.
9. Time log `location` remains.
10. Activity type selection uses a searchable combobox with inline `Create activity` when no match exists.
11. Time logs stay date ordered; no activity grouping/filtering in Phase 1.6.
12. Project completion uses a boolean `finished`; Shipped defaults to finished.
13. Venture archive cascades to projects and uses `archived_by_venture` to restore only projects archived by that cascade.
14. Existing orphan projects attach to a migration-created `Unsorted` venture with category label `Hustle`.
15. The Project board shows all project types together and supports a type filter.
16. Venture category labels are user-defined Title Case strings; defaults include `Hobby`.

---

## 8. Risks And Dependencies

- This phase requires database migrations and API contract changes, so it must follow the project's tests-before-code rule and cannot be treated as a pure UI pass.
- `projects.status` currently means active/archive. Phase 1.6 must keep that archive visibility separate from `board_status` and `finished`.
- Venture archive/unarchive must preserve whether each child project was already archived before the cascade.
- SQLite migrations may need table rebuilds to enforce non-null `venture_id` and new constraints after backfill.
- Sidebar filters currently support a single selected project. Phase 1.6 target UX uses venture/project tree filtering and likely multi-select behaviour.
- Existing time logs need a nullable `activity_type_id`; the UI must consistently render `uncategorised` for null or archived-cleared rows.
