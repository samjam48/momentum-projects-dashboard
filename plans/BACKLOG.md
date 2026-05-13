# Backlog

Future phases beyond the current sprint live here. Nothing in this file is in scope for Phase 0.

## Phase 0 — Scaffold
- Basic folder/file structure created (don't make all individual empty files yet)
- Docker setup
- Installation - Python, TypeScript, React, Vite, SQLite, PyTest, viTest
- Agents creation

## Phase 1 — Projects + Tasks + Kanban
- Projects CRUD
- Tasks CRUD with status, priority, and dates
- Kanban board with `dnd-kit` drag-and-drop
- Task modal
- Manual time log
- Project filter

## Phase 2 — Income Tracking
- Income streams CRUD
- Income entries with actual vs projected tracking
- Multi-currency support with GBP rollup
- Income summary API for MTD, QTD, and YTD
- Stacked area chart animated with Framer Motion

## Phase 3 — Goals + Dashboard
- Goals CRUD with auto-calculation
- Goal periods
- Habit streaks
- Dashboard page with KPI strip, progress rings, streak grid, task velocity chart, and recent activity feed

## Phase 4 — Reports + Polish
- Monthly report view
- Dark mode
- Mobile-responsive layout
- Skeleton loaders
- Empty states
- Number count-up animations

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
