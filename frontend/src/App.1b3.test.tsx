import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderApp } from './test/renderApp'
import { resetProjectFilterStore } from './stores/projectFilter'
import {
  BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
  buildProject,
  buildTask,
  buildTimeLog,
} from './test/fixtures'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  dispatchKanbanDrop,
  expectKanbanTaskOrder,
  getBoardOptionsButton,
  clickBoardOptionsCheckbox,
  getBoardOptionsCheckbox,
  getKanbanBoard,
  getKanbanColumn,
  getKanbanRegion,
  getTaskCard,
  getTaskCardByTitle,
  openBoardOptionsMenu,
  queryHexStrings,
  queryKanbanCardMoveButtons,
  waitForKanbanCard,
  waitForKanbanTaskVisible,
  selectComboboxOption,
} from './test/workspaceQueries'

const alphaProject = buildProject({
  id: 'project-alpha',
  name: 'Alpha Client',
  colour: '#5B7C99',
})
const betaProject = buildProject({
  id: 'project-beta',
  name: 'Beta Podcast',
  colour: '#6B8E6B',
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

describe('Ticket 1b-3 task Kanban interaction and card density', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetTestStorage()
    resetProjectFilterStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetTestStorage()
    resetProjectFilterStore()
  })

  describe('card surface and linear density', () => {
    it('does not render per-card drag, reorder, or column shortcut buttons', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [
          buildTask({
            id: 'task-plan',
            project_id: 'project-alpha',
            title: 'Plan migration',
            status: 'backlog',
            kanban_order: 0,
          }),
          buildTask({
            id: 'task-draft',
            project_id: 'project-beta',
            title: 'Draft release copy',
            status: 'backlog',
            kanban_order: 1,
          }),
        ],
      })

      await renderApp()

      await waitForKanbanTaskVisible('Plan migration')
      await waitForKanbanTaskVisible('Draft release copy')

      const backlogColumn = getKanbanColumn(/backlog/i)
      const planCard = getTaskCardByTitle(backlogColumn, 'Plan migration')
      const draftCard = getTaskCardByTitle(backlogColumn, 'Draft release copy')

      expect(queryKanbanCardMoveButtons(planCard)).toHaveLength(0)
      expect(queryKanbanCardMoveButtons(draftCard)).toHaveLength(0)
    })

    it('renders linear-density cards with colour dot, clickable title, and due date by default', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [
          buildTask({
            id: 'task-launch-brief',
            project_id: 'project-alpha',
            title: 'Draft launch brief',
            priority: 'urgent',
            target_date: '2026-05-20',
            status: 'backlog',
            kanban_order: 0,
          }),
        ],
        timeLogs: {
          'task-launch-brief': [
            buildTimeLog({
              id: 'log-launch-1',
              task_id: 'task-launch-brief',
              project_id: 'project-alpha',
              hours: 2.5,
            }),
          ],
        },
      })

      await renderApp()

      await waitForKanbanTaskVisible('Draft launch brief')

      const card = getTaskCard(getKanbanColumn(/backlog/i), 'Draft launch brief')

      expect(within(card).getByTestId('kanban-task-colour-dot')).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: /draft launch brief/i })).toBeInTheDocument()
      expect(within(card).queryByText('Alpha Client')).not.toBeInTheDocument()
      expect(within(card).getByText('May 20')).toBeInTheDocument()
      expect(queryHexStrings(card)).toHaveLength(0)
      expect(within(card).queryByText(/urgent/i)).not.toBeInTheDocument()
      expect(within(card).queryByText('2.5')).not.toBeInTheDocument()
    })

    it('opens the task edit dialog when clicking a card title without persisting a drag', async () => {
      const backend = installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-open-modal',
            project_id: 'project-alpha',
            title: 'Open from title',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      const card = await waitForKanbanCard('Open from title')
      fireEvent.click(within(card).getByTestId('kanban-task-title'))

      expect(await screen.findByRole('dialog', { name: /edit task/i })).toBeInTheDocument()
      expect(backend.taskStatusRequests).toHaveLength(0)
    })
  })

  describe('board options menu', () => {
    it('shows only the due date metric by default when localStorage is empty', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-default-metrics',
            project_id: 'project-alpha',
            title: 'Default metrics task',
            priority: 'high',
            target_date: '2026-05-22',
            status: 'in_progress',
          }),
        ],
        timeLogs: {
          'task-default-metrics': [
            buildTimeLog({
              id: 'log-default',
              task_id: 'task-default-metrics',
              project_id: 'project-alpha',
              hours: 1.25,
            }),
          ],
        },
      })

      await renderApp()

      expect(localStorage.getItem(BOARD_DISPLAY_OPTIONS_STORAGE_KEY)).toBeNull()

      await waitForKanbanTaskVisible('Default metrics task', /in progress/i)

      const card = getTaskCard(getKanbanColumn(/in progress/i), 'Default metrics task')
      expect(within(card).getByText('May 22')).toBeInTheDocument()
      expect(within(card).queryByText(/high/i)).not.toBeInTheDocument()
      expect(within(card).queryByText('1.25')).not.toBeInTheDocument()
      expect(within(card).queryByTestId('kanban-task-status-badge')).not.toBeInTheDocument()
    })

    it('toggles optional card fields from the board options menu', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-toggle-fields',
            project_id: 'project-alpha',
            title: 'Toggle fields task',
            priority: 'urgent',
            target_date: '2026-05-21',
            status: 'review',
          }),
        ],
        timeLogs: {
          'task-toggle-fields': [
            buildTimeLog({
              id: 'log-toggle',
              task_id: 'task-toggle-fields',
              project_id: 'project-alpha',
              hours: 3,
            }),
          ],
        },
      })

      await renderApp()

      await openBoardOptionsMenu()
      await clickBoardOptionsCheckbox(/show priority/i)
      await clickBoardOptionsCheckbox(/show actual hours/i)

      await waitForKanbanTaskVisible('Toggle fields task', /review/i)
      const card = getTaskCard(getKanbanColumn(/review/i), 'Toggle fields task')

      await waitFor(() => {
        expect(within(card).getByText(/urgent/i)).toBeInTheDocument()
        expect(within(card).getByText('3')).toBeInTheDocument()
      })
    })

    it('persists board display options in localStorage across remounts', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-persist-options',
            project_id: 'project-alpha',
            title: 'Persist options task',
            priority: 'low',
            status: 'backlog',
          }),
        ],
      })

      const { unmount } = await renderApp()

      await openBoardOptionsMenu()
      await clickBoardOptionsCheckbox(/show priority/i)

      await waitFor(() => {
        const stored = localStorage.getItem(BOARD_DISPLAY_OPTIONS_STORAGE_KEY)
        expect(stored).not.toBeNull()
        expect(JSON.parse(stored ?? '{}') as Record<string, boolean>).toMatchObject({
          showPriority: true,
        })
      })

      unmount()
      await renderApp()

      await openBoardOptionsMenu()
      expect(getBoardOptionsCheckbox(/show priority/i)).toBeChecked()
    })
  })

  describe('project name visibility', () => {
    it('can show project name on cards when board options enable it in the all-projects view', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [
          buildTask({
            id: 'task-all-projects',
            project_id: 'project-beta',
            title: 'All projects card',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      const card = await waitForKanbanCard('All projects card')
      expect(within(card).queryByText('Beta Podcast')).not.toBeInTheDocument()

      await openBoardOptionsMenu()
      await clickBoardOptionsCheckbox(/show project name/i)

      await waitFor(() => {
        expect(within(card).getByText('Beta Podcast')).toBeInTheDocument()
      })
    })

    it('hides redundant project name when a single project is filtered unless board options enable it', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [
          buildTask({
            id: 'task-single-filter',
            project_id: 'project-alpha',
            title: 'Single filter card',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      await selectComboboxOption(/project filter/i, 'project-alpha')

      await waitForKanbanTaskVisible('Single filter card')
      const card = getTaskCard(getKanbanColumn(/backlog/i), 'Single filter card')
      expect(within(card).queryByText('Alpha Client')).not.toBeInTheDocument()

      await openBoardOptionsMenu()
      await clickBoardOptionsCheckbox(/show project name/i)

      await waitFor(() => {
        expect(within(card).getByText('Alpha Client')).toBeInTheDocument()
      })
    })
  })

  describe('kanban layout and empty states', () => {
    it('renders kanban columns in a horizontally scrollable flex row with title and task count headers', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-one',
            project_id: 'project-alpha',
            title: 'First backlog task',
            status: 'backlog',
          }),
          buildTask({
            id: 'task-two',
            project_id: 'project-alpha',
            title: 'Second backlog task',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      await waitForKanbanTaskVisible('First backlog task')
      await waitForKanbanTaskVisible('Second backlog task')
      const board = getKanbanBoard()
      expect(board).toHaveClass('kanban-grid-row')

      const backlogColumn = getKanbanColumn(/backlog/i)
      expect(within(backlogColumn).getByText(/^backlog$/i)).toHaveClass('status-pill')
      expect(within(backlogColumn).getByText('2')).toBeInTheDocument()
    })

    it('shows muted copy in empty kanban columns', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-only-backlog',
            project_id: 'project-alpha',
            title: 'Only backlog task',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      const emptyCopy = within(getKanbanColumn(/in progress/i)).getByText(/no tasks in this column/i)
      expect(emptyCopy).toHaveClass('muted-copy')
    })
  })

  describe('drag persistence and failure handling', () => {
    it('persists same-column reorders through the kanban:drop test hook', async () => {
      const backend = installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [
          buildTask({
            id: 'task-plan-migration',
            project_id: 'project-alpha',
            title: 'Plan migration',
            status: 'backlog',
            kanban_order: 0,
          }),
          buildTask({
            id: 'task-draft-copy',
            project_id: 'project-beta',
            title: 'Draft release copy',
            status: 'backlog',
            kanban_order: 1,
          }),
        ],
      })

      await renderApp()

      await waitForKanbanTaskVisible('Plan migration')
      await waitForKanbanTaskVisible('Draft release copy')

      const backlogColumn = getKanbanColumn(/backlog/i)
      await dispatchKanbanDrop({
        taskId: 'task-draft-copy',
        status: 'backlog',
        kanban_order: 0,
      })

      await waitFor(() => {
        expect(backend.taskStatusRequests).toEqual([
          {
            taskId: 'task-draft-copy',
            payload: { status: 'backlog', kanban_order: 0 },
          },
        ])
      })

      expectKanbanTaskOrder(backlogColumn, ['Draft release copy', 'Plan migration'])
    })

    it('moves a card between columns through kanban:drop and updates completed date when moved to done', async () => {
      const backend = installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-plan-migration',
            project_id: 'project-alpha',
            title: 'Plan migration',
            status: 'backlog',
            kanban_order: 0,
          }),
        ],
      })

      await renderApp()

      await waitForKanbanTaskVisible('Plan migration')

      await dispatchKanbanDrop({
        taskId: 'task-plan-migration',
        status: 'done',
        kanban_order: 0,
      })

      await waitFor(() => {
        expect(backend.taskStatusRequests).toEqual([
          {
            taskId: 'task-plan-migration',
            payload: { status: 'done', kanban_order: 0 },
          },
        ])
      })

      await waitForKanbanTaskVisible('Plan migration', /done/i)

      const doneCard = getTaskCard(getKanbanColumn(/done/i), 'Plan migration')
      fireEvent.click(within(doneCard).getByTestId('kanban-task-title'))
      const doneDialog = await screen.findByRole('dialog', { name: /edit task/i })
      expect(within(doneDialog).getByText('2026-05-26')).toBeInTheDocument()
    })

    it('rolls back kanban state and surfaces an error when status persistence fails via kanban:drop', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [
          buildTask({
            id: 'task-first-backlog',
            project_id: 'project-alpha',
            title: 'Triage launch blockers',
            status: 'backlog',
            kanban_order: 0,
          }),
          buildTask({
            id: 'task-second-backlog',
            project_id: 'project-beta',
            title: 'Schedule stakeholder review',
            status: 'backlog',
            kanban_order: 1,
          }),
        ],
        onTaskStatusUpdate: () =>
          jsonResponse({ detail: 'Unable to update task status.' }, 500),
      })

      await renderApp()

      await waitForKanbanTaskVisible('Triage launch blockers')
      await waitForKanbanTaskVisible('Schedule stakeholder review')

      const backlogColumn = getKanbanColumn(/backlog/i)
      await dispatchKanbanDrop({
        taskId: 'task-second-backlog',
        status: 'done',
        kanban_order: 0,
      })

      await waitFor(() => {
        expect(screen.getByText(/unable to update task status/i)).toBeInTheDocument()
      })

      expectKanbanTaskOrder(backlogColumn, [
        'Triage launch blockers',
        'Schedule stakeholder review',
      ])
      expect(within(getKanbanColumn(/done/i)).getByText(/no tasks in this column/i)).toBeInTheDocument()
    })

    it('ignores additional kanban drops while a status mutation is in flight', async () => {
      let releaseFirstUpdate: (() => void) | undefined
      const backend = installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [
          buildTask({
            id: 'task-first-backlog',
            project_id: 'project-alpha',
            title: 'First card',
            status: 'backlog',
            kanban_order: 0,
          }),
          buildTask({
            id: 'task-second-backlog',
            project_id: 'project-beta',
            title: 'Second card',
            status: 'backlog',
            kanban_order: 1,
          }),
        ],
        onTaskStatusUpdate: () =>
          new Promise<Response>((resolve) => {
            releaseFirstUpdate = () => {
              resolve(jsonResponse({}))
            }
          }),
      })

      await renderApp()

      await waitForKanbanTaskVisible('First card')
      await waitForKanbanTaskVisible('Second card')

      await dispatchKanbanDrop({
        taskId: 'task-first-backlog',
        status: 'in_progress',
        kanban_order: 0,
      })

      await waitFor(() => {
        expect(backend.taskStatusRequests).toHaveLength(1)
      })

      await dispatchKanbanDrop({
        taskId: 'task-second-backlog',
        status: 'done',
        kanban_order: 0,
      })

      expect(backend.taskStatusRequests).toHaveLength(1)

      releaseFirstUpdate?.()

      await waitFor(() => {
        expect(getKanbanColumn(/in progress/i)).toHaveTextContent('First card')
      })
    })
  })

  describe('board options control', () => {
    it('exposes an actionable board options menu from the projects toolbar', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      expect(getBoardOptionsButton()).toBeEnabled()
      const menu = await openBoardOptionsMenu()
      expect(within(menu).getByRole('menuitemcheckbox', { name: /show due date/i })).toBeChecked()
      expect(
        within(getKanbanRegion()).queryByRole('button', { name: /drag task/i }),
      ).not.toBeInTheDocument()
    })
  })
})
