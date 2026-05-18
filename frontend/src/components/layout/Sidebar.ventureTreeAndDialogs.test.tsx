import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Project, Venture, VentureCategoryLabel } from '../../api/types'
import { buildProject, buildVenture, buildVentureCategoryLabel } from '../../test/fixtures'
import { renderWithQueryClient } from '../../test/renderApp'
import { resetProjectFilterStore } from '../../stores/projectFilter'
import { Sidebar } from './Sidebar'

const TEST_LABEL_HUSTLE: VentureCategoryLabel = buildVentureCategoryLabel({
  id: 'lbl-hustle',
  name: 'Hustle',
  slug: 'hustle',
})

const TEST_VENTURE_ID = 'venture-hustle-1'

const DEFAULT_ACTIVE_VENTURE: Venture = buildVenture({
  id: TEST_VENTURE_ID,
  name: 'Hustle',
  category_label: TEST_LABEL_HUSTLE,
  category_label_id: TEST_LABEL_HUSTLE.id,
})

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function installSidebarFetchMock(options?: {
  activeVentures?: Venture[]
  projectsForList?: Project[]
}): void {
  const initialVentures =
    options?.activeVentures !== undefined ? [...options.activeVentures] : [DEFAULT_ACTIVE_VENTURE]

  let activeVentures = [...initialVentures]
  let projectsState = [...(options?.projectsForList ?? [])]

  const fetchMock = vi.fn<typeof fetch>((input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    const url = new URL(raw, 'http://localhost')
    const method = init?.method ?? 'GET'

    if (method === 'GET' && url.pathname === '/api/v1/venture-category-labels') {
      return Promise.resolve(
        jsonOk([
          TEST_LABEL_HUSTLE,
          buildVentureCategoryLabel({
            id: 'lbl-business',
            name: 'Business',
            slug: 'business',
          }),
        ]),
      )
    }

    if (
      method === 'GET' &&
      url.pathname === '/api/v1/ventures' &&
      url.searchParams.get('status') === 'active'
    ) {
      return Promise.resolve(
        jsonOk([
          ...new Map(
            activeVentures
              .filter((venture) => venture.status === 'active')
              .map((venture) => [venture.id, venture]),
          ).values(),
        ]),
      )
    }

    if (
      method === 'GET' &&
      url.pathname === '/api/v1/ventures' &&
      url.searchParams.get('status') === 'archived'
    ) {
      return Promise.resolve(jsonOk([]))
    }

    const ventureDeleteMatch = url.pathname.match(/^\/api\/v1\/ventures\/([^/]+)$/)
    if (ventureDeleteMatch && method === 'DELETE') {
      const [, ventureId] = ventureDeleteMatch
      activeVentures = activeVentures.map((venture) =>
        venture.id === ventureId ? { ...venture, status: 'archived' } : venture,
      )
      projectsState = projectsState.map((project) =>
        project.venture_id === ventureId
          ? {
              ...project,
              archived_by_venture: true,
              status: 'archived',
            }
          : project,
      )
      return Promise.resolve(new Response(null, { status: 204 }))
    }

    if (method === 'GET' && url.pathname === '/api/v1/projects') {
      const statusFilter = url.searchParams.get('status')
      const items =
        statusFilter === 'archived'
          ? projectsState.filter((project) => project.status === 'archived')
          : projectsState.filter((project) => project.status === 'active')

      return Promise.resolve(jsonOk(items))
    }

    if (method === 'GET' && url.pathname === '/api/v1/tasks') {
      return Promise.resolve(jsonOk([]))
    }

    return Promise.resolve(
      new Response(JSON.stringify({ detail: 'Not Found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      }),
    )
  })

  vi.stubGlobal('fetch', fetchMock)
}

async function renderSidebar(options?: {
  activeProjects?: Project[]
  fetchVentures?: Venture[]
  projectsError?: string | null
  projectsLoading?: boolean
  skipReadyWait?: boolean
}): Promise<ReturnType<typeof renderWithQueryClient>> {
  const activeProjects = options?.activeProjects ?? []

  installSidebarFetchMock({
    activeVentures: options?.fetchVentures ?? [DEFAULT_ACTIVE_VENTURE],
    projectsForList: activeProjects,
  })

  const view = renderWithQueryClient(
    <Sidebar
      activeProjects={activeProjects}
      onCreateProject={vi.fn()}
      onEditProject={vi.fn()}
      onEditTask={vi.fn()}
      projectsError={options?.projectsError ?? null}
      projectsLoading={options?.projectsLoading ?? false}
      reloadProjects={vi.fn()}
    />,
  )

  if (!options?.projectsLoading && !options?.skipReadyWait) {
    await screen.findByRole('button', { name: /^\+ hustle$/i })
  }

  return view
}

describe('Venture tree sidebar and venture dialogs', () => {
  beforeEach(() => {
    resetProjectFilterStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetProjectFilterStore()
  })

  it('replaces phase-1b flat scaffold with venture-grouped tree copy', async () => {
    await renderSidebar({
      activeProjects: [
        buildProject({
          id: 'project-1',
          name: 'Landing Page',
          venture_id: TEST_VENTURE_ID,
        }),
        buildProject({
          id: 'project-2',
          name: 'Automation Bot',
          venture_id: TEST_VENTURE_ID,
        }),
      ],
    })

    const sidebar = screen.getByRole('complementary', { name: /projects sidebar/i })
    expect(within(sidebar).queryByText(/flat list until phase 1\.6 adds ventures/i)).not.toBeInTheDocument()
    expect(within(sidebar).getByText(/^ventures$/i)).toBeInTheDocument()
    expect(within(sidebar).getAllByTestId(`sidebar-venture-${TEST_VENTURE_ID}`)).toHaveLength(1)
  })

  it('shows expand/collapse affordance and child count on venture row', async () => {
    await renderSidebar({
      activeProjects: [
        buildProject({ id: 'project-1', name: 'Landing Page', venture_id: TEST_VENTURE_ID }),
        buildProject({ id: 'project-2', name: 'Automation Bot', venture_id: TEST_VENTURE_ID }),
      ],
    })

    const ventureRows = screen.getAllByTestId(`sidebar-venture-${TEST_VENTURE_ID}`)
    expect(ventureRows).toHaveLength(1)
    const ventureRow = ventureRows[0]
    expect(within(ventureRow).getByRole('button', { name: /expand|collapse/i })).toBeInTheDocument()
    expect(within(ventureRow).getByText(/2 projects/i)).toBeInTheDocument()
  })

  it('keeps child project checkboxes selected by default', async () => {
    await renderSidebar({
      activeProjects: [
        buildProject({ id: 'project-1', name: 'Landing Page', venture_id: TEST_VENTURE_ID }),
        buildProject({ id: 'project-2', name: 'Automation Bot', venture_id: TEST_VENTURE_ID }),
      ],
    })

    expect(screen.getByRole('checkbox', { name: /show landing page in workspace/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /show automation bot in workspace/i })).toBeChecked()
  })

  it('opens venture edit dialog when venture title is clicked', async () => {
    await renderSidebar({
      activeProjects: [
        buildProject({ id: 'project-1', name: 'Landing Page', venture_id: TEST_VENTURE_ID }),
      ],
    })

    await userEvent.click(screen.getByRole('button', { name: /^hustle$/i }))

    expect(screen.getByRole('dialog', { name: /^hustle$/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /venture category/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /archive venture/i })).toBeInTheDocument()
  })

  it('opens venture create dialog via + Hustle with default Hustle category combobox', async () => {
    await renderSidebar({
      activeProjects: [
        buildProject({ id: 'project-1', name: 'Landing Page', venture_id: TEST_VENTURE_ID }),
      ],
    })

    const createButton = screen.getByRole('button', { name: /^\+ hustle$/i })
    expect(createButton).toBeEnabled()
    await userEvent.click(createButton)

    expect(screen.getByRole('dialog', { name: /new venture/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /venture category/i })).toHaveDisplayValue(/hustle/i)
  })

  it('archive dialog includes archived ventures/projects views in archive pattern', async () => {
    await renderSidebar({
      activeProjects: [
        buildProject({ id: 'project-1', name: 'Landing Page', venture_id: TEST_VENTURE_ID }),
      ],
    })

    await userEvent.click(screen.getByRole('button', { name: /view archive/i }))
    const dialog = screen.getByRole('dialog', { name: /archive/i })
    expect(within(dialog).getByRole('tab', { name: /archived ventures/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: /archived projects/i })).toBeInTheDocument()
  })

  it('does not reset sidebar subset filter when archiving a venture excluded from sidebar selection', async () => {
    const ventureBizId = 'venture-biz-1'

    const bizVenture: Venture = buildVenture({
      id: ventureBizId,
      name: 'Biz',
      category_label: TEST_LABEL_HUSTLE,
      category_label_id: TEST_LABEL_HUSTLE.id,
    })

    await renderSidebar({
      activeProjects: [
        buildProject({
          id: 'project-alpha',
          name: 'Alpha One',
          venture_id: TEST_VENTURE_ID,
        }),
        buildProject({
          id: 'project-bravo',
          name: 'Bravo Two',
          venture_id: ventureBizId,
        }),
        buildProject({
          id: 'project-charlie',
          name: 'Charlie Three',
          venture_id: ventureBizId,
        }),
      ],
      fetchVentures: [DEFAULT_ACTIVE_VENTURE, bizVenture],
    })

    await userEvent.click(
      screen.getByRole('checkbox', { name: /show alpha one in workspace/i }),
    )
    await userEvent.click(
      screen.getByRole('checkbox', { name: /show charlie three in workspace/i }),
    )

    await userEvent.click(screen.getByRole('button', { name: /^hustle$/i }))
    await userEvent.click(screen.getByRole('button', { name: /archive venture/i }))

    expect(screen.queryByTestId(`sidebar-venture-${TEST_VENTURE_ID}`)).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /show bravo two in workspace/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /show charlie three in workspace/i })).not.toBeChecked()
  })

  it('removes archived venture and cascaded projects from active tree after archive action', async () => {
    await renderSidebar({
      activeProjects: [
        buildProject({ id: 'project-1', name: 'Landing Page', venture_id: TEST_VENTURE_ID }),
        buildProject({ id: 'project-2', name: 'Automation Bot', venture_id: TEST_VENTURE_ID }),
      ],
    })

    await userEvent.click(screen.getByRole('button', { name: /^hustle$/i }))
    await userEvent.click(screen.getByRole('button', { name: /archive venture/i }))
    expect(screen.queryByTestId(`sidebar-venture-${TEST_VENTURE_ID}`)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /show landing page in workspace/i })).not.toBeInTheDocument()
  })

  it('shows venture-first empty state guidance and not root-level project create entrypoint', async () => {
    await renderSidebar({
      activeProjects: [],
      fetchVentures: [],
    })

    const sidebar = screen.getByRole('complementary', { name: /projects sidebar/i })
    expect(within(sidebar).getByText(/create a venture to get started/i)).toBeInTheDocument()
    expect(within(sidebar).queryByRole('button', { name: /new project/i })).not.toBeInTheDocument()
  })

  it('loading state does not render dead project rows or checkboxes', () => {
    const activeProjects = [
      buildProject({ id: 'project-1', name: 'Landing Page', venture_id: TEST_VENTURE_ID }),
    ]

    installSidebarFetchMock({
      activeVentures: [DEFAULT_ACTIVE_VENTURE],
      projectsForList: activeProjects,
    })

    renderWithQueryClient(
      <Sidebar
        activeProjects={activeProjects}
        onCreateProject={vi.fn()}
        onEditProject={vi.fn()}
        onEditTask={vi.fn()}
        projectsError={null}
        projectsLoading
        reloadProjects={vi.fn()}
      />,
    )

    expect(screen.getByTestId('sidebar-loading-state')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByTestId(/sidebar-project-/)).not.toBeInTheDocument()
  })
})
