import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { DragEndEvent } from '@dnd-kit/core'

import type { Project, ProjectBoardStatus, Task } from '../api/types'
import { sortProjectsForKanbanBoard, sortTasksForKanban } from './kanbanSort'
import { buildProject, buildTask } from '../test/fixtures'

type KanbanColumnKey = string

type DropDetail = {
  itemId: string
  columnKey: KanbanColumnKey
  kanban_order: number | null
}

type KanbanDndConfig<TItem extends { id: string }> = {
  columnIdPrefix: string
  cardIdPrefix: string
  getColumnKey: (item: TItem) => KanbanColumnKey
  getOrder: (item: TItem) => number | null
  setColumnAndOrder: (
    item: TItem,
    column: KanbanColumnKey,
    order: number | null,
  ) => TItem
  orderItemsInColumn: (items: TItem[], column: KanbanColumnKey) => TItem[]
}

type KanbanDndModule = {
  getDropDetailFromDragEvent: <TItem extends { id: string }>(
    items: TItem[],
    event: DragEndEvent,
    config: KanbanDndConfig<TItem>,
  ) => DropDetail | null
  reorderKanbanItems: <TItem extends { id: string }>(
    items: TItem[],
    itemId: string,
    nextColumn: KanbanColumnKey,
    nextKanbanOrder: number | null,
    config: KanbanDndConfig<TItem>,
  ) => TItem[]
}

const KANBAN_DND_MODULE_PATH = resolve(process.cwd(), 'src/lib/kanbanDnd.ts')
const APP_SOURCE_PATH = resolve(process.cwd(), 'src/App.tsx')

function requireSource(filePath: string, description: string): string {
  expect(
    existsSync(filePath),
    `Expected ${description} at ${filePath}, but it does not exist yet.`,
  ).toBe(true)

  return readFileSync(filePath, 'utf8')
}

async function loadKanbanDndModule(): Promise<KanbanDndModule> {
  requireSource(
    KANBAN_DND_MODULE_PATH,
    'the extracted generic kanban DnD module for FR-5',
  )

  return (await import(pathToFileURL(KANBAN_DND_MODULE_PATH).href)) as KanbanDndModule
}

function buildTaskKanbanConfig(): KanbanDndConfig<Task> {
  return {
    columnIdPrefix: 'kanban-column:',
    cardIdPrefix: 'kanban-task:',
    getColumnKey: (task) => task.status,
    getOrder: (task) => task.kanban_order,
    setColumnAndOrder: (task, column, order) => ({
      ...task,
      status: column as Task['status'],
      kanban_order: order,
      completed_date: column === 'done' ? task.completed_date : null,
    }),
    orderItemsInColumn: (items, column) =>
      sortTasksForKanban(
        items.filter((task) => task.status === column),
      ),
  }
}

function buildProjectKanbanConfig(): KanbanDndConfig<Project> {
  return {
    columnIdPrefix: 'kanban-project-column:',
    cardIdPrefix: 'kanban-project:',
    getColumnKey: (project) => project.board_status,
    getOrder: (project) => project.kanban_order,
    setColumnAndOrder: (project, column, order) => ({
      ...project,
      board_status: column as ProjectBoardStatus,
      kanban_order: order,
      finished: column === 'shipped' ? true : project.finished,
    }),
    orderItemsInColumn: (items, column) =>
      sortProjectsForKanbanBoard(
        items.filter((project) => project.board_status === column),
      ),
  }
}

function buildDragEndEvent(params: {
  activeId: string
  overData?: unknown
  overId: string | null
}): DragEndEvent {
  return {
    active: {
      id: params.activeId,
    },
    over:
      params.overId === null
        ? null
        : {
            id: params.overId,
            data: {
              current: params.overData,
            },
          },
  } as DragEndEvent
}

describe('generic kanban DnD utility extraction', () => {
  it('adds a shared kanban DnD module with config hooks and rewires App away from duplicated board math', () => {
    const kanbanDndSource = requireSource(
      KANBAN_DND_MODULE_PATH,
      'the extracted generic kanban DnD module for FR-5',
    )
    const appSource = requireSource(APP_SOURCE_PATH, 'App.tsx')

    expect(kanbanDndSource).toMatch(/export\s+type\s+KanbanDndConfig\b/)
    expect(kanbanDndSource).toMatch(/\bcolumnIdPrefix\s*:/)
    expect(kanbanDndSource).toMatch(/\bcardIdPrefix\s*:/)
    expect(kanbanDndSource).toMatch(/\bgetColumnKey\s*:/)
    expect(kanbanDndSource).toMatch(/\bgetOrder\s*:/)
    expect(kanbanDndSource).toMatch(/\bsetColumnAndOrder\s*:/)
    expect(kanbanDndSource).toMatch(/\borderItemsInColumn\s*:/)
    expect(kanbanDndSource).toMatch(/export\s+type\s+DropDetail\b/)
    expect(kanbanDndSource).toMatch(/export\s+(?:function|const)\s+getDropDetailFromDragEvent\b/)
    expect(kanbanDndSource).toMatch(/export\s+(?:function|const)\s+reorderKanbanItems\b/)
    expect(kanbanDndSource).toMatch(/export\s+(?:function|const)\s+hasKanbanComparableChanged\b/)

    expect(appSource).toMatch(/from ['"].*kanbanDnd['"]/)
    expect(appSource).not.toContain('function reorderTasksForKanban(')
    expect(appSource).not.toContain('function hasKanbanStateChanged(')
    expect(appSource).not.toContain('function getKanbanDropDetailFromDragEvent(')
    expect(appSource).not.toContain('function reorderProjectsForKanban(')
    expect(appSource).not.toContain('function hasProjectKanbanComparableChanged(')
    expect(appSource).not.toContain('function getProjectKanbanDropDetailFromDragEvent(')
  })

  it('keeps the extracted kanban DnD utility pure and free of React, browser, and mutation-side-effect wiring', () => {
    const kanbanDndSource = requireSource(
      KANBAN_DND_MODULE_PATH,
      'the extracted generic kanban DnD module for FR-5',
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
      'updateStatus(',
      'updateProjectBoardStatus(',
      'mutateAsync(',
    ].forEach((forbiddenSnippet) => {
      expect(kanbanDndSource).not.toContain(forbiddenSnippet)
    })
  })

  it('derives a same-column card drop deterministically even when kanban_order values are duplicated or null', async () => {
    const { getDropDetailFromDragEvent, reorderKanbanItems } = await loadKanbanDndModule()
    const config = buildTaskKanbanConfig()
    const tasks = [
      buildTask({
        id: 'task-alpha',
        title: 'Alpha',
        status: 'backlog',
        kanban_order: 0,
        created_at: '2026-05-13T08:00:00Z',
      }),
      buildTask({
        id: 'task-beta',
        title: 'Beta',
        status: 'backlog',
        kanban_order: 0,
        created_at: '2026-05-13T09:00:00Z',
      }),
      buildTask({
        id: 'task-gamma',
        title: 'Gamma',
        status: 'backlog',
        kanban_order: null,
        created_at: '2026-05-13T10:00:00Z',
      }),
    ]

    const detail = getDropDetailFromDragEvent(
      tasks,
      buildDragEndEvent({
        activeId: 'kanban-task:task-gamma',
        overId: 'kanban-task:task-beta',
        overData: {
          type: 'task',
          taskId: 'task-beta',
          status: 'backlog',
        },
      }),
      config,
    )

    expect(detail).toEqual({
      itemId: 'task-gamma',
      columnKey: 'backlog',
      kanban_order: 1,
    })

    const reordered = reorderKanbanItems(
      tasks,
      detail!.itemId,
      detail!.columnKey,
      detail!.kanban_order,
      config,
    )

    expect(
      sortTasksForKanban(
        reordered.filter((task) => task.status === 'backlog'),
      ).map((task) => [task.id, task.kanban_order]),
    ).toEqual([
      ['task-alpha', 0],
      ['task-gamma', 1],
      ['task-beta', 2],
    ])
  })

  it('appends drops on column or empty targets and lets task-specific patching clear completed_date outside done', async () => {
    const { getDropDetailFromDragEvent, reorderKanbanItems } = await loadKanbanDndModule()
    const config = buildTaskKanbanConfig()
    const reviewSeed = buildTask({
      id: 'task-review-seed',
      title: 'Review seed',
      status: 'review',
      kanban_order: 0,
    })
    const backlogMover = buildTask({
      id: 'task-backlog-mover',
      title: 'Backlog mover',
      status: 'backlog',
      kanban_order: 0,
    })
    const doneMover = buildTask({
      id: 'task-done-mover',
      title: 'Done mover',
      status: 'done',
      kanban_order: 0,
      completed_date: '2026-05-16',
    })

    expect(
      getDropDetailFromDragEvent(
        [backlogMover, reviewSeed],
        buildDragEndEvent({
          activeId: 'kanban-task:task-backlog-mover',
          overId: 'kanban-column:review',
          overData: {
            type: 'column',
            status: 'review',
          },
        }),
        config,
      ),
    ).toEqual({
      itemId: 'task-backlog-mover',
      columnKey: 'review',
      kanban_order: 1,
    })

    const emptyTargetDetail = getDropDetailFromDragEvent(
      [doneMover],
      buildDragEndEvent({
        activeId: 'kanban-task:task-done-mover',
        overId: 'kanban-column:review',
      }),
      config,
    )

    expect(emptyTargetDetail).toEqual({
      itemId: 'task-done-mover',
      columnKey: 'review',
      kanban_order: 0,
    })

    const reordered = reorderKanbanItems(
      [doneMover],
      emptyTargetDetail!.itemId,
      emptyTargetDetail!.columnKey,
      emptyTargetDetail!.kanban_order,
      config,
    )

    expect(reordered).toEqual([
      expect.objectContaining({
        id: 'task-done-mover',
        status: 'review',
        kanban_order: 0,
        completed_date: null,
      }),
    ])
  })

  it('supports cross-column project moves without erasing project-specific shipped and finished semantics', async () => {
    const { getDropDetailFromDragEvent, reorderKanbanItems } = await loadKanbanDndModule()
    const config = buildProjectKanbanConfig()
    const projects = [
      buildProject({
        id: 'project-active',
        name: 'Active project',
        board_status: 'active',
        kanban_order: 0,
        finished: false,
      }),
      buildProject({
        id: 'project-shipped',
        name: 'Already shipped',
        board_status: 'shipped',
        kanban_order: 0,
        finished: true,
      }),
    ]

    const detail = getDropDetailFromDragEvent(
      projects,
      buildDragEndEvent({
        activeId: 'kanban-project:project-active',
        overId: 'kanban-project:project-shipped',
        overData: {
          type: 'project',
          projectId: 'project-shipped',
          board_status: 'shipped',
        },
      }),
      config,
    )

    expect(detail).toEqual({
      itemId: 'project-active',
      columnKey: 'shipped',
      kanban_order: 0,
    })

    const reordered = reorderKanbanItems(
      projects,
      detail!.itemId,
      detail!.columnKey,
      detail!.kanban_order,
      config,
    )

    expect(
      sortProjectsForKanbanBoard(
        reordered.filter((project) => project.board_status === 'shipped'),
      ).map((project) => [project.id, project.kanban_order, project.finished]),
    ).toEqual([
      ['project-active', 0, true],
      ['project-shipped', 1, true],
    ])
  })

  it('treats same-column end drops as no-ops but still reports real column changes when the numeric order stays the same', async () => {
    const { getDropDetailFromDragEvent } = await loadKanbanDndModule()
    const config = buildTaskKanbanConfig()
    const noOpTasks = [
      buildTask({
        id: 'task-first',
        title: 'First',
        status: 'backlog',
        kanban_order: 0,
      }),
      buildTask({
        id: 'task-last',
        title: 'Last',
        status: 'backlog',
        kanban_order: 1,
      }),
    ]

    expect(
      getDropDetailFromDragEvent(
        noOpTasks,
        buildDragEndEvent({
          activeId: 'kanban-task:task-last',
          overId: 'kanban-column:backlog',
          overData: {
            type: 'column',
            status: 'backlog',
          },
        }),
        config,
      ),
    ).toBeNull()

    expect(
      getDropDetailFromDragEvent(
        [
          buildTask({
            id: 'task-column-change',
            title: 'Column change',
            status: 'backlog',
            kanban_order: 0,
          }),
        ],
        buildDragEndEvent({
          activeId: 'kanban-task:task-column-change',
          overId: 'kanban-column:review',
        }),
        config,
      ),
    ).toEqual({
      itemId: 'task-column-change',
      columnKey: 'review',
      kanban_order: 0,
    })
  })
})
