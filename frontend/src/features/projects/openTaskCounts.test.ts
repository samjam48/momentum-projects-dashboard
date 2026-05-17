import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Project, Task } from '../../api/types'
import { buildProject, buildTask } from '../../test/fixtures'
import { readWorkspaceComposerSource } from '../../test/readWorkspaceComposerSource'

type OpenTaskCountsModule = {
  deriveOpenTaskCountsByProjectId: (
    projects: Project[],
    tasks: Task[],
  ) => Record<string, number>
}

const OPEN_TASK_COUNTS_MODULE_PATH = resolve(
  process.cwd(),
  'src/features/projects/openTaskCounts.ts',
)

function requireSource(filePath: string, description: string): string {

  expect(
    existsSync(filePath),
    `Expected ${description} at ${filePath}, but it does not exist yet.`,
  ).toBe(true)

  return readFileSync(filePath, 'utf8')
}

async function loadOpenTaskCountsModule(): Promise<OpenTaskCountsModule> {
  requireSource(
    OPEN_TASK_COUNTS_MODULE_PATH,
    'the extracted project open-task-count helper for FR-2',
  )

  return (await import(
    pathToFileURL(OPEN_TASK_COUNTS_MODULE_PATH).href
  )) as OpenTaskCountsModule
}

describe('project open-task-count utility extraction', () => {
  it('moves open-task-count derivation into a dedicated projects helper and trims App responsibility', () => {
    const openTaskCountsSource = requireSource(
      OPEN_TASK_COUNTS_MODULE_PATH,
      'the extracted project open-task-count helper for FR-2',
    )
    const composerSource = readWorkspaceComposerSource()

    expect(openTaskCountsSource).toMatch(
      /export\s+(?:function|const)\s+deriveOpenTaskCountsByProjectId\b/,
    )
    expect(composerSource).toMatch(/from ['"].*openTaskCounts['"]/)
    expect(composerSource).not.toContain('for (const task of tasksQuery.data)')
    expect(composerSource).not.toContain("task.status === 'done' || task.status === 'archived'")
    expect(composerSource).not.toContain('counts[task.project_id] =')
  })

  it('keeps the extracted open-task-count helper free of React and browser APIs', () => {
    const openTaskCountsSource = requireSource(
      OPEN_TASK_COUNTS_MODULE_PATH,
      'the extracted project open-task-count helper for FR-2',
    )

    ;[
      "from 'react'",
      'from "react"',
      'document.',
      'window.',
      'localStorage',
      'sessionStorage',
      'navigator.',
      'useEffect',
      'useMemo',
      'useState',
      'addEventListener',
    ].forEach((forbiddenSnippet) => {
      expect(openTaskCountsSource).not.toContain(forbiddenSnippet)
    })
  })

  it('counts only open tasks for active projects and excludes archived or unknown project rows', async () => {
    const { deriveOpenTaskCountsByProjectId } = await loadOpenTaskCountsModule()
    const activeAlpha = buildProject({ id: 'project-open-alpha', name: 'Open Alpha' })
    const activeBeta = buildProject({ id: 'project-open-beta', name: 'Open Beta' })
    const archivedProject = buildProject({
      id: 'project-archived-count',
      name: 'Archived Count',
      status: 'archived',
    })

    const counts = deriveOpenTaskCountsByProjectId(
      [activeAlpha, activeBeta, archivedProject],
      [
        buildTask({
          id: 'task-open-alpha-backlog',
          project_id: activeAlpha.id,
          status: 'backlog',
        }),
        buildTask({
          id: 'task-open-alpha-review',
          project_id: activeAlpha.id,
          status: 'review',
        }),
        buildTask({
          id: 'task-done-alpha',
          project_id: activeAlpha.id,
          status: 'done',
        }),
        buildTask({
          id: 'task-archived-alpha',
          project_id: activeAlpha.id,
          status: 'archived',
        }),
        buildTask({
          id: 'task-open-beta',
          project_id: activeBeta.id,
          status: 'in_progress',
        }),
        buildTask({
          id: 'task-open-archived-project',
          project_id: archivedProject.id,
          status: 'backlog',
        }),
        buildTask({
          id: 'task-open-unknown-project',
          project_id: 'project-missing',
          status: 'backlog',
        }),
      ],
    )

    expect(counts).toEqual({
      [activeAlpha.id]: 2,
      [activeBeta.id]: 1,
    })
  })
})
