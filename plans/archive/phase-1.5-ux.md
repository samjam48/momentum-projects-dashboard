# Phase 1.5 — UX / IA Foundation

**Status:** Signed off (May 2026)  
**Owner:** Sam  
**Date:** May 2026  
**Purpose:** Design decisions and layout patterns before Phase 1b implementation. No production code in this phase.

---

## 1. Summary

Phase 1 delivered correct workflows on a monolithic, panel-heavy UI. Phase 1.5 locks how the app should **look, navigate, and behave** before refactoring the frontend in Phase 1b.

A larger domain change — **Venture → Project/Asset → Task** — is designed here but **implemented in Phase 1.6**, after Phase 1b UX fixes land on the current Project → Task schema.

---

## 2. Entity model (target state)

### Hierarchy

```text
Venture (category label: user-defined Title Case; defaults include Hustle, Business, Investment, Property, Education, Hobby)
  └── Project (same table; `project_type`: project | asset | gig | contract — default "project")
        └── Task
```

| Level | Role | Examples |
| --- | --- | --- |
| **Venture** | Permanent top-level “hustle” or business line | Podcast business, Trading bots, Etsy store, Property portfolio |
| **Project** | Default work container inside a venture | Redecorate flat, Optimise Etsy page, Research new algo |
| **Asset** | Ongoing income-bearing unit (`project_type = asset`) | Apartment A, Individual trading bot, Etsy listing SKU |
| **Gig** | Paid one-off or recurring work, often under a hustle (`project_type = gig`) | Design a website, Edit a podcast episode |
| **Contract** | Formal paid engagement, often under a business (`project_type = contract`) | Retainer, SaaS client agreement |
| **Task** | Unit of work inside a project | Landing page copy, SEO audit, Deploy v2 |

- A project belongs to **exactly one** venture.
- Tasks belong to **exactly one** project.
- **Project type** is a single enum on the projects row (not a separate table). Default `project` when unset.
- **Phase 1.6:** type is selectable in UI; **no behavioural difference** between types yet — same fields, Kanban, and task flows.
- **Phase 2+:** gigs, contracts, assets, and projects may link to income streams with **cadence** (weekly, monthly, one-time); architect to finalise schema and UX with income (see `docs/V1-PRD.md` §3.3, `plans/BACKLOG.md` Phase 2).

### Kanban boards (two views, one page)

| Board | Columns | Page |
| --- | --- | --- |
| **Task board** | Backlog → In Progress → Review → Done | Projects page (toggle) |
| **Project board** | Idea → Active → Paused → Shipped | Projects page (toggle) |

Tasks and projects are **never mixed** on the same board.

### Goals and income (target)

- **Income streams** roll up **venture-first**, with optional project/asset drill-down.
- **Goals** attach to a **venture**, a **project**, or both (not global-only long term).
- **Dashboard** (Phase 3): total revenue + per-venture sidebar chart; next goal per project listed beneath KPIs.

---

## 3. Information architecture

### Default landing

| Phase | Default route | Notes |
| --- | --- | --- |
| Now → Phase 3 | **Projects** | Task board via toggle on same page |
| Phase 3+ | **Dashboard** | Projects remains in top nav |

### Top navigation

```text
┌──────────────────────────────────────────────────────────────────┐
│  Momentum     [Projects]  [Income]  [Goals]  [Dashboard †]     │
└──────────────────────────────────────────────────────────────────┘
† Dashboard: hidden or disabled until Phase 3
```

- **Projects** — default; hosts project/task toggle, Kanban, summary table.
- **Income** — Phase 2.
- **Goals** — Phase 3.
- **Dashboard** — Phase 3 (monthly default, weekly toggle on all KPIs/charts).

### App shell layout

```text
┌────────────┬─────────────────────────────────────────────────────┐
│  Sidebar   │  Main content                                       │
│            │                                                     │
│  Ventures  │  [Toolbar: filters + primary actions]               │
│  (expand)  │  [Primary view: Kanban full width]                  │
│    □ Proj  │  [Secondary: task summary table]                    │
│    □ Proj  │                                                     │
│            │                                                     │
│ + Hustle   │                                                     │
│            │                                                     │
│ Archive ↓  │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

### Sidebar behaviour

| Control | Action |
| --- | --- |
| **Venture row** | Expand/collapse project list |
| **Project checkbox** | Multi-select filter (default: all selected) — scopes Kanban, table, and future dashboard widgets |
| **Click project title** | Opens **edit modal** (interim hub); full hub page in Phase 3+ |
| **Click venture title** | Opens venture edit modal (Phase 1.6+) |
| **+ Hustle** | Create venture (top-level only; projects added inside venture) |
| **Archive** (bottom-left) | View archived ventures/projects |

No **+ Project** at sidebar root. Projects are created inside a venture context.

### Archive and delete policy

| Action | v1 behaviour |
| --- | --- |
| **Archive** | Reversible; visible via Archive link in sidebar |
| **Delete** | Soft-hide from UI (hidden archive); no Settings purge until future phase |
| **True purge** | Backlog — Settings + account phase (unscoped) |

---

## 4. Projects page (Phase 1b target)

### Toolbar (no standalone “workspace filter” panel)

```text
┌─ Projects ───────────────────────────────────────────────────────┐
│ [Tasks | Projects]   [All projects ▼]   [+ New task]            │
│                      [Board options ▾]                          │
└─────────────────────────────────────────────────────────────────┘
```

- **Tasks | Projects** — toggles which Kanban board is shown.
- **All projects ▼** — complements sidebar multi-select (dropdown for quick filter).
- **+ New task** — opens task modal.
- **Board options** — toggle optional card fields (priority, due date, hours, etc.); persisted in **localStorage**.

Venture creation uses **+ Hustle** in sidebar, not the main toolbar.

### Task Kanban layout

```text
┌─────────────────────────────────────────────────────────────────┐
│  Backlog      │  In Progress   │  Review       │  Done          │
│  ┌──────────┐ │  ┌──────────┐  │               │  ┌──────────┐  │
│  │ ● Title  │ │  │ ● Title   │  │               │  │ ● Title  │  │
│  │ Podcast  │ │  │ High      │  │               │  │ 2.5h     │  │
│  │ ──────── │ │  │ 29 May    │  │               │  └──────────┘  │
│  │ 29 May   │ │  └──────────┘  │               │                │
│  └──────────┘ │                │               │                │
├─────────────────────────────────────────────────────────────────┤
│  Task summary                              [Sort ▼]             │
│  Title · Project · Status · Priority · Due · Hours              │
└─────────────────────────────────────────────────────────────────┘
```

- Kanban is **full width** — no side-by-side table.
- Summary table **below** the board (future: optional Kanban ↔ list-only toggle).
- Columns are **fixed-width**, flex row — Linear board density.

### Task card (default)

Linear-style neutral card:

- Small **project colour dot**
- **Task title** (click → full task modal)
- **Project name** (required in all-projects view)
- **Venture colour underline** on title when viewing all projects
- **One default metric:** target due date
- **No** hex codes, status buttons, or Drag button on card
- **Drag:** press/hold or drag anywhere on card (`@dnd-kit` on card surface)
- **Status** implied by column (optional badge via Board options)

### Project card (Phase 1.6+, designed now)

- Project colour dot + name
- Status badge (idea / active / paused / shipped)
- Type indicator when not default `project` (asset / gig / contract)
- One default metric (e.g. open task count) — options via Board options

### Project hub (interim vs future)

| Phase | Click project title |
| --- | --- |
| **1b** | Edit modal only (name, description, colour swatch, archive at bottom) |
| **3+** | Dedicated hub page: read-only stats + Edit button + shortcuts (add task, goal, etc.) |

---

## 5. Colour and design tokens

### UI chrome (3 primary + 3 accent)

Derived from existing warm terracotta PRD palette. **Draft — owner approval required before 1b.**

| Token | Role | Draft hex |
| --- | --- | --- |
| `primary-bg` | Page background | `#F6EFE2` |
| `primary-surface` | Card / panel | `#FFFAF4` |
| `primary-text` | Body text | `#1F1712` |
| `accent-action` | Primary button | `#9C5D35` |
| `accent-action-hover` | Button hover | `#824C29` |
| `accent-highlight` | Links, focus, KPI emphasis | `#D97048` |
| `accent-muted` | Borders, dividers | `rgba(90, 58, 37, 0.14)` |
| `accent-success` | Done / on-track | `#1F5D2F` on `#D9EDD5` |
| `accent-warning` | Review / at-risk | `#7A4C00` on `#F8E2B5` |

### Venture / project palette (12 colours)

Stored as `#RRGGBB` in DB; chosen from swatch picker only (no free-text hex in UI).

| # | Hex | Name |
| --- | --- | --- |
| 1 | `#D97048` | Terracotta |
| 2 | `#E07A5F` | Coral |
| 3 | `#C8553D` | Burnt sienna |
| 4 | `#9C5D35` | Umber |
| 5 | `#B8860B` | Antique gold |
| 6 | `#6B8E6B` | Sage |
| 7 | `#5B7C99` | Slate blue |
| 8 | `#7B5EA7` | Plum |
| 9 | `#C77DFF` | Lavender |
| 10 | `#E8A87C` | Peach |
| 11 | `#85C1E2` | Sky |
| 12 | `#8B7355` | Taupe |

Ventures and projects each pick one swatch. In task cards, **project dot** uses project colour; **title underline** uses venture colour.

### Task and activity colour note

Phase 1.6 does not add task `type` or semantic task colours. Task cards continue to use project and venture colours for hierarchy. Time log activity types are text labels for log rows, not card colour drivers.

---

## 6. Component and layout standards

### Stack (Phase 1b onward)

| Layer | Choice |
| --- | --- |
| Styling | Tailwind CSS v4 |
| Components | **shadcn/ui** (copy-paste into `components/ui/`, not npm package) |
| Global tokens | `styles/tokens.css` + `base.css` |
| Charts | **Recharts** (Phase 2+); Tremor optional later |
| Motion | Framer Motion for Kanban drag |
| Density reference | Linear dashboard + board view |

**Rule:** Agents use shadcn primitives (`Card`, `Dialog`, `Button`, `Select`, `Checkbox`) before writing bespoke component CSS.

### Shared patterns (all phases)

- Create/edit flows use **Dialog** modals (project, task, venture, income stream, goal).
- **Colour picker** — label `Colour`; shows the **currently selected** swatch only; click opens all 12 palette options (popover or expandable row). Never show hex strings in UI.
- **Page toolbar** — filters + primary action; no card-wrapped “workspace filter” section.
- **Empty states** — block task creation when no active projects; clear CTA to create venture/project.
- **Board options** — localStorage until user settings API exists.

### What we are not doing in 1b

- Full venture sidebar (stub or hide until 1.6 if needed for layout)
- Project Kanban board (1.6)
- Dashboard page
- Settings page / hidden-delete purge UI
- Server-persisted board preferences

---

## 7. Dashboard (Phase 3 — IA locked now)

- **Default period:** monthly; **toggle:** weekly (applies to **all** KPIs and charts on the page).
- **Top:** total revenue + revenue goal progress.
- **Sidebar chart:** revenue by venture.
- **Below KPIs:** each project’s status + next goal, ordered by **urgency then alphabetical**.
- **Reorder:** manual drag (session first; DB persistence later).
- **Filter/sort options:** revenue, task count, project count, venture category type.

---

## 8. Phase sequencing

```text
Phase 1     ✅  Projects + tasks + Kanban (functional baseline)
Phase 1.5   ✅  This document
Phase 1b    →   UX overhaul on current schema (shell, modals, task board, table)
Phase 1.6   →   Ventures, project types, project Kanban, schema migration
Phase 2     →   Income (venture-first streams)
Phase 3     →   Goals + Dashboard
Phase 4     →   Reports + polish (dark mode, responsive, empty states)
Phase 5+    →   Unchanged from BACKLOG
```

### Phase 1b tickets (ready for AGENTS.md sprint)

#### Ticket 1b-1 — App shell and Projects page layout

- Extract monolithic `App.tsx` into `AppShell`, sidebar scaffold, `Projects` page.
- Top nav: Projects (default), Income/Goals disabled stubs, Dashboard hidden.
- Projects page: toolbar above board; task Kanban full width; summary table below.
- Remove workspace filter panel and two-up Kanban/table layout.
- shadcn/ui setup + `tokens.css` with approved palette.

#### Ticket 1b-2 — Project and task modal UX

- Project create/edit via Dialog only (no permanent form).
- Colour picker: label `Colour`, selected swatch visible by default, click to choose from 12 options; no hex visible in UI.
- Active project list: coloured title chip; spacing between items; click title → edit modal; archive at bottom of modal.
- Sidebar: archive link bottom-left; multi-select filter (localStorage); all selected by default.
- Task create/edit Dialog unchanged in fields; wired to new layout.

#### Ticket 1b-3 — Task Kanban interaction and card density

- Card-level drag (remove Drag and status shortcut buttons).
- Linear-density card: dot, title, project name, default due date metric.
- Click title → task modal.
- Board options menu; preferences in localStorage.
- Failed drag rollback + error surface (preserve Phase 1 behaviour).

---

## 9. Open items (non-blocking)

| Item | When |
| --- | --- |
| Owner sign-off on draft hex tokens (§5) | Before 1b-1 |
| Low-fi Canvas wireframes | `plans/wireframes/phase-1b-wireframes.canvas.tsx` |
| Venture sidebar expand/collapse UI detail | 1.6 ticket writing |
| Time log activity type polish | 1.6 ticket writing |
| Settings + hidden-delete purge | Future backlog |
| Dashboard chart catalogue | Phase 3.5 — cross-app data viz pass |

---

## 11. Phase 1b cleanup backlog (owner feedback, May 2026)

Owner review after 1b-1 / 1b-2 / 1b-3 — implement as **one or two cleanup tickets** (`1b-4`, optional `1b-5`) after sign-off. Do not land ad hoc.

### 11.1 Shell, sidebar, and archive

| Item | Decision | Detail |
| --- | --- | --- |
| **View archive** | Ship in cleanup | Replace footer stub with **Dialog** listing archived items. Toggle: **archived projects** \| **archived tasks**. Projects: `GET /api/v1/projects?status=archived`. Tasks: archive via task modal (see §11.2); list archived tasks when API supports `status=archived` or equivalent. Full archive page later. |
| **Dual filter UX copy** | Polish | Toolbar dropdown + sidebar checkboxes work; align labels and empty states so mismatched filters are not confusing. |
| **Loading sidebar** | Fix | No misleading dead form while app is still loading (`!workspaceReady`). |
| **TopNav Projects link** | Fix | No client router yet — avoid `<a href>` that hard-navigates away; use non-navigating control. |
| **App.tsx extraction** | Cleanup | Slim ~1.8k-line file — extract Kanban / table / dialog wiring into components. |
| **Sidebar checkboxes** | Redesign | All projects checked by default (keep). **Checkbox on the right** of each row; **project colour dot only on the left** (no coloured title chip in row). Checkbox: transparent or very low-opacity fill; **darker outline when checked**, lighter when unchecked. |
| **Icon set** | Standardise | Use one flat icon library site-wide (e.g. Lucide via shadcn). **No emoji** for controls. |

### 11.2 Board options and Kanban

| Item | Decision | Detail |
| --- | --- | --- |
| **Board options control** | Gear icon | Replace large button with **gear icon** at **right of Kanban title bar**. Menu items: smaller text; **checkboxes left-aligned** (same pattern as sidebar project checkboxes), not bold labels. |
| **Column headers** | Status pills | Column titles use the **same pill style** as card status badges (Backlog, In Progress, etc.). |
| **Status on cards** | Remove from board options | Status is implied by column — drop status from optional card fields. |
| **Card layout** | Linear polish | **5px padding** on each card. **Project colour dot top-right** (same height as title). **Project name not shown by default** under title; when enabled in board options, show as **pill** tinted to project colour. |
| **Title hover** | Underline only | Remove background colour on title hover (unreadable); keep **underline** only. |
| **Due date format** | `MMM DD` | Three-letter month + day: `May 14`, `Sep 09`, `Dec 23`. |
| **Column layout** | Four columns | **Four vertical columns** in one row (not 2×2 grid). Horizontal scroll on narrow viewports. |
| **Kanban drag** | Stabilise | Card-surface drag still rough (title button inside draggable, touch). Revisit activation constraints and nested interactive elements. |
| **Board options keyboard** | Defer | Full keyboard operation after feature set stabilises. |
| **Colour picker keyboard** | Optional | Enter/Space on swatches — polish when convenient. |

### 11.3 Task summary table

| Item | Decision | Detail |
| --- | --- | --- |
| **Section title** | Match Projects bar | **Task summary** — bold, same typographic treatment as **Projects** in page toolbar. |
| **Filter subtitle** | Human copy | Replace “Shared filter target: …” with **“Showing all projects”**, **“Showing N projects”**, or **“Showing {project name}”** when one selected. |
| **Table sort** | Gear + dropdown | Sort via **gear icon** (right of section title bar), dropdown labelled **Sort by** with column options. Keep or replace header-click sort — dropdown must be the obvious entry point. |

### 11.4 Task modals and time logs

| Item | Decision | Detail |
| --- | --- | --- |
| **Remove dev/meta copy** | All task dialogs | Drop placeholder strings that read like implementation notes, e.g. “Create a task in the Phase 1 workspace”, “Backend-derived completion…”, “Manual entries refresh task totals…”. **UI copy rule:** labels describe user actions and data, not system behaviour. |
| **New task modal** | Minimal | No “Task detail” section header; no blank Actual hours / completed date block; no “Save the task before adding manual time logs.” |
| **Edit task modal — chrome** | Dialog UX | **X icon** closes (no “Close” button). **No “Title” label** — task name is **editable h3**; click to edit inline. |
| **Edit task — save model** | Blur / close save | Persist on **blur** or **close** when edited. **Cancel** discards unsaved edits. Primary footer: **Cancel** (current Save styling). Secondary: **Archive** as grey text link (no outline, same padding as old Cancel) — archives task; view in archive toggle. True delete deferred. |
| **Time logs section** | Restructure | Title: **Time logs** only. **Actual hours** and **completed date** at **top**. Listed entries below; **+ Add time log** directly under title or list (no inline date/hours/notes form). |
| **Add time log** | Sub-modal | Opens Dialog: **title**, **notes**, **location**, **date**, **time** (hours). Only **time** required; rest nullable. Save / Cancel. |
| **Time log list item** | Compact row | **Title bold** (primary line). Date and location below in smaller, lighter text. **Click row** to view notes (expand or secondary modal). |
| **Activity type tags** | Phase 1.6 signed off | Replace the time log row **title** with a user-defined activity type. Defaults: `planning`, `meeting`, `admin`; users can add values such as `coding`, `researching`, `outreach`, and `writing`. Activity type is the primary label, notes carry specifics, `location` remains, and null/cleared activity type displays as `uncategorised`. |
| **Create task copy** | Minimal | Remove “New task” / “Edit task” instructional subtitles. |

### 11.5 Still deferred (unchanged)

| Item | When | Notes |
| --- | --- | --- |
| **Task API `project_id` filter** | Scale | Client-side multi-select filter; server filter when volume warrants. |
| **Venture colour underline** | 1.6 | Ventures not in schema until Phase 1.6. |
| **Archive filter rollback** | Done in 1b-2 | Filter reset on archive success. |
| **Kanban card hex tags** | Done in 1b-3 | Colour dot only. |
| **Duplicate Kanban test helpers** | Done post-1b-3 | Shared `workspaceQueries` in tests. |

### 11.6 Suggested ticket split

| Ticket | Scope |
| --- | --- |
| **1b-4 — Projects page polish** | §11.1 (except task archive list if blocked on API), §11.2, §11.3, App.tsx extraction |
| **1b-5 — Task modal and time logs** | §11.4, archived tasks in archive modal, task archive API if needed |

Planner may merge into a single **1b-4** if acceptance criteria stay reviewable in one PR.

### 11.7 Post–1b-5 owner sign-off (`1b-6`)

Owner review after **1b-4** / **1b-5** (see `plans/to-do-list.md` §1b review notes). Ticket **`1b-6`** covers: clean `act(...)` test output; checkbox restyle (clear background, Lucide tick, darker selected outline); Kanban outer card gap + reverted inner padding + due-date type scale; modal backdrop close and visible X; h3 task title + inline-edit padding; time-log GET/POST fix, hard delete, coloured metric cards, responsive right column; board-options row weight; plus deferred items (DnD/sort cleanup, ArchiveDialog stale flash, drop `showStatusBadge` writes). Explicitly out: archived-project task labels, empty-notes row UX, AppShell test flake.

---

## 10. Workshop decision log

| # | Decision |
| --- | --- |
| Q1 | Code name **venture**; category labels are user-defined Title Case strings; defaults include **Hustle**, **Business**, **Investment**, **Property**, **Education**, **Hobby** |
| Q2 | Strict venture → project → task ownership |
| Q3 | Venture fields: name, description, colour, status, icon, category |
| Q4 | Both venture and project have colours; Phase 1.6 has no task type colours |
| Q5 | Project statuses: idea, active, paused, shipped |
| Q6 | One Projects page; toggle Tasks / Projects boards |
| Q7 | Sidebar: ventures with expandable project lists |
| Q8 | Income venture-first; `project_type` on projects (project \| asset \| gig \| contract); cadence in Phase 2 |
| Q9 | Goals on venture and/or project |
| Q10 | **1b before 1.6** — UX on current schema first |
| Q11–13 | Edit in modal now; hub page later; multi-select filter; + Hustle only in sidebar |
| Q14–16 | Linear card + venture underline; default metric = due date; options in localStorage |
| Q17–18 | shadcn now; Recharts for charts; terracotta tokens for approval |
| Q19–20 | Archive in sidebar footer; no true delete in UI |
| Q21–22 | Dashboard weekly/monthly global toggle; project order urgency → alpha, drag reorder |
| Q23–24 | Projects default nav; hub modal = edit fields only for now |

---

*Next step: owner approves §5 palette, then update `AGENTS.md` current sprint to Phase 1b and implement ticket 1b-1.*
