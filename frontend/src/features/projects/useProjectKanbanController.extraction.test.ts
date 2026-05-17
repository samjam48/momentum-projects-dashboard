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
 * FR-8 (Test Writer): failing guard tests until project kanban orchestration moves out of App.tsx
 * into `useProjectKanbanController` (optional `ProjectBoardView` composer).
 */
describe('FR-8 project board controller extraction (repo integration)', () => {
  it('adds features/projects/useProjectKanbanController.ts as the home for project kanban orchestration', () => {
    const absolutePath = resolve(process.cwd(), 'src/features/projects/useProjectKanbanController.ts')
    expect(
      existsSync(absolutePath),
      'FR-8 should introduce src/features/projects/useProjectKanbanController.ts before wiring completes.',
    ).toBe(true)
  })

  it('exports a hook that owns the project-kanban:drop test-hook listener for project board drops', () => {
    const controllerSource = readRequiredSource(
      'src/features/projects/useProjectKanbanController.ts',
      'the FR-8 project kanban controller hook',
    )

    expect(controllerSource).toMatch(/export\s+(function|const)\s+useProjectKanbanController\b/)
    expect(controllerSource).toMatch(/\bproject-kanban:drop\b/)
    expect(controllerSource).toMatch(/\baddEventListener\b/)
    expect(controllerSource).toMatch(/\bremoveEventListener\b/)
  })

  it('stops registering project-kanban:drop directly from App.tsx once the controller exists', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    expect(appSource).not.toMatch(/addEventListener\(\s*['"]project-kanban:drop['"]/)
    expect(appSource).not.toMatch(/removeEventListener\(\s*['"]project-kanban:drop['"]/)
  })

  it('wires the workspace composer through the feature controller (hook or ProjectBoardView)', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    const importsController = /from\s+['"]\.\/features\/projects\/useProjectKanbanController['"]/.test(
      appSource,
    )
    const importsBoardView = /from\s+['"]\.\/features\/projects\/ProjectBoardView['"]/.test(appSource)

    expect(
      importsController || importsBoardView,
      'App should import useProjectKanbanController or an optional ProjectBoardView from features/projects.',
    ).toBe(true)

    if (importsBoardView) {
      const boardViewPath = resolve(process.cwd(), 'src/features/projects/ProjectBoardView.tsx')
      expect(
        existsSync(boardViewPath),
        'ProjectBoardView.tsx should exist when App imports it.',
      ).toBe(true)

      const boardViewSource = readFileSync(boardViewPath, 'utf8')
      expect(
        boardViewSource.includes('useProjectKanbanController'),
        'ProjectBoardView should delegate board orchestration to useProjectKanbanController.',
      ).toBe(true)
    }
  })
})
