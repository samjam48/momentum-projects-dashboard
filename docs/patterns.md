# Implementation Patterns

Cross-cutting conventions for agents and contributors. Read alongside `docs/V1-TRD.md`.

---

## UI copy

User-visible text must read like product UI, not agent or developer commentary.

**Do:**
- Name fields and actions plainly: `Time logs`, `Archive`, `Showing 3 projects`
- Use empty states that tell the user what to do next
- Keep dialog titles short and specific to the entity: `Podcast landing page` (task name as heading), not `Edit task`

**Do not:**
- Reference implementation: “backend-derived”, “API”, “workspace”, “Phase 1”, sprint/ticket IDs
- Explain system behaviour where a label suffices: prefer `Time logs` over “Manual entries refresh task totals after save”
- Use placeholder subtitles that sound like PR notes: “Create a task in the Phase 1 workspace”, “Update details and capture manual time logs”
- Duplicate section headers that add no information: drop `Task detail` when the fields below are self-explanatory

When adding or editing strings in `frontend/`, ask: *Would a user who never saw the codebase expect this on a shipping product?* If not, rewrite or remove.

## Naming conventions

Test file = component/feature/behavior being tested
Test case = expected user-observable behavior
Ticket ID = branch, commit, PR, changelog, or test annotation/comment only when valuable

Avoid
```
App.1b4.test.tsx
it('APP-1B4 works')
```

Prefer

```
App.auth-redirect.test.tsx
it('redirects signed-out users to the login page')
```


## Relational modelling bias
We use Postgres as a relational system, not a document store.

Default to separate tables for repeated business records.
Examples: interviews, applications, payments, comments, status changes, assignments.

Use JSON/arrays only for:
- rarely queried metadata,
- raw external payloads,
- experimental fields,
- configuration blobs retrieved as one unit.

A child record should become its own table when it has:
- more than one occurrence per parent,
- its own date/status/notes/owner fields,
- independent filtering or sorting needs,
- links to other entities,
- reporting or analytics value,
- an independent edit lifecycle.

Do not avoid a new table merely to reduce migration work.
Do not add a new table merely because a field group looks large.
Choose based on query patterns and lifecycle.