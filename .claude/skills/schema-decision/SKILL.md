---
name: schema-decision
description: Use when adding or changing persisted data structures, especially when deciding between a column, child table, join table, or JSON/JSONB.
---

# Schema Decision

Use this skill before proposing or implementing non-trivial schema changes.

Canonical reference:
[docs/ai/skills/schema-decision.md](../../../docs/ai/skills/schema-decision.md)

Core rule:
Choose structure based on query patterns, lifecycle, constraints, and relationships.
Do not default toward either "always add a new table" or "always extend the existing one".

Apply this when:
- adding persisted fields,
- deciding between table vs JSON/JSONB,
- deciding whether repeated child data belongs in a child table,
- deciding whether a many-to-many relationship needs a join table.

Minimum output:
1. Recommended structure.
2. Why it fits query and lifecycle needs.
3. Why the main alternatives are worse.
4. Whether approval is required.
5. Which files must change.