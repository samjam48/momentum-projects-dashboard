/**
 * Ticket 1b-8 — owner UI polish (checkbox outline, Kanban list gap, due-date size,
 * time-log row cards, primary-line separators, plain delete + confirm).
 * Tests precede implementation per sprint rules.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, screen, within } from '@testing-library/react'

import './styles/base.css'
import { renderApp } from './test/renderApp'
import {
  BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
  resetBoardDisplayOptionsStore,
} from './stores/boardDisplayOptions'
import { resetProjectFilterStore } from './stores/projectFilter'
import { buildProject, buildTask, buildTimeLog } from './test/fixtures'
import { urlFromFetchMockFirstArg } from './test/fetchMockUrl'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  clickProjectFilterCheckbox,
  getKanbanColumn,
  getProjectFilterCheckbox,
} from './test/workspaceQueries'

function readBaseCss(): string {
  return readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8')
}

const alphaProject = buildProject({
  id: 'project-alpha',
  name: 'Alpha Client',
  colour: '#5B7C99',
})

const backlogTask = buildTask({
  id: 'task-backlog-alpha',
  project_id: 'project-alpha',
  title: 'Backlog alpha',
  status: 'backlog',
  target_date: '2026-05-20',
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

function cssOpacity(backgroundColor: string): number | null {
  if (backgroundColor === 'transparent') {
    return 0
  }
  const match = /^rgba?\(\s*([^)]+)\s*\)$/i.exec(backgroundColor.trim())
  if (!match) {
    return null
  }

  const parts = match[1].split(',').map((segment) => segment.trim())
  if (parts.length === 4) {
    return Number.parseFloat(parts[3])
  }

  return 1
}

function expectComputedBackgroundFullyTransparent(element: HTMLElement): void {
  const color = window.getComputedStyle(element).backgroundColor
  const opacity = cssOpacity(color)

  expect(
    opacity,
    `Expected a transparent computed background on ${element.tagName}; got "${color}".`,
  ).toBe(0)
}

function resolveCheckboxPrimitive(element: HTMLElement): HTMLElement {
  if (element.getAttribute('role') === 'checkbox') {
    return element
  }

  const nested = element.querySelector('[role="checkbox"]')
  if (!(nested instanceof HTMLElement)) {
    throw new Error('Expected checkbox element.')
  }

  return nested
}

function readMaxBorderWidthPx(element: HTMLElement): number {
  const raw = window.getComputedStyle(element).borderWidth
  const parts = raw.split(/\s+/).map((part) => Number.parseFloat(part))
  const finite = parts.filter((n) => Number.isFinite(n))
  return finite.length === 0 ? 0 : Math.max(...finite)
}

function luminanceFromRgb(rgb: string): number | null {
  const match = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i.exec(rgb.trim())
  if (!match) {
    return null
  }
  const r = Number.parseFloat(match[1]) / 255
  const g = Number.parseFloat(match[2]) / 255
  const b = Number.parseFloat(match[3]) / 255

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function parseGapPx(gap: string): number {
  const parts = gap.split(/\s+/).map((part) => Number.parseFloat(part))
  const finite = parts.filter((value) => Number.isFinite(value))
  return finite.length === 0 ? 0 : Math.min(...finite)
}

function countTaskTimeLogDeleteCalls(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.filter((call) => {
    const url = urlFromFetchMockFirstArg(call[0] as unknown)
    const init = call[1] as RequestInit | undefined
    return (
      (init?.method ?? 'GET') === 'DELETE' &&
      /^\/api\/v1\/tasks\/[^/]+\/time-logs\/[^/]+$/.test(url.pathname)
    )
  }).length
}

async function openEditTaskDialog(taskTitle: string): Promise<HTMLElement> {
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`edit task ${taskTitle}`, 'i') }),
  )
  return screen.findByRole('dialog', { name: /edit task/i })
}

describe('Ticket 1b-8 owner UI polish', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetTestStorage()
    resetProjectFilterStore()
    resetBoardDisplayOptionsStore()
    localStorage.setItem(
      BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
      JSON.stringify({
        showDueDate: true,
        showProjectName: true,
        showPriority: false,
        showActualHours: false,
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetTestStorage()
    resetProjectFilterStore()
    resetBoardDisplayOptionsStore()
  })

  it('unchecked project-filter checkbox shows a visible outline and transparent fill', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [backlogTask],
    })

    await renderApp()

    await clickProjectFilterCheckbox('Alpha Client')

    const box = resolveCheckboxPrimitive(getProjectFilterCheckbox('Alpha Client'))
    expect(box.getAttribute('data-state')).toBe('unchecked')

    expect(readMaxBorderWidthPx(box)).toBeGreaterThan(0)
    expectComputedBackgroundFullyTransparent(box)
  })

  it('checked project-filter checkbox has a thicker or darker border than unchecked', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [backlogTask],
    })

    await renderApp()

    await clickProjectFilterCheckbox('Alpha Client')
    const unchecked = resolveCheckboxPrimitive(getProjectFilterCheckbox('Alpha Client'))
    const uncheckedWidth = readMaxBorderWidthPx(unchecked)
    const uncheckedBorder = window.getComputedStyle(unchecked).borderTopColor
    const uncheckedLum = luminanceFromRgb(uncheckedBorder)

    await clickProjectFilterCheckbox('Alpha Client')
    const checked = resolveCheckboxPrimitive(getProjectFilterCheckbox('Alpha Client'))
    expect(checked.getAttribute('data-state')).toBe('checked')

    const checkedWidth = readMaxBorderWidthPx(checked)
    const checkedBorder = window.getComputedStyle(checked).borderTopColor
    const checkedLum = luminanceFromRgb(checkedBorder)

    const thicker = checkedWidth > uncheckedWidth
    const darker =
      uncheckedLum !== null && checkedLum !== null && checkedLum < uncheckedLum - 0.01

    expect(
      thicker || darker,
      'Checked state should use a thicker and/or darker outline than unchecked (1b-8).',
    ).toBe(true)

    expectComputedBackgroundFullyTransparent(checked)
  })

  it('Kanban `.kanban-task-list` uses flex or grid with gap at least 5px', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [backlogTask],
    })

    await renderApp()

    const column = getKanbanColumn(/backlog/i)
    const list = column.querySelector('.kanban-task-list')
    expect(list, 'Expected `.kanban-task-list` in the Backlog column.').toBeInstanceOf(
      HTMLElement,
    )

    const listEl = list as HTMLElement
    const display = window.getComputedStyle(listEl).display

    expect(['flex', 'inline-flex', 'grid', 'inline-grid']).toContain(display)

    const gapPx = parseGapPx(window.getComputedStyle(listEl).gap)
    expect(gapPx).toBeGreaterThanOrEqual(5)
  })

  it('due date on Kanban cards uses 0.78rem to match `.kanban-project-pill` in base.css', () => {
    const css = readBaseCss()

    expect(
      /\.kanban-project-pill\s*\{[^}]*font-size:\s*0\.78rem/m.test(css),
      'Expected `.kanban-project-pill` to pin font-size at 0.78rem.',
    ).toBe(true)

    expect(
      /\.kanban-task-metrics\s+\.task-meta\s*\{[^}]*font-size:\s*0\.78rem/m.test(css),
      'Expected card due-date line (.task-meta) to match the project pill at 0.78rem (1b-8 supersedes 1b-7 column-pill sizing).',
    ).toBe(true)
  })

  it('time-log list row surface is card-like (border + transparent background)', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-card-style',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            title: 'Card surface',
            location: 'Remote',
            logged_date: '2026-05-12',
            hours: 1,
            notes: null,
          }),
        ],
      },
    })

    await renderApp()

    const dialog = await openEditTaskDialog('Write release notes')
    const rowButton = await within(dialog).findByTestId('time-log-row-log-card-style')
    expect(rowButton.tagName.toLowerCase()).toBe('button')

    const styles = window.getComputedStyle(rowButton)
    const borderWidth = Number.parseFloat(styles.borderTopWidth)
    expect(borderWidth).toBeGreaterThan(0)

    const opacity = cssOpacity(styles.backgroundColor)
    expect(
      opacity === 0,
      `Time-log entry row should be transparent/clear; got background "${styles.backgroundColor}" `
        + `(parsed opacity: ${String(opacity)}).`,
    ).toBe(true)
  })

  it('time-log primary line uses spaced middle-dot separators between title, date, and location', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-dots',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            title: 'Deep work',
            location: 'Remote',
            logged_date: '2026-05-12',
            hours: 1,
            notes: null,
          }),
        ],
      },
    })

    await renderApp()

    const dialog = await openEditTaskDialog('Write release notes')
    const rowButton = await within(dialog).findByTestId('time-log-row-log-dots')

    const primaryText = rowButton.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    expect(primaryText).toMatch(/Deep work · .+ · Remote/)
  })

  it('expanded time log with no notes shows muted No notes placeholder', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-empty-notes',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            title: 'No body',
            location: 'Remote',
            logged_date: '2026-05-12',
            hours: 1,
            notes: null,
          }),
        ],
      },
    })

    await renderApp()

    const dialog = await openEditTaskDialog('Write release notes')
    fireEvent.click(await within(dialog).findByTestId('time-log-row-log-empty-notes'))

    const detail = await within(dialog).findByTestId('time-log-detail-log-empty-notes')
    expect(detail).toHaveTextContent('No notes')
    expect(detail.className).toMatch(/\bmuted-copy\b/)
  })

  it('time-log delete is plain X (no icon button); confirm opens before DELETE', async () => {
    const { fetchMock } = installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-delete',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            title: 'Delete me',
            location: 'Remote',
            logged_date: '2026-05-11',
            hours: 1,
            notes: null,
          }),
        ],
      },
    })

    await renderApp()

    const dialog = await openEditTaskDialog('Write release notes')
    const wrap = (await within(dialog).findByTestId('time-log-row-log-delete')).closest(
      '.time-log-row-wrap',
    )
    expect(wrap).toBeInstanceOf(HTMLElement)

    const deleteControl = within(wrap as HTMLElement).getByRole('button', {
      name: /delete time log delete me/i,
    })

    expect(deleteControl.querySelector('svg')).toBeNull()
    expect(deleteControl.textContent?.includes('X') || deleteControl.textContent === '×').toBe(
      true,
    )
    expect(deleteControl.className).not.toMatch(/\brounded-full\b/)

    const deletesBefore = countTaskTimeLogDeleteCalls(fetchMock)
    fireEvent.click(deleteControl)

    expect(countTaskTimeLogDeleteCalls(fetchMock)).toBe(deletesBefore)

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })
})
