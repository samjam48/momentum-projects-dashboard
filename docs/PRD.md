# Momentum — Product Requirements Document (PRD)
**Version:** 1.1 — May 2026 | **Owner:** Sam | **Status:** Approved

---

## 1. Vision

Momentum is a self-hosted personal operations dashboard for a multi-project independent creator and developer. It provides a single interface to track income across flexible revenue streams, manage cross-project tasks via Kanban, monitor progress against goals at every time horizon, and visualise accountability through animated, interactive charts.

**The core problem it solves:** too many active projects with no unified view of what's making money, what's progressing, and where time is being spent — leading to low accountability and unclear prioritisation.

---

## 2. Users & Context

- **Primary user:** Single person, primarily on laptop, eventually on mobile
- **Access model:** Private by default; optional read-only shareable link (v1.1) for an accountability partner
- **Hosting:** Local Docker (v1), upgradeable to Railway/Render for mobile access (v2)
- **Open source intent:** Code open-sourced; personal data never included

---

## 3. Feature Areas

### 3.1 Projects
Projects are the top-level organisational unit. Everything — tasks, income streams, goals, time logs — belongs to a project.

**User can:**
- Create a project with a name, description, and colour tag
- Archive a project (soft delete; data retained)
- View a per-project summary: income MTD, tasks this week, active goal progress

**Examples:** Podcast, Trading Bot, Dev Skills, Flat, Newsletter, Book

---

### 3.2 Income & Revenue Tracking

Income streams are user-defined and flexible. There is no hardcoded list of stream types — Sam can add a podcast stream today and a Patreon or book royalties stream next month.

**Income stream properties:**
- Name (e.g. "Podcast Sponsorships", "Flat Rental", "Affiliate")
- Type tag (recurring / one-off / consulting / rental / affiliate / other)
- Linked project (optional)
- Status: active / inactive / projected
- Currency (default GBP; other currencies stored at entry level with GBP conversion)

**Income entry (manual):**
- Amount + currency
- Period: year + month
- Flag: actual or projected
- Optional notes

**What the user sees:**
- Income per stream per month — actual vs. projected
- MTD, QTD, YTD rollups in a KPI strip
- Stacked area/bar chart: income by stream over time (interactive, animated)
- Per-project income summary

**Auto-calculation rule:** Numeric goals of type `income` auto-pull their `actual_value` from summed income entries for the linked project/stream in the goal's period. No manual update needed.

---

### 3.3 Task Management & Kanban

Tasks are the unit of work. They live inside projects but can be viewed across all projects simultaneously.

**Task fields:**
- Title, description
- Project (required)
- Status: Backlog → In Progress → Review → Done
- Priority: Low / Medium / High / Urgent
- Target completion date
- Actual completion date (auto-set when moved to Done)
- Estimated hours
- Actual hours (summed from time logs)

**Views:**
- **Kanban board:** drag-and-drop columns; filterable by project or show all
- **Summary table:** all tasks across all projects, sortable by date/priority/project
- **Task detail modal:** full edit, time log list, notes

**Time tracking (v1):** manual time log entry per task (date + hours + notes).
**Time tracking (v2):** Toggl Track sync — see Section 7.

---

### 3.4 Goals & Streaks

Goals are flexible and user-defined. The user sets the cadence and the pass/fail criteria themselves.

**Goal types:**
- **Numeric** — e.g. "Earn £500/month from podcast" → actual_value auto-calculated from income entries
- **Completion** — e.g. "Ship 4 podcast episodes this month" → user manually updates count, or links to task completions
- **Habit** — e.g. "Meditate 10 mins/day", "Read 1 book/month", "Complete 1 certificate/week" → user sets cadence (daily/weekly/monthly) and a pass test (binary yes/no or a count threshold)

**Goal cadences:** daily, weekly, monthly, quarterly, annual

**Goal period:** auto-generated each period; user can edit target or skip a period.

**What the user sees:**
- Progress ring per active goal (current period)
- Weekly, monthly, quarterly, annual tabs showing targets vs. actuals
- Running totals in dashboard KPI strip
- Streak view: consecutive periods a habit goal was passed — e.g., "7-week streak on meditation"
- Streak is defined per goal: a "pass" means meeting the goal's own pass criteria for that period

**Auto-calculation rules:**
- `income` type numeric goals → actual_value = SUM of linked income entries in period
- `task_completion` type → actual_value = COUNT of Done tasks in linked project in period
- `habit` type → pass/fail per period = user-logged boolean or count vs. threshold

---

### 3.5 Dashboard

The home screen. One page, no sub-navigation required. Fast single round-trip API call.

**KPI strip (top):** Total income MTD | Tasks completed this week | Active projects | Goals on track this month

**Charts (animated on load, interactive on hover/click):**
- Income over time: stacked area by stream; click stream to isolate
- Task velocity: bar chart, tasks completed per week, coloured by project
- Goal progress: horizontal progress bars or rings, grouped by cadence tab

**Streak tracker:** Visual streak dots per habit goal (like a GitHub contribution graph)

**Recent activity feed:** last 10 actions (task moved to Done, income entry added, goal period closed)

---

### 3.6 Monthly Report View

A generated summary for any selected month:
- Total income (actual vs. projected), broken down by stream
- Tasks completed vs. created
- Goals hit vs. missed
- Hours logged
- Top project by income; top project by tasks completed

Auto-generated from DB data — no manual entry required.

---

### 3.7 Read-Only Shareable View (v1.1 — not Phase 1)

- Token-gated URL (e.g. `/share/{token}`)
- Dashboard view only — no edit capability
- Toggle per section: show/hide income, show/hide specific projects

---

## 4. Design & UX

### 4.1 Aesthetic
Warm parchment background, terracotta orange accent, `Instrument Serif` for big data numbers, `General Sans` for all UI. Clean, paper-feel cards. Bold animated charts. Inspired by the population bar chart reference (confident data visualisation) and the Vibe Skills reference (clean layout rhythm, warm off-white surfaces).

### 4.2 Motion
- Chart bars/lines animate in on mount (staggered ease-out)
- KPI number count-up on dashboard load
- Progress ring stroke animation
- Streak dot pop-in on load
- Kanban card drag: spring physics (scale + shadow)
- All charts respond to user interaction (hover tooltips, click-to-filter)
- `prefers-reduced-motion` respected throughout

### 4.3 Responsive
- Designed desktop-first (1280px+), fully responsive to 375px
- Sidebar collapses to bottom tab bar on mobile
- Charts reflow to full width on mobile
- Touch-friendly: 44px minimum tap targets

### 4.4 Light/Dark Mode
Full dark mode from day one, with manual toggle + system preference detection.

---

## 5. Out of Scope (v1)

- Multi-user / team features
- AI or agent features (planned for v3+)
- Toggl sync (v2)
- Shareable link (v1.1)
- Push notifications
- Email reports
- Mobile native app

---

## 6. Success Criteria

- User can open the dashboard and see all active project statuses, MTD income, and current goal progress in under 3 seconds
- User can add a new income entry in under 30 seconds
- User can move a Kanban task between columns with drag-and-drop
- User can add a new income stream or project without touching the code
- Monthly report is auto-generated with no manual input

---

## 7. Toggl Integration (v2 — future)

Toggl Track has a public API (v9) available on all plans including free. [Free tier limit: 30 requests/hour as of June 2025.] For a single-user personal tool with periodic syncs (not real-time), this is sufficient.

**Planned v2 sync behaviour:**
- Background job (APScheduler or Celery Beat) polls Toggl API every 30–60 minutes
- Time entries pulled by project tag and mapped to Momentum tasks/projects
- Stored as `time_logs` with `source = 'toggl'`
- No write-back to Toggl from Momentum in v2

**Toggl API endpoint:** `https://api.track.toggl.com/api/v9/`
Authentication: Basic auth with API token (no OAuth required for personal use).

---

## 8. Future: MCP & Agent Integration (v3+)

Momentum's RESTful API is designed from day one to be MCP-compatible. Future agentic workflows (Claude, Hermes, OpenClaw) will be able to:
- Read task lists by project or status
- Update task status
- Create new tasks from natural language
- Query income and goal progress
- Surface "what should I work on today?" from goal pressure + task backlog

This requires an MCP server wrapper on top of the existing FastAPI routes — no schema changes needed.

---

*Living document. Update as decisions are made. Version history in Git.*
