# Backlog

Future phases beyond the current sprint live here. Nothing in this file is in scope until pulled into `AGENTS.md`.

## Phase 0 — Scaffold ✅
- Basic folder/file structure created (don't make all individual empty files yet)
- Docker setup
- Installation - Python, TypeScript, React, Vite, SQLite, PyTest, viTest
- Agents creation

## Phase 1 — Projects + Tasks + Kanban ✅
- Projects CRUD
- Tasks CRUD with status, priority, and dates
- Kanban board with `dnd-kit` drag-and-drop
- Task modal
- Manual time log
- Project filter

## Phase 1.5 — UX / IA Foundation ✅
- Workshop decisions locked in `plans/phase-1.5-ux.md`
- Entity model: Venture → Project/Asset → Task (designed, not implemented)
- App shell IA, navigation, colour tokens, component standards
- Phase 1b ticket breakdown

## Phase 1b — Task Workspace UX Overhaul
- App shell + top nav (Projects default; Income/Goals stubs; Dashboard deferred)
- Extract monolithic `App.tsx` into layout + Projects page
- shadcn/ui primitives + `tokens.css` (terracotta palette)
- Project create/edit via Dialog; compact colour picker (no hex in UI)
- Sidebar: venture scaffold, multi-select project filter, archive link, + Hustle placement
- Task Kanban full width; summary table below; toolbar above board
- Linear-density task cards; card-level drag; board options in localStorage
- **Cleanup tickets (1b-4+):** owner UX polish in `plans/phase-1.5-ux.md` §11
- **Scope:** current Project → Task schema only (no venture migration)

## Phase 1.6 — Ventures, Project Types, Project Kanban, and Time Log Activity Types
- Architect planning signed off: `plans/PRD-phase-1.6-2026-05-15.md`, `plans/TRD-phase-1.6-2026-05-15.md` — ready for Planner
- Alembic migration: `venture_category_labels`, `ventures`, `activity_types`; `projects.venture_id`, `project_type`, project board status, `finished`, `archived_by_venture`; nullable `time_logs.activity_type_id`
- **`project_type`** enum on projects: `project` (default) \| `asset` \| `gig` \| `contract` — replaces boolean `is_asset`; selectable in UI; **no behavioural difference between types in 1.6** (same fields, Kanban, tasks)
- Project statuses: `idea` | `active` | `paused` | `shipped` + project Kanban board
- **No task `type` in 1.6**; owner deferred task labels/repeatable-task semantics
- User-defined time log activity types: seed `planning`, `meeting`, `admin`; max 25 chars; case-insensitive unique; editable; archivable; deletable when unused; null displays as `uncategorised`
- Venture CRUD + archive cascade; category labels are user-defined Title Case strings with defaults including `Hobby`
- Sidebar: expandable venture → project tree; venture edit modal
- Projects page toggle: Tasks board | Projects board; Project board shows all project types with type filter
- Data migration: existing projects → `Unsorted` venture with `Hustle` category label; `is_asset = true` → `project_type = asset`; existing time logs → null activity type displayed as `uncategorised`

## Phase 2 — Income Tracking
- **Architect pass required** before implementation: income streams linked to ventures and optionally to projects by **type** (project, asset, gig, contract); **payment cadence** (weekly, monthly, one-time) for recurring vs episodic revenue; how gigs/contracts differ from assets in rollup UX
- Income streams CRUD (venture-first; optional project link by `project_type`)
- Income entries with actual vs projected tracking
- Multi-currency support with GBP rollup
- Income summary API for MTD, QTD, and YTD (venture + project breakdown)
- Recharts stacked area chart (animated with Framer Motion)

## Phase 3 — Goals + Dashboard
- Goals CRUD with auto-calculation (venture and/or project scope)
- Goal periods and habit streaks
- Dashboard page (default landing after ship): monthly/weekly toggle on all widgets
- KPI strip, venture revenue chart, per-project status + next goal
- Progress rings, streak grid, task velocity chart, recent activity feed
- Project hub page (replaces edit-only modal)

## Phase 3.5 — Data visualisation and metrics pass
- Cross-app review of which metrics and charts to show (dashboard, project hub, income, goals)
- Chart type and layout decisions per surface; beautiful, intuitive presentation
- Refine or replace placeholder dashboard widgets from Phase 3
- Document chart catalogue in PRD/TRD

## Phase 4 — Reports + Polish
- Monthly report view
- Dark mode
- Mobile-responsive layout (sidebar → bottom nav)
- Skeleton loaders
- Empty states
- Number count-up animations
- Server-persisted user preferences (board options, dashboard order)

## Phase 5 — Cloud + Auth
- PostgreSQL swap via env var
- Deploy to Railway or Render
- JWT auth for multi-device access
- Read-only shareable token link

## Phase 6 — Toggl Integration
- APScheduler background sync from Toggl Track v9 API
- Time entries mapped to tasks and projects
- Deduplication on `external_id`

## Phase 7 — MCP + Agent Integration
- MCP server wrapper over existing FastAPI routes
- Agent access for reading tasks, updating status, and querying income and goal progress

## Future (unscoped)
- Settings page (hidden-delete purge, account preferences, Toggl mapping)
- Tremor chart components (evaluate vs Recharts in Phase 3)
- Kanban ↔ list-only toggle on Projects page
- True hard-delete with cascade (admin/settings only)

---

## Flagged

Items deferred from completed work or discovered during review. Not in the current sprint until pulled into `AGENTS.md`.

### Epic D — TaskDialog module decomposition

**Source:** Frontend refactor epic (owner Q4 in `docs/frontend-refactor-prd-trd.md`). `TaskDialog.tsx` remains ~930 lines; orchestration already lives in `features/tasks/useTaskDialog.tsx`.

**Summary:** Split the task create/edit UI out of the monolithic component into feature-local modules under `features/tasks/` (e.g. `TaskCreateForm`, `TaskEditForm`, `TaskTimeLogsPanel`, `TimeLogFormDialog`, thin composer). Co-locate behaviour tests. High regression surface: nested dialogs (task → time log → manage activity types), blur autosave vs cancel, time-log PATCH. **Defer if task-dialog UX is changing soon** — avoid over-investing in structure before design settles.

**Approach options (pick one when scheduled):**

| Option | Scope | Rough effort | Outcome |
|--------|--------|--------------|---------|
| **A. Minimal** | Move `TaskDialog.tsx` to `features/tasks/` only; no internal split | ~2–4 hours | Correct folder layout; file still large |
| **B. Medium** | Extract `TimeLogFormDialog` + `TaskTimeLogsPanel`; leave create/edit shell in main composer | ~1–2 days | Isolates the heaviest nested-dialog/time-log block |
| **C. Full epic D** | Full split per PRD (create/edit forms, time logs, nested dialogs, tests per module) | ~3–7 days | Matches signed-off target; best maintainability |

**Also noted (optional hygiene, not blocking):** `BoardOptionsMenu` nests a Radix `Checkbox` (`<button>`) inside a `menuitemcheckbox` `<button>` — valid HTML/a11y cleanup, ~half day if desired.
