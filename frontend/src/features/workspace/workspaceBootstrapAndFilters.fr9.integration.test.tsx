import { screen, waitFor, within } from '@testing-library/react'

import {
  buildProject,
  buildTask,
  buildVenture,
  buildVentureCategoryLabel,
} from '../../test/fixtures'
import { renderApp, renderAppBare } from '../../test/renderApp'
import { resetBoardDisplayOptionsStore } from '../../stores/boardDisplayOptions'
import { resetProjectFilterStore } from '../../stores/projectFilter'
import { resetTestStorage } from '../../test/storage'
import { installWorkspaceBackendMock } from '../../test/workspaceBackendMock'
import {
  getKanbanRegion,
  getSidebar,
  selectComboboxOption,
  switchBoardViewTab,
  waitForWorkspaceReady,
} from '../../test/workspaceQueries'

function readFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

const labelSeed = buildVentureCategoryLabel({
  id: 'label-fr9',
  name: 'Hustle',
  slug: 'hustle',
})

const activeVenture = buildVenture({
  id: 'venture-fr9',
  name: 'FR9 Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

const PK_WAIT = { timeout: 2500 } satisfies { timeout: number }

/**
 * FR-9 behavioural coverage: workspace bootstrap gates, cold-load priming,
 * filter sync, and board tab + type filter semantics.
 * Extraction guards live in `*.extraction.test.ts` alongside target hooks.
 */
describe('FR-9 workspace bootstrap, filters, and board tabs (integration)', () => {
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

  it('holds the loading gate until the projects list finishes its initial fetch', async () => {
    const alpha = buildProject({
      id: 'project-fr9-projects-gate',
      name: 'Gate Project',
      venture_id: activeVenture.id,
    })

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha],
      tasks: [],
    })

    const originalFetch = fetchMock.getMockImplementation()
    if (!originalFetch) {
      throw new Error('Expected workspace backend mock implementation.')
    }

    let releaseProjects: (() => void) | null = null
    const projectsGate = new Promise<void>((resolve) => {
      releaseProjects = resolve
    })

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      const url = new URL(readFetchUrl(input), 'http://localhost')

      if (method === 'GET' && url.pathname === '/api/v1/projects') {
        await projectsGate
      }

      return originalFetch(input, init)
    })

    renderAppBare()

    expect(await screen.findByText(/loading workspace/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /kanban board/i })).not.toBeInTheDocument()

    releaseProjects?.()

    await waitForWorkspaceReady()
    expect(screen.getByRole('region', { name: /kanban board/i })).toBeInTheDocument()
  })

  it('completes workspace bootstrap on cold load with zero projects without an endless loading gate', async () => {
    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [],
      tasks: [],
    })

    await renderApp()

    expect(screen.queryByText(/loading workspace/i)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/create a project first to add tasks/i)).toBeInTheDocument()
    })
  })

  it('cold-loads tasks after the project list primes the task workspace', async () => {
    const alpha = buildProject({
      id: 'project-fr9-priming',
      name: 'Priming Project',
      venture_id: activeVenture.id,
    })

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha],
      tasks: [
        buildTask({
          id: 'task-fr9-priming',
          project_id: alpha.id,
          title: 'Primed backlog task',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()

    await waitFor(() => {
      expect(within(getKanbanRegion()).getByText('Primed backlog task')).toBeInTheDocument()
    })
  })

  it('reflects toolbar single-project selection onto sidebar inclusion checkboxes', async () => {
    const alpha = buildProject({
      id: 'project-fr9-toolbar-alpha',
      name: 'Toolbar Alpha',
      venture_id: activeVenture.id,
    })
    const beta = buildProject({
      id: 'project-fr9-toolbar-beta',
      name: 'Toolbar Beta',
      venture_id: activeVenture.id,
    })

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [alpha, beta],
      tasks: [],
    })

    await renderApp()

    const filter = screen.getByRole('combobox', { name: /project filter/i })
    expect(filter).toHaveValue('all')

    await selectComboboxOption(/project filter/i, beta.id)

    const sidebar = getSidebar()
    await waitFor(() => {
      expect(
        within(sidebar).getByRole('checkbox', { name: /show toolbar alpha in workspace/i }),
      ).not.toBeChecked()
      expect(
        within(sidebar).getByRole('checkbox', { name: /show toolbar beta in workspace/i }),
      ).toBeChecked()
    })
  })

  it('scopes the Projects board tab by project type without losing tab state', async () => {
    const gig = buildProject({
      id: 'project-fr9-gig',
      name: 'Gig Board Row',
      venture_id: activeVenture.id,
      project_type: 'gig',
      board_status: 'idea',
      kanban_order: 0,
    })
    const standard = buildProject({
      id: 'project-fr9-standard',
      name: 'Standard Board Row',
      venture_id: activeVenture.id,
      project_type: 'project',
      board_status: 'idea',
      kanban_order: 1,
    })

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [gig, standard],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const region = getKanbanRegion()
    await waitFor(
      () => {
        expect(within(region).getByText('Gig Board Row')).toBeInTheDocument()
        expect(within(region).getByText('Standard Board Row')).toBeInTheDocument()
      },
      PK_WAIT,
    )

    await selectComboboxOption(/project type filter/i, 'gig')

    await waitFor(() => {
      expect(within(region).getByText('Gig Board Row')).toBeInTheDocument()
      expect(within(region).queryByText('Standard Board Row')).not.toBeInTheDocument()
    })

    const tablist = screen.getByRole('tablist', { name: /board view/i })
    expect(within(tablist).getByRole('tab', { name: /^projects$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await selectComboboxOption(/project type filter/i, 'all')

    await waitFor(() => {
      expect(within(region).getByText('Standard Board Row')).toBeInTheDocument()
    })
  })
})
