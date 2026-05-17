import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readRequiredSource(relativePath: string, description: string): string {
  const absolutePath = resolve(process.cwd(), relativePath)

  expect(
    existsSync(absolutePath),
    `Expected ${description} at ${absolutePath}, but it does not exist yet.`,
  ).toBe(true)

  return readFileSync(absolutePath, 'utf8')
}

/**
 * FR-7 (Test Writer): failing guard tests until task kanban orchestration moves out of App.tsx
 * into `useTaskKanbanController` (optional `TaskBoardView` composer).
 */
describe('FR-7 task board controller extraction (repo integration)', () => {
  it('adds features/tasks/useTaskKanbanController.ts as the home for task kanban orchestration', () => {
    const absolutePath = resolve(process.cwd(), 'src/features/tasks/useTaskKanbanController.ts')
    expect(
      existsSync(absolutePath),
      'FR-7 should introduce src/features/tasks/useTaskKanbanController.ts before wiring completes.',
    ).toBe(true)
  })

  it('exports a hook that owns the kanban:drop test-hook listener for task status drops', () => {
    const controllerSource = readRequiredSource(
      'src/features/tasks/useTaskKanbanController.ts',
      'the FR-7 task kanban controller hook',
    )

    expect(controllerSource).toMatch(/export\s+(function|const)\s+useTaskKanbanController\b/)
    expect(controllerSource).toMatch(/\bkanban:drop\b/)
    expect(controllerSource).toMatch(/\baddEventListener\b/)
    expect(controllerSource).toMatch(/\bremoveEventListener\b/)
  })

  it('stops registering kanban:drop directly from App.tsx once the controller exists', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    expect(appSource).not.toMatch(/addEventListener\(\s*['"]kanban:drop['"]/)
    expect(appSource).not.toMatch(/removeEventListener\(\s*['"]kanban:drop['"]/)
  })

  it('wires the workspace composer through the feature controller (hook or TaskBoardView)', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    const importsController = /from\s+['"]\.\/features\/tasks\/useTaskKanbanController['"]/.test(
      appSource,
    )
    const importsBoardView = /from\s+['"]\.\/features\/tasks\/TaskBoardView['"]/.test(appSource)

    expect(
      importsController || importsBoardView,
      'App should import useTaskKanbanController or an optional TaskBoardView from features/tasks.',
    ).toBe(true)

    if (importsBoardView) {
      const boardViewPath = resolve(process.cwd(), 'src/features/tasks/TaskBoardView.tsx')
      expect(
        existsSync(boardViewPath),
        'TaskBoardView.tsx should exist when App imports it.',
      ).toBe(true)

      const boardViewSource = readFileSync(boardViewPath, 'utf8')
      expect(
        boardViewSource.includes('useTaskKanbanController'),
        'TaskBoardView should delegate kanban orchestration to useTaskKanbanController.',
      ).toBe(true)
    }
  })
})
