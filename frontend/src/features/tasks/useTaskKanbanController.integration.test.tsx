import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildProject,
  buildTask,
  buildVenture,
  buildVentureCategoryLabel,
} from '../../test/fixtures'
import { renderApp } from '../../test/renderApp'
import { resetTestStorage } from '../../test/storage'
import { installWorkspaceBackendMock } from '../../test/workspaceBackendMock'
import { resetBoardDisplayOptionsStore } from '../../stores/boardDisplayOptions'
import { resetProjectFilterStore } from '../../stores/projectFilter'
import type { WorkspaceBackendOptions } from '../../test/workspaceBackendMock'
import {
  clickBoardOptionsCheckbox,
  dispatchKanbanDrop,
  expectKanbanTaskOrder,
  getKanbanColumn,
  getSidebar,
  getTableRegion,
  getTaskCardByTitle,
  openBoardOptionsMenu,
  openTableSortMenu,
  waitForKanbanTaskVisible,
  waitForWorkspaceReady,
} from '../../test/workspaceQueries'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const labelSeed = buildVentureCategoryLabel({
  id: 'label-fr7',
  name: 'Hustle',
  slug: 'hustle',
})

const venture = buildVenture({
  id: 'venture-fr7',
  name: 'FR7 Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

/**
 * RTL integration spec for FR-7: behaviour that must survive extracting
 * `useTaskKanbanController` from App. Guards in `useTaskKanbanController.extraction.test.ts`
 * fail until that module is wired; these examples stay green today and act as the
 * controller extraction safety net.
 */
describe('FR-7 task board controller orchestration (integration)', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.restoreAllMocks()
    resetTestStorage()
    resetProjectFilterStore()
    resetBoardDisplayOptionsStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetTestStorage()
    resetProjectFilterStore()
    resetBoardDisplayOptionsStore()
  })

  it('applies optimistic reorder for task kanban:drop and persists through the status API', async () => {
    const alpha = buildProject({
      id: 'project-fr7-alpha',
      name: 'Alpha Client',
      venture_id: venture.id,
    })

    const backend = installWorkspaceBackendMock({
      ventures: [venture],
      projects: [alpha],
      tasks: [
        buildTask({
          id: 'task-fr7-first',
          project_id: alpha.id,
          title: 'First task',
          status: 'backlog',
          kanban_order: 0,
        }),
        buildTask({
          id: 'task-fr7-second',
          project_id: alpha.id,
          title: 'Second task',
          status: 'backlog',
          kanban_order: 1,
        }),
      ],
    })

    await renderApp()
    await waitForKanbanTaskVisible('First task')
    await waitForKanbanTaskVisible('Second task')

    const backlogColumn = getKanbanColumn(/backlog/i)
    await dispatchKanbanDrop({
      taskId: 'task-fr7-second',
      status: 'backlog',
      kanban_order: 0,
    })

    await waitFor(() => {
      expect(backend.taskStatusRequests).toEqual([
        {
          taskId: 'task-fr7-second',
          payload: { status: 'backlog', kanban_order: 0 },
        },
      ])
    })

    expectKanbanTaskOrder(backlogColumn, ['Second task', 'First task'])
  })

  it('rolls back optimistic kanban order and surfaces an error when status persistence fails', async () => {
    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [
        buildProject({
          id: 'project-fr7-rollback-a',
          name: 'Alpha Client',
          venture_id: venture.id,
        }),
        buildProject({
          id: 'project-fr7-rollback-b',
          name: 'Beta Podcast',
          venture_id: venture.id,
        }),
      ],
      tasks: [
        buildTask({
          id: 'task-fr7-r1',
          project_id: 'project-fr7-rollback-a',
          title: 'Rollback task A',
          status: 'backlog',
          kanban_order: 0,
        }),
        buildTask({
          id: 'task-fr7-r2',
          project_id: 'project-fr7-rollback-b',
          title: 'Rollback task B',
          status: 'backlog',
          kanban_order: 1,
        }),
      ],
      onTaskStatusUpdate: (): Promise<Response> =>
        Promise.resolve(jsonResponse({ detail: 'FR7 simulated failure.' }, 500)),
    })

    await renderApp()

    await waitForKanbanTaskVisible('Rollback task A')
    await waitForKanbanTaskVisible('Rollback task B')

    const backlogColumn = getKanbanColumn(/backlog/i)

    await dispatchKanbanDrop({
      taskId: 'task-fr7-r2',
      status: 'done',
      kanban_order: 0,
    })

    await waitFor(() => {
      expect(screen.getByText(/fr7 simulated failure/i)).toBeInTheDocument()
    })

    expectKanbanTaskOrder(backlogColumn, ['Rollback task A', 'Rollback task B'])
    expect(within(getKanbanColumn(/done/i)).getByText(/no tasks in this column/i)).toBeInTheDocument()
  })

  it('drops stale optimistic task board state when the sidebar project filter changes during an in-flight status update', async () => {
    let releaseStatus: (() => void) | undefined
    const statusGate = new Promise<void>((resolve) => {
      releaseStatus = (): void => {
        resolve()
      }
    })

    const alpha = buildProject({
      id: 'project-fr7-filter-a',
      name: 'Filter Alpha',
      venture_id: venture.id,
    })
    const beta = buildProject({
      id: 'project-fr7-filter-b',
      name: 'Filter Beta',
      venture_id: venture.id,
    })

    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [alpha, beta],
      tasks: [
        buildTask({
          id: 'task-fr7-fa',
          project_id: alpha.id,
          title: 'Only Alpha task',
          status: 'backlog',
          kanban_order: 0,
        }),
        buildTask({
          id: 'task-fr7-fb',
          project_id: beta.id,
          title: 'Only Beta task',
          status: 'backlog',
          kanban_order: 1,
        }),
      ],
      onTaskStatusUpdate: (async () => {
        await statusGate
        return null
      }) as NonNullable<WorkspaceBackendOptions['onTaskStatusUpdate']>,
    })

    await renderApp()
    await waitForWorkspaceReady()

    await waitForKanbanTaskVisible('Only Alpha task')
    await waitForKanbanTaskVisible('Only Beta task')

    const backlogColumn = getKanbanColumn(/backlog/i)

    await dispatchKanbanDrop({
      taskId: 'task-fr7-fb',
      status: 'backlog',
      kanban_order: 0,
    })

    await waitFor(() => {
      expectKanbanTaskOrder(backlogColumn, ['Only Beta task', 'Only Alpha task'])
    })

    await user.click(
      within(getSidebar()).getByRole('checkbox', { name: /show filter beta in workspace/i }),
    )

    await waitFor(() => {
      expect(within(backlogColumn).queryByText('Only Beta task')).not.toBeInTheDocument()
      expect(within(backlogColumn).getByText('Only Alpha task')).toBeInTheDocument()
    })

    releaseStatus?.()

    await waitFor(() => {
      expect(within(backlogColumn).queryAllByTestId('kanban-task-title')).toHaveLength(1)
    })
  })

  it('combines board display options with task summary sort and row-open behaviour on the same workspace surface', async () => {
    const alpha = buildProject({
      id: 'project-fr7-sort-a',
      name: 'Zebra Project',
      venture_id: venture.id,
    })
    const beta = buildProject({
      id: 'project-fr7-sort-b',
      name: 'Alpha Table Project',
      venture_id: venture.id,
    })

    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [alpha, beta],
      tasks: [
        buildTask({
          id: 'task-fr7-zebra',
          project_id: alpha.id,
          title: 'Zebra row task',
          status: 'backlog',
          kanban_order: 0,
          priority: 'low',
        }),
        buildTask({
          id: 'task-fr7-alpha-row',
          project_id: beta.id,
          title: 'Alpha row task',
          status: 'backlog',
          kanban_order: 1,
          priority: 'high',
        }),
      ],
    })

    await renderApp()
    await waitForKanbanTaskVisible('Zebra row task')
    await waitForKanbanTaskVisible('Alpha row task')

    await openBoardOptionsMenu()
    await clickBoardOptionsCheckbox(/show priority/i)

    const zebraCard = getTaskCardByTitle(getKanbanColumn(/backlog/i), 'Zebra row task')
    await waitFor(() => {
      expect(within(zebraCard).getByText(/^low$/i)).toBeInTheDocument()
    })

    const tableRegion = getTableRegion()
    const menu = await openTableSortMenu()
    await user.click(within(menu).getByRole('menuitem', { name: /^project$/i }))

    const table = within(tableRegion).getByRole('table')
    const rowButtons = within(table).getAllByRole('button', { name: /^edit task /i })
    expect(rowButtons[0]).toHaveAccessibleName(/edit task alpha row task/i)
    expect(rowButtons[rowButtons.length - 1]).toHaveAccessibleName(/edit task zebra row task/i)

    await user.click(within(tableRegion).getByRole('button', { name: /edit task alpha row task/i }))
    await screen.findByRole('dialog', { name: /^edit task$/i })
  })

  it('clears completed date semantics when a task leaves done via kanban:drop', async () => {
    const alpha = buildProject({
      id: 'project-fr7-done',
      name: 'Done column project',
      venture_id: venture.id,
    })

    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [alpha],
      tasks: [
        buildTask({
          id: 'task-fr7-reopen',
          project_id: alpha.id,
          title: 'Reopen from done',
          status: 'done',
          kanban_order: 0,
          completed_date: '2026-05-26',
        }),
      ],
    })

    await renderApp()
    await waitForKanbanTaskVisible('Reopen from done', /done/i)

    await dispatchKanbanDrop({
      taskId: 'task-fr7-reopen',
      status: 'backlog',
      kanban_order: 0,
    })

    await waitForKanbanTaskVisible('Reopen from done', /backlog/i)

    const reopenedCard = getTaskCardByTitle(getKanbanColumn(/backlog/i), 'Reopen from done')
    fireEvent.click(within(reopenedCard).getByTestId('kanban-task-title'))
    const editDialog = await screen.findByRole('dialog', { name: /edit task/i })

    const completedCard = within(editDialog).getByText('Completed date').closest('.time-log-card')
    expect(completedCard).not.toBeNull()
    expect(within(completedCard as HTMLElement).getByRole('strong')).toHaveTextContent('—')
  })
})
