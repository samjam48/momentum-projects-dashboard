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
 * FR-9 (Test Writer): extraction guards for board Tasks/Projects tab and project-type filter
 * state lifted out of `App.tsx`.
 */
describe('FR-9 board view tab extraction (repo integration)', () => {
  it('adds features/workspace/useBoardViewTab.ts for board tab + project type filter state', () => {
    const absolutePath = resolve(process.cwd(), 'src/features/workspace/useBoardViewTab.ts')
    expect(
      existsSync(absolutePath),
      'FR-9 should introduce src/features/workspace/useBoardViewTab.ts before wiring completes.',
    ).toBe(true)
  })

  it('exports a hook that owns Tasks vs Projects tab state and the project kanban type filter', () => {
    const hookSource = readRequiredSource(
      'src/features/workspace/useBoardViewTab.ts',
      'the FR-9 board view tab hook',
    )

    expect(hookSource).toMatch(/export\s+(function|const)\s+useBoardViewTab\b/)
    expect(hookSource).toMatch(/\bboardViewTab\b/)
    expect(hookSource).toMatch(/\bprojectKanbanTypeFilter\b/)
    expect(hookSource).toMatch(/\b(ProjectType|'projects'|'tasks'|'all')\b/)
  })

  it('wires the App composer through useBoardViewTab', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    expect(/\bfrom\s+['"].*\/workspace\/useBoardViewTab['"]/.test(appSource)).toBe(true)
  })

  it('stops declaring board tab and project type filter state inline in App.tsx', () => {
    const appSource = readRequiredSource('src/App.tsx', 'App composer')

    expect(appSource).not.toMatch(
      /\[\s*boardViewTab\s*,\s*setBoardViewTab\s*\]\s*=\s*useState\s*<\s*'projects'\s*\|\s*'tasks'\s*>/,
    )
    expect(appSource).not.toMatch(
      /\[projectKanbanTypeFilter\s*,\s*setProjectKanbanTypeFilter\]\s*=\s*useState/s,
    )
  })
})
