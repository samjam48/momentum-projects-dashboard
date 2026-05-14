import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import App from './App'
import { resetProjectFilterStore, useProjectFilterStore } from './stores/projectFilter'
import {
  PROJECT_PALETTE,
  SIDEBAR_PROJECT_FILTER_STORAGE_KEY,
  buildProject,
  buildTask,
} from './test/fixtures'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  getKanbanRegion,
  getProjectFilterCheckbox,
  getSidebar,
  getTableRegion,
  queryHexStrings,
  waitForWorkspaceReady,
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

const workspaceTasks = [
  buildTask({
    id: 'task-alpha-ship',
    project_id: 'project-alpha',
    title: 'Ship landing page',
    status: 'backlog',
  }),
  buildTask({
    id: 'task-beta-record',
    project_id: 'project-beta',
    title: 'Record intro',
    status: 'in_progress',
  }),
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

describe('Ticket 1b-2 project and task modal UX', () => {
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

  describe('project dialog and sidebar layout', () => {
    it('does not render permanent on-page project create or edit forms in the sidebar', async () => {
      installWorkspaceBackendMock({ projects: [alphaProject] })

      render(<App />)
      await waitForWorkspaceReady()

      const sidebar = getSidebar()
      expect(within(sidebar).queryByLabelText(/project name/i)).not.toBeInTheDocument()
      expect(within(sidebar).queryByLabelText(/project description/i)).not.toBeInTheDocument()
      expect(within(sidebar).queryByLabelText(/project colour/i)).not.toBeInTheDocument()
      expect(within(sidebar).queryByRole('button', { name: /create project/i })).not.toBeInTheDocument()
    })

    it('opens project create and edit flows in a shadcn Dialog instead of inline sidebar forms', async () => {
      installWorkspaceBackendMock({ projects: [alphaProject] })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /new project/i }))
      const createDialog = await screen.findByRole('dialog', { name: /new project/i })
      expect(createDialog).toHaveAttribute('data-slot', 'dialog-content')

      fireEvent.click(within(createDialog).getByRole('button', { name: /cancel/i }))

      fireEvent.click(
        within(getSidebar()).getByRole('button', { name: /^alpha client$/i }),
      )
      const editDialog = await screen.findByRole('dialog', { name: /edit project/i })
      expect(editDialog).toHaveAttribute('data-slot', 'dialog-content')
    })

    it('shows coloured project chips in the sidebar without visible hex strings', async () => {
      installWorkspaceBackendMock({ projects: [alphaProject, betaProject] })

      render(<App />)
      await waitForWorkspaceReady()

      const sidebar = getSidebar()
      expect(within(sidebar).getByTestId('project-chip-project-alpha')).toBeInTheDocument()
      expect(within(sidebar).getByTestId('project-chip-project-beta')).toBeInTheDocument()
      expect(queryHexStrings(sidebar)).toHaveLength(0)
    })

    it('opens the edit dialog when clicking a project title and places Archive at the bottom of the dialog', async () => {
      installWorkspaceBackendMock({ projects: [alphaProject] })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /^alpha client$/i }))

      const dialog = await screen.findByRole('dialog', { name: /edit project/i })
      const archiveButton = within(dialog).getByRole('button', { name: /archive project/i })
      const dialogActions = within(dialog).getByTestId('project-dialog-actions')

      expect(dialogActions.compareDocumentPosition(archiveButton)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING,
      )
    })

    it('exposes a View archive link in the sidebar footer', async () => {
      installWorkspaceBackendMock({ projects: [alphaProject] })

      render(<App />)
      await waitForWorkspaceReady()

      const sidebar = getSidebar()
      expect(within(sidebar).getByRole('link', { name: /view archive/i })).toBeInTheDocument()
    })

    it('shows a disabled + Hustle stub labelled for Phase 1.6', async () => {
      installWorkspaceBackendMock({ projects: [alphaProject] })

      render(<App />)
      await waitForWorkspaceReady()

      const hustleButton = within(getSidebar()).getByRole('button', { name: /\+ hustle/i })
      expect(hustleButton).toBeDisabled()
      expect(hustleButton).toHaveAccessibleName(/1\.6/i)
    })
  })

  describe('colour picker', () => {
    it('labels the picker Colour, shows only the selected swatch by default, and reveals all 12 palette options on click', async () => {
      installWorkspaceBackendMock({ projects: [] })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /new project/i }))
      const dialog = await screen.findByRole('dialog', { name: /new project/i })

      expect(within(dialog).getByText(/^colour$/i)).toBeInTheDocument()

      const picker = within(dialog).getByRole('button', { name: /^colour$/i })
      expect(within(dialog).queryAllByRole('radio')).toHaveLength(0)

      fireEvent.click(picker)

      const swatches = within(dialog).getAllByRole('radio', { name: /colour swatch/i })
      expect(swatches).toHaveLength(PROJECT_PALETTE.length)
      expect(queryHexStrings(dialog)).toHaveLength(0)
    })

    it('exposes keyboard focus on the colour swatch trigger with a visible focus ring', async () => {
      installWorkspaceBackendMock({ projects: [] })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /new project/i }))
      const dialog = await screen.findByRole('dialog', { name: /new project/i })
      const picker = within(dialog).getByRole('button', { name: /^colour$/i })

      picker.focus()
      expect(picker).toHaveFocus()
      expect(picker.className).toMatch(/focus-visible|ring/)
    })
  })

  describe('sidebar multi-select filter', () => {
    it('renders a checkbox per active project with all projects selected by default', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      expect(getProjectFilterCheckbox('Alpha Client')).toBeChecked()
      expect(getProjectFilterCheckbox('Beta Podcast')).toBeChecked()
    })

    it('scopes the Kanban board and summary table to checked projects', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(getProjectFilterCheckbox('Alpha Client'))

      const kanban = getKanbanRegion()
      const table = within(getTableRegion()).getByRole('table')

      await waitFor(() => {
        expect(within(kanban).getByText('Record intro')).toBeInTheDocument()
        expect(within(kanban).queryByText('Ship landing page')).not.toBeInTheDocument()
        expect(within(table).getByText('Record intro')).toBeInTheDocument()
        expect(within(table).queryByText('Ship landing page')).not.toBeInTheDocument()
      })
    })

    it('persists sidebar multi-select choices in localStorage across remounts', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
      })

      const { unmount } = render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(getProjectFilterCheckbox('Beta Podcast'))

      await waitFor(() => {
        const stored = localStorage.getItem(SIDEBAR_PROJECT_FILTER_STORAGE_KEY)
        expect(stored).not.toBeNull()
        expect(JSON.parse(stored ?? '[]') as string[]).toEqual(['project-alpha'])
      })

      unmount()
      render(<App />)
      await waitForWorkspaceReady()

      expect(getProjectFilterCheckbox('Alpha Client')).toBeChecked()
      expect(getProjectFilterCheckbox('Beta Podcast')).not.toBeChecked()
    })

    it('keeps the toolbar project filter aligned with sidebar multi-select', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.change(screen.getByRole('combobox', { name: /project filter/i }), {
        target: { value: 'project-alpha' },
      })

      await waitFor(() => {
        expect(getProjectFilterCheckbox('Alpha Client')).toBeChecked()
        expect(getProjectFilterCheckbox('Beta Podcast')).not.toBeChecked()
        expect(screen.getByRole('combobox', { name: /project filter/i })).toHaveValue(
          'project-alpha',
        )
      })

      fireEvent.click(getProjectFilterCheckbox('Beta Podcast'))

      await waitFor(() => {
        expect(getProjectFilterCheckbox('Alpha Client')).toBeChecked()
        expect(getProjectFilterCheckbox('Beta Podcast')).toBeChecked()
        expect(screen.getByRole('combobox', { name: /project filter/i })).toHaveValue('all')
      })
    })

    it('shows an empty Kanban and table with clear guidance when zero projects are checked', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(getProjectFilterCheckbox('Alpha Client'))
      fireEvent.click(getProjectFilterCheckbox('Beta Podcast'))

      const kanban = getKanbanRegion()
      const table = within(getTableRegion()).getByRole('table')

      await waitFor(() => {
        expect(within(kanban).getByText(/no projects selected/i)).toBeInTheDocument()
        expect(within(table).getByText(/no projects selected/i)).toBeInTheDocument()
      })
    })
  })

  describe('task dialog wiring', () => {
    it('opens the existing task dialog from the toolbar with all required fields', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(screen.getByRole('button', { name: /new task/i }))

      const dialog = await screen.findByRole('dialog', { name: /new task/i })
      expect(within(dialog).getByLabelText(/title/i)).toBeInTheDocument()
      expect(within(dialog).getByLabelText(/description/i)).toBeInTheDocument()
      expect(within(dialog).getByRole('combobox', { name: /^project$/i })).toBeInTheDocument()
      expect(within(dialog).getByRole('combobox', { name: /status/i })).toBeInTheDocument()
      expect(within(dialog).getByRole('combobox', { name: /priority/i })).toBeInTheDocument()
      expect(within(dialog).getByLabelText(/target date/i)).toBeInTheDocument()
      expect(within(dialog).getByLabelText(/estimated hours/i)).toBeInTheDocument()
    })
  })

  describe('mutation consistency and edge cases', () => {
    it('keeps Kanban and table in sync after creating a project without a full-page reload', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /new project/i }))
      const dialog = await screen.findByRole('dialog', { name: /new project/i })

      fireEvent.change(within(dialog).getByLabelText(/project name/i), {
        target: { value: 'Gamma Studio' },
      })
      fireEvent.click(within(dialog).getByRole('button', { name: /^colour$/i }))
      fireEvent.click(
        within(dialog).getByRole('radio', { name: /colour swatch terracotta/i }),
      )
      fireEvent.click(within(dialog).getByRole('button', { name: /create project/i }))

      await waitFor(() => {
        expect(within(getSidebar()).getByText('Gamma Studio')).toBeInTheDocument()
      })

      expect(screen.queryByText(/loading workspace/i)).not.toBeInTheDocument()
      expect(getKanbanRegion()).toBeInTheDocument()
      expect(getTableRegion()).toBeInTheDocument()
    })

    it('preserves project dialog form state when validation fails', async () => {
      installWorkspaceBackendMock({
        projects: [],
        onProjectCreate: () =>
          jsonResponse({ detail: 'colour must match #RRGGBB' }, 422),
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /new project/i }))
      const dialog = await screen.findByRole('dialog', { name: /new project/i })

      fireEvent.change(within(dialog).getByLabelText(/project name/i), {
        target: { value: 'Podcast' },
      })
      fireEvent.click(within(dialog).getByRole('button', { name: /create project/i }))

      expect(await within(dialog).findByText(/colour must match/i)).toBeInTheDocument()
      expect(within(dialog).getByLabelText(/project name/i)).toHaveValue('Podcast')
      expect(screen.getByRole('dialog', { name: /new project/i })).toBeInTheDocument()
    })

    it('keeps filter state unchanged when archive API fails', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
        onProjectArchive: () => jsonResponse({ detail: 'Unable to archive project.' }, 500),
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.change(screen.getByRole('combobox', { name: /project filter/i }), {
        target: { value: 'project-beta' },
      })

      await waitFor(() => {
        expect(getProjectFilterCheckbox('Beta Podcast')).toBeChecked()
        expect(getProjectFilterCheckbox('Alpha Client')).not.toBeChecked()
        expect(screen.getByRole('combobox', { name: /project filter/i })).toHaveValue(
          'project-beta',
        )
      })

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /^beta podcast$/i }))
      const dialog = await screen.findByRole('dialog', { name: /edit project/i })
      fireEvent.click(within(dialog).getByRole('button', { name: /archive project/i }))

      await waitFor(() => {
        expect(within(dialog).getByText(/unable to archive project/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        const filterState = useProjectFilterStore.getState()
        expect(filterState.selectedProjectId).toBe('project-beta')
        expect(filterState.selectedProjectIds).toEqual(['project-beta'])
        expect(JSON.parse(localStorage.getItem(SIDEBAR_PROJECT_FILTER_STORAGE_KEY) ?? '[]')).toEqual(
          ['project-beta'],
        )
      })
    })

    it('resets the multi-select filter to all projects when the only checked project is archived', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      fireEvent.click(getProjectFilterCheckbox('Alpha Client'))
      expect(getProjectFilterCheckbox('Beta Podcast')).toBeChecked()
      expect(getProjectFilterCheckbox('Alpha Client')).not.toBeChecked()

      fireEvent.click(within(getSidebar()).getByRole('button', { name: /^beta podcast$/i }))
      const dialog = await screen.findByRole('dialog', { name: /edit project/i })
      fireEvent.click(within(dialog).getByRole('button', { name: /archive project/i }))

      await waitFor(() => {
        expect(getProjectFilterCheckbox('Alpha Client')).toBeChecked()
        expect(within(getSidebar()).queryByText('Beta Podcast')).not.toBeInTheDocument()
      })
    })

    it('does not list archived projects in the active sidebar list or open their edit dialog', async () => {
      const archivedProject = buildProject({
        id: 'project-archived',
        name: 'Archived Venture',
        status: 'archived',
      })

      installWorkspaceBackendMock({
        projects: [alphaProject, archivedProject],
        tasks: workspaceTasks,
      })

      render(<App />)
      await waitForWorkspaceReady()

      const sidebar = getSidebar()
      expect(within(sidebar).queryByRole('button', { name: /archived venture/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: /edit project/i })).not.toBeInTheDocument()
    })
  })
})
