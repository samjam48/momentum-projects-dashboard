import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const taskKanbanControllerPath = resolve(
  __dirname,
  './features/tasks/useTaskKanbanController.ts',
)

describe('App — Chore 1.6-C1 optimistic reset (no synchronous render-phase state sync)', () => {
  it('does not compare filter/task refs with inequality in render (reset lives in effects)', () => {
    const appSourcePath = resolve(__dirname, './App.tsx')
    const appSource = readFileSync(appSourcePath, 'utf8')
    expect(appSource).not.toContain('previousFilterKeyRef.current !== storedProjectIdsKey')
    expect(appSource).not.toContain('previousTasksDataRef.current !== tasksQuery.data')
  })

  it('does not call optimistic Kanban setters synchronously alongside filter/task ref syncing in render', () => {
    const controllerSource = readFileSync(taskKanbanControllerPath, 'utf8')
    const lines = controllerSource.split(/\r?\n/)

    assertNoAdjacentRenderSync(lines, 'const displayTasks = optimisticTasks ?? visibleTasks', [
      'setOptimisticTasks(null)',
      'setKanbanMutationError(null)',
    ])
  })
})

/** Guard for Chore 1.6-C1 §3: reset must happen in effects, not next to Kanban task derivation in render. */
function assertNoAdjacentRenderSync(
  lines: string[],
  anchor: string,
  forbidden: string[],
): void {
  const anchorIndex = lines.findIndex((line) => line.includes(anchor))

  expect(
    anchorIndex,
    `Anchor line not found (${anchor}); adjust guard if task kanban controller moved: expected in useTaskKanbanController.ts`,
  ).toBeGreaterThanOrEqual(0)

  const windowText = lines.slice(anchorIndex, anchorIndex + 18).join('\n')
  for (const needle of forbidden) {
    expect(
      windowText,
      `${needle} must not run next to "${anchor.trim()}" in render (move to useEffect / useLayoutEffect).`,
    ).not.toContain(needle)
  }
}
