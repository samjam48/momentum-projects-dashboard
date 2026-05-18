import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp, renderAppBare } from './test/renderApp'
import {
  dispatchKanbanDrop,
  dispatchProjectKanbanDrop,
  expectKanbanTaskOrder,
  expectProjectKanbanCardOrder,
  getKanbanColumn,
  getKanbanRegion,
  getSidebar,
  waitForKanbanTaskVisible,
  waitForProjectKanbanCard,
  waitForWorkspaceReady,
} from './test/workspaceQueries'
import {
  buildProject,
  buildTask,
  buildVenture,
  buildVentureCategoryLabel,
} from './test/fixtures'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import { resetProjectFilterStore } from './stores/projectFilter'
import { resetBoardDisplayOptionsStore } from './stores/boardDisplayOptions'

function readFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

const labelSeed = buildVentureCategoryLabel({
  id: 'label-seed-refactor',
  name: 'Hustle',
  slug: 'hustle',
})
const activeVenture = buildVenture({
  id: 'venture-refactor-active',
  name: 'Refactor Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})
const archivedVenture = buildVenture({
  id: 'venture-refactor-archived',
  name: 'Dormant Venture',
  status: 'archived',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

describe('App frontend refactor baseline', () => {
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

  it('holds the workspace loading gate until the initial task bootstrap settles', async () => {
    const alpha = buildProject({
      id: 'project-bootstrap',
      name: 'Bootstrap Project',
      venture_id: activeVenture.id,
    })
    const bootstrapTask = buildTask({
      id: 'task-bootstrap',
      project_id: alpha.id,
      title: 'Bootstrap task',
      status: 'backlog',
    })

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha],
      tasks: [bootstrapTask],
    })

    const originalFetch = fetchMock.getMockImplementation()
    if (!originalFetch) {
      throw new Error('Expected workspace backend mock implementation.')
    }

    let releaseTasks: (() => void) | null = null
    const taskGate = new Promise<void>((resolve) => {
      releaseTasks = resolve
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      const url = new URL(readFetchUrl(input), 'http://localhost')

      if (method === 'GET' && url.pathname === '/api/v1/tasks') {
        await taskGate
      }

      return originalFetch(input, init)
    })

    renderAppBare()

    expect(await screen.findByText(/loading workspace/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /kanban board/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /task summary/i })).not.toBeInTheDocument()

    releaseTasks?.()

    await waitForWorkspaceReady()
    expect(screen.getByRole('region', { name: /kanban board/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /task summary/i })).toBeInTheDocument()
  })

  it('persists end-of-column task reorders through the kanban:drop test hook', async () => {
    const alpha = buildProject({
      id: 'project-task-hook',
      name: 'Task Hook Project',
      venture_id: activeVenture.id,
    })
    const backend = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha],
      tasks: [
        buildTask({
          id: 'task-first',
          project_id: alpha.id,
          title: 'First task',
          status: 'backlog',
          kanban_order: 0,
        }),
        buildTask({
          id: 'task-second',
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
      taskId: 'task-first',
      status: 'backlog',
      kanban_order: null,
    })

    await waitFor(() => {
      expect(backend.taskStatusRequests).toEqual([
        {
          taskId: 'task-first',
          payload: { status: 'backlog', kanban_order: null },
        },
      ])
    })

    expectKanbanTaskOrder(backlogColumn, ['Second task', 'First task'])
  })

  it('restores the original same-column project order after the server accepts an end drop', async () => {
    const alpha = buildProject({
      id: 'project-first',
      name: 'Alpha Client',
      venture_id: activeVenture.id,
      board_status: 'active',
      kanban_order: 0,
    })
    const beta = buildProject({
      id: 'project-second',
      name: 'Beta Podcast',
      venture_id: activeVenture.id,
      board_status: 'active',
      kanban_order: 1,
    })

    const { projectBoardStatusRequests } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha, beta],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await userEvent.click(screen.getByRole('tab', { name: /^projects$/i }))
    await waitForProjectKanbanCard('Alpha Client', /active/i)
    await waitForProjectKanbanCard('Beta Podcast', /active/i)

    const activeColumn = getKanbanColumn(/active/i)
    await dispatchProjectKanbanDrop({
      projectId: alpha.id,
      board_status: 'active',
      kanban_order: null,
    })

    await waitFor(() => {
      expect(projectBoardStatusRequests).toHaveLength(1)
    })

    expect(projectBoardStatusRequests[0]).toEqual({
      projectId: alpha.id,
      payload: { board_status: 'active' },
    })

    await waitFor(() => {
      expectProjectKanbanCardOrder(activeColumn, ['Alpha Client', 'Beta Podcast'])
    })
  })

  it('rolls back optimistic project board moves when board persistence fails', async () => {
    const alpha = buildProject({
      id: 'project-rollback-active',
      name: 'Rollback Alpha',
      venture_id: activeVenture.id,
      board_status: 'active',
      kanban_order: 0,
    })
    const beta = buildProject({
      id: 'project-rollback-paused',
      name: 'Rollback Beta',
      venture_id: activeVenture.id,
      board_status: 'paused',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha, beta],
      tasks: [],
      onProjectBoardStatus: () =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: 'Simulated persistence failure.' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
          }),
        ),
    })

    await renderApp()
    await waitForWorkspaceReady()
    await userEvent.click(screen.getByRole('tab', { name: /^projects$/i }))
    await waitForProjectKanbanCard('Rollback Alpha', /active/i)
    await waitForProjectKanbanCard('Rollback Beta', /paused/i)

    await dispatchProjectKanbanDrop({
      projectId: alpha.id,
      board_status: 'paused',
      kanban_order: 1,
    })

    await waitFor(() => {
      expect(
        screen.getByText(/simulated persistence failure|unable to persist project board changes/i),
      ).toBeInTheDocument()
    })

    expect(within(getKanbanColumn(/active/i)).getByText('Rollback Alpha')).toBeInTheDocument()
    expect(
      within(getKanbanColumn(/paused/i)).queryByText('Rollback Alpha'),
    ).not.toBeInTheDocument()
  })

  it('keeps the toolbar project filter aligned with sidebar selection changes, including zero selected projects', async () => {
    const alpha = buildProject({
      id: 'project-filter-alpha',
      name: 'Alpha Client',
      venture_id: activeVenture.id,
    })
    const beta = buildProject({
      id: 'project-filter-beta',
      name: 'Beta Podcast',
      venture_id: activeVenture.id,
    })

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha, beta],
      tasks: [
        buildTask({
          id: 'task-filter-a',
          project_id: alpha.id,
          title: 'Alpha task',
          status: 'backlog',
        }),
        buildTask({
          id: 'task-filter-b',
          project_id: beta.id,
          title: 'Beta task',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()

    const filter = screen.getByRole('combobox', { name: /project filter/i })
    expect(filter).toHaveValue('all')

    await userEvent.click(
      within(getSidebar()).getByRole('checkbox', { name: /show alpha client in workspace/i }),
    )

    await waitFor(() => {
      expect(filter).toHaveValue(beta.id)
    })

    await userEvent.click(
      within(getSidebar()).getByRole('checkbox', { name: /show beta podcast in workspace/i }),
    )

    await waitFor(() => {
      expect(filter).toHaveValue('all')
      expect(within(getKanbanRegion()).getByText(/no projects selected/i)).toBeInTheDocument()
    })
  })

  it('resets archive dialog tab state on reopen and keeps restore confirmation cancellable', async () => {
    const archivedProject = buildProject({
      id: 'project-archive-reset',
      name: 'Restorable Row',
      venture_id: activeVenture.id,
      status: 'archived',
    })

    installWorkspaceBackendMock({
      ventures: [activeVenture, archivedVenture],
      projects: [archivedProject],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    await userEvent.click(screen.getByRole('button', { name: /view archive/i }))
    const archiveDialog = await screen.findByRole('dialog', { name: /^archive$/i })

    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived ventures/i }))
    expect(
      within(archiveDialog).getByRole('tab', { name: /archived ventures/i }),
    ).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^archive$/i })).not.toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /view archive/i }))
    const reopened = await screen.findByRole('dialog', { name: /^archive$/i })

    expect(
      within(reopened).getByRole('tab', { name: /archived projects/i }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    const restoreTrigger = await within(reopened).findByRole('button', { name: /^restore$/i })
    await userEvent.click(restoreTrigger)

    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    expect(within(reopened).getByText('Restorable Row')).toBeInTheDocument()
  })
})
