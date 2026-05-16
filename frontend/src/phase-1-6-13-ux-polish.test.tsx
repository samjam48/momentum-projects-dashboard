/**
 * Ticket 1.6-13 — Post–Phase 1.6 UX polish (behavioural acceptance tests).
 * Tests only; production implementation tracked separately.
 *
 * Note: jsdom does not compute `:hover` styles; title hover assertions read
 * `base.css` rule blocks (same pattern as `App.1b7.test.tsx`).
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
  getKanbanColumn,
  getKanbanRegion,
  getSidebar,
  switchBoardViewTab,
  waitForProjectKanbanCard,
  waitForWorkspaceReady,
} from './test/workspaceQueries'

const labelSeed = buildVentureCategoryLabel({ id: 'label-pk-ux', name: 'Hustle', slug: 'hustle' })
const ventureUx = buildVenture({
  id: 'venture-ux-13',
  name: 'Venture UX',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

function readBaseCss(): string {
  return readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8')
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

async function ensureVentureTreeExpanded(ventureRow: HTMLElement): Promise<void> {
  const expand = within(ventureRow).queryByRole('button', { name: /expand venture/i })
  if (expand) {
    await userEvent.click(expand)
  }
}

describe('Ticket 1.6-13 — Task Kanban title hover', () => {
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

  it('uses underline-only hover on the task card title (no pill / solid fill)', async () => {
    const project = buildProject({
      id: 'p-task-hover',
      name: 'Hover Venture Project',
      venture_id: ventureUx.id,
    })
    installWorkspaceBackendMock({
      ventures: [ventureUx],
      projects: [project],
      tasks: [
        buildTask({
          id: 't-hover',
          project_id: project.id,
          title: 'Task title hover probe',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const backlog = getKanbanColumn(/backlog/i)
    const titleBtn = within(backlog).getByTestId('kanban-task-title')
    expect(titleBtn).toHaveTextContent(/task title hover probe/i)

    expectKanbanTitleHoverRule('kanban-task-title', 'Task kanban title')
  })
})

describe('Ticket 1.6-13 — Project Kanban cards and columns', () => {
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

  it('styles the project card title like the task title (underline hover, no faux button fill)', async () => {
    const project = buildProject({
      id: 'p-proj-title',
      name: 'Project title polish',
      venture_id: ventureUx.id,
      board_status: 'active',
      kanban_order: 0,
    })
    installWorkspaceBackendMock({
      ventures: [ventureUx],
      projects: [project],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const card = await waitForProjectKanbanCard('Project title polish', /active/i)
    const projTitle = within(card).getByTestId('kanban-project-title')
    expect(projTitle).toHaveTextContent(/project title polish/i)
    expectKanbanTitleHoverRule('kanban-project-title', 'Project kanban title')
  })

  it('omits the per-card lifecycle pill and dedicated drag handle from the project card chrome', async () => {
    const project = buildProject({
      id: 'p-chrome',
      name: 'Chrome trim',
      venture_id: ventureUx.id,
      board_status: 'idea',
      kanban_order: 0,
      status: 'active',
    })
    installWorkspaceBackendMock({
      ventures: [ventureUx],
      projects: [project],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const card = await waitForProjectKanbanCard('Chrome trim', /idea/i)
    expect(within(card).queryByTestId('kanban-project-drag-handle')).toBeNull()
    expect(within(card).queryByLabelText(/drag project/i)).toBeNull()

    const lifePill = card.querySelector('.kanban-project-meta-row .status-pill')
    expect(lifePill, 'Lifecycle/archive pill should be removed from project cards.').toBeNull()
    expect(within(card).queryByText(/^active$/i)).toBeNull()
  })

  it('uses the whole card as the drag surface (grab cursor on the card like task cards)', () => {
    const css = readBaseCss()
    expect(
      /\.kanban-task-card\s*\{[^}]*\bcursor:\s*grab\b/m.test(css),
      'Task cards should use cursor: grab for the whole-card drag surface.',
    ).toBe(true)
    expect(
      /\.kanban-project-card\s*\{[^}]*\bcursor:\s*grab\b/m.test(css),
      'Project cards should use cursor: grab on the card (same model as task cards once the handle is removed).',
    ).toBe(true)
  })

  it('still opens Edit project from the card title when the card becomes the drag surface', async () => {
    const target = buildProject({
      id: 'p-click',
      name: 'Clickable whole card',
      venture_id: ventureUx.id,
      board_status: 'paused',
      kanban_order: 0,
    })
    installWorkspaceBackendMock({
      ventures: [ventureUx],
      projects: [target],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const card = await waitForProjectKanbanCard('Clickable whole card', /paused/i)
    await userEvent.click(within(card).getByTestId('kanban-project-title'))

    expect(await screen.findByRole('dialog', { name: /edit project/i })).toBeInTheDocument()
  })

  it('shows only the numeric active open-task count under the title (no “open task(s)” copy)', async () => {
    const target = buildProject({
      id: 'p-count',
      name: 'Metric copy',
      venture_id: ventureUx.id,
      board_status: 'active',
      kanban_order: 0,
    })
    installWorkspaceBackendMock({
      ventures: [ventureUx],
      projects: [target],
      tasks: [
        buildTask({ id: 'o1', project_id: target.id, title: 'Open one', status: 'backlog' }),
        buildTask({ id: 'o2', project_id: target.id, title: 'Open two', status: 'in_progress' }),
        buildTask({ id: 'done1', project_id: target.id, title: 'Done one', status: 'done' }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const card = await waitForProjectKanbanCard('Metric copy', /active/i)
    const metricSpans = [...card.querySelectorAll('.kanban-project-meta-row .task-meta')]
    const numericOnly = metricSpans.find((node) => /^\d+$/.test(node.textContent?.trim() ?? ''))
    expect(numericOnly?.textContent?.trim()).toBe('2')
    expect(card.textContent?.toLowerCase() ?? '').not.toMatch(/open task/)
  })

  it('uses status pill styling for project column headers consistent with task board headers', async () => {
    const p = buildProject({
      id: 'p-cols',
      name: 'Column compare',
      venture_id: ventureUx.id,
      board_status: 'active',
      kanban_order: 0,
    })
    installWorkspaceBackendMock({
      ventures: [ventureUx],
      projects: [p],
      tasks: [
        buildTask({
          id: 'tc',
          project_id: p.id,
          title: 'Task column style',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const taskHeaderPill = getKanbanColumn(/backlog/i).querySelector('.task-card-header .status-pill')
    expect(taskHeaderPill).toBeTruthy()

    await switchBoardViewTab('projects')
    const ideaRegion = within(getKanbanRegion()).getByRole('region', { name: /^Idea$/ })
    const projectHeaderPill = ideaRegion.querySelector('.task-card-header .status-pill')

    expect(projectHeaderPill).toBeTruthy()
    const a = window.getComputedStyle(taskHeaderPill as Element)
    const b = window.getComputedStyle(projectHeaderPill as Element)
    expect(b.borderRadius).toBe(a.borderRadius)
    expect(b.padding).toBe(a.padding)
    expect(b.fontWeight).toBe(a.fontWeight)
  })
})

describe('Ticket 1.6-13 — Ventures sidebar chrome', () => {
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

  it('uses a compact chevron toggle (no visible “Collapse” / “Expand” label as the control text)', async () => {
    const venture = buildVenture({
      id: 'v-chv',
      name: 'Chevron Venture',
      category_label: labelSeed,
      category_label_id: labelSeed.id,
    })
    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [
        buildProject({ id: 'sp1', name: 'Side P1', venture_id: venture.id }),
      ],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const sidebar = getSidebar()
    const row = within(sidebar).getByTestId(`sidebar-venture-${venture.id}`)
    await ensureVentureTreeExpanded(row)

    const expandedToggle = within(sidebar).getByRole('button', { name: /collapse venture/i })
    const visible = expandedToggle.textContent?.trim() ?? ''
    expect(visible.toLowerCase()).not.toContain('collapse')
    expect(visible.toLowerCase()).not.toContain('expand')
    expect(visible.length).toBeLessThanOrEqual(2)
  })

  it('renders “+ project” as small link-style control after the venture project list', async () => {
    const venture = buildVenture({
      id: 'v-addp',
      name: 'Add Project Venture',
      category_label: labelSeed,
      category_label_id: labelSeed.id,
    })
    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [
        buildProject({ id: 'ap-1', name: 'Listed Alpha', venture_id: venture.id }),
        buildProject({ id: 'ap-2', name: 'Listed Bravo', venture_id: venture.id }),
      ],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const sidebar = getSidebar()
    const row = within(sidebar).getByTestId(`sidebar-venture-${venture.id}`)
    await ensureVentureTreeExpanded(row)

    const addProject =
      within(sidebar).queryByRole('link', { name: /^\+ project$/i }) ??
      within(sidebar).queryByRole('button', { name: /^\+ project$/i })
    expect(addProject, 'Expected + project affordance after the venture project list.').not.toBeNull()

    const ul = sidebar.querySelector('ul.sidebar-project-list')
    expect(ul, 'Expected a venture project list in the sidebar.').toBeTruthy()

    const addFollowsList =
      Boolean(ul!.compareDocumentPosition(addProject!) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      addFollowsList,
      '+ project should appear after the venture project list in document order.',
    ).toBe(true)

    const addStyles = window.getComputedStyle(addProject!)
    expect(addStyles.backgroundColor === 'rgba(0, 0, 0, 0)' || addStyles.backgroundColor === 'transparent').toBe(
      true,
    )
  })

  it('runs the vertical colour accent for the full venture block (header, nested list, and + project row)', async () => {
    const venture = buildVenture({
      id: 'v-stripe',
      name: 'Stripe Venture',
      category_label: labelSeed,
      category_label_id: labelSeed.id,
      colour: '#336699',
    })
    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [
        buildProject({ id: 'st-1', name: 'Stripe Child', venture_id: venture.id, colour: '#112233' }),
      ],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const row = screen.getByTestId('sidebar-venture-v-stripe')
    const shell = row.parentElement
    expect(shell).toBeTruthy()

    await ensureVentureTreeExpanded(row)

    const addProject =
      screen.queryByRole('link', { name: /^\+ project$/i }) ??
      screen.queryByRole('button', { name: /^\+ project$/i })
    expect(
      addProject,
      'Expected + project control at bottom of venture for continuous stripe layout.',
    ).not.toBeNull()

    const shellRect = shell!.getBoundingClientRect()
    const stripeWidth = Number.parseFloat(window.getComputedStyle(shell!).borderLeftWidth)
    expect(stripeWidth, 'Venture block shell should expose a left accent stripe.').toBeGreaterThan(0)

    const stripeColour = window.getComputedStyle(shell!).borderLeftColor
    expect(stripeColour.toLowerCase()).not.toBe('rgba(0, 0, 0, 0)')
    expect(stripeColour.toLowerCase()).not.toBe('transparent')

    const addRect = addProject!.getBoundingClientRect()
    expect(
      addRect.bottom <= shellRect.bottom + 2,
      '+ project control should sit inside the accent region (continuous venture block).',
    ).toBe(true)
  })

  it('keeps the venture toggle focusable with an accessible name (chevron-only visuals)', async () => {
    const venture = buildVenture({
      id: 'v-a11y',
      name: 'A11y Venture',
      category_label: labelSeed,
      category_label_id: labelSeed.id,
    })
    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const toggle = screen.getByRole('button', { name: /expand venture|collapse venture/i })
    toggle.focus()
    expect(document.activeElement).toBe(toggle)
    expect(toggle.getAttribute('aria-label') ?? '').toMatch(/venture/i)
  })
})
