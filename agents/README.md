# Agent Prompts

Project-specific agent prompts live in this directory.

Start with `AGENTS.md` for repo-wide rules.

For a **major feature or full phase build**, use `orchestrator.md` as the single entry point. It delegates to the specialized agents below one at a time and does not parallelize work.

Specialized agents (invoked by the orchestrator, not run in parallel):

- `orchestrator.md` controls gated, sequential flow across a phase or ticket pipeline.
- `architect.md` shapes feature requests into PRD, TRD, and ADR outputs.
- `planner.md` turns an approved phase or feature into implementation tickets.
- `test-writer.md` turns approved ticket acceptance criteria into failing tests only.
- `implementer.md` writes the minimum production changes needed to satisfy failing tests.
- `reviewer.md` reviews the branch diff for code quality, architecture, and convention issues.
- `pr-checker.md` runs the full quality gate sequence and reports pass or fail without fixing.
