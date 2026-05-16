import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderApp, renderAppBare } from './test/renderApp'
import { resetProjectFilterStore } from './stores/projectFilter'
import { buildProject, buildTask } from './test/fixtures'
import { urlFromFetchMockFirstArg } from './test/fetchMockUrl'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  getArchiveViewControl,
  getKanbanBoard,
  getKanbanBoardOptionsControl,
  getKanbanColumn,
  getKanbanRegion,
  clickProjectFilterCheckbox,
  getSidebar,
  getTableRegion,
  getTableSortControl,
  getTaskCardByTitle,
  getTaskSummaryFilterSubtitle,
  getTopNavProjectsControl,
  openTableSortMenu,
  waitForKanbanTaskVisible,
  selectComboboxOption,
} from './test/workspaceQueries'

const srcRoot = resolve(process.cwd(), 'src')

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
const gammaProject = buildProject({
  id: 'project-gamma',
  name: 'Gamma Studio',
  colour: '#7B5EA7',
})
const archivedProject = buildProject({
  id: 'project-archived',
  name: 'Sunset Studio',
  colour: '#9B6B55',
  status: 'archived',
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function installDelayedProjectsMock(
  projects: ReturnType<typeof buildProject>[],
  delayMs = 50,
): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlFromFetchMockFirstArg(input)
    const pathname = url.pathname
    const method = init?.method ?? 'GET'

    if (method === 'GET' && pathname === '/api/v1/projects') {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs)
      })
      const status = url.searchParams.get('status')
      const items =
        status === 'archived'
          ? projects.filter((project) => project.status === 'archived')
          : projects.filter((project) => project.status === 'active')
      return jsonResponse(items)
    }

    if (method === 'GET' && pathname === '/api/v1/tasks') {
      return jsonResponse([])
    }

    return jsonResponse([])
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Ticket 1b-4 Projects page polish', () => {
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

  describe('archive dialog (projects tab)', () => {
    it('opens a dialog from View archive and fetches archived projects', async () => {
      const { fetchMock } = installWorkspaceBackendMock({
        projects: [alphaProject, archivedProject],
        tasks: [],
      })

      await renderApp()

      fireEvent.click(getArchiveViewControl())

      const dialog = await screen.findByRole('dialog', { name: /archive/i })
      expect(dialog).toHaveAttribute('data-slot', 'dialog-content')

      await waitFor(() => {
        const archivedRequest = fetchMock.mock.calls.some(([first]) => {
          const url = urlFromFetchMockFirstArg(first)
          return (
            url.pathname === '/api/v1/projects' && url.searchParams.get('status') === 'archived'
          )
        })
        expect(archivedRequest).toBe(true)
      })

      expect(await within(dialog).findByText('Sunset Studio')).toBeInTheDocument()
      expect(within(dialog).getByTestId('archive-project-dot-project-archived')).toBeInTheDocument()
    })

    it('exposes Archived ventures and Archived projects tabs (1.6-8) with ventures empty state', async () => {
      const { fetchMock } = installWorkspaceBackendMock({
        projects: [alphaProject, archivedProject],
        tasks: [],
      })

      await renderApp()

      fireEvent.click(getArchiveViewControl())
      const dialog = await screen.findByRole('dialog', { name: /archive/i })

      expect(within(dialog).getByRole('tab', { name: /archived ventures/i })).toBeInTheDocument()
      expect(within(dialog).getByRole('tab', { name: /archived projects/i })).toBeInTheDocument()

      await waitFor(() => {
        const archivedVenturesRequest = fetchMock.mock.calls.some(([first]) => {
          const url = urlFromFetchMockFirstArg(first)
          return url.pathname === '/api/v1/ventures' && url.searchParams.get('status') === 'archived'
        })
        expect(archivedVenturesRequest).toBe(true)
      })

      fireEvent.click(within(dialog).getByRole('tab', { name: /archived ventures/i }))

      await waitFor(() => {
        expect(within(dialog).getByText(/no archived ventures/i)).toBeInTheDocument()
      })
    })

    it('shows an empty state when no archived projects exist', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      fireEvent.click(getArchiveViewControl())
      const dialog = await screen.findByRole('dialog', { name: /archive/i })

      expect(
        await within(dialog).findByText(/no archived projects/i),
      ).toBeInTheDocument()
    })
  })

  describe('sidebar loading state', () => {
    it('shows a dedicated sidebar loading state without interactive filter chrome', async () => {
      installDelayedProjectsMock([alphaProject, betaProject], 200)

      renderAppBare()

      const sidebar = await screen.findByRole('complementary', { name: /projects sidebar/i })
      expect(within(sidebar).getByTestId('sidebar-loading-state')).toBeInTheDocument()
      expect(within(sidebar).queryByRole('checkbox')).not.toBeInTheDocument()
      expect(within(sidebar).queryByTestId(/sidebar-project-/)).not.toBeInTheDocument()
      expect(within(sidebar).queryByLabelText(/project name/i)).not.toBeInTheDocument()
    })
  })

  describe('TopNav Projects control', () => {
    it('uses a non-navigating button for Projects instead of an anchor link', async () => {
      installWorkspaceBackendMock({ projects: [alphaProject], tasks: [] })

      await renderApp()

      const projectsControl = getTopNavProjectsControl()
      expect(projectsControl.tagName).toBe('BUTTON')
      expect(projectsControl).toHaveAttribute('aria-current', 'page')
    })
  })

  describe('task summary filter subtitle copy', () => {
    it('shows human copy for all projects, counts, and a single project name', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject, gammaProject],
        tasks: [
          buildTask({
            id: 'task-alpha',
            project_id: 'project-alpha',
            title: 'Alpha task',
            status: 'backlog',
          }),
          buildTask({
            id: 'task-beta',
            project_id: 'project-beta',
            title: 'Beta task',
            status: 'backlog',
          }),
          buildTask({
            id: 'task-gamma',
            project_id: 'project-gamma',
            title: 'Gamma task',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      expect(getTaskSummaryFilterSubtitle()).toHaveTextContent(/^Showing all projects$/i)
      expect(screen.queryByText(/shared filter target/i)).not.toBeInTheDocument()

      await clickProjectFilterCheckbox('Gamma Studio')

      await waitFor(() => {
        expect(getTaskSummaryFilterSubtitle()).toHaveTextContent(/^Showing 2 projects$/i)
      })

      await selectComboboxOption(/project filter/i, 'project-alpha')

      await waitFor(() => {
        expect(getTaskSummaryFilterSubtitle()).toHaveTextContent(/^Showing Alpha Client$/i)
      })
    })
  })

  describe('sidebar project row layout', () => {
    it('places the colour dot left of the title and the checkbox on the right without a title chip', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [],
      })

      await renderApp()

      const row = within(getSidebar()).getByTestId('sidebar-project-project-alpha')
      const dot = within(row).getByTestId('project-colour-dot')
      const title = within(row).getByRole('button', { name: /^alpha client$/i })
      const checkbox = within(row).getByRole('checkbox', { name: /alpha client/i })

      expect(within(row).queryByTestId('project-chip-project-alpha')).not.toBeInTheDocument()
      expect(dot.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(title.compareDocumentPosition(checkbox)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
  })

  describe('board options gear placement', () => {
    it('renders a gear control on the Kanban title bar instead of the toolbar', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      const toolbar = screen.getByRole('toolbar', { name: /projects page/i })
      expect(
        within(toolbar).queryByRole('button', { name: /board options|display options/i }),
      ).not.toBeInTheDocument()

      const boardOptions = getKanbanBoardOptionsControl()
      expect(boardOptions).toHaveAccessibleName(/board options|display options/i)
      expect(boardOptions.querySelector('svg')).toBeInTheDocument()
    })

    it('omits status from board options and uses checkbox menu items', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      fireEvent.click(getKanbanBoardOptionsControl())
      const menu = screen.getByRole('menu', { name: /board options|display options/i })

      expect(within(menu).queryByRole('menuitemcheckbox', { name: /show status/i })).not.toBeInTheDocument()
      expect(within(menu).getByRole('menuitemcheckbox', { name: /show due date/i })).toBeInTheDocument()
    })
  })

  describe('four-column Kanban layout', () => {
    it('renders four status columns in one horizontal row instead of a 2x2 grid', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-backlog',
            project_id: 'project-alpha',
            title: 'Backlog task',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      await waitForKanbanTaskVisible('Backlog task')

      const board = getKanbanBoard()
      expect(board).toHaveClass('kanban-grid-row')
      expect(board).not.toHaveClass('kanban-grid')
      expect(board.querySelectorAll('section.kanban-column')).toHaveLength(4)

      ;[/backlog/i, /in progress/i, /review/i, /done/i].forEach((label) => {
        expect(getKanbanColumn(label)).toBeInTheDocument()
      })
    })
  })

  describe('Kanban card due date format', () => {
    it('formats default due dates as MMM DD on cards', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-due-date',
            project_id: 'project-alpha',
            title: 'Due date card',
            target_date: '2026-05-20',
            status: 'backlog',
          }),
          buildTask({
            id: 'task-sep-date',
            project_id: 'project-alpha',
            title: 'September card',
            target_date: '2026-09-09',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      await waitForKanbanTaskVisible('Due date card')

      const backlogColumn = getKanbanColumn(/backlog/i)
      const mayCard = getTaskCardByTitle(backlogColumn, 'Due date card')
      const sepCard = getTaskCardByTitle(backlogColumn, 'September card')

      expect(within(mayCard).getByText('May 20')).toBeInTheDocument()
      expect(within(mayCard).queryByText('2026-05-20')).not.toBeInTheDocument()
      expect(within(sepCard).getByText('Sep 09')).toBeInTheDocument()
    })
  })

  describe('task summary table sort gear', () => {
    it('exposes a Sort by dropdown from a gear control on the section title bar', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [
          buildTask({
            id: 'task-sort',
            project_id: 'project-alpha',
            title: 'Sortable task',
            status: 'backlog',
          }),
        ],
      })

      await renderApp()

      const sortControl = getTableSortControl()
      expect(sortControl.querySelector('svg')).toBeInTheDocument()

      const menu = await openTableSortMenu()
      expect(within(menu).getByText(/^sort by$/i)).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: /project/i })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: /target date/i })).toBeInTheDocument()
    })
  })

  describe('App.tsx extraction landmarks', () => {
    it('extracts TaskKanbanBoard wiring from App', () => {
      expect(existsSync(resolve(srcRoot, 'components/TaskKanbanBoard.tsx'))).toBe(true)
    })

    it('extracts TaskSummaryTable wiring from App', () => {
      expect(existsSync(resolve(srcRoot, 'components/TaskSummaryTable.tsx'))).toBe(true)
    })

    it('extracts workspace dialog orchestration from App', () => {
      expect(existsSync(resolve(srcRoot, 'components/WorkspaceDialogs.tsx'))).toBe(true)
    })

    it('keeps Projects page regions mounted through extracted components', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      expect(getKanbanRegion()).toBeInTheDocument()
      expect(getTableRegion()).toBeInTheDocument()
      expect(within(getKanbanRegion()).getByRole('heading', { name: /tasks/i })).toBeInTheDocument()
    })
  })
})
