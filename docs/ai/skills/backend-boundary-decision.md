Name: backend-boundary-decision

Use when:
- deciding where backend logic should live,
- adding new business rules or orchestration,
- deciding route/controller vs service vs repository vs helper,
- noticing logic spread across layers.

Goal:
Place backend logic in the layer where it belongs so the code stays coherent, testable, and easy to extend.

Core rules:
- Keep routes/controllers thin and focused on transport concerns.
- Put business rules and multi-step workflows in services/use-case logic.
- Put database reads and writes in repositories or data-access modules.
- Use helpers only for reusable logic that is not itself domain orchestration.
- Do not smear logic across layers with unclear ownership.
- Do not introduce unnecessary service-layer ceremony for trivial one-step CRUD.

Checks:
- Is this HTTP/transport handling, business logic, data access, or pure utility logic?
- Will this logic be reused across routes or workflows?
- Does this layer now know too much about another layer?
- Is a new abstraction genuinely justified?

Output:
1. Recommended layer or boundary.
2. Why it belongs there.
3. Why alternatives are worse.
4. Whether a new abstraction is justified.
5. Which files or modules should change.