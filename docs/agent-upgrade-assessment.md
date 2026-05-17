# Agent Upgrade Assessment

Assessment date: 2026-05-17

This review is based on the current working tree, including untracked AI-doc changes under `.claude/`, `.cursor/`, and `docs/ai/`.

## Executive summary

The repo already has the right raw ingredients:
- `AGENTS.md` is a strong repo-wide contract for scope, quality gates, and workflow.
- `docs/architecture.md` and `docs/patterns.md` provide useful project-specific judgment instead of generic style advice.
- `agents/` defines clear roles with explicit handoff points.
- `docs/ai/skills/` contains mostly good narrow decision aids rather than vague “best practices”.

The main problem is not lack of guidance. It is fragmented discovery plus a few real rule conflicts.

Current assessment:
- Coherence with project goals: good
- Human maintainability: medium
- AI-agent clarity: medium
- Portability across Codex, Claude, Cursor: medium-low
- Redundancy level: medium-high
- Production-safety support: medium

The best next move is to make `docs/ai/skills/` the canonical shared skill library, add a central index, reduce tool-specific files to thin adapters, and turn repeated workflow instructions into a small named hook set.

## Current state assessment

What is working well:
- `AGENTS.md` is the clearest single source of truth in the repo.
- `agents/README.md` explains the intended role split cleanly.
- The role prompts are practical and task-shaped rather than abstract.
- The skill topics are mostly the right ones for this codebase: schema, API, backend boundaries, component boundaries, state, data flow, monolith extraction, and test strategy.
- The Cursor and Claude schema files already point back to a canonical shared doc instead of fully forking the content.

What is risky or confusing:
- Skill discovery is uneven. Most agents mention only `schema-decision`; the rest of the skills are effectively invisible unless a human remembers them.
- The same policy lives in multiple places with slight variation: `AGENTS.md`, `CLAUDE.md`, `agents/*.md`, and tool-specific adapters.
- Some instructions conflict in ways that can block or misroute work.
- Skill metadata is inconsistent, which makes automation and cross-tool adapters harder.
- There is no central “before starting work” checklist tying repo rules, role prompts, and skills together.

## Agent instruction files

| File | Purpose / audience | Strengths | Weaknesses / conflicts | Recommendation |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | Repo-wide contract for all tools and humans | Strong scope rules, quality gates, workflow boundaries | Does not point to the shared skills library or a canonical AI docs index | Keep as the top-level source of truth. Add a short “AI guidance entrypoints” section linking `agents/README.md` and a future skills index. |
| `CLAUDE.md` | Claude entrypoint | Correctly defers to `AGENTS.md` | Too thin to help skill discovery; Claude-only file while Codex/Cursor rely on other paths | Keep it thin, but add one pointer to the shared skills index. Do not duplicate rules here. |
| `agents/README.md` | Human-readable map of the role system | Clear overview of the pipeline and role purposes | Does not map roles to the skills they are expected to consult | Add a compact role-to-skill matrix. |
| `agents/orchestrator.md` | Sequential controller for major feature work | Clear gated workflow and escalation paths | Conflicts with `AGENTS.md`: it says commit per ticket and avoid running quality gates during the ticket loop, while `AGENTS.md` says no commit without passing tests and to run `make test` first | Resolve the commit/test policy. Either require ticket-level verification before commit, or move “commit after each ticket” to “commit after passing required gates”. |
| `agents/architect.md` | Phase/feature shaping | Good emphasis on approval gates, reuse vs new structure, and owner questions | Self-conflict: it says stop immediately if schema or API contract changes are required, even though this role exists to shape approved schema/API changes. Minor quality issues: duplicate numbering, typo (`phase-sepcific`) | Keep the role, but change the stop rule to “stop for unapproved implementation, not for planning”. |
| `agents/planner.md` | Convert approved feature plan into tickets | Good dependency-order and acceptance-criteria guidance | Mentions only `schema-decision`; no test-strategy or API skill awareness. “Create a branch and commit” sits awkwardly in a planning role | Keep, but remove branch/commit responsibility unless explicitly intended. Add links to relevant decision skills by trigger. |
| `agents/test-writer.md` | TDD test-authoring role | Strong failing-test definition and verification expectations | Two jobs are merged: ticket-driven failing test authoring, and post-implementation verification/reliability review. This blurs TDD vs QA/review. | Split or trim. Keep this file focused on failing tests from acceptance criteria. Move the appended “risks / manual verification / reliability” block into reviewer guidance or a separate QA-checklist doc. |
| `agents/implementer.md` | Production-code role | Good scope discipline, UI-copy warning, and architecture references | “Do not open test source files” is too restrictive for TDD debugging. There is a dangling blank bullet under Skills and a typo (`appoved`). Only `schema-decision` is named despite other relevant skills existing. | Allow reading nearby tests when needed to understand the contract. Clean up the prompt and add skill triggers for API, state, component, and backend-boundary decisions. |
| `agents/reviewer.md` | Non-author review role | Clear focus on diff-based review and concrete findings | Mentions only `schema-decision`, even though API, boundary, state, and component skills are also relevant review tools | Keep, but broaden the skill triggers and add explicit doc-sync checks for `docs/api-map.md` and `docs/database-schema.md`. |
| `agents/pr-checker.md` | Final quality-gate runner | Clear, simple, and appropriately narrow | Duplicates the backend/frontend gate list from `AGENTS.md` | Keep the behavior, but treat `AGENTS.md` as canonical and reference it instead of maintaining a second full copy of the gate list. |

## Skill assessment

The shared skill docs are conceptually strong. The main issues are inconsistent metadata, uneven discoverability, and one real architecture conflict.

| Skill | Intended use | Assessment | Overlap / portability risk | Recommendation |
| --- | --- | --- | --- | --- |
| `docs/ai/skills/schema-decision.md` | Persisted data shape choices | Strongest skill in the set. Has frontmatter and clear output expectations. | Also exists as `.claude/skills/schema-decision/SKILL.md` and `.cursor/rules/schema-decision.mdc`, which must now be kept in sync by hand. | Keep as the canonical skill. Make adapters thinner or generate them from shared metadata. |
| `docs/ai/skills/api-contract-decision.md` | Endpoint and contract decisions | Useful and specific | Metadata format differs from `schema-decision`; no tool adapters yet | Keep. Add standard frontmatter and wire into Architect, Planner, Implementer, and Reviewer. |
| `docs/ai/skills/backend-boundary-decision.md` | Backend layer placement | Useful topic | Conflicts with `AGENTS.md` hard rule 4: the skill suggests repositories/data-access modules, while repo rules say logic and DB access belong in `services/` | Rewrite to match the actual project architecture unless the repo is deliberately adopting repositories. |
| `docs/ai/skills/component-boundary-decision.md` | UI reuse/extraction decisions | Clear and practical | Slight overlap with monolith extraction, but still distinct | Keep. Add standard frontmatter and explicit trigger phrases. |
| `docs/ai/skills/frontend-state-decision.md` | State ownership decisions | Good, narrow, useful | Overlaps mildly with data-flow skill; boundary is still understandable | Keep. Cross-link with `frontend-data-flow-check`. |
| `docs/ai/skills/frontend-data-flow-check.md` | Server-state transformation and duplication checks | Good for React Query style work | Overlap with state skill is manageable, but triggers should be sharper | Keep. Add “use when reshaping server data or duplicating API state” language in metadata. |
| `docs/ai/skills/monolith-component-abstraction.md` | Large-component extraction | Valuable for this repo, especially given the prior code review on large UI files | Name mismatch: filename says `monolith-component-abstraction`, content says `monolith-component-extraction`. Could be confused with `component-boundary-decision`. | Keep the idea, but rename for consistency, for example `large-component-refactor.md`, and make it explicitly a workflow skill that composes the others. |
| `docs/ai/skills/test-strategy-decision.md` | Test-scope and test-layer decisions | Strong and portable | Not referenced by the role most likely to need it: `agents/test-writer.md` | Keep and wire it into Test Writer, Implementer, and Reviewer. |

## Tool-specific adapters and portability

Current state:
- `.claude/skills/schema-decision/SKILL.md` is a thin Claude adapter that points back to `docs/ai/skills/schema-decision.md`.
- `.cursor/rules/schema-decision.mdc` is a thin Cursor rule pointing back to the same canonical file.
- There is no equivalent repo-native Codex adapter file.
- There are no adapters for the other seven skills.

Assessment:
- This is the right pattern directionally: shared canonical content plus thin tool adapters.
- It is incomplete and inconsistent today.
- Portability is currently document-level, not system-level. A human can reuse the skill library across tools, but the tools are not reliably guided to the same skills.

## Agent awareness of skills

Current behavior:
- `AGENTS.md` and `CLAUDE.md` do not tell agents that `docs/ai/skills/` exists.
- `agents/README.md` does not serve as a skill catalog.
- Most role prompts mention only `schema-decision`.
- There is no central inventory, no trigger metadata contract, and no environment-neutral routing checklist.

Recommended model:

### 1. Create a canonical skills index

Suggested file:
- `docs/ai/skills/index.md`

Suggested fields per skill entry:
- Skill name
- One-line purpose
- Trigger phrases
- Roles that should use it
- Required supporting docs
- Approval-sensitive areas
- Tool adapters that exist

This should be the first file that tool-specific entrypoints reference.

### 2. Standardize skill frontmatter

Recommended frontmatter shape:

```yaml
---
name: api-contract-decision
summary: Decide whether to extend an existing API contract or create a new one.
triggers:
  - add endpoint
  - change request shape
  - change response shape
roles:
  - architect
  - planner
  - implementer
  - reviewer
read_first:
  - AGENTS.md
  - docs/architecture.md
  - docs/api-map.md
approval_required_if:
  - API contract changes
related_skills:
  - backend-boundary-decision
  - schema-decision
canonical: true
---
```

Use the same structure for every skill. Right now only `schema-decision` is close to this.

### 3. Add a lightweight start-work checklist

Recommended checklist for any non-trivial task:
1. Read `AGENTS.md`.
2. Identify whether the task is planning, implementation, testing, review, or verification.
3. Open the relevant role prompt from `agents/` if using the role workflow.
4. Check `docs/ai/skills/index.md` for matching decision skills.
5. Read only the project docs needed for the affected area.

### 4. Keep tool-specific files as adapters, not duplicated sources

Recommended strategy:
- `AGENTS.md`: canonical repo policy
- `agents/*.md`: canonical role prompts
- `docs/ai/skills/*.md`: canonical skill bodies
- `CLAUDE.md`, `.claude/skills/*`, `.cursor/rules/*`: thin adapters only
- Future Codex-specific repo file, if added: thin adapter only

## Recommended hooks and rules

These do not need to be heavyweight automation first. A named rule set is enough, and later it can be mapped to Cursor rules, Claude skills, or CI checks.

| Name | Purpose | Suggested trigger | Required checks | Scope / tools |
| --- | --- | --- | --- | --- |
| `start-work-context` | Ensure agents start from repo rules and the right docs | Before any non-trivial task | Read `AGENTS.md`, locate role prompt if applicable, check skills index, identify impacted docs/tests | Global |
| `schema-change-check` | Prevent ad hoc data-model changes | Before editing models, migrations, persisted DTOs, or schema-related services | Use `schema-decision`, confirm approval status, update migration + docs + tests list | Global, plus Cursor/Claude adapters |
| `api-contract-check` | Keep API changes coherent | Before adding/changing endpoints, params, request/response shapes | Use `api-contract-decision`, confirm whether `docs/api-map.md` must change, confirm approval need | Global, plus Cursor/Claude adapters |
| `backend-boundary-check` | Keep routers/services responsibilities clean | Before adding business rules or new backend modules | Confirm logic lives in `services/`, not routers; verify no accidental repository pattern drift | Global |
| `frontend-boundary-check` | Avoid state/component/data-flow sprawl | Before introducing shared state, extracting components, or reshaping server data | Use `frontend-state-decision`, `frontend-data-flow-check`, or `component-boundary-decision` as appropriate | Global |
| `test-strategy-check` | Match verification strength to risk | Before writing tests and before implementation of behavior changes | Use `test-strategy-decision`; identify lowest effective layer and remaining manual checks | Global |
| `docs-sync-check` | Keep architecture/API/schema docs accurate | After approved code changes affecting those areas | Update `docs/api-map.md`, `docs/database-schema.md`, and `docs/architecture.md` when their source-of-truth area changed | Global |
| `pre-commit-verification` | Resolve commit-quality ambiguity | Before any commit | Enforce the relevant test and gate policy from `AGENTS.md`; define clearly whether ticket commits require full or scoped verification | Global, likely backed by automation later |
| `critical-area-escalation` | Slow down risky changes | When touching auth, billing, permissions, database schema, migrations, or production-critical flows | Require explicit owner confirmation and non-author review | Global |

## Redundancy and consolidation

Recommended single sources of truth:
- Repo workflow, scope, and quality gates: `AGENTS.md`
- Role workflows: `agents/*.md`
- Cross-cutting architecture and product-writing rules: `docs/architecture.md`, `docs/patterns.md`
- Shared decision skills: `docs/ai/skills/*.md`
- Tool integration glue: `CLAUDE.md`, `.claude/skills/*`, `.cursor/rules/*`

What should be linked rather than duplicated:
- Quality gate command lists
- Skill bodies
- Repeated “read first” lists when a role can say “read `AGENTS.md` and the relevant skill/index”
- Approval rules for schema/API changes

What should be merged, renamed, or split:
- Split the appended QA-style section out of `agents/test-writer.md`
- Rename `docs/ai/skills/monolith-component-abstraction.md` or align its internal name
- Normalize all skills to one frontmatter format
- Convert `.claude/skills/schema-decision/SKILL.md` and `.cursor/rules/schema-decision.mdc` into minimal wrappers if they are going to remain hand-maintained

## Recommended target structure

```text
AGENTS.md
CLAUDE.md
agents/
  README.md
  orchestrator.md
  architect.md
  planner.md
  test-writer.md
  implementer.md
  reviewer.md
  pr-checker.md
docs/
  architecture.md
  patterns.md
  api-map.md
  database-schema.md
  ai/
    README.md
    skills/
      index.md
      api-contract-decision.md
      backend-boundary-decision.md
      component-boundary-decision.md
      frontend-data-flow-check.md
      frontend-state-decision.md
      large-component-refactor.md
      schema-decision.md
      test-strategy-decision.md
.claude/
  skills/
    <thin adapters only>
.cursor/
  rules/
    <thin adapters only>
```

## Recommended agent instruction strategy by environment

### Codex
- Use `AGENTS.md` plus the shared docs as the repo-native source.
- If a Codex-specific repo file is added later, keep it as a pointer file only.
- Do not fork skill content into a Codex-only directory unless the tool absolutely requires it.

### Claude
- Keep `CLAUDE.md` short.
- Point it to `AGENTS.md`, `agents/README.md`, and `docs/ai/skills/index.md`.
- Keep `.claude/skills/*` as thin shims pointing to canonical shared docs.

### Cursor
- Use `.cursor/rules/*.mdc` only for trigger wrappers and high-value hooks.
- Keep the real content in `docs/ai/skills/*.md`.
- Avoid embedding full skill bodies into `.mdc` files.

## Prioritized action plan

### Quick wins
- Add `docs/ai/skills/index.md`.
- Standardize frontmatter across every skill.
- Fix the explicit conflicts in `agents/orchestrator.md`, `agents/architect.md`, `agents/implementer.md`, and `agents/test-writer.md`.
- Add one pointer from `AGENTS.md` and `CLAUDE.md` to the shared skills index.

### Medium-effort improvements
- Add role-to-skill mapping in `agents/README.md`.
- Broaden role prompts so they reference the right skills by trigger, not just `schema-decision`.
- Normalize tool-specific adapters for at least the highest-value shared skills.
- Add a `docs/ai/README.md` that explains the relationship between repo rules, roles, skills, and adapters.

### Larger structural improvements
- Generate tool-specific adapters from shared skill metadata instead of hand-maintaining them.
- Add lightweight automation for `pre-commit-verification` and doc-sync checks.
- Revisit whether the orchestrator model should be tool-neutral or split into “portable process” and “tool-specific delegation mechanics”.

## File-by-file recommendations

- `AGENTS.md`: keep as canonical repo policy; add links to AI entrypoints.
- `CLAUDE.md`: keep short; add shared skills index reference.
- `agents/README.md`: add role-to-skill routing table.
- `agents/orchestrator.md`: fix commit/test conflict with `AGENTS.md`.
- `agents/architect.md`: remove the schema/API planning dead-end; fix minor quality issues.
- `agents/planner.md`: remove or clarify branch/commit ownership; add more skill triggers.
- `agents/test-writer.md`: narrow to failing-test work; move review-style reliability guidance elsewhere.
- `agents/implementer.md`: allow test-source reading when needed; clean up typos and dangling bullet; add more skill triggers.
- `agents/reviewer.md`: add API, backend-boundary, component, state, and test-strategy skill triggers.
- `agents/pr-checker.md`: reference `AGENTS.md` for gate definitions instead of duplicating the full list.
- `docs/ai/skills/backend-boundary-decision.md`: align with the repo’s services-first backend architecture.
- `docs/ai/skills/monolith-component-abstraction.md`: rename or align internal name and make it explicitly compositional.
- `.claude/skills/schema-decision/SKILL.md`: keep only as adapter text pointing to the canonical skill.
- `.cursor/rules/schema-decision.mdc`: keep only as adapter text pointing to the canonical skill.

## Suggested new files

- `docs/ai/README.md`
- `docs/ai/skills/index.md`

Optional later:
- `docs/ai/hooks.md` or `docs/ai/rules.md`

## Files reviewed

- `AGENTS.md`
- `CLAUDE.md`
- `agents/README.md`
- `agents/orchestrator.md`
- `agents/architect.md`
- `agents/planner.md`
- `agents/test-writer.md`
- `agents/implementer.md`
- `agents/reviewer.md`
- `agents/pr-checker.md`
- `docs/architecture.md`
- `docs/patterns.md`
- `docs/code-review-16-05.md`
- `docs/ai/skills/api-contract-decision.md`
- `docs/ai/skills/backend-boundary-decision.md`
- `docs/ai/skills/component-boundary-decision.md`
- `docs/ai/skills/frontend-data-flow-check.md`
- `docs/ai/skills/frontend-state-decision.md`
- `docs/ai/skills/monolith-component-abstraction.md`
- `docs/ai/skills/schema-decision.md`
- `docs/ai/skills/test-strategy-decision.md`
- `.claude/skills/schema-decision/SKILL.md`
- `.cursor/rules/schema-decision.mdc`

## Short summary

Main findings:
- The repo already has strong shared guidance, but discovery and routing are fragmented.
- The biggest practical issues are a small number of instruction conflicts and the lack of a canonical skills index.
- The shared skills are worth keeping, but only if they become more consistent and more visible to the role prompts and tool adapters.

Recommended next steps:
1. Add a shared skills index.
2. Resolve the workflow conflicts in the role prompts.
3. Standardize skill metadata and convert tool-specific files into thin adapters.
4. Add a small named hook set for start-work, schema/API checks, docs sync, and pre-commit verification.

Areas needing human review:
- Whether ticket-by-ticket commits are still required once commit verification is tightened.
- Whether the repo actually wants a repository/data-access layer, or wants `services/` to remain the only backend boundary.
- Whether the appended QA-style section in `agents/test-writer.md` reflects intentional workflow design or an accidental prompt merge.
