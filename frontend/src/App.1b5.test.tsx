import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderApp } from './test/renderApp'
import type { Task } from './api/types'
import { resetProjectFilterStore } from './stores/projectFilter'
import { buildProject, buildTask, buildTimeLog } from './test/fixtures'
import { urlFromFetchMockFirstArg } from './test/fetchMockUrl'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  getArchiveViewControl,
  getKanbanRegion,
  waitForKanbanTaskVisible,
} from './test/workspaceQueries'

const alphaProject = buildProject({
  id: 'project-alpha',
  name: 'Alpha Client',
  colour: '#5B7C99',
})

const releaseNotesTask = buildTask({
  id: 'task-write-release-notes',
  project_id: 'project-alpha',
  title: 'Write release notes',
  status: 'done',
  completed_date: '2026-05-18',
  actual_hours: 2,
})

const archivedTask = {
  ...buildTask({
    id: 'task-archived-draft',
    project_id: 'project-alpha',
    title: 'Retired draft',
    status: 'backlog',
  }),
  status: 'archived',
} as Task

const DEV_META_COPY = [
  /phase 1 workspace/i,
  /backend-derived/i,
  /manual entries refresh task totals/i,
  /save the task before adding manual time logs/i,
  /update details and capture manual time logs/i,
]

function assertNoDevMetaCopy(container: HTMLElement): void {
  DEV_META_COPY.forEach((pattern) => {
    expect(within(container).queryByText(pattern)).not.toBeInTheDocument()
  })
}

async function openNewTaskDialog(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: /new task/i }))
  return screen.findByRole('dialog')
}

async function openEditTaskDialog(taskTitle: string): Promise<HTMLElement> {
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`edit task ${taskTitle}`, 'i') }),
  )
  return screen.findByRole('dialog')
}

function getTaskDialogFooter(dialog: HTMLElement): HTMLElement {
  const footer = within(dialog).queryByTestId('task-dialog-footer')
  if (footer) {
    return footer
  }

  return within(dialog).getByRole('contentinfo', { name: /task actions/i })
}

describe('Ticket 1b-5 task modal, time logs, and archived tasks', () => {
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

  describe('stripped dev and meta copy', () => {
    it('removes implementation-note placeholder strings from create and edit task dialogs', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
        timeLogs: {
          'task-write-release-notes': [
            buildTimeLog({
              id: 'log-1',
              task_id: 'task-write-release-notes',
              project_id: 'project-alpha',
              hours: 2,
              logged_date: '2026-05-13',
              notes: 'Drafted launch copy',
            }),
          ],
        },
      })

      await renderApp()

      const createDialog = await openNewTaskDialog()
      assertNoDevMetaCopy(createDialog)

      fireEvent.click(within(createDialog).getByRole('button', { name: /cancel/i }))

      const editDialog = await openEditTaskDialog('Write release notes')
      assertNoDevMetaCopy(editDialog)
    })
  })

  describe('new task modal minimal chrome', () => {
    it('omits task detail header, actual-hours block, and time-log guidance on create', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      const dialog = await openNewTaskDialog()

      expect(within(dialog).queryByRole('heading', { name: /new task/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: /edit task/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: /task detail/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByText(/^actual hours$/i)).not.toBeInTheDocument()
      expect(within(dialog).queryByText(/^completed date$/i)).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /add time log/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByText(/save the task before adding/i)).not.toBeInTheDocument()
    })
  })

  describe('edit task modal chrome', () => {
    it('uses an icon close control, editable h3 task title, and Cancel plus Archive footer actions', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')

      const closeControl = within(dialog).getByRole('button', { name: /close task/i })
      expect(closeControl.querySelector('svg')).toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument()

      const titleHeading = within(dialog).getByRole('heading', {
        level: 3,
        name: /write release notes/i,
      })
      expect(titleHeading).toHaveAttribute('contenteditable', 'true')
      expect(within(dialog).queryByLabelText(/^title$/i)).not.toBeInTheDocument()

      const footer = getTaskDialogFooter(dialog)
      const cancelButton = within(footer).getByRole('button', { name: /^cancel$/i })
      const archiveAction = within(footer).getByRole('button', { name: /^archive$/i })

      expect(cancelButton.className).toMatch(/primary|default/)
      expect(archiveAction.className).toMatch(/link|ghost|muted|text/)
      expect(within(footer).queryByRole('button', { name: /save task/i })).not.toBeInTheDocument()
      expect(within(footer).queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument()
    })
  })

  describe('blur and close save with cancel discard', () => {
    it('persists field edits on blur and when closing via the icon', async () => {
      const { fetchMock } = installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')

      const descriptionField = within(dialog).getByLabelText(/description/i)
      fireEvent.change(descriptionField, { target: { value: 'Updated release copy' } })
      fireEvent.blur(descriptionField)

      await waitFor(() => {
        const patchOnBlur = fetchMock.mock.calls.some(([input, init]) => {
          const url = urlFromFetchMockFirstArg(input)
          return (
            url.pathname === '/api/v1/tasks/task-write-release-notes' &&
            init?.method === 'PATCH' &&
            typeof init?.body === 'string' &&
            init.body.includes('Updated release copy')
          )
        })
        expect(patchOnBlur).toBe(true)
      })

      const titleHeading = within(dialog).getByRole('heading', {
        level: 3,
        name: /write release notes/i,
      })
      fireEvent.focus(titleHeading)
      fireEvent.input(titleHeading, { target: { textContent: 'Ship release notes' } })
      fireEvent.blur(titleHeading)

      await waitFor(() => {
        const patchOnTitleBlur = fetchMock.mock.calls.some(([input, init]) => {
          const url = urlFromFetchMockFirstArg(input)
          return (
            url.pathname === '/api/v1/tasks/task-write-release-notes' &&
            init?.method === 'PATCH' &&
            typeof init?.body === 'string' &&
            init.body.includes('Ship release notes')
          )
        })
        expect(patchOnTitleBlur).toBe(true)
      })

      fireEvent.click(within(dialog).getByRole('button', { name: /close task/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('discards unsaved edits when Cancel is clicked', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')

      const titleHeading = within(dialog).getByRole('heading', {
        level: 3,
        name: /write release notes/i,
      })
      fireEvent.focus(titleHeading)
      fireEvent.input(titleHeading, { target: { textContent: 'Temporary rename' } })

      fireEvent.click(within(getTaskDialogFooter(dialog)).getByRole('button', { name: /^cancel$/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      const reopened = await openEditTaskDialog('Write release notes')
      expect(
        within(reopened).getByRole('heading', { level: 3, name: /write release notes/i }),
      ).toBeInTheDocument()
      expect(within(reopened).queryByRole('heading', { level: 3, name: /temporary rename/i })).not.toBeInTheDocument()
    })
  })

  describe('time logs section layout', () => {
    it('titles the section Time logs and shows actual hours and completed date above the entry list', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
        timeLogs: {
          'task-write-release-notes': [
            buildTimeLog({
              id: 'log-release-1',
              task_id: 'task-write-release-notes',
              project_id: 'project-alpha',
              hours: 1.5,
              logged_date: '2026-05-13',
              notes: 'Drafted launch copy',
            }),
          ],
        },
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')

      expect(within(dialog).getByRole('heading', { name: /^time logs$/i })).toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: /manual time logs/i })).not.toBeInTheDocument()

      const section = within(dialog).getByTestId('time-logs-section')
      const summary = within(section).getByTestId('time-logs-summary')
      const list = within(section).getByRole('list', { name: /time logs/i })

      expect(within(summary).getByText(/^actual hours$/i)).toBeInTheDocument()
      expect(within(summary).getByText('2')).toBeInTheDocument()
      expect(within(summary).getByText(/^completed date$/i)).toBeInTheDocument()
      expect(within(summary).getByText('2026-05-18')).toBeInTheDocument()
      expect(summary.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

      expect(within(dialog).queryByLabelText(/logged date/i)).not.toBeInTheDocument()
      expect(within(dialog).queryByLabelText(/^hours$/i)).not.toBeInTheDocument()
    })
  })

  describe('add time log sub-modal', () => {
    it('opens a nested dialog, requires hours, and posts to the time-log API on save', async () => {
      const { fetchMock } = installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
        timeLogs: {
          'task-write-release-notes': [],
        },
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')
      fireEvent.click(within(dialog).getByRole('button', { name: /\+ add time log/i }))

      const subDialog = await screen.findByRole('dialog', { name: /add time log/i })
      expect(subDialog).not.toBe(dialog)

      fireEvent.click(within(subDialog).getByRole('button', { name: /^save$/i }))
      expect(await within(subDialog).findByText(/hours must be greater than zero|hours is required/i)).toBeInTheDocument()

      fireEvent.change(within(subDialog).getByLabelText(/^time$/i), {
        target: { value: '1.5' },
      })
      fireEvent.change(within(subDialog).getByLabelText(/^title$/i), {
        target: { value: 'Client call' },
      })
      fireEvent.change(within(subDialog).getByLabelText(/^location$/i), {
        target: { value: 'Home office' },
      })
      fireEvent.click(within(subDialog).getByRole('button', { name: /^save$/i }))

      await waitFor(() => {
        const createRequest = fetchMock.mock.calls.some(([input, init]) => {
          const url = urlFromFetchMockFirstArg(input)
          return (
            url.pathname === '/api/v1/tasks/task-write-release-notes/time-logs' &&
            init?.method === 'POST'
          )
        })
        expect(createRequest).toBe(true)
      })

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /add time log/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('time log list row layout', () => {
    it('renders a bold title on the primary line with date and location on the secondary line', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
        timeLogs: {
          'task-write-release-notes': [
            buildTimeLog({
              id: 'log-structured',
              task_id: 'task-write-release-notes',
              project_id: 'project-alpha',
              hours: 2,
              logged_date: '2026-05-12',
              notes: 'title:Client call\nlocation:Home office\nDiscussed launch timeline',
            }),
          ],
        },
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')
      const row = await within(dialog).findByTestId('time-log-row-log-structured')

      const primary = within(row).getByTestId('time-log-row-primary')
      const secondary = within(row).getByTestId('time-log-row-secondary')

      expect(within(primary).getByText('Client call').tagName).toBe('STRONG')
      expect(within(secondary).getByText(/may 12|2026-05-12/i)).toBeInTheDocument()
      expect(within(secondary).getByText(/home office/i)).toBeInTheDocument()
    })

    it('opens notes detail when a time-log row is clicked', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
        timeLogs: {
          'task-write-release-notes': [
            buildTimeLog({
              id: 'log-detail',
              task_id: 'task-write-release-notes',
              project_id: 'project-alpha',
              hours: 1,
              logged_date: '2026-05-11',
              notes: 'title:Research\nlocation:Library\nReviewed competitor sites',
            }),
          ],
        },
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')
      fireEvent.click(await within(dialog).findByTestId('time-log-row-log-detail'))

      expect(
        await within(dialog).findByText(/reviewed competitor sites/i),
      ).toBeInTheDocument()
    })
  })

  describe('task archive affordance and archive dialog (1.6-8)', () => {
    it('exposes Archive in the edit modal footer', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')
      expect(within(getTaskDialogFooter(dialog)).getByRole('button', { name: /^archive$/i })).toBeInTheDocument()
    })

    it('archive dialog lists ventures, projects, and tasks tabs; archived tasks fetch only after opening the tasks tab', async () => {
      const { fetchMock } = installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask, archivedTask],
      })

      await renderApp()

      fireEvent.click(getArchiveViewControl())
      const archiveDialog = await screen.findByRole('dialog', { name: /archive/i })

      expect(within(archiveDialog).getByRole('tab', { name: /archived ventures/i })).toBeInTheDocument()
      expect(within(archiveDialog).getByRole('tab', { name: /archived projects/i })).toBeInTheDocument()
      expect(within(archiveDialog).getByRole('tab', { name: /archived tasks/i })).toBeInTheDocument()

      const callCountBeforeTabs = fetchMock.mock.calls.length

      fireEvent.click(within(archiveDialog).getByRole('tab', { name: /archived ventures/i }))
      fireEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([input]) => {
            const url = urlFromFetchMockFirstArg(input)
            return url.pathname === '/api/v1/ventures' && url.searchParams.get('status') === 'archived'
          }),
        ).toBe(true)
      })

      const archivedTasksRequestsBeforeTasksTab = fetchMock.mock.calls
        .slice(callCountBeforeTabs)
        .filter(([input]) => {
          const url = urlFromFetchMockFirstArg(input)
          return url.pathname === '/api/v1/tasks' && url.searchParams.get('status') === 'archived'
        })
      expect(archivedTasksRequestsBeforeTasksTab).toHaveLength(0)

      fireEvent.click(within(archiveDialog).getByRole('tab', { name: /archived tasks/i }))

      await waitFor(() => {
        const archivedTasksRequestsAfterTasksTab = fetchMock.mock.calls.filter(([input]) => {
          const url = urlFromFetchMockFirstArg(input)
          return url.pathname === '/api/v1/tasks' && url.searchParams.get('status') === 'archived'
        })
        expect(archivedTasksRequestsAfterTasksTab.length).toBeGreaterThan(0)
      })
    })

    it('removes an archived task from the active Kanban after Archive is confirmed', async () => {
      const backlogTask = buildTask({
        id: 'task-to-archive',
        project_id: 'project-alpha',
        title: 'Archive me',
        status: 'backlog',
      })

      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [backlogTask],
      })

      await renderApp()
      await waitForKanbanTaskVisible('Archive me')

      const dialog = await openEditTaskDialog('Archive me')
      fireEvent.click(within(getTaskDialogFooter(dialog)).getByRole('button', { name: /^archive$/i }))

      await waitFor(() => {
        expect(within(getKanbanRegion()).queryByText('Archive me')).not.toBeInTheDocument()
      })
    })
  })
})
