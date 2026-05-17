import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from './test/renderApp'
import {
  dispatchKanbanDrop,
  dispatchProjectKanbanDrop,
  getKanbanColumn,
  switchBoardViewTab,
  waitForProjectKanbanCard,
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

const labelSeed = buildVentureCategoryLabel({
  id: 'label-fr6-shared-shell',
  name: 'Hustle',
  slug: 'hustle',
})

const activeVenture = buildVenture({
  id: 'venture-fr6-shared-shell',
  name: 'Shared Shell Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

describe('FR-6 shared kanban shell integration coverage', () => {
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

  it('keeps the board-view tablist and labeled task and project columns through both board entry points', async () => {
    const user = userEvent.setup()
    const project = buildProject({
      id: 'project-fr6-tablist',
      name: 'Shared Shell Project',
      venture_id: activeVenture.id,
      board_status: 'active',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [project],
      tasks: [
        buildTask({
          id: 'task-fr6-tablist',
          project_id: project.id,
          title: 'Shared shell task',
          status: 'backlog',
          kanban_order: 0,
        }),
      ],
    })

    await renderApp()

    const tablist = screen.getByRole('tablist', { name: /board view/i })
    expect(within(tablist).getByRole('tab', { name: /^tasks$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const backlogColumn = getKanbanColumn(/backlog/i)
    expect(backlogColumn).toHaveAccessibleName('Backlog')
    expect(within(backlogColumn).getByRole('button', { name: /shared shell task/i })).toBeInTheDocument()

    await user.click(within(tablist).getByRole('tab', { name: /^projects$/i }))

    const activeColumn = getKanbanColumn(/active/i)
    expect(activeColumn).toHaveAccessibleName('Active')
    expect(
      within(activeColumn).getByRole('button', { name: /shared shell project/i }),
    ).toBeInTheDocument()
  })

  it('preserves kanban drop test hooks for both boards through the shared board wrapper', async () => {
    const alpha = buildProject({
      id: 'project-fr6-alpha',
      name: 'Alpha Project',
      venture_id: activeVenture.id,
      board_status: 'active',
      kanban_order: 0,
    })
    const beta = buildProject({
      id: 'project-fr6-beta',
      name: 'Beta Project',
      venture_id: activeVenture.id,
      board_status: 'active',
      kanban_order: 1,
    })

    const backend = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha, beta],
      tasks: [
        buildTask({
          id: 'task-fr6-first',
          project_id: alpha.id,
          title: 'First shell task',
          status: 'backlog',
          kanban_order: 0,
        }),
        buildTask({
          id: 'task-fr6-second',
          project_id: alpha.id,
          title: 'Second shell task',
          status: 'backlog',
          kanban_order: 1,
        }),
      ],
    })

    await renderApp()

    await dispatchKanbanDrop({
      taskId: 'task-fr6-first',
      status: 'backlog',
      kanban_order: null,
    })

    await waitFor(() => {
      expect(backend.taskStatusRequests).toEqual([
        {
          taskId: 'task-fr6-first',
          payload: { status: 'backlog', kanban_order: null },
        },
      ])
    })

    await switchBoardViewTab('projects')
    await waitForProjectKanbanCard('Alpha Project', /active/i)
    await waitForProjectKanbanCard('Beta Project', /active/i)

    await dispatchProjectKanbanDrop({
      projectId: alpha.id,
      board_status: 'active',
      kanban_order: null,
    })

    await waitFor(() => {
      expect(backend.projectBoardStatusRequests).toEqual([
        {
          projectId: alpha.id,
          payload: { board_status: 'active' },
        },
      ])
    })
  })
})
