/**
 * Ticket 1.6-15 — Final Phase 1.6 polish (Vitest + RTL; tests only).
 *
 * jsdom does not apply :hover; Kanban title and shell assertions mirror
 * `App.1b7.test.tsx` / `phase-1-6-13-ux-polish.test.tsx` by reading `base.css`
 * hover rule blocks and checking default computed backgrounds where useful.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import './styles/base.css'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  buildProject,
  buildTask,
  buildVenture,
  buildVentureCategoryLabel,
} from './test/fixtures'
import { renderApp } from './test/renderApp'
import { resetBoardDisplayOptionsStore } from './stores/boardDisplayOptions'
import { resetProjectFilterStore } from './stores/projectFilter'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  getArchiveViewControl,
  getKanbanColumn,
  switchBoardViewTab,
  waitForProjectKanbanCard,
  waitForWorkspaceReady,
} from './test/workspaceQueries'

const labelSeed = buildVentureCategoryLabel({ id: 'label-pk-15', name: 'Hustle', slug: 'hustle' })
const venture15 = buildVenture({
  id: 'venture-ux-15',
  name: 'Venture 15',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

function readBaseCss(): string {
  return readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8')
}

function readArchiveDialogSource(): string {
  return readFileSync(resolve(process.cwd(), 'src/components/ArchiveDialog.tsx'), 'utf8')
}

/** Link-style title hover in CSS: underline, transparent fill, no translate (global `button:hover` uses brown pill). */
function expectKanbanTitleHoverRule(className: string, debugLabel: string): void {
  const css = readBaseCss()
  const hoverMatch = new RegExp(`\\.${className}:hover\\s*\\{([^}]+)\\}`).exec(css)
  expect(hoverMatch, `${debugLabel}: expected .${className}:hover in base.css`).not.toBeNull()
  const block = hoverMatch![1]

  expect(block.includes('underline'), `${debugLabel}: hover rule must underline text.`).toBe(true)
  expect(
    /background(?:-color)?:\s*transparent\b/.test(block),
    `${debugLabel}: hover rule must force transparent background (no pill fill).`,
  ).toBe(true)
  expect(/\btransform:\s*none\b/.test(block), `${debugLabel}: hover rule must reset transform.`).toBe(
    true,
  )
}

describe('Ticket 1.6-15 — Kanban title hover (task + project)', () => {
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

  it('forces transparent hover background and underline via base.css for task card titles', async () => {
    const project = buildProject({
      id: 'p-15-task',
      name: 'Kanban Task Project',
      venture_id: venture15.id,
    })
    installWorkspaceBackendMock({
      ventures: [venture15],
      projects: [project],
      tasks: [
        buildTask({
          id: 't-15',
          project_id: project.id,
          title: 'Phase 1.6-15 task title',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const titleBtn = within(getKanbanColumn(/backlog/i)).getByTestId('kanban-task-title')
    expect(titleBtn).toHaveTextContent(/phase 1\.6-15 task title/i)
    expectKanbanTitleHoverRule('kanban-task-title', 'Task kanban title')
  })

  it('forces transparent hover background and underline via base.css for project card titles', async () => {
    const project = buildProject({
      id: 'p-15-proj',
      name: 'Phase 1.6-15 project title',
      venture_id: venture15.id,
      board_status: 'active',
      kanban_order: 0,
    })
    installWorkspaceBackendMock({
      ventures: [venture15],
      projects: [project],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const card = await waitForProjectKanbanCard('Phase 1.6-15 project title', /active/i)
    const titleBtn = within(card).getByTestId('kanban-project-title')
    expect(titleBtn).toHaveTextContent(/phase 1\.6-15 project title/i)
    expectKanbanTitleHoverRule('kanban-project-title', 'Project kanban title')
  })
})

describe('Ticket 1.6-15 — Shell “View archive” control', () => {
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

  it('uses ghost (non-primary) Button variant for the archive trigger in source', () => {
    const source = readArchiveDialogSource()
    expect(
      /<Button\b[^>]*\bclassName="sidebar-archive-link"[^>]*\bvariant="ghost"/.test(source),
      'View archive must stay on variant="ghost", not a filled primary button.',
    ).toBe(true)
  })

  it('styles View archive hover like underline-first text actions (no solid pill plate)', () => {
    const css = readBaseCss()
    const hoverMatch = /\.sidebar-archive-link:hover\s*\{([^}]+)\}/.exec(css)
    expect(hoverMatch, 'Expected .sidebar-archive-link:hover rule in base.css').not.toBeNull()
    const block = hoverMatch![1]
    expect(
      block.includes('underline'),
      'View archive hover should underline like Kanban title links.',
    ).toBe(true)
    expect(
      /background(?:-color)?:\s*transparent\b/.test(block),
      'View archive hover must not apply a filled plate (transparent background only).',
    ).toBe(true)
    expect(/\btransform:\s*none\b/.test(block), 'View archive hover should not use CTA motion.').toBe(
      true,
    )
  })

  it('does not use a full pill radius on the archive entry (link-style silhouette)', () => {
    const css = readBaseCss()
    const blocks = [...css.matchAll(/\.sidebar-archive-link\s*\{([^}]+)\}/g)].map((match) => match[1])
    expect(blocks.length).toBeGreaterThan(0)
    const usesPillRadius = blocks.some((block) => /border-radius:\s*999px\b/.test(block))
    expect(
      usesPillRadius,
      'Archive entry should not use the 999px “pill” radius used for primary CTAs.',
    ).toBe(false)
  })

  it('does not assign opaque hex fills on the archive entry default rule blocks', () => {
    const css = readBaseCss()
    const blocks = [...css.matchAll(/\.sidebar-archive-link\s*\{([^}]+)\}/g)].map((match) => match[1])
    expect(blocks.length).toBeGreaterThan(0)
    const assignsOpaqueHex = blocks.some(
      (block) =>
        /\bbackground:\s*#[0-9a-f]{3,8}\b/i.test(block) ||
        /\bbackground-color:\s*#[0-9a-f]{3,8}\b/i.test(block),
    )
    expect(assignsOpaqueHex, 'Archive link default styles should stay text-like (transparent / inherited).').toBe(
      false,
    )
  })
})

describe('Ticket 1.6-15 — Archive: archived project is read-only summary, not Edit project', () => {
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

  it(
    'opens a venture-style read-only summary for an archived project row (no ProjectDialog)',
    async () => {
      const archived = buildProject({
        id: 'project-archived-15',
        name: 'Archived Polishing',
        colour: '#9B6B55',
        venture_id: venture15.id,
        status: 'archived',
      })
      installWorkspaceBackendMock({
        ventures: [venture15],
        projects: [
          buildProject({ id: 'p-active-15', name: 'Active Co', venture_id: venture15.id }),
          archived,
        ],
        tasks: [],
      })

      await renderApp()
      await waitForWorkspaceReady()

      await userEvent.click(getArchiveViewControl())
      const archiveShell = await screen.findByRole('dialog', { name: /archive/i })

      await userEvent.click(
        within(archiveShell).getByRole('button', { name: /archived polishing/i }),
      )

      let editDialog: HTMLElement | null = null
      try {
        editDialog = await screen.findByRole('dialog', { name: /edit project/i }, { timeout: 5000 })
      } catch {
        editDialog = null
      }
      expect(
        editDialog,
        'Archived project rows must not open the full Edit project modal.',
      ).toBeNull()
      expect(screen.queryByRole('heading', { name: /^edit project$/i })).not.toBeInTheDocument()

      expect(
        await screen.findByText(/review archived project/i),
        'Expected copy aligned with the archived venture detail pattern.',
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /save project/i })).not.toBeInTheDocument()
    },
    15_000,
  )
})

describe('Ticket 1.6-15 — Project Kanban card task count copy', () => {
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

  it('prefixes the open-task metric with the literal “Tasks ” even when the count is zero', async () => {
    const target = buildProject({
      id: 'p-zero-tasks',
      name: 'Empty Metrics',
      venture_id: venture15.id,
      board_status: 'idea',
      kanban_order: 0,
    })
    installWorkspaceBackendMock({
      ventures: [venture15],
      projects: [target],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const card = await waitForProjectKanbanCard('Empty Metrics', /idea/i)
    expect(card).toHaveTextContent(/tasks\s+0\b/i)
  })
})
