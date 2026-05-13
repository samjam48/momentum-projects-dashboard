# To Do List
**Agents do not need to read this file.** It is for the owner's reference only.
**Phase 1 — Projects + Tasks + Kanban**
Projects CRUD, tasks CRUD with status/priority/dates, Kanban board with dnd-kit drag-and-drop, task modal, manual time log, project filter.
**Phase 2 — Income Tracking**
Income streams CRUD, income entries (manual, actual vs projected, multi-currency with GBP rollup), income summary API (MTD/QTD/YTD), stacked area chart animated with Framer Motion.
**Phase 3 — Goals + Dashboard**
Goals CRUD with auto-calculation (income type → from entries, task_completion type → from done tasks), goal periods, habit streaks, dashboard page (KPI strip, progress rings, streak grid, task velocity chart, recent activity feed).
**Phase 4 — Reports + Polish**
Monthly report view, dark mode, mobile-responsive layout (sidebar → bottom nav), skeleton loaders, empty states, number count-up animations.
**Phase 5 — Cloud + Auth**
PostgreSQL swap (env var only), deploy to Railway/Render, JWT auth for multi-device, read-only shareable token link.
**Phase 6 — Toggl Integration**
APScheduler background sync from Toggl Track v9 API, time entries mapped to tasks/projects, dedup on external_id.
**Phase 7 — MCP + Agent Integration**
MCP server wrapper over existing FastAPI routes, enabling Claude/Hermes to read tasks, update status, query income and goal progress.