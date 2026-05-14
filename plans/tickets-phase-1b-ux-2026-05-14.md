# Phase 1b Tickets — UX / IA Foundation

## Scope Notes

- Phase 1b refactors the Phase 1 frontend onto the layout and design system locked in `plans/phase-1.5-ux.md`.
- Backend schema and API remain unchanged. Venture/asset hierarchy, project Kanban, and sidebar venture tree ship in Phase 1.6.
- shadcn/ui is added as copy-paste primitives under `frontend/src/components/ui/`, not as an npm meta-package.
- Design tokens use the approved terracotta palette from Phase 1.5 §5.

## Assumptions

- Phase 1 functional behaviour (project CRUD, task CRUD, Kanban drag-and-drop, task modal, manual time logs, project filter) must keep working through the refactor; tickets may relocate UI but must not regress API integration.
- `Projects` remains the default landing route until Phase 3 Dashboard ships.
- Board display options and sidebar multi-select filter persistence are browser `localStorage` until a settings API exists.
- Income, Goals, and Dashboard nav items may render as disabled stubs or be hidden per wireframe; Dashboard is not navigable in 1b.

## Ticket Ordering Rationale

1. **1b-1** establishes shell and page skeleton so later tickets have stable mount points.
2. **1b-2** moves create/edit flows into Dialog modals and wires sidebar filtering — depends on shell/sidebar from 1b-1.
3. **1b-3** refines Kanban card density and drag interaction — depends on Projects page layout from 1b-1 and modal patterns from 1b-2.
4. **1b-4** polishes Projects page shell, Kanban, summary table, and archive dialog (projects tab) — depends on 1b-1–1b-3 layout and interaction baseline.
5. **1b-5** refines task modal UX, time-log sub-modal, and archived-tasks archive tab — depends on 1b-2 modal patterns; archive task action may depend on API gap resolution in Unresolved Dependencies.
6. **1b-6** — final owner sign-off polish after 1b-4/1b-5; fixes regressions (checkboxes, Kanban spacing, modals), time-log E2E and delete, test hygiene, and deferred cleanup items — depends on 1b-1 through 1b-5.
7. **1b-7** — owner-reported follow-ups after 1b-6: production time-log failures on databases that pre-date applied Alembic revisions, and residual Kanban/checkbox styling conflicts with global CSS — depends on 1b-6 shipping as baseline; does not expand product scope beyond Phase 1b UX.

---

## Ticket 1b-1 — App Shell and Projects Page Layout

### Acceptance Criteria

- Add `frontend/src/styles/tokens.css` with CSS custom properties for the approved Phase 1.5 palette (`primary-bg`, `primary-surface`, `primary-text`, `accent-action`, `accent-action-hover`, `accent-highlight`, `accent-muted`, `accent-success`, `accent-warning`).
- Initialise shadcn/ui tooling: Tailwind CSS v4 wiring, `lib/utils.ts` (`cn` helper), and at minimum `Button` primitive under `components/ui/`.
- Extract layout from monolithic `App.tsx` into:
  - `components/layout/AppShell.tsx` — sidebar + main content grid
  - `components/layout/TopNav.tsx` — brand + nav items
  - `components/layout/Sidebar.tsx` — flat project list scaffold (venture tree deferred to 1.6), footer placeholder for archive link
  - `pages/ProjectsPage.tsx` — toolbar, Kanban, summary table
- Top navigation shows **Projects** as active; **Income** and **Goals** render disabled stubs; **Dashboard** is not shown or is visibly marked unavailable (Phase 3).
- Projects page toolbar includes: **Tasks | Projects** toggle (Projects board disabled or labelled Phase 1.6), **All projects** filter control, **+ New task** primary action, and a **Board options** control (may be non-functional stub until 1b-3).
- Task Kanban renders **full width** in the main column; task summary table renders **below** the board — not side-by-side.
- Remove the standalone **Workspace filter** panel and the two-column `workspace-panels-two-up` Kanban/table layout.
- `App.tsx` composes `AppShell` wrapping `ProjectsPage`; existing task/project data hooks and dialogs may remain in `App.tsx` or move incrementally, but all Phase 1 tests must pass after updates.
- Add or update frontend tests that assert the new shell landmarks (top nav, sidebar, vertical board/table stack) without regressing Phase 1 workflow tests.

### Edge Cases

- Loading state should use the new shell, not a bare full-page spinner outside layout.
- When no active projects exist, toolbar **+ New task** remains disabled with the existing empty-state guidance.
- Responsive behaviour: Kanban columns scroll horizontally on narrow viewports; table remains below board.
- Projects toggle to project board does not crash when clicked; shows placeholder or disabled state until 1.6.

---

## Ticket 1b-2 — Project and Task Modal UX

### Acceptance Criteria

- Remove permanent on-page project create/edit forms. All project create and edit flows use shadcn `Dialog`.
- Colour picker: label **Colour**; shows only the currently selected swatch; click opens all 12 palette options; no hex strings visible in UI.
- Active project list in sidebar: coloured title chip/dot, spacing between items, click project title opens edit dialog; **Archive project** action at bottom of dialog.
- Sidebar footer: **View archive** link (may navigate to stub list until archive view is fully built).
- Sidebar project filter: multi-select checkboxes, all projects selected by default, persisted in `localStorage`, scopes Kanban and summary table.
- Task create/edit continues to use Dialog with existing fields; wired to new layout toolbar and sidebar.
- **+ Hustle** button visible in sidebar as disabled stub labelled for Phase 1.6 (no venture creation yet).
- Project and task mutation flows invalidate queries and keep Kanban/table consistent without full-page reload.

### Edge Cases

- Archiving the only selected project resets filter to all projects.
- Dialog validation errors preserve form state.
- Opening edit dialog for archived project is not possible from active list.
- Multi-select with zero projects checked shows empty Kanban/table with clear empty state.
- Colour picker keyboard accessible; selected swatch has visible focus ring.

---

## Ticket 1b-3 — Task Kanban Interaction and Card Density

### Acceptance Criteria

- Remove per-card **Drag**, **Up/Down**, and column shortcut buttons; drag initiates from anywhere on the card surface (`@dnd-kit` listeners on card root).
- Card default layout (Linear density): small project colour dot, task title (click opens task modal), project name, default metric = target due date.
- Optional fields (priority badge, actual hours, status badge) controlled by **Board options** menu; preferences stored in `localStorage`.
- Failed status persistence rolls back optimistic board state and surfaces error message (preserve Phase 1 behaviour).
- Kanban columns use fixed flex row with horizontal scroll; column headers show title + count.
- Update tests to use card drag or programmatic `kanban:drop` event instead of button-based moves where applicable.

### Edge Cases

- Clicking task title opens modal without starting drag (activation constraint / pointer threshold).
- Cards in all-projects view show project name; single-project filter may hide redundant project line per board options.
- Board options defaults when `localStorage` empty: due date only, no priority badge.
- Drag disabled while mutations in flight.
- Empty columns show muted empty state copy.

---

## Ticket 1b-4 — Projects Page Polish (Shell, Kanban, Summary Table)

### Acceptance Criteria

- **View archive (projects):** Replace sidebar footer **View archive** stub with a shadcn `Dialog`. On open, fetch and list archived projects via `GET /api/v1/projects?status=archived`. Each row shows project name and colour dot; click opens read-only or edit dialog per existing project patterns (archived projects must not appear in the active sidebar list). Dialog includes a toggle or tabs for **Archived projects** | **Archived tasks**; **Archived tasks** tab may render a placeholder empty state until 1b-5 ships (do not block 1b-4 on task archive API).
- **Dual filter UX copy:** Toolbar **All projects** dropdown and sidebar multi-select checkboxes remain functionally unchanged. Align labels and empty-state copy so combined filters are understandable (e.g. empty Kanban when sidebar selection excludes all visible toolbar targets shows guidance referencing sidebar selection, not internal keys like “Shared filter target”).
- **Loading sidebar:** While `!workspaceReady`, sidebar must not render a misleading dead project form or interactive filter chrome; show skeleton, muted loading copy, or hide filter rows until data is ready.
- **TopNav Projects link:** **Projects** nav item must not use `<a href>` that triggers a full document navigation (no client router yet). Use a non-navigating control (`button` or `role="button"`) that preserves current-page behaviour and active styling.
- **Sidebar row layout:** Keep all projects checked by default. Per row: **project colour dot on the left**; project title (click opens edit dialog); **checkbox on the right**. Remove coloured title chip from the row. Checkbox styling: transparent or very low-opacity fill; **darker outline when checked**, lighter when unchecked (match board-options checkbox pattern).
- **Icon set:** Standardise interactive controls on the Projects page and shell to **Lucide** icons via shadcn-compatible imports (`lucide-react`). Remove emoji used as control icons in scope (gear, close, add, archive affordances, etc.).
- **App.tsx extraction:** Slim monolithic `App.tsx` by extracting Kanban board wiring, task summary table wiring, and dialog orchestration into dedicated components under `components/` or `pages/` (e.g. `TaskKanbanBoard`, `TaskSummaryTable`, workspace dialog host). `App.tsx` composes shell + page + query/mutation hooks; no regression to Phase 1 workflows.
- **Board options control:** Replace large **Board options** button with a **gear icon** at the **right of the Kanban section title bar**. Dropdown menu: smaller text; each option is a **left-aligned checkbox** (same visual pattern as sidebar project checkboxes), not bold labels. Remove **status** from optional card fields (status is implied by column). Preferences remain in `localStorage`.
- **Kanban columns:** Exactly **four vertical columns** in one horizontal row (Backlog, In Progress, Review, Done) — not a 2×2 grid. Narrow viewports: horizontal scroll. Column headers use the **same pill/badge style** as task status badges on cards.
- **Kanban cards (Linear polish):** **5px padding** on each card. **Project colour dot top-right**, aligned to title line height. **Project name hidden by default**; when enabled in board options, show as a **pill tinted to project colour** (not plain text under title). Title hover: **underline only** — remove background highlight on hover. Default metric due date formatted **`MMM DD`** (three-letter month + day, e.g. `May 14`, `Sep 09`, `Dec 23`). Card-surface drag remains; stabilise interaction (activation constraints, nested title button vs draggable root) so title click opens modal without spurious drags on mouse and touch.
- **Task summary table:** Section title **Task summary** uses the same bold typographic treatment as **Projects** in the page toolbar. Replace “Shared filter target: …” subtitle with human copy: **“Showing all projects”**, **“Showing N projects”**, or **“Showing {project name}”** when exactly one project is selected. Sort via **gear icon** to the right of the section title bar; dropdown labelled **Sort by** lists column sort options. Dropdown is the obvious sort entry point (header-click sort may remain but must not be the only discoverable control).
- Add or update frontend tests for archive dialog (projects list), sidebar loading state, TopNav non-navigation, filter subtitle copy, board-options gear placement, four-column layout, due-date format, table sort gear, and App extraction landmarks (imports/render without behaviour regression).

### Edge Cases

- Archive dialog with zero archived projects shows clear empty state.
- Archive dialog open while project list refetches does not flash active projects into archived list.
- Sidebar with zero active projects: no misleading checkboxes; empty state consistent with toolbar.
- Board options `localStorage` missing or corrupt: safe defaults (due date on, no project-name pill, no priority badge); status option ignored if present in stale storage.
- Kanban drag disabled while status mutation in flight (preserve 1b-3 rollback behaviour).
- Table sort gear and Kanban board options gear are independently operable and labelled for assistive tech.
- Full keyboard traversal of board options menu deferred post-stabilisation (§11.2); focus trap in archive dialog still required.
- Colour picker Enter/Space on swatches: optional polish when convenient; not a blocker for 1b-4.

---

## Ticket 1b-5 — Task Modal, Time Logs, and Archived Tasks

### Acceptance Criteria

- **Remove dev/meta copy:** All task dialogs drop implementation-note placeholder strings (e.g. “Create a task in the Phase 1 workspace”, “Backend-derived completion…”, “Manual entries refresh task totals…”). Copy describes user actions and data fields only.
- **New task modal:** Minimal chrome — no “Task detail” section header; no blank Actual hours / completed date block on create; no “Save the task before adding manual time logs.” Remove instructional subtitles (“New task”, “Edit task”).
- **Edit task modal — chrome:** **X icon** closes dialog (no footer **Close** button). No **Title** label — task name is an **editable heading** (`h3`-level); click/focus enables inline edit.
- **Edit task — save model:** Persist field changes on **blur** and on **dialog close** when dirty. Footer primary **Cancel** uses prior Save button styling and **discards unsaved edits**. Footer secondary **Archive** is a grey text link (no outline; padding consistent with former Cancel) — triggers task archive flow (see below). Remove standalone **Save** button.
- **Time logs section (edit modal):** Section title **Time logs** only. **Actual hours** and **completed date** displayed at the **top** of the section (read-only aggregates from task). Listed entries below. **+ Add time log** sits directly under the section title or list — **no** inline date/hours/notes form on the main modal.
- **Add time log sub-modal:** **+ Add time log** opens a nested `Dialog` with fields: **title**, **notes**, **location**, **date**, **time** (hours). Only **time** (hours) is required; title, notes, location, and date nullable/default sensibly. Footer **Save** / **Cancel**. On save, call existing `POST /api/v1/tasks/{id}/time-logs` with `hours`, `logged_date`, and `notes` (map title/location into `notes` per Unresolved Dependencies until schema supports separate columns). Invalidate task and time-log queries; refresh actual hours in parent modal.
- **Time log list item:** Compact row — **title bold** on primary line (derive display title from stored notes convention or notes first line if title not persisted separately). **Date** and **location** on secondary line in smaller, lighter text. **Click row** opens notes detail (expand in place or lightweight secondary dialog).
- **Archived tasks in archive modal:** Complete the **Archived tasks** tab from 1b-4 archive dialog. List archived tasks when API supports `GET /api/v1/tasks?status=archived` or equivalent soft-archive filter. Rows show task title and project name/dot; click opens read-only task detail or edit modal per product rules for archived items.
- **Task archive action:** **Archive** in edit modal soft-archives the task (removes from active Kanban and sidebar-scoped views) and surfaces it under **Archived tasks**. Prefer existing PATCH/status or dedicated archive endpoint without schema change if available; if no soft-archive exists, follow Unresolved Dependencies (do **not** use hard `DELETE` as user-facing archive without owner sign-off).
- Add or update frontend tests for stripped copy, inline title edit, blur/close save, Cancel discard, Archive affordance, time-log sub-modal validation (hours required), list row layout, and archived-tasks tab behaviour (or placeholder until API lands).

### Edge Cases

- Cancel with dirty inline title reverts to last saved title.
- Close dialog via X or overlay with dirty fields persists (blur/close save) unless Cancel was explicitly clicked.
- Archive while edits pending: define order (save then archive, or archive discards pending) and test; on failure show error without removing task from board.
- New task modal: time logs section hidden or disabled until task exists (no confusing add-time-log on unsaved create).
- Time log sub-modal: invalid or zero hours blocks save with field-level error; date defaults to today when omitted.
- Sub-modal open: parent task modal remains mounted; escape closes sub-modal first.
- Archived tasks tab empty state when API returns `[]`.
- Task on archived project: archive/list behaviour consistent with backend rules (409 on mutate if project archived).
- Clicking time log row with empty notes still opens detail without error.

---

## Ticket 1b-6 — Phase 1b Owner Sign-off Polish

### Acceptance Criteria

- **Test hygiene:** Frontend test suite runs without React `act(...)` warnings in output (`npm run test` clean aside from intentional assertions). Wrap async state updates, user events, and query resolution in `act` / `waitFor` / Testing Library patterns as needed.
- **Checkbox pattern (site-wide):** Sidebar project filter, board-options menu, and shared `Checkbox` primitive use a consistent style: **fully transparent/clear background when checked** (not filled brown/accent); **dark tick** via Lucide `Check` (not Unicode `✓`); **outline thicker and darker when selected** than unchecked. Apply wherever Phase 1b checkboxes appear in scope.
- **Kanban column-header pills:** Add or update a frontend test that asserts column-header elements use the expected pill/badge CSS classes (same styling contract as task status pills per 1b-4).
- **Kanban card spacing:** **5px external margin/gap between cards** within a column so cards do not touch. **Revert internal card padding** to pre-1b-4 spacing (uniform with other UI elements — owner meant outer gap, not 5px inner padding).
- **Kanban card due date:** Due-date text on cards uses the **same font size** as column-header pill text.
- **Modal close behaviour:** Backdrop/overlay click closes **task** and **project** modals the same way as X and Escape.
- **Modal close affordance:** Close control shows a visible **X** (Lucide `X` or literal text `X` acceptable) — not a dot or ambiguous icon.
- **Task modal title:** Task name renders at visibly **h3** scale in read mode. Inline edit input uses the **same padding/spacing** as other form fields (not width-hugging the text).
- **Time logs — E2E fix:** `GET /api/v1/tasks/{id}/time-logs` loads entries in the edit-task modal; `POST /api/v1/tasks/{id}/time-logs` creates entries and refreshes list plus parent **actual hours** / aggregates. Diagnose and fix whichever layer breaks (API client path, query keys, router, or service).
- **Time logs — delete:** User can **hard-delete** a time-log entry (not archive). If `DELETE /api/v1/tasks/{id}/time-logs/{log_id}` is missing, add backend service method, router endpoint, and pytest coverage; wire frontend delete affordance on list row or detail. Deleting updates task-derived hours and list without full-page reload.
- **Time logs — metric cards:** **Actual hours** and **completed date** restore **styled metric cards with colour** (pre-1b-5 treatment), not plain unstyled text.
- **Time logs — responsive layout:** On viewports with space, time-logs section and actual-hours/completed-date metrics sit in a **right column** beside task fields; on small viewports they **stack below** task details.
- **Board options menu:** Remove `font-weight: 500` (or equivalent) emphasis on selected/checked rows — checked state conveyed by checkbox only.
- **Pragmatic cleanup (pick one):** Either extract Kanban DnD orchestration out of `App.tsx` **or** deduplicate Kanban sort helpers between `App.tsx` and `TaskKanbanBoard.tsx` — one coherent cleanup, not both unless required for the chosen approach.
- **ArchiveDialog stale flash:** On close, clear or reset archived-list state so reopen does not briefly show stale rows before refetch.
- **`showStatusBadge` storage:** Stop writing `showStatusBadge` to `localStorage`; continue to ignore stale values safely on read.
- Add or update frontend and backend tests for the above without regressing Phase 1 workflows; all quality gates pass.

### Edge Cases

- Time-log delete on last entry zeroes or updates `actual_hours` per backend rules; parent modal reflects change immediately.
- Time-log GET/POST/DELETE failures show user-visible error; task modal remains usable.
- Backdrop click on **nested** time-log sub-modal closes sub-modal only (parent task modal stays open) — same stacking as Escape.
- Checkbox restyle applies when `localStorage` contains legacy board-options keys including ignored `showStatusBadge`.
- Kanban inter-card margin does not break drag activation, column scroll, or empty-column layout.
- Empty time-log list still shows metric cards when task has derived hours/completed date.
- Delete time-log blocked or errored when task is on archived project — consistent with existing mutate rules.
- ArchiveDialog reopen immediately after archiving a project/task does not flash pre-archive list.
- `act` cleanup does not mask real failures by silencing assertions.
- Modal backdrop close with dirty inline title triggers blur/close-save per 1b-5 before dismiss.

### Out of Scope (owner deferred)

- Archived-task rows lacking project label when parent project is archived.
- Empty-notes time-log row expand UX.
- `AppShell.test.tsx` occasional flake under full parallel suite.
- Sprint doc vs backend schema tension (already approved minimal migrations).

---

## Ticket 1b-7 — Owner-Reported Bugs (Stale DB Time Logs, Checkbox, Kanban Typography/Hover)

### Context

Real installs can keep an existing SQLite file while the codebase gains new columns via Alembic (e.g. `title` / `location` on `time_logs` from revision `20260514_0003`). CI and local tests often use fresh databases (`create_all` only), so mismatches go unnoticed until GET/POST `/api/v1/tasks/{id}/time-logs` hits a stale schema and returns **500**. Separately, global base styles (notably `button`) can override Radix/shadcn checkbox and Kanban title hover appearance despite ticket **1b-6** intent.

### Acceptance Criteria

- **Time logs / stale schema:** Ensure every normal application startup applies pending migrations so existing DB files reach current head (e.g. run Alembic **`upgrade head`** from app lifespan or equivalent single, documented hook). Add or complete **`alembic.ini`** and **`env.py`** if missing so CLI upgrades and runtime upgrades stay aligned with the same revision chain.
- **Time logs / regression test:** Add a **backend integration test** that reproduces the stale-database scenario: DB built or trimmed to omit columns introduced by `20260514_0003` (or equivalent “pre-migration” snapshot), then assert time-log endpoints fail before upgrade and succeed after **`upgrade head`** (or assert migration runs and endpoints return non-5xx for valid requests). Fresh-db behaviour remains covered; full suite and coverage gates still pass.
- **Checkbox:** Checked state uses a **fully transparent / clear** fill that matches the parent surface (Kanban card, dropdown menu row, sidebar row, etc.) — **no** dark brown or accent-filled indicator box. Unchecked/checked states remain distinguishable via border/tick (per **1b-6** tick/outline rules). Fix must account for **global `button` (or other)** rules that override Radix `Checkbox`/`button` parts.
- **Kanban due date:** Due-date text on task cards uses the **same font size as status/column pills**, specifically **`0.88rem`** (not larger).
- **Kanban title hover:** Task title control on cards: **hover = underline only** — **no** hover background (including brown/accent wash), **no** `transform` (scale/translate/nudge). Focus-visible styling remains accessible (focus ring or underline policy unchanged from product baseline unless required for contrast).

### Edge Cases

- **Migrations:** Startup upgrade is **idempotent** at head (repeated starts do not error). Behaviour when `alembic_version` is missing, wrong, or manually corrupted — fail loudly with clear logs or documented recovery (no silent partial schema).
- **Migrations:** Concurrent multi-worker startup — document single-instance expectation for SQLite + Alembic or guard so only one process runs upgrades if applicable.
- **Migrations:** User runs DB from read-only path — startup fails predictably with actionable message (no partial writes).
- **Time-log API:** After upgrade, existing rows without new nullable columns behave per ORM/SQL defaults; POST with only legacy fields still succeeds.
- **Checkbox:** Hover/focus/active states do not reintroduce opaque fills; **keyboard** focus visibility preserved; works inside menus, dialogs, and sidebar scroll regions.
- **Checkbox:** Nested interactive elements (e.g. row click vs checkbox click) do not double-toggle or lose transparent styling.
- **Due date:** Long or localized date strings do not blow layout (ellipsis or wrap per existing card constraints).
- **Title hover:** Touch / coarse pointers: no reliance on hover-only affordance for critical actions; drag activation still works; underline does not break title hit area for modal open.

---

## Unresolved Dependencies

- Owner approval on draft hex tokens is recorded in Phase 1.5; implementation uses those values unless revised.
- Phase 1.6 tickets (ventures, assets, project Kanban) are out of scope for this file.
- **Task soft-archive API gap:** Tasks currently expose Kanban statuses only (`backlog` | `in_progress` | `review` | `done`); `DELETE /api/v1/tasks/{id}` hard-deletes. There is no `GET /api/v1/tasks?status=archived`. **1b-5** archived-tasks tab and **Archive** action need owner decision: (a) minimal backend follow-up (e.g. `archived` status or `archived_at` + list filter) without broader schema churn, or (b) defer archived-tasks tab until API exists while shipping modal/time-log UX. Do not masquerade hard delete as archive.
- **Time log title and location fields:** `time_logs` table has `hours`, `logged_date`, `notes` only. Sub-modal **title** and **location** require either owner-approved Alembic addition to `time_logs` or an interim mapping into `notes` with a documented parse/display convention; prefer (a) if owner wants faithful §11.4 list rows without hacks.
- **Time log delete API:** `GET` and `POST` exist on `/api/v1/tasks/{id}/time-logs`; per-entry **hard delete** does not. **1b-6** adds `DELETE /api/v1/tasks/{id}/time-logs/{log_id}` (service + router + tests) without schema migration if still missing.
- **Board options and table sort keyboard polish** remain deferred per §11.2 until feature set stabilises.
