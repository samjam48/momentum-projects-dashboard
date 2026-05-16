import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildProject,
  buildTask,
  buildTimeLog,
  buildVenture,
  buildVentureCategoryLabel,
} from './test/fixtures'
import { renderApp } from './test/renderApp'
import {
  BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
  resetBoardDisplayOptionsStore,
} from './stores/boardDisplayOptions'
import {
  DEFAULT_PROJECT_FILTER,
  resetProjectFilterStore,
  useProjectFilterStore,
} from './stores/projectFilter'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  dispatchKanbanDrop,
  getKanbanRegion,
  getSidebar,
  getTableRegion,
  switchBoardViewTab,
  waitForKanbanCard,
  waitForProjectKanbanCard,
  waitForWorkspaceReady,
} from './test/workspaceQueries'

const labelSeed = buildVentureCategoryLabel({ id: 'label-seed-1', name: 'Hustle', slug: 'hustle' })
const ventureBase = buildVenture({
  id: 'venture-test',
  name: 'Test Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

/** Integration: boards + filters + project dialog after 1.6-10/11 landed. */
const STALE_WAIT = { timeout: 4000 }

describe('Ticket 1.6-12 — cross-feature stale state after mutations', () => {
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

  it('removes a project from the type-filtered Project Kanban after Save project changes project_type', async () => {
    const assetProject = buildProject({
      id: 'p-stale-type',
      name: 'Stale filter asset',
      venture_id: ventureBase.id,
      project_type: 'asset',
      board_status: 'active',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [assetProject],
      tasks: [
        buildTask({
          id: 't-keep-board-warm',
          project_id: assetProject.id,
          title: 'Warm task',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const typeFilter = screen.getByRole('combobox', { name: /project type(?: filter)?/i })
    await user.selectOptions(typeFilter, 'asset')

    const card = await waitForProjectKanbanCard('Stale filter asset', /active/i, STALE_WAIT)
    await user.click(within(card).getByTestId('kanban-project-title'))

    const dialog = await screen.findByRole('dialog', { name: /edit project/i })
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /project type/i }),
      'project',
    )
    await user.click(within(dialog).getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      expect(within(getKanbanRegion()).queryByText(/stale filter asset/i)).not.toBeInTheDocument()
    }, STALE_WAIT)
  })

  it('shows In progress in Task summary table after backlog → in_progress Kanban move', async () => {
    const projId = 'proj-k-summ'
    const taskId = 'task-k-summ'

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        buildProject({
          id: projId,
          name: 'Kanban Summary Project',
          venture_id: ventureBase.id,
        }),
      ],
      tasks: [
        buildTask({
          id: taskId,
          title: 'Kanban summary mover',
          project_id: projId,
          status: 'backlog',
          kanban_order: 0,
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()

    await waitForKanbanCard('Kanban summary mover')
    await dispatchKanbanDrop({ taskId, status: 'in_progress', kanban_order: 0 })

    const table = await within(getTableRegion()).findByRole('table')

    await waitFor(() => {
      const summaryRow = within(table).getByRole('button', {
        name: /^Edit task Kanban summary mover$/i,
      }).closest('tr')
      expect(summaryRow).not.toBeNull()
      if (!summaryRow) {
        throw new Error('Expected summary row.')
      }

      expect(within(summaryRow as HTMLElement).getByText(/^In progress$/i)).toBeInTheDocument()
    }, STALE_WAIT)
  })

  it('shows updated Activity type primary label after saving Edit time log (PATCH) from Edit task dialog', async () => {
    const projId = 'proj-time-co'
    const taskId = 'task-time-co'
    const logId = 'log-time-co'

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        buildProject({
          id: projId,
          name: 'Timelog coherence project',
          venture_id: ventureBase.id,
        }),
      ],
      tasks: [
        buildTask({
          id: taskId,
          title: 'Timelog coherence task',
          project_id: projId,
          status: 'backlog',
        }),
      ],
      timeLogs: {
        [taskId]: [
          buildTimeLog({
            id: logId,
            task_id: taskId,
            project_id: projId,
            activity_type_id: 'at-seed-planning',
            activity_type_name: 'planning',
            activity_type_display_name: 'Planning',
            hours: 1,
          }),
        ],
      },
    })

    await renderApp()
    await waitForWorkspaceReady()

    await user.click(
      within(getTableRegion()).getByRole('button', { name: /^Edit task Timelog coherence task$/ }),
    )

    await screen.findByRole('dialog', { name: /^Edit task$/ })

    await user.click(
      screen.getByRole('button', { name: /^Edit time log Planning$/ }),
    )

    const nestedLogDialog = await screen.findByRole('dialog', { name: /^Edit time log$/ })

    const combo = within(nestedLogDialog).getByRole('combobox', { name: /^Activity type$/ })
    await user.click(combo)
    await user.clear(combo)

    await user.click(within(nestedLogDialog).getByRole('option', { name: /^Meeting$/ }))

    await user.click(within(nestedLogDialog).getByRole('button', { name: /^Save$/ }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^Edit time log$/ })).not.toBeInTheDocument()
    })

    const taskShell = screen.getByRole('dialog', { name: /^Edit task$/ })
    await waitFor(() => {
      const rowWrap = within(taskShell).getByTestId(`time-log-row-${logId}`)
      expect(within(rowWrap).getByTestId('time-log-row-primary')).toHaveTextContent(/Meeting/i)
    })
  })

  it('archiving a venture via sidebar hides the venture and its child projects from the active sidebar tree', async () => {
    const ventureCascade = buildVenture({
      id: 'venture-shell-archive',
      name: 'Cascade Studio',
      category_label: labelSeed,
      category_label_id: labelSeed.id,
    })

    installWorkspaceBackendMock({
      ventures: [ventureCascade],
      projects: [
        buildProject({
          id: 'proj-under-venture-shell',
          name: 'Depends on venture archive',
          venture_id: ventureCascade.id,
          status: 'active',
          board_status: 'active',
          kanban_order: 0,
        }),
      ],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    expect(screen.getByTestId(`sidebar-venture-${ventureCascade.id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`sidebar-project-proj-under-venture-shell`)).toBeInTheDocument()

    await user.click(within(getSidebar()).getByRole('button', { name: /^Cascade Studio$/ }))
    const ventureArchiveDialog = await screen.findByRole('dialog', {
      name: /Cascade Studio/i,
    })

    await user.click(
      within(ventureArchiveDialog).getByRole('button', { name: /^Archive venture$/ }),
    )

    await waitFor(() => {
      expect(
        screen.queryByTestId(`sidebar-venture-${ventureCascade.id}`),
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('sidebar-project-proj-under-venture-shell')).not.toBeInTheDocument()
    }, STALE_WAIT)
  })

  it('handles corrupt board-display localStorage JSON without crashing the workspace shell', async () => {
    globalThis.localStorage.setItem(
      BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
      '{broken-localstorage-json',
    )

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        buildProject({
          id: 'proj-ls-health',
          name: 'Ls health probe',
          venture_id: ventureBase.id,
        }),
      ],
      tasks: [],
    })

    await expect(renderApp()).resolves.toBeTruthy()
    await waitForWorkspaceReady()

    await expect(within(screen.getByRole('complementary', { name: /projects sidebar/i })).findByRole(
      'button',
      { name: /^Ls health probe$/i },
    )).resolves.toBeTruthy()
  })

  it('handles persisted sidebar selections that resolve to zero real projects without crashing', async () => {
    resetProjectFilterStore()
    useProjectFilterStore.setState({
      selectedProjectId: DEFAULT_PROJECT_FILTER,
      selectedProjectIds: ['persisted-but-not-in-backend'],
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        buildProject({
          id: 'proj-persist-peer',
          name: 'Stale filter peer',
          venture_id: ventureBase.id,
        }),
      ],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    await expect(
      within(getKanbanRegion()).findByText(/no projects selected/i),
    ).resolves.toBeInTheDocument()
  })
})
