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

## Phase 1.6 — Ventures, Project Types, and Project Kanban
- Alembic migration: `ventures` table; `projects.venture_id`, `project_type`, project status workflow
- **`project_type`** enum on projects: `project` (default) \| `asset` \| `gig` \| `contract` — replaces boolean `is_asset`; selectable in UI; **no behavioural difference between types in 1.6** (same fields, Kanban, tasks)
- Project statuses: `idea` | `active` | `paused` | `shipped` + project Kanban board
- Task `type` field with semantic colours (writing, research, code, meeting, admin)
- Venture CRUD + archive; income stream `venture_id`; goals `venture_id`
- Sidebar: expandable venture → project tree; venture edit modal
- Projects page toggle: Tasks board | Projects board
- Data migration: existing projects → default venture; `is_asset = true` → `project_type = asset`

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
