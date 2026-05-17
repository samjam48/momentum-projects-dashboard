Here is a practical technical audit based on `docs/database-schema.md`, `docs/api-map.md`, and a pass over backend (`backend/app/`), frontend (`frontend/src/`), tests, `Makefile`, and `docs/patterns.md`.

---

## A. Executive summary

| Dimension | Rating (1–10) | One-line rationale |
|-----------|-----------------|----------------------|
| **Overall codebase health** | **7** | Clear layering and strong typing/tests for size; main risks are **no auth**, **very large UI root**, and a few **API/domain edge inconsistencies**. |
| **Complexity** | **6** | Backend services stay bounded (~160–330 lines each); **`App.tsx` ~1160 lines** and **`WorkspaceDialogs.tsx` ~676 lines** concentrate behaviour and drag complexity to the UI layer. |
| **Maintainability** | **6** | Good separation (routers → services → DB; React Query API modules). **God components** and **ticket-scoped test filenames** work against long-term navigation. |
| **API design** | **6** | Resource-oriented URLs and JSON bodies are mostly consistent; **verbs encoded in paths** (`/unarchive`, `/board-status`, `/status`) and **DELETE = archive** weaken predictability. |
| **Database design** | **7** | Small, coherent domain model (ventures → projects → tasks → time_logs); **SQLite**, **string “enums”**, and **`time_logs.project_id` denormalization** are fine for V1 but need discipline as features grow. |

---

## B. Top 10 most important issues

1. **No authentication or authorization**  
   - **Severity:** **High** (Critical if this is ever exposed beyond a trusted single-user / VPN context.)  
   - **Location:** `backend/app/main.py` (no auth middleware or dependencies on routes).  
   - **Issue:** Every API route is callable by anyone who can reach the server.  
   - **Why it matters:** Reliability and safety of a “production” deployment; any bug in the client or network path becomes full data access.  
   - **Suggested fix:** Add a single auth mechanism aligned with product (e.g. API key header, reverse-proxy auth, or session) and a FastAPI dependency used by all routers.  
   - **Effort:** Medium (design + dependency wiring); quick win only for a **minimal API key** behind nginx.

2. **`App.tsx` is a monolith (~1160 lines)**  
   - **Severity:** **High** (maintainability, developer speed, bug risk.)  
   - **Location:** `frontend/src/App.tsx`.  
   - **Issue:** Routing, drag-and-drop, sorting, mutations, and workspace state coexist in one module.  
   - **Why it matters:** Hard to review, easy to regress unrelated behaviour, slows onboarding and refactors.  
   - **Suggested fix:** Extract cohesive units already hinted at in the file (e.g. Kanban container hooks, task table controller, DnD wiring) into `hooks/` or `features/workspace/`.  
   - **Effort:** Deeper refactor (do in slices with tests).

3. **`DELETE` used for “archive” on projects and ventures**  
   - **Severity:** **High** (API clarity, client mistakes, future integrations.)  
   - **Location:** `backend/app/routers/projects.py`, `backend/app/routers/ventures.py`; mirrored in `frontend/src/api/projects.ts` and ventures API.  
   - **Issue:** HTTP DELETE does not remove rows; it changes `status` (and related fields).  
   - **Why it matters:** Caching layers, HTTP clients, and developers assume DELETE is destructive; easy to misuse and hard to document without caveats (you already flag this in `docs/api-map.md`).  
   - **Suggested fix:** Prefer `POST /projects/{id}/archive` or `PATCH` with explicit body; keep DELETE for true purge later or reserve it for hard delete only.  
   - **Effort:** Medium (version API or dual-route deprecation period).

4. **Inconsistent enforcement of “parent must be active” for tasks**  
   - **Severity:** **Medium** (bug risk.)  
   - **Location:** `backend/app/services/tasks.py` — `update_task` / `_ensure_task_project_is_active` vs `update_task_status` (no project/venture check).  
   - **Issue:** Some write paths block changes when the project is archived; the dedicated status endpoint does not repeat that check.  
   - **Why it matters:** Subtle state drift or inconsistent rules depending on which endpoint the UI uses.  
   - **Suggested fix:** Share a single guard (e.g. `_ensure_task_mutable(session, task)`) used by all mutating paths.  
   - **Effort:** Quick win once behaviour is agreed and covered by a test.

5. **Domain validation sometimes returns HTTP 422**  
   - **Severity:** **Medium** (API ergonomics, observability.)  
   - **Location:** e.g. `backend/app/services/projects.py` (`order` validation), `backend/app/services/tasks.py` (empty PATCH for time log), `venture_category_labels` / `activity_types` duplicate slug handling.  
   - **Issue:** 422 is overloaded: both Pydantic shape errors and business-rule failures.  
   - **Why it matters:** Harder to distinguish “bad JSON” from “rule violation” in clients and logs; some teams reserve 422 for validation only.  
   - **Suggested fix:** Use **409** for conflict, **400** for explicit rule violations where appropriate; keep 422 for schema validation only.  
   - **Effort:** Medium (client + contract updates).

6. **`time_logs.project_id` denormalized without a DB guarantee it matches `tasks.project_id`**  
   - **Severity:** **Medium** (data integrity as product grows.)  
   - **Location:** `backend/app/models/time_log.py`; creation in `backend/app/services/tasks.py` (`create_time_log`).  
   - **Issue:** Correct today because service copies `task.project_id`; future code paths or raw SQL could diverge.  
   - **Why it matters:** Reporting and joins can silently double-count or mis-attribute hours.  
   - **Suggested fix:** Long term: drop column and join through `task_id`; shorter term: add a test + optional DB CHECK (SQLite limited) or assert in service on update.  
   - **Effort:** Quick win = tests + comment; deeper = schema migration.

7. **No pagination or cursor on list endpoints**  
   - **Severity:** **Medium** (scalability, UI performance.)  
   - **Location:** All `GET` list routes in `backend/app/routers/*.py`.  
   - **Issue:** Full collections returned every time.  
   - **Why it matters:** As tasks/logs grow, latency and memory spike; frontend refetch cost rises.  
   - **Suggested fix:** Add `limit`/`cursor` (or venture-scoped paging) when data volume warrants it.  
   - **Effort:** Medium–large depending on UI.

8. **Duplicated “now” helpers across models and services**  
   - **Severity:** **Low** (DRY / consistency.)  
   - **Location:** `utc_now` / `_utc_now` in each of `backend/app/models/*.py` and multiple `backend/app/services/*.py`.  
   - **Issue:** Same trivial function repeated many times.  
   - **Why it matters:** Low immediate risk; slightly harder to change clock strategy (e.g. test doubles) consistently.  
   - **Suggested fix:** One `app/core/time.py` used by models and services.  
   - **Effort:** Quick win.

9. **Test file naming vs documented patterns**  
   - **Severity:** **Low** (developer speed, clarity.)  
   - **Location:** e.g. `frontend/src/App.1b4.test.tsx`, `phase-1-6-*.test.tsx`; `docs/patterns.md` explicitly discourages ticket-style test names.  
   - **Issue:** Hard to discover which test protects which behaviour after tickets close.  
   - **Why it matters:** Slows refactors and encourages duplicate coverage.  
   - **Suggested fix:** Rename incrementally to behaviour-based names when touching files (`patterns.md` examples).  
   - **Effort:** Quick win per file (tedious in bulk).

10. **`extractProjects` supports a paginated `{ items: [] }` shape the API does not return**  
   - **Severity:** **Low** (clarity / dead path.)  
   - **Location:** `frontend/src/api/projects.ts` (`extractProjects`).  
   - **Issue:** Extra branch for a payload format the backend does not produce (per current routers).  
   - **Why it matters:** Readers assume pagination exists or will appear; can hide type drift.  
   - **Suggested fix:** Remove branch or gate behind a feature flag when pagination ships.  
   - **Effort:** Quick win.

---

## C. REST API assessment

**Verdict: partially RESTful**

**Reasoning (with examples):**

- **Resource-oriented URLs:** Good — `/projects`, `/tasks/{id}/time-logs`, `/ventures`, `/activity-types` map cleanly to resources (`docs/api-map.md`).
- **HTTP verbs:** Mostly appropriate (`GET`/`POST`/`PATCH`), but **`DELETE` for archive** is the main REST semantic mismatch (projects, ventures).
- **Action-style routes:** `/projects/{id}/unarchive`, `/projects/{id}/board-status`, `/tasks/{id}/status`, `/activity-types/{id}/archive` encode **RPC-style actions** on resources. Common and workable, but not strict REST (which would often fold state into `PATCH` on the resource with a clear body).
- **Status codes:** Generally fine (`201` create, `204` no body). Using **`422` for non-schema business rules** blurs the usual REST/client contract (`services/projects.py`, `services/tasks.py`, etc.).
- **Filtering:** Query parameters on lists are consistent; **no pagination** — acceptable for a small personal app, less so for “at scale.”
- **Auth:** None — not a REST violation, but a **production API** gap for any multi-user or exposed deployment.

So: **good resource nouns**, **mixed verb model**, **DELETE semantics** and **status code semantics** pull the score down from “mostly RESTful.”

---

## D. Database assessment

**Verdict: workable but needs cleanup** (leaning **clean for current scope**, with known seams as features grow)

**Reasoning:**

- **Strengths:** Clear hierarchy (`venture_category_labels` → `ventures` → `projects` → `tasks` → `time_logs` + `activity_types`); documented in `docs/database-schema.md`; migrations chained in Alembic; soft archive via `status` is a practical product pattern.
- **Watch items:**  
  - **SQLite** — fine for self-hosted single user; concurrency and analytics at scale are the ceiling.  
  - **String columns** instead of DB enums — flexible but **no DB-level enum constraint**; invalid values possible if someone bypasses Pydantic.  
  - **`time_logs.project_id`** — denormalized convenience; integrity is **application-enforced** only.  
  - **Foreign keys on SQLite** — enforcement nuances (see “Unknown” in `docs/database-schema.md`); don’t rely on DB cascades: the code already implements some cascades (e.g. task delete + time logs in `services/tasks.py`).

For a **personal dashboard V1**, the schema is **practical**; for **many users / heavy time logging**, you’ll want **pagination**, **stricter integrity** (or fewer denormalized columns), and possibly **Postgres** — not because the design is “messy” today, but because **SQLite + denorm + no server-side auth** define the scaling and risk envelope.

---

## E. Refactor roadmap

### 1. Safe quick wins

- Centralize **`_utc_now` / `utc_now`** in one small module (`backend/app/core/time.py` or similar).  
- **Align task mutation guards** (`update_task_status` vs `update_task`) + one focused test in `backend/app/tests/test_tasks.py`.  
- Trim **`extractProjects`** dead branch or document it as “future pagination only” (`frontend/src/api/projects.ts`).  
- Add **CI** (e.g. GitHub Actions / GitLab) running `make lint` + `make test` — **no CI config was found** under `.github/`; today quality relies on developers running `Makefile` locally.

### 2. High-impact bug-risk reductions

- **Standardize HTTP codes** for business vs validation errors (reduce 422 overload).  
- Add **integration tests** for “archived project / venture” matrix on **all** task and time-log mutation entry points (not only the happy path).  
- Document or enforce **API versioning** if the frontend hardcodes `/api/v1/...` everywhere (`frontend/src/api/*.ts`) while the server prefix is configurable (`MOMENTUM_API_V1_PREFIX` / `api_v1_prefix` in `backend/app/core/config.py`) — mismatch would be painful to debug.

### 3. Medium refactors

- **Split `App.tsx` and `WorkspaceDialogs.tsx`** into feature hooks/components (biggest maintainability win for frontend).  
- Consider **replacing DELETE archive** with explicit archive routes (with deprecation window and test updates).  
- **Pagination** when list sizes become painful (tasks/time_logs first).

### 4. Larger architectural changes (only if needed)

- **Auth layer** aligned to deployment (reverse proxy vs app-level).  
- **Database engine migration** (e.g. Postgres) if multi-writer, reporting, or strict FK/cascade semantics become requirements — **not** justified purely by code smell today.

---

### What would strengthen this audit further

- **Runtime / ops:** How the app is deployed (TLS termination, auth at proxy, single-user assumption).  
- **Product roadmap:** Expected entity counts (tasks/day, retention) to stress-test pagination and SQLite.  
- **CI location:** If pipelines live only on GitLab or another host, those config paths were not in the workspace snapshot I searched (`.github` empty).

No rewrite is warranted: the stack matches the problem size; the highest ROI is **thinning the UI core**, **tightening API semantics**, and **auth when exposure grows** — not a greenfield replacement.