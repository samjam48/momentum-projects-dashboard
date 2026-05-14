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
Venture (UI label: hustle | business | investment | property | education — default "hustle")
  └── Project / Asset (same table; `is_asset` flag)
        └── Task
```

| Level | Role | Examples |
| --- | --- | --- |
| **Venture** | Permanent top-level “hustle” or business line | Podcast business, Trading bots, Etsy store, Property portfolio |
| **Project** | Shorter-term work inside a venture | Redecorate flat, Optimise Etsy page, Research new algo |
| **Asset** | Ongoing income-bearing unit at project level | Apartment A, Individual trading bot, Etsy listing SKU |
| **Task** | Unit of work inside a project | Landing page copy, SEO audit, Deploy v2 |

- A project belongs to **exactly one** venture.
- Tasks belong to **exactly one** project.
- **Assets** share the projects table with `is_asset = true` when the unit is a recurring income source.

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
- Asset indicator when `is_asset`
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

### Task type colours (Phase 1.6+)

Task `type` is a DB field. Colour is semantic, not user-picked:

| Type | Draft colour |
| --- | --- |
| `writing` | `#7B5EA7` |
| `research` | `#5B7C99` |
| `code` | `#6B8E6B` |
| `meeting` | `#D97048` |
| `admin` | `#8B7355` |

Shown as a small type chip when Board options include task type.

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
Phase 1.6   →   Ventures, assets, project Kanban, schema migration
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
| `task_type` enum final list | 1.6 (admin listed once) |
| Settings + hidden-delete purge | Future backlog |
| Dashboard chart catalogue | Phase 3.5 — cross-app data viz pass |

---

## 11. Phase 1b cleanup backlog (caught during implementation)

Owner decisions logged during 1b-1 / 1b-2 — address in a **final 1b cleanup ticket** after 1b-3, not ad hoc.

| Item | Owner decision | Notes |
| --- | --- | --- |
| **View archive** | Modal listing archived projects (and later ventures/tasks) | API exists: `GET /api/v1/projects?status=archived`. Current footer link is a no-op stub (`#` + `preventDefault`). Replace with Dialog modal for 1b; full archive page later. |
| **Archive filter rollback** | Fixed in 1b-2 | Filter reset moved to archive success path; snapshot restore on API failure. |
| **Dual filter UX copy** | Cleanup | Toolbar dropdown + sidebar checkboxes are coordinated in code; polish labels / empty-state copy when filters disagree. |
| **Task API `project_id` filter** | Defer | 1b-2 loads all tasks and filters client-side for multi-select; revisit server-side filter when task volume warrants it. |
| **Colour picker keyboard** | Defer | Enter/Space on focused swatch optional polish; trigger focus ring sufficient for now. |
| **Loading sidebar dead form** | Defer to 1b-2+ cleanup | Remove no-op form during `!workspaceReady` when modals own all project flows. |
| **TopNav `/projects` href** | Defer | No client router yet; use non-navigating control until routing ticket. |
| **App.tsx size** | Defer | ~1.8k lines; extract Kanban/table/dialog wiring in cleanup or post-1b chore. |
| **Kanban card hex tags** | Done in 1b-3 | Linear cards use colour dot; no hex on cards. |
| **Board options keyboard** | Defer — late-stage usability | Owner: not needed while features still changing; full keyboard nav after feature set stabilises. |
| **Kanban drag / card-surface DnD** | Defer — 1b cleanup or later | Owner: card-surface drag needs stabilisation; revisit after more features land (nested button + touch). |
| **Venture colour underline on task titles** | Defer — 1.6 | All-projects view underline uses venture colour; ventures not in schema until 1.6. |
| **Duplicate Kanban test helpers** | Fixed post-1b-3 review | `App.test.tsx` imports shared `workspaceQueries`; Ticket 5 slimmed to smoke. |

---

## 10. Workshop decision log

| # | Decision |
| --- | --- |
| Q1 | Code name **venture**; UI category labels user-selectable; default label **hustle** |
| Q2 | Strict venture → project → task ownership |
| Q3 | Venture fields: name, description, colour, status, icon, category |
| Q4 | Both venture and project have colours; task colour from type |
| Q5 | Project statuses: idea, active, paused, shipped |
| Q6 | One Projects page; toggle Tasks / Projects boards |
| Q7 | Sidebar: ventures with expandable project lists |
| Q8 | Income venture-first; assets flagged on projects |
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
