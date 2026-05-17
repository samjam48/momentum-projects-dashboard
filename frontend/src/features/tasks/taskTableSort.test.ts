import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Project, Task } from '../../api/types'
import { buildProject, buildTask } from '../../test/fixtures'

type TaskSortKey = 'target_date' | 'priority' | 'project_name'

type TaskSortState = {
  direction: 'asc' | 'desc'
  key: TaskSortKey
} | null

type TaskSortModule = {
  compareTasks: (
    leftTask: Task,
    rightTask: Task,
    projectsById: Record<string, Project>,
    sortState: TaskSortState,
    leftIndex: number,
    rightIndex: number,
  ) => number
  sortTasks: (
    tasks: Task[],
    projectsById: Record<string, Project>,
    sortState: TaskSortState,
  ) => Task[]
}

const TASK_SORT_MODULE_PATH = resolve(process.cwd(), 'src/features/tasks/taskTableSort.ts')
const APP_SOURCE_PATH = resolve(process.cwd(), 'src/App.tsx')
const TASK_SUMMARY_TABLE_SOURCE_PATH = resolve(
  process.cwd(),
  'src/components/TaskSummaryTable.tsx',
)
const TABLE_SORT_MENU_SOURCE_PATH = resolve(
  process.cwd(),
  'src/components/TableSortMenu.tsx',
)

function requireSource(filePath: string, description: string): string {

  expect(
    existsSync(filePath),
    `Expected ${description} at ${filePath}, but it does not exist yet.`,
  ).toBe(true)

  return readFileSync(filePath, 'utf8')
}

async function loadTaskSortModule(): Promise<TaskSortModule> {
  requireSource(
    TASK_SORT_MODULE_PATH,
    'the extracted task table sort module for FR-2',
  )

  return (await import(pathToFileURL(TASK_SORT_MODULE_PATH).href)) as TaskSortModule
}

function buildProjectsById(projects: Project[]): Record<string, Project> {
  return projects.reduce<Record<string, Project>>((accumulator, project) => {
    accumulator[project.id] = project
    return accumulator
  }, {})
}

describe('task table sort utility extraction', () => {
  it('moves task sort types and helpers into a dedicated module and rewires current consumers', () => {
    const taskSortSource = requireSource(
      TASK_SORT_MODULE_PATH,
      'the extracted task table sort module for FR-2',
    )
    const appSource = requireSource(APP_SOURCE_PATH, 'App.tsx')
    const taskSummaryTableSource = requireSource(
      TASK_SUMMARY_TABLE_SOURCE_PATH,
      'TaskSummaryTable.tsx',
    )
    const tableSortMenuSource = requireSource(
      TABLE_SORT_MENU_SOURCE_PATH,
      'TableSortMenu.tsx',
    )

    expect(taskSortSource).toMatch(/export\s+type\s+TaskSortKey\b/)
    expect(taskSortSource).toMatch(/export\s+type\s+TaskSortState\b/)
    expect(taskSortSource).toMatch(/export\s+(?:function|const)\s+compareTasks\b/)
    expect(taskSortSource).toMatch(/export\s+(?:function|const)\s+sortTasks\b/)

    expect(appSource).toMatch(/from ['"].*taskTableSort['"]/)
    expect(taskSummaryTableSource).toMatch(/from ['"].*taskTableSort['"]/)
    expect(tableSortMenuSource).toMatch(/from ['"].*taskTableSort['"]/)

    expect(appSource).not.toContain('function compareTasks(')
    expect(appSource).not.toContain('function sortTasks(')
    expect(taskSummaryTableSource).not.toContain('type TaskSortState =')
    expect(tableSortMenuSource).not.toContain('type TaskSortKey =')
  })

  it('keeps the extracted task sort utility free of React, browser, and mutation-side-effect wiring', () => {
    const taskSortSource = requireSource(
      TASK_SORT_MODULE_PATH,
      'the extracted task table sort module for FR-2',
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
      expect(taskSortSource).not.toContain(forbiddenSnippet)
    })
  })

  it('sorts target dates with nulls last in both directions and keeps ties stable across optional fields', async () => {
    const { sortTasks } = await loadTaskSortModule()
    const alpha = buildProject({ id: 'project-alpha', name: 'Alpha client' })
    const beta = buildProject({ id: 'project-beta', name: 'Beta podcast' })
    const projectsById = buildProjectsById([alpha, beta])
    const tasks = [
      buildTask({
        id: 'date-same-first',
        project_id: beta.id,
        title: 'Same date first',
        target_date: '2026-05-14',
        estimated_hours: 2,
        completed_date: '2026-05-20',
      }),
      buildTask({
        id: 'date-null-first',
        project_id: alpha.id,
        title: 'Null date first',
        target_date: null,
        estimated_hours: null,
        completed_date: null,
      }),
      buildTask({
        id: 'date-same-second',
        project_id: alpha.id,
        title: 'Same date second',
        target_date: '2026-05-14',
        estimated_hours: 5,
        completed_date: null,
      }),
      buildTask({
        id: 'date-earlier',
        project_id: alpha.id,
        title: 'Earlier date',
        target_date: '2026-05-12',
      }),
      buildTask({
        id: 'date-null-second',
        project_id: beta.id,
        title: 'Null date second',
        target_date: null,
        estimated_hours: 1,
        completed_date: '2026-05-21',
      }),
    ]
    const originalOrder = tasks.map((task) => task.id)

    const ascending = sortTasks(tasks, projectsById, {
      key: 'target_date',
      direction: 'asc',
    }).map((task) => task.id)
    const descending = sortTasks(tasks, projectsById, {
      key: 'target_date',
      direction: 'desc',
    }).map((task) => task.id)

    expect(ascending).toEqual([
      'date-earlier',
      'date-same-first',
      'date-same-second',
      'date-null-first',
      'date-null-second',
    ])
    expect(descending).toEqual([
      'date-same-first',
      'date-same-second',
      'date-earlier',
      'date-null-first',
      'date-null-second',
    ])
    expect(tasks.map((task) => task.id)).toEqual(originalOrder)
  })

  it('keeps priority and project-name ties deterministic without mutating the input array', async () => {
    const { compareTasks, sortTasks } = await loadTaskSortModule()
    const alpha = buildProject({ id: 'project-alpha-stable', name: 'Alpha' })
    const alphaCaseVariant = buildProject({
      id: 'project-alpha-case',
      name: 'alpha',
    })
    const beta = buildProject({ id: 'project-beta-stable', name: 'Beta' })
    const projectsById = buildProjectsById([alpha, alphaCaseVariant, beta])
    const tasks = [
      buildTask({
        id: 'priority-medium-first',
        project_id: alpha.id,
        title: 'Priority medium first',
        priority: 'medium',
      }),
      buildTask({
        id: 'priority-urgent',
        project_id: beta.id,
        title: 'Priority urgent',
        priority: 'urgent',
      }),
      buildTask({
        id: 'priority-low',
        project_id: beta.id,
        title: 'Priority low',
        priority: 'low',
      }),
      buildTask({
        id: 'priority-medium-second',
        project_id: alphaCaseVariant.id,
        title: 'Priority medium second',
        priority: 'medium',
      }),
    ]
    const originalOrder = tasks.map((task) => task.id)

    expect(
      compareTasks(
        tasks[0],
        tasks[3],
        projectsById,
        { key: 'project_name', direction: 'asc' },
        0,
        3,
      ),
    ).toBeLessThan(0)

    expect(
      sortTasks(tasks, projectsById, {
        key: 'priority',
        direction: 'asc',
      }).map((task) => task.id),
    ).toEqual([
      'priority-low',
      'priority-medium-first',
      'priority-medium-second',
      'priority-urgent',
    ])

    expect(
      sortTasks(tasks, projectsById, {
        key: 'project_name',
        direction: 'asc',
      }).map((task) => task.id),
    ).toEqual([
      'priority-medium-first',
      'priority-medium-second',
      'priority-urgent',
      'priority-low',
    ])

    expect(tasks.map((task) => task.id)).toEqual(originalOrder)
  })
})
