# Momentum — Technical Reference Document (TRD)
**Version:** 1.1 — May 2026 | **Owner:** Sam | **Status:** Approved

---

## 1. Stack Decisions

| Layer | Technology | Version | Rationale |
| --- | --- | --- | --- |
| Frontend framework | React | 18 | Component model suits dashboard; excellent ecosystem |
| Build tool | Vite | 5 | Fast HMR, minimal config |
| Language | TypeScript | 5.x | Type safety; Cursor/Claude Code friendly |
| Styling | Tailwind CSS | v4 | Token-mapped utilities; co-located responsive styles |
| Charts | Recharts | 2.x | React-native, composable, SSR-safe |
| Animation | Framer Motion | 11 | Spring physics; entrance animations; Kanban drag feel |
| Drag and drop | @dnd-kit/core | 6 | Accessible, headless; pairs well with Framer Motion |
| Server state | TanStack Query | v5 | Caching, mutations, optimistic updates |
| UI state | Zustand | 4 | Lightweight; no boilerplate; co-located slices |
| Backend | FastAPI | 0.115+ | Async, typed, auto OpenAPI docs; Python familiarity |
| ORM | SQLModel | 0.0.21+ | Single model = DB schema + Pydantic validation |
| Database (v1) | SQLite | 3.x | Zero infrastructure; file-based; easy Docker volume mount |
| Database (v2) | PostgreSQL | 16 | Cloud-ready; env-var swap only; same Alembic migrations |
| Migrations | Alembic | 1.x | Industry-standard for SQLAlchemy-based ORMs |
| Auth (v1) | API key (header) | — | Single user, local; no OAuth overhead |
| Auth (v1.1) | JWT (python-jose) | — | Multi-device; cloud deploy; read-only share tokens |
| Containerisation | Docker + Compose | — | `docker-compose up` = everything running locally |
| Backend testing | pytest + httpx | — | Async-compatible; TDD-ready |
| Frontend testing | Vitest + RTL | — | Vite-native; fast; component testing |
| Python linting | Ruff + mypy | — | Fast, strict; CI-enforced |
| JS linting | ESLint + Prettier | — | Standard TS/React config |
| Complexity gate | radon (Python) | — | Cyclomatic complexity ≤ 10 enforced in CI |
| Background jobs | APScheduler | 3.x | Toggl sync (v2); lightweight, no Redis needed |

---

## 2. Repository Structure

```
momentum/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app factory
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic Settings (env vars)
│   │   │   └── security.py           # API key validation / JWT utils
│   │   ├── db/
│   │   │   ├── database.py           # Engine + session factory
│   │   │   └── migrations/           # Alembic env + version files
│   │   ├── models/                   # SQLModel table definitions (DB + schema)
│   │   │   ├── project.py
│   │   │   ├── task.py
│   │   │   ├── time_log.py
│   │   │   ├── income_stream.py
│   │   │   ├── income_entry.py
│   │   │   ├── goal.py
│   │   │   └── goal_period.py
│   │   ├── routers/                  # FastAPI APIRouter per resource
│   │   │   ├── projects.py
│   │   │   ├── tasks.py
│   │   │   ├── time_logs.py
│   │   │   ├── income.py
│   │   │   ├── goals.py
│   │   │   └── dashboard.py
│   │   ├── services/                 # Business logic (no DB calls in routers)
│   │   │   ├── income_service.py
│   │   │   ├── goal_service.py       # Auto-calc logic lives here
│   │   │   └── report_service.py
│   │   ├── schemas/                  # Response/request schemas (where ≠ model)
│   │   └── tests/
│   │       ├── conftest.py           # DB fixtures, test client
│   │       ├── test_projects.py
│   │       ├── test_tasks.py
│   │       ├── test_income.py
│   │       ├── test_goals.py
│   │       └── test_dashboard.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pyproject.toml                # Ruff + mypy config
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/                      # axios client + TanStack Query hooks
│   │   │   ├── client.ts
│   │   │   ├── projects.ts
│   │   │   ├── tasks.ts
│   │   │   ├── income.ts
│   │   │   └── goals.ts
│   │   ├── components/
│   │   │   ├── layout/               # AppShell, Sidebar, TopBar, BottomNav
│   │   │   ├── dashboard/            # KPIStrip, IncomeChart, TaskVelocity, RecentFeed
│   │   │   ├── kanban/               # KanbanBoard, KanbanColumn, TaskCard, TaskModal
│   │   │   ├── goals/                # GoalCard, ProgressRing, StreakGrid, GoalForm
│   │   │   ├── income/               # StreamList, EntryTable, EntryForm, StreamForm
│   │   │   └── ui/                   # Button, Modal, Badge, Input, Select, Skeleton
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Kanban.tsx
│   │   │   ├── Income.tsx
│   │   │   ├── Goals.tsx
│   │   │   └── Reports.tsx
│   │   ├── stores/                   # Zustand (ui state: modals, filters, theme)
│   │   ├── styles/
│   │   │   ├── tokens.css            # CSS custom properties (design system)
│   │   │   └── base.css
│   │   └── utils/
│   │       ├── currency.ts           # GBP conversion helpers
│   │       ├── dates.ts
│   │       └── cn.ts                 # Tailwind class merge helper
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml                # Local dev
├── docker-compose.prod.yml           # Cloud deploy (PostgreSQL)
├── .env.example
├── AGENTS.md                         # Multi-agent workflow instructions
├── PRD.md
├── TRD.md
├── ADR/                              # Architecture Decision Records
│   └── 001-sqlite-first.md
├── CONTRIBUTING.md
└── README.md
```

**Architectural rule:** Business logic lives in `services/`. Routers only validate input, call services, and return responses. Nothing with a database session belongs in a router directly.

---

## 3. Database Schema

All primary keys are UUID strings. All timestamps are UTC ISO 8601.

### `projects`
```sql
id           TEXT PRIMARY KEY        -- uuid4
name         TEXT NOT NULL
description  TEXT
colour       TEXT                    -- hex string, e.g. "#d97048"
status       TEXT DEFAULT 'active'   -- active | archived
created_at   DATETIME NOT NULL
updated_at   DATETIME NOT NULL
```

### `tasks`
```sql
id               TEXT PRIMARY KEY
project_id       TEXT NOT NULL REFERENCES projects(id)
title            TEXT NOT NULL
description      TEXT
status           TEXT DEFAULT 'backlog'   -- backlog | in_progress | review | done
priority         TEXT DEFAULT 'medium'    -- low | medium | high | urgent
estimated_hours  REAL
actual_hours     REAL                     -- computed: SUM(time_logs.hours) for this task
target_date      DATE
completed_date   DATE                     -- auto-set when status → done
kanban_order     INTEGER                  -- sort order within column
created_at       DATETIME NOT NULL
updated_at       DATETIME NOT NULL
```

### `time_logs`
```sql
id           TEXT PRIMARY KEY
task_id      TEXT REFERENCES tasks(id)
project_id   TEXT NOT NULL REFERENCES projects(id)
hours        REAL NOT NULL
logged_date  DATE NOT NULL
source       TEXT DEFAULT 'manual'        -- manual | toggl | clockify
external_id  TEXT                         -- toggl entry ID for dedup
notes        TEXT
created_at   DATETIME NOT NULL
```

### `income_streams`
```sql
id           TEXT PRIMARY KEY
project_id   TEXT REFERENCES projects(id)   -- nullable
name         TEXT NOT NULL
type         TEXT       -- recurring | one_off | consulting | rental | affiliate | other
status       TEXT DEFAULT 'active'           -- active | inactive | projected
default_currency  TEXT DEFAULT 'GBP'
notes        TEXT
created_at   DATETIME NOT NULL
updated_at   DATETIME NOT NULL
```

### `income_entries`
```sql
id              TEXT PRIMARY KEY
stream_id       TEXT NOT NULL REFERENCES income_streams(id)
amount_raw      REAL NOT NULL              -- amount in original currency
currency        TEXT NOT NULL DEFAULT 'GBP'
amount_gbp      REAL NOT NULL              -- converted to GBP at time of entry
fx_rate         REAL DEFAULT 1.0           -- rate used for conversion
period_year     INTEGER NOT NULL
period_month    INTEGER NOT NULL           -- 1–12
is_projected    BOOLEAN DEFAULT FALSE
notes           TEXT
created_at      DATETIME NOT NULL
```

### `goals`
```sql
id               TEXT PRIMARY KEY
project_id       TEXT REFERENCES projects(id)   -- nullable = global goal
title            TEXT NOT NULL
description      TEXT
goal_type        TEXT NOT NULL   -- numeric | completion | habit
auto_source      TEXT            -- income | task_completion | null (manual)
auto_filter      TEXT            -- JSON: {"stream_id": "..."} or {"project_id": "..."}
target_value     REAL
unit             TEXT            -- "£", "episodes", "hours", "tasks", "days"
cadence          TEXT NOT NULL   -- daily | weekly | monthly | quarterly | annual
pass_threshold   REAL            -- for habit goals: minimum value to count as a pass
status           TEXT DEFAULT 'active'
created_at       DATETIME NOT NULL
updated_at       DATETIME NOT NULL
```

### `goal_periods`
```sql
id              TEXT PRIMARY KEY
goal_id         TEXT NOT NULL REFERENCES goals(id)
period_start    DATE NOT NULL
period_end      DATE NOT NULL
target_value    REAL
actual_value    REAL DEFAULT 0              -- updated by auto-calc or manual
status          TEXT DEFAULT 'in_progress' -- in_progress | hit | missed | skipped
notes           TEXT
updated_at      DATETIME NOT NULL
```

**Auto-calculation trigger:** When an `income_entry` is created/updated/deleted, a service function recalculates `actual_value` for all `goal_periods` where `goal.auto_source = 'income'` and the entry's period overlaps. Same pattern for `task_completion` goals when a task moves to `done`.

---

## 4. API Design

All routes: `GET /api/v1/...` — JSON only. Auth: `X-API-Key` header (v1). FastAPI auto-generates OpenAPI 3.1 at `/docs`.

### Projects
```
GET    /api/v1/projects                     List (filter: status)
POST   /api/v1/projects                     Create
GET    /api/v1/projects/{id}                Detail
PATCH  /api/v1/projects/{id}                Update
DELETE /api/v1/projects/{id}                Archive (soft delete)
GET    /api/v1/projects/{id}/summary        Aggregated stats
```

### Tasks
```
GET    /api/v1/tasks                        List (filter: project_id, status, priority)
POST   /api/v1/tasks                        Create
GET    /api/v1/tasks/{id}                   Detail
PATCH  /api/v1/tasks/{id}                   Update
DELETE /api/v1/tasks/{id}                   Delete
PATCH  /api/v1/tasks/{id}/status            Quick status update (Kanban drag)
GET    /api/v1/tasks/{id}/time-logs         List time logs for task
POST   /api/v1/tasks/{id}/time-logs         Add time log
```

### Income
```
GET    /api/v1/income/streams               List streams (filter: project_id, status)
POST   /api/v1/income/streams               Create stream
GET    /api/v1/income/streams/{id}          Detail
PATCH  /api/v1/income/streams/{id}          Update
GET    /api/v1/income/entries               List entries (filter: stream_id, year, month)
POST   /api/v1/income/entries               Create entry
PATCH  /api/v1/income/entries/{id}          Update entry
DELETE /api/v1/income/entries/{id}          Delete entry
GET    /api/v1/income/summary               MTD/QTD/YTD rollup, by-stream breakdown
```

### Goals
```
GET    /api/v1/goals                        List (filter: project_id, cadence, status)
POST   /api/v1/goals                        Create + auto-generate first period
PATCH  /api/v1/goals/{id}                   Update
GET    /api/v1/goals/{id}/periods           All periods for a goal
PATCH  /api/v1/goals/periods/{period_id}    Update actual_value or status (manual goals)
GET    /api/v1/goals/summary                Active goals with current period progress
```

### Dashboard & Reports
```
GET    /api/v1/dashboard                    Combined KPI snapshot (single round-trip)
GET    /api/v1/reports/monthly              Monthly report (?year=&month=)
```

---

## 5. Docker Setup

### Local Dev (`docker-compose.yml`)
```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ./backend:/app
      - ./data:/data          # SQLite file persisted here
    environment:
      DATABASE_URL: sqlite:////data/momentum.db
      API_KEY: ${API_KEY}
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    volumes:
      - ./frontend/src:/app/src
    depends_on: [backend]
    environment:
      VITE_API_URL: http://localhost:8000/api/v1
```

### Cloud Deploy (`docker-compose.prod.yml`)
Identical except:
- `DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/momentum`
- Adds `db:` service (postgres:16-alpine)
- Backend command: `uvicorn app.main:app --host 0.0.0.0 --port 8000` (no --reload)
- Frontend: `npm run build` + Nginx static serve

SQLite → PostgreSQL switch: **env var only**. No code changes required. SQLModel + Alembic handle both.

---

## 6. Multi-Agent Development Workflow

### Agent Roles

| Agent | Model | Primary Responsibility |
| --- | --- | --- |
| Architect | Claude Opus/Sonnet | Enforces TRD; reviews PRD changes; writes ADRs |
| Planner | Claude Sonnet | Breaks features into tickets with acceptance criteria |
| Test Writer | Claude Code / Cursor | Writes failing tests from acceptance criteria |
| Implementer | Claude Code / Codex | Writes minimum code to pass tests |
| Reviewer | Claude Sonnet | Code complexity, REST conventions, style, accessibility |
| PR Checker | Claude Code | Runs lint + type check + tests; blocks on failure |

### AGENTS.md Convention
`AGENTS.md` is read by every agent at session start. It contains:
- Current sprint goals (what to build this session)
- Architecture rules ("no business logic in routers", "all DB access via services")
- Style rules ("use `cn()` for Tailwind classes", "Framer Motion for all animations")
- Anti-patterns ("no hardcoded lists", "no direct `fetch()` in components")
- Open decisions / questions

### TDD Workflow
```
1. Planner      → ticket with acceptance criteria + edge cases
2. Test Writer  → failing pytest / Vitest tests from criteria
3. Implementer  → minimum code to pass tests (no gold-plating)
4. Reviewer     → complexity check, REST check, style check
5. PR Checker   → full suite, lint, types — hard block on failure
6. Architect    → spot-check TRD fidelity on significant changes
```

### Code Quality Gates (CI)
| Check | Tool | Threshold |
| --- | --- | --- |
| Cyclomatic complexity | radon (Python) | ≤ 10 per function |
| Backend test coverage | pytest-cov | ≥ 80% |
| Frontend test coverage | Vitest | ≥ 70% |
| Type safety (Python) | mypy --strict | Zero errors |
| Type safety (TS) | tsc --noEmit | Zero errors |
| Python lint | Ruff | Zero warnings |
| JS lint | ESLint | Zero errors |
| Formatting | Prettier | Auto-format (no manual check needed) |

---

## 7. Toggl Integration (v2)

**API:** Toggl Track v9 — `https://api.track.toggl.com/api/v9/`
**Auth:** Basic auth with API token (no OAuth; personal use)
**Free tier limit:** 30 requests/hour (sufficient for periodic sync)

**Sync strategy:**
- APScheduler background job: poll every 60 minutes
- Fetch time entries since last sync timestamp
- Map Toggl project tags → Momentum project IDs (user-configured mapping)
- Insert into `time_logs` with `source = 'toggl'`, dedup on `external_id`
- Trigger `actual_hours` recomputation on affected tasks

**No write-back** to Toggl in v2. Momentum is read-only consumer of Toggl data.

---

## 8. Architecture Decision Records

ADRs live in `/ADR/` as individual markdown files. Naming: `NNN-title.md`.

First ADR to create: `001-sqlite-first.md` — rationale for starting with SQLite over PostgreSQL.

Every significant architecture decision (e.g., "why SQLModel over SQLAlchemy + separate Pydantic", "why dnd-kit over react-beautiful-dnd") gets an ADR. This is the institutional memory of the project.

---

## 9. Security Considerations (v1)

- API key stored in `.env` (never committed; `.env.example` committed without values)
- `.gitignore` includes: `.env`, `data/`, `*.db`, `__pycache__`
- No sensitive data in frontend bundle (API key is backend-only)
- CORS: restrict to `localhost:3000` in dev; to actual domain in prod
- SQLite file lives in Docker volume, not in the repo

---

*Living document. Update with each architecture decision. Version history in Git.*
