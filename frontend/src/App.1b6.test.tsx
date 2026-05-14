/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { flushSync } from 'react-dom'

import './styles/base.css'
import { renderApp } from './test/renderApp'
import {
  BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
  resetBoardDisplayOptionsStore,
} from './stores/boardDisplayOptions'
import { resetProjectFilterStore } from './stores/projectFilter'
import { buildProject, buildTask, buildTimeLog } from './test/fixtures'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  getArchiveViewControl,
  clickBoardOptionsCheckbox,
  getBoardOptionsCheckbox,
  getKanbanBoardOptionsControl,
  getKanbanColumn,
  clickProjectFilterCheckbox,
  getProjectFilterCheckbox,
  getSidebar,
  getTaskCardByTitle,
  openBoardOptionsMenu,
  waitForKanbanTaskVisible,
} from './test/workspaceQueries'

const betaProject = buildProject({
  id: 'project-beta',
  name: 'Beta Client',
  colour: '#6B8E6B',
})

const alphaProject = buildProject({
  id: 'project-alpha',
  name: 'Alpha Client',
  colour: '#5B7C99',
})

const archivedProject = buildProject({
  id: 'project-archived',
  name: 'Sunset Studio',
  colour: '#9B6B55',
  status: 'archived',
})

const releaseNotesTask = buildTask({
  id: 'task-write-release-notes',
  project_id: 'project-alpha',
  title: 'Write release notes',
  status: 'done',
  completed_date: '2026-05-18',
  actual_hours: 2,
  target_date: '2026-05-20',
})

const backlogTask = buildTask({
  id: 'task-backlog-one',
  project_id: 'project-alpha',
  title: 'Backlog alpha',
  status: 'backlog',
  target_date: '2026-05-20',
})

const backlogTaskTwo = buildTask({
  id: 'task-backlog-two',
  project_id: 'project-alpha',
  title: 'Backlog beta',
  status: 'backlog',
  target_date: '2026-05-21',
})

function getColumnHeaderPill(column: HTMLElement): HTMLElement {
  const pill = column.querySelector('.task-card-header .status-pill')
  if (!(pill instanceof HTMLElement)) {
    throw new Error('Expected column header status pill element.')
  }

  return pill
}

function installDelayedArchivedProjectsMock(
  projects: ReturnType<typeof buildProject>[],
  delayMs = 250,
): ReturnType<typeof vi.fn<typeof fetch>> {
  let archivedFetchCount = 0
  let archivedPayload = projects.filter((project) => project.status === 'archived')

  const fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost')
    const pathname = url.pathname
    const method = init?.method ?? 'GET'

    if (method === 'GET' && pathname === '/api/v1/projects') {
      const status = url.searchParams.get('status')
      if (status === 'archived') {
        archivedFetchCount += 1
        if (archivedFetchCount > 1) {
          archivedPayload = []
          await new Promise((resolve) => {
            setTimeout(resolve, delayMs)
          })
        }
        return new Response(JSON.stringify(archivedPayload), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      return new Response(
        JSON.stringify(projects.filter((project) => project.status === 'active')),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (method === 'GET' && pathname === '/api/v1/tasks') {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function readPx(value: string): number {
  return Number.parseFloat(value)
}

function hasCheckedBoardOptionsWeightRule(): boolean {
  const baseCss = readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8')
  return /\.board-options-item\[aria-checked=['"]true['"]\][^{]*\{[^}]*font-weight:\s*500/.test(
    baseCss,
  )
}

function resolveCheckboxElement(element: HTMLElement): HTMLElement {
  if (element.getAttribute('role') === 'checkbox') {
    return element
  }

  const nested = element.querySelector('[role="checkbox"]')
  if (nested instanceof HTMLElement) {
    return nested
  }

  throw new Error('Expected checkbox element.')
}

function expectCheckboxPattern(checkbox: HTMLElement): void {
  const target = resolveCheckboxElement(checkbox)
  expect(target.querySelector('svg')).toBeInTheDocument()
  expect(target.textContent?.includes('✓')).toBe(false)
  expect(target.className).toMatch(/bg-transparent/)
  expect(target.className).not.toMatch(/bg-\[rgba\(156,93,53/)
}

async function openEditTaskDialog(taskTitle: string): Promise<HTMLElement> {
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`edit task ${taskTitle}`, 'i') }),
  )
  return screen.findByRole('dialog', { name: /edit task/i })
}

async function openEditProjectDialog(projectName: string): Promise<HTMLElement> {
  const sidebar = getSidebar()
  fireEvent.click(within(sidebar).getByRole('button', { name: new RegExp(projectName, 'i') }))
  return screen.findByRole('dialog', { name: /edit project/i })
}

function getTaskDialogBackdrop(): HTMLElement {
  const backdrop = document.querySelector('.dialog-backdrop')
  if (!(backdrop instanceof HTMLElement)) {
    throw new Error('Expected task dialog backdrop element.')
  }

  return backdrop
}

function getRadixDialogOverlay(): HTMLElement {
  const overlay = document.querySelector('[data-radix-dialog-overlay], .fixed.inset-0')
  if (!(overlay instanceof HTMLElement)) {
    throw new Error('Expected Radix dialog overlay element.')
  }

  return overlay
}

describe('Ticket 1b-6 owner sign-off polish', () => {
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

  describe('checkbox pattern (site-wide)', () => {
    it('uses transparent backgrounds, Lucide checks, and darker selected outlines in sidebar and board options', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject, betaProject],
        tasks: [backlogTask],
      })

      await renderApp()

      await clickProjectFilterCheckbox('Alpha Client')
      const checkedSidebarCheckbox = getProjectFilterCheckbox('Alpha Client')
      expectCheckboxPattern(checkedSidebarCheckbox)

      await openBoardOptionsMenu()
      await clickBoardOptionsCheckbox(/show priority/i)
      expectCheckboxPattern(getBoardOptionsCheckbox(/show priority/i))
    })
  })

  describe('Kanban column-header pills', () => {
    it('styles each column header with status-pill badge classes', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [backlogTask],
      })

      await renderApp()
      await waitForKanbanTaskVisible('Backlog alpha')

      ;[
        { label: /backlog/i, statusClass: 'status-backlog' },
        { label: /in progress/i, statusClass: 'status-in_progress' },
        { label: /review/i, statusClass: 'status-review' },
        { label: /done/i, statusClass: 'status-done' },
      ].forEach(({ label, statusClass }) => {
        const column = getKanbanColumn(label)
        const headerPill = getColumnHeaderPill(column)
        expect(headerPill).toHaveClass('status-pill', statusClass)
      })
    })
  })

  describe('Kanban card spacing and due-date type scale', () => {
    it('uses 5px external gaps, reverts internal padding, and matches due-date size to header pills', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [backlogTask, backlogTaskTwo],
      })

      await renderApp()
      await waitForKanbanTaskVisible('Backlog alpha')
      await waitForKanbanTaskVisible('Backlog beta')

      const backlogColumn = getKanbanColumn(/backlog/i)
      const taskList = backlogColumn.querySelector('ul.task-list')
      expect(taskList).toBeInstanceOf(HTMLElement)

      const listGap = readPx(getComputedStyle(taskList as HTMLElement).gap)
      expect(listGap).toBeCloseTo(5, 0)

      const firstCard = getTaskCardByTitle(backlogColumn, 'Backlog alpha')
      const cardPadding = readPx(getComputedStyle(firstCard).paddingTop)
      expect(cardPadding).toBeCloseTo(16, 0)

      const baseCss = readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8')
      expect(
        /\.kanban-project-pill\s*\{[^}]*font-size:\s*0\.78rem/m.test(baseCss),
        'Expected project pill font-size at 0.78rem.',
      ).toBe(true)
      expect(
        /\.kanban-task-metrics\s+\.task-meta\s*\{[^}]*font-size:\s*0\.78rem/m.test(baseCss),
        'Expected card due-date line to match project pill at 0.78rem (1b-8).',
      ).toBe(true)
    })
  })

  describe('modal close behaviour and affordance', () => {
    it('closes the task modal when the backdrop is clicked', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
      })

      await renderApp()

      await openEditTaskDialog('Write release notes')
      const backdrop = getTaskDialogBackdrop()
      fireEvent.click(backdrop)

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit task/i })).not.toBeInTheDocument()
      })
    })

    it('closes the project modal when the backdrop overlay is clicked', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      await openEditProjectDialog('Alpha Client')
      fireEvent.click(getRadixDialogOverlay())

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit project/i })).not.toBeInTheDocument()
      })
    })

    it('shows a visible X close control on task and project modals', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
      })

      await renderApp()

      const taskDialog = await openEditTaskDialog('Write release notes')
      const taskClose = within(taskDialog).getByRole('button', { name: /close task/i })
      expect(taskClose.querySelector('svg')).toBeInTheDocument()
      expect(taskClose.textContent?.trim()).toMatch(/x/i)

      fireEvent.click(taskClose)
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit task/i })).not.toBeInTheDocument()
      })

      const projectDialog = await openEditProjectDialog('Alpha Client')
      const projectClose = within(projectDialog).getByRole('button', { name: /close project/i })
      expect(projectClose.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('task modal title scale and inline-edit padding', () => {
    it('renders the task title at h3 scale with field-matching edit padding', async () => {
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
      const descriptionField = within(dialog).getByLabelText(/description/i)

      expect(readPx(getComputedStyle(titleHeading).fontSize)).toBeGreaterThanOrEqual(18)
      expect(readPx(getComputedStyle(titleHeading).paddingLeft)).toBeGreaterThanOrEqual(
        readPx(getComputedStyle(descriptionField).paddingLeft),
      )
    })
  })

  describe('time logs GET, POST, and DELETE integration', () => {
    it('loads entries on open, creates via POST, and refreshes actual hours in the parent modal', async () => {
      const { fetchMock } = installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [{ ...releaseNotesTask, actual_hours: 0 }],
        timeLogs: {
          'task-write-release-notes': [
            buildTimeLog({
              id: 'log-existing',
              task_id: 'task-write-release-notes',
              project_id: 'project-alpha',
              hours: 1.5,
              logged_date: '2026-05-12',
              notes: 'Existing session',
            }),
          ],
        },
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')

      await waitFor(() => {
        const listRequest = fetchMock.mock.calls.some(([input, init]) => {
          const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost')
          return (
            url.pathname === '/api/v1/tasks/task-write-release-notes/time-logs' &&
            (init?.method ?? 'GET') === 'GET'
          )
        })
        expect(listRequest).toBe(true)
      })

      expect(within(dialog).getByTestId('time-log-row-log-existing')).toBeInTheDocument()
      expect(within(dialog).getByTestId('time-logs-summary')).toHaveTextContent('1.5')

      fireEvent.click(within(dialog).getByRole('button', { name: /\+ add time log/i }))
      const subDialog = await screen.findByRole('dialog', { name: /add time log/i })
      fireEvent.change(within(subDialog).getByLabelText(/^time$/i), { target: { value: '2' } })
      fireEvent.click(within(subDialog).getByRole('button', { name: /^save$/i }))

      await waitFor(() => {
        expect(within(dialog).getByTestId('time-logs-summary')).toHaveTextContent('3.5')
      })

      await waitFor(() => {
        expect(within(dialog).getByTestId('time-log-row-log-1')).toBeInTheDocument()
      })
    })

    it('hard-deletes a time-log entry and updates derived hours without a full reload', async () => {
      const { fetchMock } = installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
        timeLogs: {
          'task-write-release-notes': [
            buildTimeLog({
              id: 'log-delete-me',
              task_id: 'task-write-release-notes',
              project_id: 'project-alpha',
              hours: 1,
              logged_date: '2026-05-11',
              notes: 'Delete me',
            }),
            buildTimeLog({
              id: 'log-keep-me',
              task_id: 'task-write-release-notes',
              project_id: 'project-alpha',
              hours: 1,
              logged_date: '2026-05-10',
              notes: 'Keep me',
            }),
          ],
        },
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')
      const deleteButton = within(dialog).getByRole('button', {
        name: /delete time log delete me/i,
      })

      fireEvent.click(deleteButton)

      const confirmDialog = await screen.findByRole('alertdialog')
      fireEvent.click(within(confirmDialog).getByRole('button', { name: /^delete$/i }))

      await waitFor(() => {
        const deleteRequest = fetchMock.mock.calls.some(([input, init]) => {
          const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost')
          return (
            url.pathname === '/api/v1/tasks/task-write-release-notes/time-logs/log-delete-me' &&
            init?.method === 'DELETE'
          )
        })
        expect(deleteRequest).toBe(true)
      })

      await waitFor(() => {
        expect(within(dialog).queryByTestId('time-log-row-log-delete-me')).not.toBeInTheDocument()
        expect(within(dialog).getByTestId('time-logs-summary')).toHaveTextContent('1')
      })
    })
  })

  describe('time logs metric cards and responsive layout', () => {
    it('renders coloured metric cards for actual hours and completed date', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
        timeLogs: {
          'task-write-release-notes': [],
        },
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')
      const summary = within(dialog).getByTestId('time-logs-summary')
      const metricCards = summary.querySelectorAll('.time-log-card')

      expect(metricCards.length).toBeGreaterThanOrEqual(2)
      metricCards.forEach((card) => {
        expect(card).toHaveClass('time-log-card')
      })
    })

    it('places time logs in a right column beside task fields on wide viewports', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [releaseNotesTask],
      })

      await renderApp()

      const dialog = await openEditTaskDialog('Write release notes')
      const grid = dialog.querySelector('.task-dialog-grid')
      expect(grid).toBeInstanceOf(HTMLElement)

      const editForm = within(dialog).getByRole('form', { name: /edit task/i })
      const timeLogsSection = within(dialog).getByTestId('time-logs-section')
      expect(editForm.parentElement).toBe(grid)
      expect(timeLogsSection.parentElement).toBe(grid)
      expect(getComputedStyle(grid as HTMLElement).gridTemplateColumns).toMatch(/minmax|fr/)
    })
  })

  describe('board options menu and storage cleanup', () => {
    it('does not apply font-weight 500 emphasis to checked board-option rows', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      await openBoardOptionsMenu()
      const checkedItem = screen.getByRole('menuitemcheckbox', { name: /show due date/i })
      expect(checkedItem.getAttribute('aria-checked')).toBe('true')
      expect(hasCheckedBoardOptionsWeightRule()).toBe(false)
      expect(getComputedStyle(checkedItem).fontWeight).not.toBe('500')
    })

    it('does not persist showStatusBadge in localStorage when toggling options', async () => {
      installWorkspaceBackendMock({
        projects: [alphaProject],
        tasks: [],
      })

      await renderApp()

      fireEvent.click(getKanbanBoardOptionsControl())
      await clickBoardOptionsCheckbox(/show priority/i)

      const stored = JSON.parse(
        globalThis.localStorage.getItem(BOARD_DISPLAY_OPTIONS_STORAGE_KEY) ?? '{}',
      ) as Record<string, unknown>

      expect(stored).not.toHaveProperty('showStatusBadge')
    })
  })

  describe('ArchiveDialog stale flash', () => {
    it('does not show stale archived rows while a delayed refetch is in flight after reopening', async () => {
      const archiveDialogSource = readFileSync(
        resolve(process.cwd(), 'src/components/ArchiveDialog.tsx'),
        'utf8',
      )
      expect(archiveDialogSource).toMatch(
        /if \(!nextOpen\)\s*\{[\s\S]*setArchivedProjects\(\[\]\)/,
      )

      installDelayedArchivedProjectsMock([alphaProject, archivedProject], 300)

      await renderApp()

      fireEvent.click(getArchiveViewControl())
      const firstDialog = await screen.findByRole('dialog', { name: /archive/i })
      await within(firstDialog).findByText('Sunset Studio')

      fireEvent.keyDown(firstDialog, { key: 'Escape' })
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /archive/i })).not.toBeInTheDocument()
      })

      flushSync(() => {
        fireEvent.click(getArchiveViewControl())
      })
      const reopenedDialog = screen.getByRole('dialog', { name: /archive/i })

      expect(within(reopenedDialog).queryByRole('button', { name: /sunset studio/i })).not.toBeInTheDocument()
      expect(within(reopenedDialog).getByText(/loading archived projects/i)).toBeInTheDocument()

      await waitFor(() => {
        expect(within(reopenedDialog).queryByText('Sunset Studio')).not.toBeInTheDocument()
      })
    })
  })
})
