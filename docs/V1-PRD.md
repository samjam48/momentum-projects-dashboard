# Momentum — Product Requirements Document (PRD)
**Version:** 1.2 — May 2026 | **Owner:** Sam | **Status:** Approved (amended post Phase 1 UX workshop)

---

## 1. Vision

Momentum is a self-hosted personal operations dashboard for a multi-project independent creator and developer. It provides a single interface to track income across flexible revenue streams, manage work across ventures and projects via Kanban, monitor progress against goals at every time horizon, and visualise accountability through animated, interactive charts.

**The core problem it solves:** too many active ventures and projects with no unified view of what's making money, what's progressing, and where time is being spent — leading to low accountability and unclear prioritisation.

---

## 2. Users & Context

- **Primary user:** Single person, primarily on laptop, eventually on mobile
- **Access model:** Private by default; optional read-only shareable link (v1.1) for an accountability partner
- **Hosting:** Local Docker (v1), upgradeable to Railway/Render for mobile access (v2)
- **Open source intent:** Code open-sourced; personal data never included

---

## 3. Domain model

### 3.0 Hierarchy

```text
Venture  →  Project  →  Task
```

Projects share one table; **project type** distinguishes general work from income-related units (asset, gig, contract).

| Entity | Description |
| --- | --- |
| **Venture** | Top-level business line or life area (podcast business, trading bots, property, education). Code/table name: `venture`. UI label is user-selectable: hustle (default), business, investment, property, or education. |
| **Project** | Work container inside a venture. Default `project_type = project`. Shorter-term initiatives (build website, research algo). |
| **Asset** | `project_type = asset` — ongoing income-bearing unit (apartment, individual bot, Etsy SKU). Same table as projects. |
| **Gig** | `project_type = gig` — paid work, often under a hustle (design a website, edit a podcast). May pay once or on a recurring cadence (Phase 2 income). |
| **Contract** | `project_type = contract` — formal paid engagement, often under a business (retainer, client agreement). May pay once or on a recurring cadence (Phase 2 income). |
| **Task** | Unit of work inside a project. |

Everything — tasks, income streams, goals, time logs — ultimately rolls up through this hierarchy.

**Phase note:** Phase 1 shipped Project → Task only. Ventures and `project_type` are introduced in Phase 1.6 per `plans/phase-1.5-ux.md`. **Until Phase 2**, selecting a non-default project type does not change project behaviour — it is classification for future income UX. Payment cadence (weekly, monthly, one-time) and stream-to-type rules are **Phase 2** scope; requires architect review before implementation.

---

## 3. Feature Areas

### 3.1 Ventures

Ventures are the top-level organisational unit.

**User can:**
- Create a venture with name, description, colour (picker: one selected swatch, click for 12 options), optional icon, and category label
- Archive a venture (soft delete; data retained; viewable via Archive in sidebar)
- Expand venture in sidebar to see and filter child projects
- View venture-level income rollup and goals (Phase 2–3)

**Examples:** Podcast business, Trading bots, Etsy store, Property portfolio, Dev skills

---

### 3.2 Projects (by type)

Projects belong to exactly one venture. Type is stored as `project_type` on the same row (`project` \| `asset` \| `gig` \| `contract`; default `project`).

**User can:**
- Create a project inside a venture (name, description, colour, optional icon)
- Set **project type** (defaults to project; asset / gig / contract for classification)
- Move project across Kanban columns: Idea → Active → Paused → Shipped
- Archive a project; view archived projects via sidebar Archive link
- Open project hub (Phase 3): stats, goals, tasks; edit via explicit control
- Interim (Phase 1b): click project title → edit modal with archive at bottom

**Type semantics (target):**
| Type | Typical venture context | Income note (Phase 2+) |
| --- | --- | --- |
| `project` | Any | General work; optional income link |
| `asset` | Business, investment, property | Recurring income unit (rental, SKU, bot) |
| `gig` | Hustle | Paid deliverable or recurring side income |
| `contract` | Business | Formal agreement; retainer or milestone pay |

**Phase 1.6:** type selector in create/edit UI only — **no difference in fields, status workflow, or task behaviour** by type.

**Archive / delete policy:**
- **Archive** — reversible; user-visible via Archive view
- **Delete** — soft-hide from UI (hidden archive); no purge UI until Settings phase
- No true hard-delete in v1 user interface

---

### 3.3 Income & Revenue Tracking

Income streams are user-defined and flexible. **Phase 2 architect review** must finalise how streams attach to ventures and to projects by **type** (project, asset, gig, contract), and how **payment cadence** (weekly, monthly, one-time) is modelled for recurring vs one-off revenue.

**Income stream properties:**
- Name (e.g. "Podcast Sponsorships", "Flat Rental", "Affiliate")
- **Venture** (required primary link)
- **Project** (optional drill-down; any `project_type`)
- **Cadence** *(Phase 2 — TBD)*: weekly \| monthly \| one_time — distinguishes recurring streams from single payouts (applies to gigs, contracts, and assets alike)
- Type tag (recurring / one-off / consulting / rental / affiliate / other) — may align with or supplement cadence; architect to reconcile
- Status: active / inactive / projected
- Currency (default GBP; other currencies stored at entry level with GBP conversion)

**Income entry (manual):**
- Amount + currency
- Period: year + month
- Flag: actual or projected
- Optional notes

**What the user sees:**
- **Venture-first** rollups: total revenue + per-venture breakdown
- Income per stream per month — actual vs. projected
- MTD, QTD, YTD rollups in a KPI strip
- Stacked area/bar chart: income by venture/stream over time
- Per-project income when drilling into a venture

**Auto-calculation rule:** Numeric goals of type `income` auto-pull `actual_value` from summed income entries for the linked venture/project/stream in the goal's period.

---

### 3.4 Task Management & Kanban

Tasks are the unit of work inside projects.

**Task fields:**
- Title, description
- Project (required)
- **Type** (Phase 1.6): writing | research | code | meeting | admin — semantic colour on cards
- Status: Backlog → In Progress → Review → Done
- Priority: Low / Medium / High / Urgent
- Target completion date
- Actual completion date (auto-set when moved to Done)
- Estimated hours
- Actual hours (summed from time logs)

**Views (Projects page):**
- **Toggle:** Task Kanban | Project Kanban (separate boards, never mixed)
- **Task Kanban:** drag-and-drop; filterable by multi-select project sidebar; all projects selected by default
- **Summary table:** below task board; sortable by date/priority/project
- **Task detail modal:** full edit, time log list, notes (click task title)
- **Board options:** toggle optional card fields; saved in browser (server later)

**Task card defaults (Linear density):**
- Neutral card; project colour dot; project name; venture colour title underline in all-projects view
- Default metric: target due date
- Drag anywhere on card; no status buttons or hex codes in UI

**Time tracking (v1):** manual time log entry per task (date + hours + notes).
**Time tracking (v2):** Toggl Track sync — see Section 7.

---

### 3.5 Goals & Streaks

Goals attach to a **venture**, a **project**, or both.

**Goal types:**
- **Numeric** — e.g. "Earn £500/month from podcast" → auto-calculated from income entries
- **Completion** — e.g. "Ship 4 podcast episodes this month" → manual count or task completions
- **Habit** — cadence + pass threshold

**Goal cadences:** daily, weekly, monthly, quarterly, annual

**What the user sees:**
- Dashboard: next goal per project beneath KPIs (Phase 3)
- Full goal detail on project hub and Goals page
- Progress rings, streak grid, cadence tabs

**Auto-calculation rules:**
- `income` type → SUM of linked income entries in period
- `task_completion` type → COUNT of Done tasks in linked project in period
- `habit` type → user-logged boolean or count vs. threshold

---

### 3.6 Dashboard

The home screen once Phase 3 ships. Until then, **Projects** is the default landing page.

**Period toggle:** monthly (default) and weekly — applies to **all** KPIs and charts on the page.

**KPI strip:** Total revenue | Revenue goal progress | Tasks completed | Goals on track

**Charts:**
- Revenue by venture (sidebar/summary chart)
- Income over time: stacked area by venture/stream
- Task velocity: tasks completed per week, coloured by project
- Goal progress: rings or bars grouped by cadence

**Project status list:** ordered by urgency then alphabetical; user can drag to reorder (session first, persisted later); filter/sort by revenue, task count, venture category

**Streak tracker** and **recent activity feed** as before.

---

### 3.7 Monthly Report View

A generated summary for any selected month:
- Total income (actual vs. projected) by venture and stream
- Tasks completed vs. created
- Goals hit vs. missed
- Hours logged
- Top venture/project by income and by tasks completed

---

### 3.8 Read-Only Shareable View (v1.1 — not Phase 1)

- Token-gated URL (e.g. `/share/{token}`)
- Dashboard view only — no edit capability
- Toggle per section: show/hide income, show/hide specific ventures/projects

---

## 4. Design & UX

### 4.1 Information architecture

- **App shell:** persistent left sidebar (ventures → projects) + top nav
- **Top nav:** Projects (default) | Income | Goals | Dashboard (Phase 3+)
- **Projects page:** toolbar (toggle, filters, actions) → full-width Kanban → summary table
- **Sidebar:** multi-select project checkboxes (default all on); + Hustle; Archive link bottom-left
- Full spec: `plans/phase-1.5-ux.md`

### 4.2 Aesthetic

Warm parchment background, terracotta orange accent, `Instrument Serif` for big data numbers, `General Sans` for all UI. Clean, paper-feel cards. Bold animated charts.

**Layout density:** match Linear dashboard and board view conventions.

**Component stack:** Tailwind + shadcn/ui (copy-paste) + Recharts. Agents use shadcn primitives before bespoke CSS.

### 4.3 Colour system

- **UI chrome:** 3 primary + 3 accent tokens (terracotta-derived; see `plans/phase-1.5-ux.md`)
- **Ventures and projects:** shared 12-colour palette via compact picker (`Colour` label, selected swatch + click-to-expand); no free-form hex in UI
- **Tasks:** semantic colour by task type (Phase 1.6)
- Colour assigned to a venture/project is consistent app-wide (Kanban, charts, KPIs)

### 4.4 Motion

- Chart bars/lines animate on mount (staggered ease-out)
- KPI number count-up on dashboard load
- Progress ring stroke animation
- Kanban card drag: spring physics (scale + shadow)
- `prefers-reduced-motion` respected throughout

### 4.5 Responsive

- Desktop-first (1280px+), responsive to 375px
- Sidebar collapses to bottom tab bar on mobile (Phase 4)
- Touch-friendly: 44px minimum tap targets

### 4.6 Light/Dark Mode

Full dark mode — Phase 4 (deferred from "day one" given Phase 1b/4 sequencing).

---

## 5. Out of Scope (v1)

- Multi-user / team features
- AI or agent features (planned for v3+)
- Toggl sync (Phase 6)
- Shareable link (v1.1)
- Settings page and hidden-delete purge UI
- Push notifications, email reports, mobile native app

---

## 6. Success Criteria

- User can open the dashboard and see venture/project status, MTD income, and goal progress in under 3 seconds (Phase 3+)
- User can add a new income entry in under 30 seconds
- User can move a Kanban task between columns with drag-and-drop on the card surface
- User can add a venture, project, or task without touching code
- Monthly report auto-generated with no manual input

---

## 7. Toggl Integration (Phase 6 — future)

Toggl Track v9 API. Background sync maps entries to tasks/projects. Read-only from Momentum.

---

## 8. Future: MCP & Agent Integration (Phase 7+)

MCP server wrapper over FastAPI routes for task, income, and goal queries.

---

*Living document. Update as decisions are made. Version history in Git.*
