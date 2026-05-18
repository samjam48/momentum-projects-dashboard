Here is a practical technical audit based on `docs/database-schema.md`, `docs/api-map.md`, and a pass over backend (`backend/app/`), frontend (`frontend/src/`), tests, `Makefile`, and `docs/patterns.md`.

---

## A. Executive summary

| Dimension | Rating (1–10) | One-line rationale |
| --- | --- | --- |
| **Overall codebase health** | **7** | Clear layering and strong typing/tests for size; main risks are **no auth**, **very large UI root**, and a few **API/domain edge inconsistencies**. |
| **Complexity** | **6** | Backend services stay bounded (~160–330 lines each); **`App.tsx` \~1160 lines** and **`WorkspaceDialogs.tsx` \~676 lines** concentrate behaviour and drag complexity to the UI layer. |
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

2. **`App.tsx` is a monolith (\~1160 lines)**  
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


------



# Amendment — 2026-05-18 current-state follow-up

This amendment reassesses the codebase after the frontend refactor package in `docs/frontend-refactor-prd-trd.md` and the backend hardening refactor in `plans/PRD-backend-refactor-2026-05-18.md`, using the current `feat/backend-refactor` workspace snapshot.

### What changed since the original review

- **Frontend shell complexity improved materially.** `frontend/src/App.tsx` is now **5 lines** and delegates to `features/workspace/WorkspaceExperience.tsx` (**301 lines**) instead of acting as the application monolith.
- **A real component-library base now exists.** Shared primitives live under `frontend/src/components/ui/` (`Button`, `DialogFormFooter`, `ConfirmDialog`, `Select`, `FormField`) and shared board primitives live under `frontend/src/components/kanban/`.
- **Project and venture archive semantics were corrected.** Canonical archive routes are now `POST /projects/{id}/archive` and `POST /ventures/{id}/archive`; `DELETE` returns **405** guidance instead of silently acting like archive.
- **Backend invariants improved.** Shared task mutation guards, `time_logs.project_id` sync on task move, archive-on-task-delete, and `app/core/time.py` centralization are implemented.
- **Pagination groundwork now exists.** List endpoints can return `{ items, next_cursor }` when `limit` is provided, so the previous “dead branch” concern in frontend extractors is now resolved.


## A. Executive summary

| Dimension | Rating (1–10) | One-line rationale |
| --- | --- | --- |
| **Overall codebase health** | **8** | Both refactors closed several real correctness and maintainability gaps; the biggest remaining risks are **no auth**, **mixed frontend data patterns**, and a few **large UI surfaces**. |
| **Complexity** | **6** | Complexity is no longer trapped in `App.tsx`, but it has moved into feature controllers and large dialogs, especially **`TaskDialog.tsx` (\~933 lines)** and the test harness. |
| **Maintainability** | **7** | Folder boundaries are clearer (`features/`, `components/ui/`, `components/kanban/`), but reuse is still incomplete in dialogs, task/time-log flows, and test organization. |
| **API design** | **7** | Archive semantics are cleaner and pagination exists, but the API still mixes **resource routes** with **action-style endpoints** and keeps some **422** business-rule responses. |
| **Database design** | **7** | The schema is safer than before (`time_logs` archive semantics, task-delete handling, project sync), though integrity still relies heavily on application code over DB constraints. |

## B. Top 10 current issues
### 4. Larger architectural changes (only if needed)


1. **No authentication or authorization remains the highest-risk gap**  
  - **Severity:** **High** (Critical if the app is exposed outside a trusted private environment.)  
  - **Location:** `backend/app/main.py`, all routers.  
  - **Issue:** Every API route is still reachable without app-level auth.  
  - **Why it matters:** The refactors improved correctness, but they do not change the fact that network access still equals full data access.  
  - **Suggested fix:** Add one consistent auth boundary now, even if minimal (reverse-proxy auth or API key dependency).  
  - **Effort:** Medium.

2. **Frontend complexity is now concentrated in `TaskDialog.tsx` rather than eliminated**  
  - **Severity:** **High** (maintainability, reviewability, bug surface.)  
  - **Location:** `frontend/src/components/TaskDialog.tsx`.  
  - **Issue:** Task editing, inline autosave, archive flow, nested time-log CRUD, activity-type creation, and nested dialog state still live in one large component (~933 lines).  
  - **Why it matters:** The `App.tsx` split succeeded, but task workflows are still hard to reason about and expensive to change safely.  
  - **Suggested fix:** Split `TaskDialog` into focused presentational sections and move the time-log editor / time-log list / activity-type management behind smaller adapters in `features/tasks/`.  
  - **Effort:** Medium-large.

3. **Frontend data fetching is still split between two patterns**  
  - **Severity:** **Medium-High** (consistency, reload semantics, future pagination work.)  
  - **Location:** `frontend/src/api/projects.ts`, `ventures.ts` vs `tasks.ts`, `timeLogs.ts`.  
  - **Issue:** Projects and ventures use TanStack Query; tasks and time logs still use custom hooks with manual reload/invalidation.  
  - **Why it matters:** This duplicates state-management ideas, makes optimistic behaviour less uniform, and complicates later adoption of cursor pagination or shared cache logic.  
  - **Suggested fix:** Standardize on one query/mutation model, preferably by migrating tasks/time logs onto the same query abstraction already used for projects/ventures.  
  - **Effort:** Medium.

4. **The frontend still hardcodes `/api/v1` while the backend prefix is configurable**  
  - **Severity:** **Medium** (contract drift risk.)  
  - **Location:** `frontend/src/api/*.ts`; backend setting in `backend/app/core/config.py`.  
  - **Issue:** The server prefix is configurable via `MOMENTUM_API_V1_PREFIX`, but client modules still build literal `'/api/v1/...'` paths.  
  - **Why it matters:** This is now documented, but it is still easy to misconfigure and hard to debug.  
  - **Suggested fix:** Centralize API path construction in one frontend helper and make the prefix explicit there.  
  - **Effort:** Quick win.

5. **REST semantics improved, but action-style routes still dominate state transitions**  
  - **Severity:** **Medium** (API predictability, future integrations.)  
  - **Location:** `backend/app/routers/projects.py`, `tasks.py`, `ventures.py`, `activity_types.py`.  
  - **Issue:** Routes such as `/tasks/{id}/status`, `/projects/{id}/board-status`, `/projects/{id}/unarchive`, `/ventures/{id}/unarchive`, and `/activity-types/{id}/archive` still encode actions rather than treating state as resource fields.  
  - **Why it matters:** The worst DELETE/archive mismatch is fixed, but the API still reads partly like RPC.  
  - **Suggested fix:** For future cleanup, collapse more state transitions into `PATCH` on the resource with explicit body fields where practical.  
  - **Effort:** Medium-large because frontend contracts and tests would move with it.

6. **`422` is still used for some domain-rule failures, not just schema validation**  
  - **Severity:** **Medium** (client semantics, observability.)  
  - **Location:** `backend/app/services/projects.py`, `ventures.py`, `activity_types.py`, `venture_category_labels.py`, `tasks.py`.  
  - **Issue:** Business-rule paths such as reorder payload composition, `cursor requires limit`, punctuation-only slug names, and `category_label_id: null` still raise explicit **422** responses.  
  - **Why it matters:** The refactor reduced some ambiguity, but clients still cannot rely on `422` meaning “validation-layer only.”  
  - **Suggested fix:** Keep `422` for FastAPI/Pydantic validation, and move explicit service-level rule failures to `400` or `409` by policy.  
  - **Effort:** Medium.

7. **Pagination exists in the backend, but the frontend flattens it into arrays and drops cursor metadata**  
  - **Severity:** **Medium** (unfinished architecture, future rework.)  
  - **Location:** `frontend/src/api/projects.ts`, `ventures.ts`, `tasks.ts`.  
  - **Issue:** Extractors correctly accept `{ items }`, but they return plain arrays and discard `next_cursor`; query hooks also expose no pagination controls.  
  - **Why it matters:** The backend contract is ahead of the client, so the new pagination layer is not yet reusable from the frontend.  
  - **Suggested fix:** Introduce a shared frontend paginated response type and decide whether list hooks should expose cursor metadata or intentionally stay non-paginated until the UI needs it.  
  - **Effort:** Medium.

8. **The test suite is still heavily ticket-named and harder to navigate than it should be**  
  - **Severity:** **Low-Medium** (developer speed, maintenance.)  
  - **Location:** `frontend/src/*test*`, `backend/app/tests/*`.  
  - **Issue:** There are still many test files named after phases/tickets rather than behaviours; in the current frontend snapshot, **16 of 54** test files are `phase-*` named, with additional `App.1b*`-style files still present.  
  - **Why it matters:** The refactors improved production structure faster than test discoverability.  
  - **Suggested fix:** Rename tests opportunistically toward behaviour-based names when touching them, starting with the highest-churn integration files.  
  - **Effort:** Quick win per file; tedious in bulk.

9. **The frontend test harness is now a complexity hotspot of its own**  
  - **Severity:** **Low-Medium** (test maintenance cost.)  
  - **Location:** `frontend/src/test/workspaceBackendMock.ts` (~1316 lines), full-app integration tests.  
  - **Issue:** The main backend mock and full-app render path carry a lot of branching and fixture setup.  
  - **Why it matters:** As feature modules become cleaner, the tests risk becoming the new monolith that slows safe change.  
  - **Suggested fix:** Split mock builders by domain (`ventures`, `projects`, `tasks`, `archives`) and prefer smaller feature harnesses where full-app coverage is not needed.  
  - **Effort:** Medium.

10. **Database integrity is improved but still mostly application-enforced**  
  - **Severity:** **Low-Medium** (longer-term reporting and data safety.)  
  - **Location:** `backend/app/models/*.py`, `backend/app/services/tasks.py`, `backend/app/services/projects.py`.  
  - **Issue:** String “enums,” denormalized `time_logs.project_id`, and archive semantics still depend on service code and tests rather than strong DB constraints.  
  - **Why it matters:** This is acceptable for V1 SQLite, but it sets a ceiling on how confidently future reporting or multi-writer behaviour can evolve.  
  - **Suggested fix:** Keep documenting service invariants now; consider stronger DB constraints only if Phase 2+ reporting or multi-user behaviour increases the risk.  
  - **Effort:** Small now, larger later if enforced structurally.

## C. REST API assessment

**Verdict: more RESTful than before, but still only partially RESTful**

**Reasoning (with examples):**

- **Major improvement:** Projects and ventures no longer use `DELETE` as an archive alias. `POST /projects/{id}/archive` and `POST /ventures/{id}/archive` are now canonical, and `DELETE` returns **405** with guidance. This is a real semantic cleanup.
- **Resource nouns remain strong:** `/projects`, `/tasks/{id}/time-logs`, `/ventures`, `/activity-types`, and `/venture-category-labels` are still good resource-oriented shapes.
- **Action-style state endpoints still exist:** `/tasks/{id}/status`, `/projects/{id}/board-status`, `/projects/{id}/unarchive`, `/ventures/{id}/unarchive`, and `/activity-types/{id}/archive` still encode operations rather than treating state as part of the primary resource representation.
- **Status codes are cleaner but not fully normalized:** **409** is now used in important conflict cases, but some explicit service-level **422** responses remain for rule failures.
- **Pagination exists:** list routes now support `limit` + `cursor`, which is a meaningful step up from the original review.
- **Auth still absent:** not a REST violation by itself, but it keeps the API from being production-ready outside a trusted single-user deployment.

So the API has moved from “partially RESTful with one major semantic mismatch” to “partially RESTful with a cleaner archive model, but still a mixed resource/RPC contract.”

## D. Database assessment

**Verdict: cleaner and safer for current scope, but still application-driven**

**Reasoning:**

- **What improved:**  
  - Task delete semantics are clearer: deleting a task now archives child time logs and clears `task_id`, preserving work history.  
  - `time_logs.project_id` is now kept in sync on task project moves.  
  - `utc_now` centralization reduces timestamp drift across services/models.  
  - Alembic-backed schema evolution continues to be used correctly.
- **What still needs discipline:**  
  - **SQLite** remains fine for a self-hosted single-user V1, but still defines the concurrency and scale ceiling.  
  - **String status/type fields** are flexible, but still lack strong DB-level enum constraints.  
  - **`time_logs.project_id`** is safer than before, but still denormalized and service-enforced.  
  - **Archived log semantics** now rely on documented application rules (`status`, nullable `task_id`) rather than stronger relational enforcement.

For the current product scope, the schema is in a better place than it was in the original review. The remaining database concerns are not immediate rewrite triggers; they are mostly “know your ceiling” constraints around SQLite and application-enforced invariants.

## E. Refactor roadmap

### 1. Safe quick wins

- Centralize **frontend API path building** so `/api/v1` is not hardcoded across modules.
- Define a **shared paginated response type** on the frontend and stop silently dropping `next_cursor` when the backend returns it.
- Keep renaming **ticket-scoped tests** toward behaviour names when files are touched.
- Add **CI config** if this repo is still intended to rely on local `make lint` / `make test` only; no `.github` or `.gitlab` pipeline config was present in the workspace snapshot.

### 2. High-impact bug-risk reductions

- Add a single **auth boundary** appropriate to deployment.
- Unify **tasks/time logs** onto the same query/cache abstraction as projects and ventures.
- Finish the **HTTP status policy** cleanup so service-level business errors stop leaking as **422** where **400** or **409** are clearer.

### 3. Medium refactors

- Split **`TaskDialog.tsx`** into smaller feature slices, especially time-log editing and activity-type management.
- Thin **`ArchiveDialog.tsx`** further now that shared primitives (`ArchiveList`, `ConfirmDialog`, `Select`) exist.
- Revisit **remaining RPC-style endpoints** and decide which should stay explicit actions versus become `PATCH` on the resource.

### 4. Larger architectural changes (only if needed)

- Move toward **stronger DB guarantees** only if reporting and multi-writer requirements grow beyond current SQLite assumptions.
- Consider a **full query/data-layer standardization** if Phase 2 materially expands list volume, caching needs, or cross-screen invalidation complexity.
- **Auth layer** aligned to deployment (reverse proxy vs app-level).  
- **Database engine migration** (e.g. Postgres) if multi-writer, reporting, or strict FK/cascade semantics become requirements — **not** justified purely by code smell today.

---

### What would strengthen this audit further

- **Runtime / ops:** How the app is deployed (TLS termination, auth at proxy, single-user assumption).  
- **Product roadmap:** Expected entity counts (tasks/day, retention) to stress-test pagination and SQLite.  
- **CI location:** If pipelines live only on GitLab or another host, those config paths were not in the workspace snapshot I searched (`.github` empty).


The broad direction of both refactors is correct: the project is more modular, the backend contract is safer, and the next work should focus on **finishing reuse patterns** rather than starting over.

No rewrite is warranted: the stack matches the problem size; the highest ROI is **thinning the UI core**, **tightening API semantics**, and **auth when exposure grows** — not a greenfield replacement.

---
