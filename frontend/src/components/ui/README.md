# Shared UI primitives (`components/ui`)

Tailwind + CVA (`class-variance-authority`), using CSS variables from `styles/tokens.css`. Feature surfaces (kanban, archive lists, workspace chrome) stay on semantic classes in `styles/base.css` unless a refactor ticket explicitly migrates them.

## Conventions

- **`Button`** — Prefer typed variants: `default`, `secondary`, `outline`, `destructive`, `ghost`. Use **`destructive`** for delete/archive-in-dialog where product copy calls for strong emphasis (replaces legacy `.danger-button`).
- **`Dialog` + `DialogFormFooter`** — Destructive actions (Archive/Delete) stay **outside** the Save/Cancel pair (**Pattern A**); see `DialogFormFooter` prop docs.
- **`Select` / `FormField`** — Wrap native selects and labels; pass `error` / `hint` for consistent field chrome.
- **`ConfirmDialog`** — Shared confirm/cancel/pending UX for restore and similar flows.

Icon-only controls must keep an explicit **`aria-label`**.

For full product context and boundaries, see `docs/frontend-refactor-prd-trd.md`.
