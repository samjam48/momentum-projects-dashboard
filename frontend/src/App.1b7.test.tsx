/**
 * Ticket 1b-7 — regressions from global CSS vs Radix/shadcn primitives and Kanban typography.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import './styles/base.css'
import { renderApp } from './test/renderApp'
import { resetBoardDisplayOptionsStore } from './stores/boardDisplayOptions'
import { resetProjectFilterStore } from './stores/projectFilter'
import { buildProject, buildTask } from './test/fixtures'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import { clickProjectFilterCheckbox, getProjectFilterCheckbox } from './test/workspaceQueries'

function readBaseCss(): string {
  const baseCss = readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8')
  return baseCss
}

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

describe('Ticket 1b-7 owner-reported regressions', () => {
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

  it('sidebar project filter checkbox has transparent computed fill when checked', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [backlogTask],
    })

    await renderApp()

    await clickProjectFilterCheckbox('Alpha Client')
    await clickProjectFilterCheckbox('Alpha Client')

    const checked = resolveCheckboxPrimitive(getProjectFilterCheckbox('Alpha Client'))
    expect(checked.getAttribute('data-state')).toBe('checked')
    expectComputedBackgroundFullyTransparent(checked)
  })

  it('Kanban due date typography matches project pill at 0.78rem (superseded by 1b-8)', () => {
    const css = readBaseCss()

    expect(
      /\.kanban-project-pill\s*\{[^}]*font-size:\s*0\.78rem/m.test(css),
      'Expected `.kanban-project-pill` to pin font-size at 0.78rem.',
    ).toBe(true)

    expect(
      /\.kanban-task-metrics\s+\.task-meta\s*\{[^}]*font-size:\s*0\.78rem/m.test(css),
      'Expected card due-date / task-meta text to use font-size 0.78rem to match project pill.',
    ).toBe(true)
  })

  it('Kanban task title hover rules neutralize global button background and transform', () => {
    const css = readBaseCss()
    const hoverMatch = /\.kanban-task-title:hover\s*\{([^}]*)\}/.exec(css)
    expect(hoverMatch, 'Expected a .kanban-task-title:hover rule block in base.css.').not.toBeNull()

    const block = hoverMatch![1]

    expect(
      block.includes('underline'),
      '.kanban-task-title:hover must keep underline hover affordance.',
    ).toBe(true)

    expect(
      /background(?:-color)?:\s*transparent\b/.test(block),
      '.kanban-task-title:hover must set an explicit transparent background '
        + '(global button:hover applies a brown fill).',
    ).toBe(true)

    expect(
      /\btransform:\s*none\b/.test(block),
      '.kanban-task-title:hover must reset transform '
        + '(global button:hover uses translateY).',
    ).toBe(true)
  })
})
