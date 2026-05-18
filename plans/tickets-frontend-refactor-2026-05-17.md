# Frontend Refactor Tickets

## Scope Notes

- This ticket set implements the approved refactor in `docs/frontend-refactor-prd-trd.md` and is grounded in the issues documented in `docs/code-review-16-05.md`.
- The refactor preserves the current single-page workspace, existing board and dialog behaviour, archive and restore flows, and the current backend contract unless a ticket explicitly calls out a targeted contract refinement.
- React Query migration is out of scope for this refactor. Keep `frontend/src/api/*` hooks and manual `reload()` patterns unless the owner approves a separate data-layer epic.
- Styling scope is limited to the approved primitive and consistency work: `components/ui/*` may use Tailwind plus CSS variables, while kanban, archive, layout, and feature surfaces stay on existing semantic classes in `frontend/src/styles/base.css` unless a ticket explicitly migrates them.
- `TaskDialog` is partially in scope for controller extraction, shared primitive adoption, and local integration cleanup, but the deeper UI split approved as follow-up epic D in `docs/frontend-refactor-prd-trd.md` is not part of this ticket set.
- No schema or Alembic work is planned in this refactor. Reuse existing frontend domain types from `frontend/src/api/types.ts`.

## Planning Decisions Applied

- `component-boundary-decision`:
  - Shared components are justified for `Button`, `IconButton`, `Select`, `FormField`, `DialogFormFooter`, `ConfirmDialog`, `EmptyState`, `LoadingState`, `ErrorBanner`, `KanbanBoard`, `KanbanColumn`, `KanbanCardShell`, and `ArchiveList`.
  - Feature-specific code should stay page-local or feature-local for task/project controllers, workspace bootstrap and filter sync hooks, dialog controllers, and board view adapters.
- `frontend-state-decision`:
  - Keep Zustand stores (`projectFilter`, `boardDisplayOptions`) as the only shared client state in scope.
  - Keep optimistic kanban state local to feature controllers, not in a new shared store.
  - Keep dialog form state local to each dialog or dialog controller.
- `frontend-data-flow-check`:
  - Keep fetching and mutation ownership in `frontend/src/api/*`.
  - Move reusable domain shaping into feature utilities or controller hooks, not leaf components.
  - Do not duplicate server state in component state except for bounded optimistic interaction state.
- `test-strategy-decision`:
  - Start risky extractions with characterization or regression tests.
  - Use pure unit tests for extracted helpers such as sort and kanban DnD utilities.
  - Keep `renderApp()` integration tests and the `kanban:drop` / `project-kanban:drop` test hooks as the primary safety net for orchestration changes.
  - Reserve manual QA for drag ergonomics, nested dialog focus, and archive restore edge cases that are expensive to prove fully in RTL.

## Assumptions

- The approved UX additions in `docs/frontend-refactor-prd-trd.md` are in scope for this refactor, including the Archived tasks tab and the Venture category `CreatableCombobox`.
- Archived-task restore is explicitly defined to move a task from `archived` back to `backlog` through the task status update path; targeted backend alignment work is in scope if tests show the current contract or service behaviour does not support that cleanly.
- Existing phase `1b` and `1.6` behaviour remains the baseline. Refactor tickets must preserve current user-visible behaviour unless a ticket explicitly calls out an approved UX change from the signed-off refactor doc.
- Test files may be renamed incrementally when touched, but the suite should not be bulk-renamed in a way that obscures behavioural coverage or creates unrelated churn.

## Ticket Ordering Rationale

1. **FR-1** locks characterization coverage before structural changes so refactors do not rely on visual spot checks alone.
2. **FR-2** extracts pure utilities first because they are low-risk and reduce `App.tsx` without changing state ownership.
3. **FR-3** establishes the shared UI primitives that later dialog and archive work depend on, and fixes the existing invalid `outline` button usage early.
4. **FR-4** introduces shared confirm and feedback primitives before archive and destructive-flow refactors consume them.
5. **FR-5** isolates the highest-risk duplicated logic, the kanban DnD and reorder math, behind pure tests before component wiring changes.
6. **FR-6** then extracts the shared kanban shell while keeping domain-specific card bodies intact.
7. **FR-7** moves task board orchestration into a feature-local controller after the shared kanban primitives exist.
8. **FR-8** repeats that extraction for projects, preserving the current shipped and queue semantics without parallel one-off logic in `App.tsx`.
9. **FR-9** extracts workspace bootstrap and filter sync after task and project controllers are already separated, allowing `App.tsx` to become a thin composer safely.
10. **FR-10** refactors archive flows and adds the Archived tasks tab after shared confirm, select, and archive list primitives are available.
11. **FR-11** splits `WorkspaceDialogs.tsx` and moves Venture label creation onto the shared combobox pattern after the primitive and archive patterns are stable.
12. **FR-12** finishes with cleanup, naming, CSS dedupe, documentation, and full validation once the structural work is complete.

---

## Ticket FR-1

### Title

Refactor Characterization Baseline

### Work Type

Test-only

### Reuse / Extend

- Components and harnesses: `frontend/src/test/renderApp.tsx`, `frontend/src/test/workspaceQueries.ts`, existing `App*.test.tsx`, `components/ArchiveDialog*.test.tsx`, `components/layout/*.test.tsx`
- Helpers and stores: existing `projectFilter` and `boardDisplayOptions` stores, existing custom DOM test hooks on the kanban board
- Endpoints and schema objects: reuse current frontend API modules and `frontend/src/api/types.ts`; no API or schema changes

### Acceptance Criteria

- Add failing or characterization frontend tests before production refactor code is written for the behaviours most likely to regress during structural extraction:
  - task kanban reorder through the `kanban:drop` test hook
  - project kanban reorder through the `project-kanban:drop` test hook
  - optimistic rollback on task or project board mutation failure
  - `workspaceReady` loading gate and initial workspace bootstrap
  - sidebar project selection plus toolbar filter sync
  - archive dialog reopen/reset behaviour and restore confirmation flow
- Prefer extending the nearest existing behaviour tests over inventing a new test style.
- Record the current large-file baseline in the ticket notes or PR description for at least `App.tsx`, `WorkspaceDialogs.tsx`, `TaskDialog.tsx`, and `ArchiveDialog.tsx`.
- Do not change production behaviour in this ticket except for minimal test harness fixes required to make the current behaviour testable.

### Edge Cases

- Characterization tests must not replace real drag or drop logic with shallow mocks that would stop catching orchestration regressions.
- Existing custom events on the board ref remain part of the test contract and must be preserved by later tickets.
- If a baseline test exposes an existing functional bug unrelated to the refactor goal, stop and record it instead of silently broadening this ticket.

---

## Ticket FR-2

### Title

Extract Pure Task and Workspace Utilities

### Work Type

Frontend

### Reuse / Extend

- Components and files: `frontend/src/App.tsx`, `frontend/src/components/TaskSummaryTable.tsx`
- Helpers: extend `frontend/src/lib/kanbanSort.ts`; add `features/tasks/taskTableSort.ts` and `features/projects/openTaskCounts.ts` or equivalent pure utility modules
- Endpoints and schema objects: reuse `frontend/src/api/types.ts`; no API or schema changes

### Acceptance Criteria

- Write failing unit tests before moving the pure logic.
- Extract task summary sort types and helpers from the current UI layer into a dedicated feature utility module:
  - `TaskSortKey`
  - `TaskSortState`
  - `compareTasks`
  - `sortTasks`
- Extract project open-task-count derivation from `App.tsx` into a pure helper owned by the projects feature.
- Keep these utilities free of React, browser APIs, and mutation side effects.
- Update current consumers to import the extracted helpers without changing runtime behaviour or UI copy.
- Reduce `App.tsx` responsibility by moving only pure logic in this ticket; optimistic state, bootstrap effects, and board handlers stay where they are for now.

### Edge Cases

- Sorting must preserve current null handling for due dates, completed dates, and optional fields.
- Stable or deterministic tie-breaking must remain unchanged so existing tests and UI ordering do not drift.
- Open-task counts must not accidentally include archived tasks or archived projects if current behaviour excludes them.

---

## Ticket FR-3

### Title

Shared UI Primitive Foundation

### Work Type

Frontend

### Reuse / Extend

- Components: extend `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/dialog.tsx`
- New shared primitives: `components/ui/Select.tsx`, `components/ui/FormField.tsx`, `components/ui/DialogFormFooter.tsx`
- Consumers to migrate in scope: `ArchiveDialog.tsx` invalid `outline` usage, one pilot entity dialog footer, and any touched filter/select controls
- Endpoints and schema objects: none

### Acceptance Criteria

- Add failing component or integration tests before production code for:
  - `Button` `outline` and `destructive` variants
  - `DialogFormFooter` layout using the approved Pattern A ordering
  - `Select` label and error wiring
  - `FormField` label, error, and accessibility contract
- Extend `Button` so `variant="outline"` and `variant="destructive"` are first-class typed variants rather than falling through to undefined styling.
- Add shared `Select`, `FormField`, and `DialogFormFooter` primitives under `components/ui/`.
- Pilot the new primitives in touched files so at least one existing invalid `outline` button usage is replaced and at least one dialog footer uses the shared Pattern A layout.
- Use CSS variables and existing semantic classes where appropriate; do not introduce a second visual language for feature surfaces.
- Do not convert every dialog or select in the repo in this ticket. Limit changes to the minimum coherent adoption required to prove the primitives.

### Edge Cases

- Icon-only button usage must keep explicit `aria-label` coverage.
- The new `Select` wrapper must support both visible labels and accessible `aria-label` use cases.
- `DialogFormFooter` must not force destructive actions into the save/cancel pair.

---

## Ticket FR-4

### Title

Shared Confirm and Feedback Primitives

### Work Type

Frontend

### Reuse / Extend

- New shared primitives: `components/ui/ConfirmDialog.tsx`, `components/feedback/EmptyState.tsx`, `components/feedback/LoadingState.tsx`, `components/feedback/ErrorBanner.tsx`, `features/archives/ArchiveList.tsx` or `components/archives/ArchiveList.tsx`
- Consumers in scope: `ArchiveDialog.tsx` restore confirm flow and empty or loading states
- Endpoints and schema objects: reuse current archive-related frontend API modules; no API or schema changes

### Acceptance Criteria

- Add failing tests before production code for:
  - confirm dialog open, cancel, confirm, and pending states
  - archive list empty-state rendering
  - loading and error feedback rendering in archive contexts
- Introduce a shared `ConfirmDialog` that replaces inline alertdialog markup in the archive restore flow.
- Introduce shared empty, loading, and error feedback components that keep copy product-like and consistent with `docs/patterns.md`.
- Introduce an `ArchiveList` abstraction for archived row rendering that can support venture, project, and later task rows without forcing domain-specific branching into the shared primitive.
- Refactor the existing venture and project archive restore confirmation flow to use the shared `ConfirmDialog`.
- Keep detail views and restore semantics unchanged in this ticket; this is a primitive extraction, not the Archived tasks feature yet.

### Edge Cases

- Pending confirm state must prevent duplicate restore submissions.
- Feedback primitives must not hide actionable error copy already present in the archive flow.
- `ArchiveList` must stay presentation-focused; restore side effects and contract decisions remain in the feature layer.

---

## Ticket FR-5

### Title

Generic Kanban DnD Utility Extraction

### Work Type

Frontend

### Reuse / Extend

- Current sources: task and project kanban DnD and reorder logic in `frontend/src/App.tsx`
- Helpers: extend `frontend/src/lib/kanbanSort.ts`; add `frontend/src/lib/kanbanDnd.ts` or an equivalent generic utility module
- Endpoints and schema objects: reuse current task and project mutation contracts through existing API hooks; no API or schema changes

### Acceptance Criteria

- Add failing unit tests before production code for the extracted DnD and reorder helpers, covering:
  - drop on a card
  - drop on an empty or column target
  - same-column reorders
  - cross-column moves
  - no-op drops
  - stable order comparison or change detection
- Extract duplicated task and project board math into a generic, typed utility module with configuration hooks for:
  - column key lookup
  - order lookup
  - item cloning or patching after a move
  - deterministic per-column ordering
- Migrate `App.tsx` to consume the new pure helpers without yet moving state ownership out of `App.tsx`.
- Preserve the existing board test-event contract and current mutation payload shapes.
- Keep task-specific side effects such as leaving `done` and project-specific side effects such as shipped or finished semantics outside the generic helper unless they can be configured cleanly.

### Edge Cases

- The generic helper must not erase domain-specific behaviour by over-generalising task and project moves into the same opaque type.
- Reorders must remain deterministic when `kanban_order` values are duplicated, missing, or null.
- No-op detection must not suppress real updates where order is unchanged but the column changed.

---

## Ticket FR-6

### Title

Shared Kanban Shell Components

### Work Type

Frontend

### Reuse / Extend

- Existing components: `frontend/src/components/TaskKanbanBoard.tsx`, `frontend/src/components/ProjectKanbanBoard.tsx`, `frontend/src/components/kanban/KanbanTaskCard.tsx`, `frontend/src/components/kanban/KanbanProjectCard.tsx`
- New shared components: `components/kanban/KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCardShell.tsx`
- Helpers and stores: reuse extracted `lib/kanbanDnd.ts`, `boardDisplayOptions` store, and existing board copy and CSS classes
- Endpoints and schema objects: none

### Acceptance Criteria

- Add failing component or integration tests before production code for the shared kanban shell through existing task and project board entry points.
- Extract the shared `DndContext`, sensors, board wrapper, column shell, and sortable card shell into reusable kanban components.
- Keep `KanbanTaskCard` and `KanbanProjectCard` as feature-specific adapters responsible for domain-specific body content and click actions.
- Preserve `boardRef` plumbing so the custom `kanban:drop` and `project-kanban:drop` events continue to work.
- Preserve current accessibility landmarks such as tablist usage, column `aria-label`s, and keyboard-safe title buttons.
- Do not move optimistic controller logic in this ticket; the goal is shared presentation and DnD shell reuse.

### Edge Cases

- Title click versus drag activation must keep current behaviour and remain safe on pointer and keyboard interaction.
- Empty columns and disabled drag states must preserve current empty-state copy and styling.
- Shared shell extraction must not force task and project cards into the same prop model if that would produce awkward optional branching.

---

## Ticket FR-7

### Title

Task Board Controller Extraction

### Work Type

Frontend

### Reuse / Extend

- Current sources: task board state and handlers in `frontend/src/App.tsx`
- Existing components and hooks: `TaskKanbanBoard.tsx`, `TaskSummaryTable.tsx`, `useTasks`, `useTaskMutations`, `projectFilter` store, `boardDisplayOptions` store, `test/workspaceQueries.ts`
- New feature-local modules: `features/tasks/useTaskKanbanController.ts`, optional `features/tasks/TaskBoardView.tsx`
- Endpoints and schema objects: reuse existing task list and task update contracts; no API or schema changes

### Acceptance Criteria

- Add failing integration tests before production code for task-board-specific orchestration:
  - optimistic reorder through the existing test hook
  - rollback and error display on mutation failure
  - reset of optimistic state when query data or filters change
  - preservation of board options and summary table behaviour
- Move task board optimistic state, mutation error state, drag handlers, and test-hook listener registration into a feature-local controller hook.
- Keep server data ownership in the current API hooks; the controller may derive display items but must not create a second durable source of truth for tasks.
- Keep task table sort and board view wiring adjacent to the tasks feature, either via a small feature view component or clearly separated controller return values.
- Reduce `App.tsx` by removing task-specific kanban orchestration from the root composer.

### Edge Cases

- Moving a task out of `done` must preserve current completed-date semantics.
- Filter changes and query reloads must clear stale optimistic state without flicker or duplicate resets.
- The controller must not break existing summary table sort state or row-open behaviour.

---

## Ticket FR-8

### Title

Project Board Controller Extraction

### Work Type

Frontend

### Reuse / Extend

- Current sources: project board state and handlers in `frontend/src/App.tsx`
- Existing components and hooks: `ProjectKanbanBoard.tsx`, project board mutation logic, `useProjects`, current project board queue behaviour, `features/projects/openTaskCounts.ts`
- New feature-local modules: `features/projects/useProjectKanbanController.ts`, optional `features/projects/ProjectBoardView.tsx`
- Endpoints and schema objects: reuse existing project board-status, archive, and list contracts; no API or schema changes

### Acceptance Criteria

- Add failing integration tests before production code for project-board-specific orchestration:
  - same-column and cross-column project moves
  - shipped transition preserving current `finished` semantics
  - mutation queue or lane serialisation behaviour
  - rollback and error display on board update failure
- Move project board optimistic state, mutation error state, queue handling, drag handlers, and test-hook listener registration into a feature-local controller hook.
- Keep type-filter behaviour and project open-task-count derivation intact.
- Reduce `App.tsx` by removing project-specific kanban orchestration from the root composer.
- Keep all board mutation payload shaping in one obvious controller path rather than partially in the board component and partially in `App.tsx`.

### Edge Cases

- Same-column reorder must not toggle `finished`.
- A failed queued update must not leave the next queued board action in an inconsistent state.
- Archived or locally archived projects must keep current board visibility and filter semantics.

---

## Ticket FR-9

### Title

Workspace Bootstrap, Filter Sync, and Thin App Composer

### Work Type

Frontend

### Reuse / Extend

- Current sources: workspace bootstrap, ready gate, board tab state, and filter sync effects in `frontend/src/App.tsx`
- Existing components and stores: `components/layout/AppShell.tsx`, `pages/ProjectsPage.tsx`, `projectFilter` store, `boardDisplayOptions` store, current toolbar and sidebar filter controls
- New feature-local modules: `features/workspace/useWorkspaceBootstrap.ts`, `useProjectFilterSync.ts`, `useBoardViewTab.ts`, optional `app/WorkspaceRoot.tsx`
- Endpoints and schema objects: reuse current project, task, venture, and activity-type frontend API modules; no API or schema changes

### Acceptance Criteria

- Add failing integration tests before production code for:
  - the loading gate before workspace bootstrap completes
  - cold-load project and task priming
  - toolbar and sidebar filter synchronisation
  - board tab and project type filter state persistence or behaviour
- Move workspace bootstrap effects, ready-state ownership, and filter-sync logic into feature-local or app-local hooks with clear ownership.
- Keep Zustand as the only shared client-state layer in scope; do not add a new context or store for data that can stay local.
- Reduce `App.tsx` to orchestration and composition only. Target under 400 lines after this ticket, with the final under-200 target completed no later than FR-11.
- Keep all existing route-free single-view composition intact; do not add `react-router`.

### Edge Cases

- Local-storage-backed filters or board settings with stale or invalid values must still fall back safely.
- Bootstrap extraction must not introduce duplicate reloads or loading flicker.
- Task and project controller resets must remain correctly ordered relative to workspace bootstrap completion.

---

## Ticket FR-10

### Title

Archive Dialog Refactor and Archived Tasks Tab

### Work Type

Full-stack

### Reuse / Extend

- Existing components and hooks: `ArchiveDialog.tsx`, archive-related tests, `ConfirmDialog`, `Select`, `ArchiveList`, current venture and project restore handlers
- Existing frontend APIs: task list and task update modules, venture and project archive modules
- Backend modules if alignment is needed: `backend/app/routers/tasks.py`, `backend/app/services/tasks.py`, task schemas and API docs
- Stores and helpers: existing project list data for task filter options, current parent-archive restore guard patterns
- Schema objects: none

### Acceptance Criteria

- Add failing integration tests before production code for:
  - existing venture and project tabs continuing to work after the refactor
  - the new Archived tasks tab
  - project filter behaviour inside the Archived tasks tab
  - restore confirmation for archived tasks
  - blocked restore when the parent project or parent venture is archived
  - stale archive list reset on dialog close and reopen
- Refactor the archive surface to consume the shared `ConfirmDialog`, `Select`, feedback components, and `ArchiveList`.
- Add a third tab, `Archived tasks`, using the current task list contract with archived status filtering and optional project filter.
- Add task restore flow through the current task update contract, restoring archived tasks specifically to `backlog` while reusing existing confirmation and error handling patterns.
- If the current backend task status or task update contract does not restore archived tasks to `backlog` cleanly, fix that contract in this ticket using thin-router and service-first conventions, with backend tests and `docs/api-map.md` updates in the same slice.
- Keep venture and project detail drill-in and restore semantics intact.

### Edge Cases

- A project filter that points to a project with zero archived tasks must show a clear empty state rather than a blank panel.
- Task restore must remain blocked or hidden when parent archive state would make the restored task immediately invalid.
- Reopening the archive dialog must not flash stale venture, project, or task rows before refetch settles.

---

## Ticket FR-11

### Title

Workspace Dialog Controller Split and Venture Label Combobox

### Work Type

Full-stack

### Reuse / Extend

- Current sources: `frontend/src/components/WorkspaceDialogs.tsx`, `ProjectDialog.tsx`, `TaskDialog.tsx`, `VentureDialog.tsx`
- Shared primitives to adopt: `Button`, `Select`, `FormField`, `DialogFormFooter`, `ConfirmDialog`, `CreatableCombobox`
- Existing frontend APIs: project, task, venture, venture-category-label, and activity-type modules
- Backend modules if contract refinement is needed: `backend/app/routers/venture_category_labels.py`, `backend/app/services/venture_category_labels.py`, `backend/app/routers/ventures.py`, related schemas and API docs
- New feature-local modules: `features/projects/useProjectDialog.ts`, `features/tasks/useTaskDialog.ts`, thin feature or workspace dialog host
- Schema objects: none

### Acceptance Criteria

- Add failing integration tests before production code for:
  - opening and closing project and task dialogs from their current entry points
  - save and cancel behaviour for the touched dialog flows
  - archive actions that currently depend on `WorkspaceDialogs.tsx`
  - Venture category label create-or-select behaviour in `VentureDialog`
- Split `WorkspaceDialogs.tsx` into feature-local dialog controller hooks or modules so the file becomes a thin composer rather than a mixed task and project controller.
- Keep `TaskDialog.tsx` as a single primary UI file in this epic unless a smaller extraction is required to complete the controller split cleanly. Shared primitive adoption, footer cleanup, and controller wiring changes are in scope; the deeper `TaskDialog` subcomponent refactor remains deferred.
- Replace the Venture dialog’s separate category select plus `Create label` flow with a shared `CreatableCombobox` pattern using the existing venture-category-label API hooks by default.
- If the existing venture-category-label or venture response contracts prove insufficient for a clean combobox flow, refine the backend API in this ticket following current router and service conventions, and update backend tests plus `docs/api-map.md` in the same slice.
- Move any project-archive-specific optimistic helper state, including `locallyArchivedProjectIds` if still needed, out of `App.tsx` and into the appropriate feature-local dialog or archive controller.
- Complete the thin-composer goal so `App.tsx` is at or under 200 lines and `WorkspaceDialogs.tsx` is at or under 200 lines unless a documented exception is approved.

### Edge Cases

- Nested dialog focus order must remain correct for task and time-log flows after controller movement.
- Cancelling dialog edits must not accidentally adopt optimistic archive or save state from another feature controller.
- The new Venture label combobox must reject duplicate label creation through the current API error path without losing the dialog’s local form state.

---

## Ticket FR-12

### Title

Frontend Refactor Cleanup, Naming, and Validation

### Work Type

Review-heavy

### Reuse / Extend

- Tests and docs: touched `frontend/src/**/*.test.*`, `docs/frontend-refactor-prd-trd.md`, optional `frontend/src/components/ui/README.md`
- Styles: `frontend/src/styles/base.css`, shared button and feedback classes
- Helpers and stores: reuse all extracted feature and UI modules from prior tickets
- Endpoints and schema objects: none

### Acceptance Criteria

- Rename touched tests from ticket-style names to behaviour-based names where doing so improves discoverability and does not create unrelated churn.
- Remove duplicate or now-unused button class definitions in touched scope, including duplicate `.danger-button` rules and any remaining ad-hoc button classes replaced by shared primitives.
- Document any intentional remaining large-file exception and the reason, especially if `TaskDialog.tsx` remains over the large-file target until the deferred follow-up epic.
- Add a short usage note for new shared primitives if implementation revealed conventions that are not obvious from code alone.
- Run the full validation set for the refactor branch:
  - `make lint`
  - `make test`
  - focused manual QA covering task board, project board, archive dialog, venture dialog, task dialog, nested time-log dialog focus, and board or filter persistence
- Confirm no new `any` types were introduced and no touched production file reintroduced duplicated DnD or ad-hoc button patterns.

### Edge Cases

- Naming cleanup must not break test discovery, snapshots, or helper imports.
- CSS dedupe must not remove rules still required by untouched legacy surfaces outside the refactor scope.
- If the full validation run exposes unrelated existing failures, stop and report them distinctly instead of hiding them inside cleanup.

---

## Resolved Decisions and Remaining Scope Guard

- Archived-task restore is not ambiguous in this plan: the restore action moves a task from `archived` to `backlog` through the task status update path. FR-10 includes any backend alignment needed to make that contract reliable.
- Venture label combobox adoption defaults to the current venture-category-label CRUD contract, but FR-11 explicitly allows a focused backend/API refinement when needed, using thin routers, service ownership, backend tests, and `docs/api-map.md` updates.
- `TaskDialog` is not completely untouched in this refactor. Controller extraction, shared primitive adoption, and local cleanup around existing flows are in scope. What remains deferred is the deeper UI decomposition into separately owned subcomponents described in `docs/frontend-refactor-prd-trd.md`.
- If the implementation team concludes that the full `TaskDialog` UI decomposition became necessary to complete the refactor safely, they must stop and get owner approval for scope expansion.

## Final Status

SIGNED OFF
