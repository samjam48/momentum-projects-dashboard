import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'react-dom'

import {
  buildProject,
  buildTask,
  buildVenture,
  buildVentureCategoryLabel,
} from '../../test/fixtures'
import { urlFromFetchMockFirstArg } from '../../test/fetchMockUrl'
import { renderApp } from '../../test/renderApp'
import { resetBoardDisplayOptionsStore } from '../../stores/boardDisplayOptions'
import { resetProjectFilterStore } from '../../stores/projectFilter'
import { resetTestStorage } from '../../test/storage'
import { installWorkspaceBackendMock } from '../../test/workspaceBackendMock'
import {
  getArchiveViewControl,
  getKanbanColumn,
  waitForKanbanTaskVisible,
} from '../../test/workspaceQueries'

const labelSeed = buildVentureCategoryLabel({
  id: 'label-fr10',
  name: 'Hustle',
  slug: 'hustle',
})

const activeVenture = buildVenture({
  id: 'venture-fr10-active',
  name: 'FR10 Active Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

const archivedVenture = buildVenture({
  id: 'venture-fr10-archived',
  name: 'FR10 Archived Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
  status: 'archived',
})

const activeProjectAlpha = buildProject({
  id: 'project-fr10-alpha',
  name: 'Alpha Client',
  venture_id: activeVenture.id,
  colour: '#5B7C99',
})

const activeProjectBeta = buildProject({
  id: 'project-fr10-beta',
  name: 'Beta Client',
  venture_id: activeVenture.id,
  colour: '#6B8E6B',
})

const emptyArchivedFilterProject = buildProject({
  id: 'project-fr10-empty-filter',
  name: 'Empty Filter Target',
  venture_id: activeVenture.id,
  colour: '#777777',
})

const archivedProject = buildProject({
  id: 'project-fr10-archived',
  name: 'Archived Studio Row',
  venture_id: activeVenture.id,
  colour: '#9B6B55',
  status: 'archived',
})

async function openArchiveDialog(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(getArchiveViewControl())
  return screen.findByRole('dialog', { name: /^archive$/i })
}

async function switchToArchiveTasksTab(
  user: ReturnType<typeof userEvent.setup>,
  archiveDialog: HTMLElement,
): Promise<void> {
  await user.click(
    within(archiveDialog).getByRole('tab', {
      name: /archived tasks/i,
    }),
  )
}

async function selectArchivedTasksProjectFilter(
  user: ReturnType<typeof userEvent.setup>,
  archiveDialog: HTMLElement,
  optionValue: string,
): Promise<void> {
  const filter = within(archiveDialog).getByRole('combobox', {
    name: /archived tasks project filter/i,
  })
  await user.selectOptions(filter, optionValue)
}

/**
 * FR-10 — Archive dialog refactor + Archived tasks tab (integration, mocked API).
 * Behaviour-first expectations for ConfirmDialog, Select filter, ArchiveList, and feedback patterns.
 */
describe('FR-10 archive dialog and archived tasks tab (integration)', () => {
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

  it('keeps archived venture and archived project tabs usable side by side', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture, archivedVenture],
      projects: [activeProjectAlpha, archivedProject],
      tasks: [],
    })

    await renderApp()

    const archiveDialog = await openArchiveDialog(user)

    await user.click(
      within(archiveDialog).getByRole('tab', { name: /archived ventures/i }),
    )
    await waitFor(() => {
      expect(
        within(archiveDialog).getByRole('button', { name: /fr10 archived venture/i }),
      ).toBeInTheDocument()
    })

    await user.click(
      within(archiveDialog).getByRole('tab', { name: /archived projects/i }),
    )
    await waitFor(() => {
      expect(
        within(archiveDialog).getByRole('button', { name: /archived studio row/i }),
      ).toBeInTheDocument()
    })
  })

  it('exposes an Archived tasks tab backed by the archived task list contract', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [activeProjectAlpha],
      tasks: [
        buildTask({
          id: 'task-fr10-archived-only',
          project_id: activeProjectAlpha.id,
          title: 'Archived tasks tab anchor',
          status: 'archived',
        }),
      ],
    })

    await renderApp()

    const archiveDialog = await openArchiveDialog(user)
    await switchToArchiveTasksTab(user, archiveDialog)

    await waitFor(() => {
      expect(
        within(archiveDialog).getByRole('button', {
          name: /archived tasks tab anchor/i,
        }),
      ).toBeInTheDocument()
    })
  })

  it('filters archived tasks by project via the archived tasks project filter select', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [activeProjectAlpha, activeProjectBeta],
      tasks: [
        buildTask({
          id: 'task-fr10-alpha-archived',
          project_id: activeProjectAlpha.id,
          title: 'Alpha archived task',
          status: 'archived',
        }),
        buildTask({
          id: 'task-fr10-beta-archived',
          project_id: activeProjectBeta.id,
          title: 'Beta archived task',
          status: 'archived',
        }),
      ],
    })

    await renderApp()

    const archiveDialog = await openArchiveDialog(user)
    await switchToArchiveTasksTab(user, archiveDialog)

    await waitFor(() => {
      expect(
        within(archiveDialog).getByRole('button', { name: /alpha archived task/i }),
      ).toBeInTheDocument()
      expect(
        within(archiveDialog).getByRole('button', { name: /beta archived task/i }),
      ).toBeInTheDocument()
    })

    await selectArchivedTasksProjectFilter(user, archiveDialog, activeProjectAlpha.id)

    await waitFor(() => {
      expect(
        within(archiveDialog).getByRole('button', { name: /alpha archived task/i }),
      ).toBeInTheDocument()
      expect(
        within(archiveDialog).queryByRole('button', { name: /beta archived task/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('shows an explicit empty state when the project filter matches no archived tasks', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [activeProjectAlpha, emptyArchivedFilterProject],
      tasks: [
        buildTask({
          id: 'task-fr10-only-alpha-archived',
          project_id: activeProjectAlpha.id,
          title: 'Only on Alpha',
          status: 'archived',
        }),
      ],
    })

    await renderApp()

    const archiveDialog = await openArchiveDialog(user)
    await switchToArchiveTasksTab(user, archiveDialog)

    await waitFor(() => {
      expect(
        within(archiveDialog).getByRole('button', { name: /only on alpha/i }),
      ).toBeInTheDocument()
    })

    await selectArchivedTasksProjectFilter(user, archiveDialog, emptyArchivedFilterProject.id)

    await waitFor(() => {
      expect(
        within(archiveDialog).queryByRole('button', { name: /only on alpha/i }),
      ).not.toBeInTheDocument()
      expect(within(archiveDialog).getByText(/no archived tasks/i)).toBeInTheDocument()
    })
  })

  it('requires confirmation in the shared ConfirmDialog before restoring an archived task to backlog', async () => {
    const user = userEvent.setup()

    const { taskStatusRequests } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [activeProjectAlpha],
      tasks: [
        buildTask({
          id: 'task-fr10-restore-confirm',
          project_id: activeProjectAlpha.id,
          title: 'Restore confirm task',
          status: 'archived',
        }),
      ],
    })

    await renderApp()

    const archiveDialog = await openArchiveDialog(user)
    await switchToArchiveTasksTab(user, archiveDialog)

    const rowTitle = await within(archiveDialog).findByRole('button', {
      name: /restore confirm task/i,
    })
    const row = rowTitle.closest('li')
    if (!row) {
      throw new Error('Expected archived task row.')
    }

    await user.click(within(row).getByRole('button', { name: /^restore$/i }))

    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText(/restore confirm task/i)).toBeInTheDocument()

    await user.click(within(confirm).getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(taskStatusRequests).toContainEqual(
        expect.objectContaining({
          taskId: 'task-fr10-restore-confirm',
          payload: expect.objectContaining({ status: 'backlog' }),
        }),
      )
    })
  })

  it('reloads workspace tasks so restored archived tasks appear on the task board', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [activeProjectAlpha],
      tasks: [
        buildTask({
          id: 'task-fr10-workspace-reload',
          project_id: activeProjectAlpha.id,
          title: 'Workspace reload after restore',
          status: 'archived',
        }),
      ],
    })

    await renderApp()

    const backlogColumn = getKanbanColumn(/backlog/i)
    expect(
      within(backlogColumn).queryByText(/workspace reload after restore/i),
    ).not.toBeInTheDocument()

    const archiveDialog = await openArchiveDialog(user)
    await switchToArchiveTasksTab(user, archiveDialog)

    const rowTitle = await within(archiveDialog).findByRole('button', {
      name: /workspace reload after restore/i,
    })
    const row = rowTitle.closest('li')
    if (!row) {
      throw new Error('Expected archived task row.')
    }

    await user.click(within(row).getByRole('button', { name: /^restore$/i }))

    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^archive$/i })).not.toBeInTheDocument()
    })

    await waitForKanbanTaskVisible('Workspace reload after restore')
  })

  it('does not offer restoration for archived tasks whose parent project is archived', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [activeProjectAlpha, archivedProject],
      tasks: [
        buildTask({
          id: 'task-fr10-on-active-project',
          project_id: activeProjectAlpha.id,
          title: 'Restorable visible row',
          status: 'archived',
        }),
        buildTask({
          id: 'task-fr10-on-archived-project',
          project_id: archivedProject.id,
          title: 'Blocked parent project row',
          status: 'archived',
        }),
      ],
    })

    await renderApp()

    const archiveDialog = await openArchiveDialog(user)
    await switchToArchiveTasksTab(user, archiveDialog)

    await waitFor(() => {
      expect(
        within(archiveDialog).getByRole('button', {
          name: /restorable visible row/i,
        }),
      ).toBeInTheDocument()
    })

    expect(
      within(archiveDialog).queryByRole('button', { name: /blocked parent project row/i }),
    ).not.toBeInTheDocument()
  })

  it('clears stale archived task rows while the refetch is still pending after reopening', async () => {
    const user = userEvent.setup()

    let stallArchivedTasksFetch = false

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [activeProjectAlpha],
      tasks: [
        buildTask({
          id: 'task-fr10-stale',
          project_id: activeProjectAlpha.id,
          title: 'Phantom archived task',
          status: 'archived',
        }),
      ],
    })

    const delegate = fetchMock.getMockImplementation()
    if (!delegate) {
      throw new Error('Expected workspace backend mock implementation.')
    }

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlFromFetchMockFirstArg(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (
        stallArchivedTasksFetch &&
        method === 'GET' &&
        url.pathname === '/api/v1/tasks' &&
        url.searchParams.get('status') === 'archived'
      ) {
        stallArchivedTasksFetch = false
        await new Promise((resolve) => {
          setTimeout(resolve, 320)
        })
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      return delegate(input, init)
    })

    await renderApp()

    const archiveDialogFirst = await openArchiveDialog(user)
    await switchToArchiveTasksTab(user, archiveDialogFirst)
    await waitFor(() => {
      expect(
        within(archiveDialogFirst).getByRole('button', {
          name: /phantom archived task/i,
        }),
      ).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^archive$/i })).not.toBeInTheDocument()
    })

    stallArchivedTasksFetch = true

    flushSync(() => {
      fireEvent.click(getArchiveViewControl())
    })

    const reopened = screen.getByRole('dialog', { name: /^archive$/i })
    await switchToArchiveTasksTab(user, reopened)

    expect(
      within(reopened).queryByRole('button', { name: /phantom archived task/i }),
    ).not.toBeInTheDocument()
    expect(within(reopened).getByText(/loading archived tasks/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(within(reopened).queryByText(/loading archived tasks/i)).not.toBeInTheDocument()
    })

    expect(
      within(reopened).getByText(/no archived tasks/i),
    ).toBeInTheDocument()
  })
})
