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

## Unresolved Dependencies

- Owner approval on draft hex tokens is recorded in Phase 1.5; implementation uses those values unless revised.
- Phase 1.6 tickets (ventures, assets, project Kanban) are out of scope for this file.
