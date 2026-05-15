import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
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
  clickProjectFilterCheckbox,
  dispatchProjectKanbanDrop,
  expectProjectKanbanCardOrder,
  getKanbanBoardHeading,
  getKanbanColumn,
  getKanbanRegion,
  queryKanbanCardMoveButtons,
  switchBoardViewTab,
  waitForKanbanTaskVisible,
  waitForProjectKanbanCard,
  waitForWorkspaceReady,
} from './test/workspaceQueries'

const labelSeed = buildVentureCategoryLabel({ id: 'label-seed-1', name: 'Hustle', slug: 'hustle' })
const ventureBase = buildVenture({
  id: 'venture-test',
  name: 'Test Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function readFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  return input.url
}

/** Pre-implementation: fail faster than Vitest suite default while waiting for Project Kanban. */
const PK_WAIT = { timeout: 2000 } satisfies { timeout: number }

/** Ticket 1.6-10 — acceptance tests (implement Project Kanban + filter UX to turn red → green). */
describe('Ticket 1.6-10 — Project Kanban Board and Project Type Filter', () => {
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

  it('enables Tasks | Projects board tabs — Tasks retains task columns; Projects exposes Idea / Active / Paused / Shipped', async () => {
    const p = buildProject({ id: 'p-board', name: 'Board Probe', venture_id: ventureBase.id })
    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [p],
      tasks: [
        buildTask({
          id: 't-b',
          project_id: p.id,
          title: 'Probe task Kanban columns',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const tablist = screen.getByRole('tablist', { name: /board view/i })
    const projectsTab = within(tablist).getByRole('tab', { name: /^projects$/i })
    expect(projectsTab).not.toHaveAttribute('disabled')

    await waitForKanbanTaskVisible('Probe task Kanban columns', /backlog/i)
    expect(getKanbanBoardHeading(/tasks$/i)).toBeInTheDocument()

    ;['idea', 'active', 'paused', 'shipped'].forEach((col) =>
      expect(
        within(getKanbanRegion()).queryByRole('region', { name: new RegExp(`^${col}$`, 'i') }),
      ).not.toBeInTheDocument(),
    )

    await switchBoardViewTab('projects')
    await waitFor(() => {
      const region = getKanbanRegion()
      expect(['Idea', 'Active', 'Paused', 'Shipped'].every((title) =>
        within(region).getByRole('region', { name: new RegExp(`^${title}$`) }),
      )).toBe(true)
    })
    expect(within(getKanbanRegion()).queryByRole('region', { name: /^Backlog$/i })).not.toBeInTheDocument()
    expect(getKanbanBoardHeading(/projects$/i)).toBeInTheDocument()

    await switchBoardViewTab('tasks')
    await waitForKanbanTaskVisible('Probe task Kanban columns', /backlog/i)
    expect(getKanbanBoardHeading(/tasks$/i)).toBeInTheDocument()
  })

  it('renders colour dot, name, archive visibility badge, type label for non-project types, and default open-task metric', async () => {
    const plain = buildProject({
      id: 'p-plain',
      name: 'Plain project',
      colour: '#aabbcc',
      venture_id: ventureBase.id,
      project_type: 'project',
      board_status: 'active',
      status: 'active',
      kanban_order: 0,
    })
    const gigProject = buildProject({
      id: 'p-gig',
      name: 'Gig work',
      colour: '#ccddee',
      venture_id: ventureBase.id,
      project_type: 'gig',
      board_status: 'active',
      kanban_order: 1,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [plain, gigProject],
      tasks: [
        buildTask({
          id: 't-open-a',
          project_id: gigProject.id,
          title: 'Tracked A',
          status: 'in_progress',
        }),
        buildTask({
          id: 't-open-b',
          project_id: gigProject.id,
          title: 'Tracked B',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const gigCard = await waitForProjectKanbanCard('Gig work', /active/i, PK_WAIT)

    expect(
      gigCard.querySelector('[data-testid="kanban-project-colour-dot"]'),
    ).toHaveStyle({ backgroundColor: '#ccddee' })

    await waitFor(() => {
      expect(within(gigCard).getByText(/^gig$/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(
        within(gigCard).getByText(/\b2\b.*\bopen\b.*\btasks?\b|\bopen tasks?\b.*\b2\b/i),
      ).toBeInTheDocument()
    })

    expect(within(gigCard).getByText(/^active$/i)).toBeInTheDocument()

    const plainCard = await waitForProjectKanbanCard('Plain project', /active/i, PK_WAIT)
    expect(within(plainCard).queryByText(/^gig$/i)).not.toBeInTheDocument()
    expect(within(plainCard).queryByText(/^asset$/i)).not.toBeInTheDocument()
  })

  it('offers All / project / asset / gig / contract type filter rows and trims cards while keeping filter controls mounted', async () => {
    const assetProject = buildProject({
      id: 'p-ass',
      name: 'Asset only',
      project_type: 'asset',
      venture_id: ventureBase.id,
      board_status: 'idea',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [assetProject],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const filter = screen.getByRole('combobox', { name: /project type(?: filter)?/i })
    const optionTexts = [...filter.querySelectorAll('option')].map((option) => option.textContent?.trim())

    ;([/^all\b/i, /(^|\s)project($|\s)/i, /\basset\b/i, /\bgig\b/i, /\bcontract\b/i] as const).forEach(
      (needle) =>
        expect(
          optionTexts.some((optionText) =>
            needle.test(optionText ?? ''),
          ),
        ).toBe(true),
    )

    await userEvent.selectOptions(filter, 'contract')
    await waitFor(() =>
      expect(within(getKanbanRegion()).queryByText(/asset only/i)).not.toBeInTheDocument(),
    )
    await waitFor(() => {
      const hits = screen.queryAllByText(
        /no .*match|nothing matches|no .*projects .*filter|nothing to show|adjust filter/i,
      )
      expect(hits.length).toBeGreaterThan(0)
    })
    expect(filter).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: /board view/i })).toBeInTheDocument()
  })

  it('scopes Project Kanban to sidebar-checked projects mirroring Task Kanban', async () => {
    const alpha = buildProject({
      id: 'p-alpha',
      name: 'Alpha Client',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 0,
    })
    const beta = buildProject({
      id: 'p-beta',
      name: 'Beta Podcast',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 1,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [alpha, beta],
      tasks: [
        buildTask({
          id: 't-a',
          project_id: alpha.id,
          title: 'Sidebar scope Alpha',
          status: 'backlog',
        }),
        buildTask({
          id: 't-b',
          project_id: beta.id,
          title: 'Sidebar scope Beta',
          status: 'backlog',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await waitForKanbanTaskVisible('Sidebar scope Beta', /backlog/i)

    await switchBoardViewTab('projects')
    await waitForProjectKanbanCard('Alpha Client', /active/i, PK_WAIT)
    await waitForProjectKanbanCard('Beta Podcast', /active/i, PK_WAIT)

    await clickProjectFilterCheckbox('Alpha Client')
    await switchBoardViewTab('tasks')

    await waitFor(() =>
      expect(screen.queryByText('Sidebar scope Alpha')).not.toBeInTheDocument(),
    )

    await switchBoardViewTab('projects')
    await waitFor(() =>
      expect(within(getKanbanRegion()).queryByText(/alpha client/i)).not.toBeInTheDocument(),
    )
    await waitForProjectKanbanCard('Beta Podcast', /active/i, PK_WAIT)
  })

  it('calls PATCH /api/v1/projects/{id}/board-status after a programmatic project Kanban drop', async () => {
    const mover = buildProject({
      id: 'p-move',
      name: 'Move me',
      venture_id: ventureBase.id,
      board_status: 'idea',
      kanban_order: 0,
    })

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [mover],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')
    await waitForProjectKanbanCard('Move me', /idea/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: mover.id,
      board_status: 'active',
      kanban_order: 0,
    })

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([request, init]) => {
          const url = readFetchUrl(request)
          const method = (init?.method ?? 'GET').toUpperCase()
          const body = typeof init?.body === 'string' ? init.body : ''

          return (
            method === 'PATCH' &&
            url.includes(`/api/v1/projects/${mover.id}/board-status`) &&
            body.includes('active')
          )
        }),
      ).toBe(true),
    )
  })

  it('rolls back optimistic moves and keeps a single instance of each card when board-status PATCH fails', async () => {
    const alpha = buildProject({
      id: 'p-a',
      name: 'Order Alpha',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 0,
    })
    const beta = buildProject({
      id: 'p-b',
      name: 'Order Beta',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 1,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [alpha, beta],
      tasks: [],
      onProjectBoardStatus: () =>
        Promise.resolve(jsonResponse({ detail: 'Simulated persistence failure.' }, 500)),
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const column = await waitFor(async () => {
      await waitForProjectKanbanCard('Order Alpha', /active/i, PK_WAIT)
      await waitForProjectKanbanCard('Order Beta', /active/i, PK_WAIT)
      return getKanbanColumn(/active/i)
    })

    await dispatchProjectKanbanDrop({
      projectId: alpha.id,
      board_status: 'active',
      kanban_order: 1,
    })

    await waitFor(() =>
      expect(screen.getByText(/simulated persistence failure|unable to .*board|persist project board/i)).toBeInTheDocument(),
    )

    await waitFor(() => expectProjectKanbanCardOrder(column, ['Order Alpha', 'Order Beta']))
    expect(within(column).getAllByText(/Order Alpha/i)).toHaveLength(1)
  })

  it('sets finished=true semantics when dragging into Shipped (payload or persisted card renders finished copy)', async () => {
    const shipMe = buildProject({
      id: 'p-ship',
      name: 'Shippable',
      venture_id: ventureBase.id,
      board_status: 'active',
      finished: false,
      kanban_order: 0,
    })

    const { fetchMock, projectBoardStatusRequests } = installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [shipMe],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')
    await waitForProjectKanbanCard('Shippable', /active/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: shipMe.id,
      board_status: 'shipped',
      kanban_order: 0,
    })

    await waitFor(() => {
      const payloadLogged = projectBoardStatusRequests.some((entry) => {
        const status = entry.payload.board_status
        return (
          entry.projectId === shipMe.id &&
          typeof status === 'string' &&
          status.toLowerCase().includes('ship')
        )
      })

      const requestLogged =
        payloadLogged ||
        fetchMock.mock.calls.some(([req, init]) => {
          const url = readFetchUrl(req)
          const body =
            typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? '')
          return url.includes('/board-status') && body.toLowerCase().includes('shipped')
        })

      expect(requestLogged).toBe(true)
    })

    await waitFor(() => {
      const bodies = fetchMock.mock.calls
        .map(([, init]) => (typeof init?.body === 'string' ? init.body : ''))
        .join('\n')

      const finishedPropagated =
        bodies.includes('"finished"') &&
        /\bfinished\b\s*[:=]\s*true|"finished"\s*:\s*true/.test(bodies)

      let finishedUi = false
      try {
        finishedUi = Boolean(
          within(getKanbanColumn(/shipped/i)).queryByText(/\bfinished\b|^shipped$/i),
        )
      } catch {
        finishedUi = false
      }

      expect(finishedPropagated || finishedUi).toBe(true)
    })

    await waitForProjectKanbanCard('Shippable', /shipped/i, PK_WAIT)
  })

  it('keeps empty Idea / Paused / Shipped columns rendered with emptystate helpers as drop zones', async () => {
    const lonely = buildProject({
      id: 'p-alone',
      name: 'Only in Active',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [lonely],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    await waitForProjectKanbanCard('Only in Active', /active/i, PK_WAIT)

    await waitFor(() => {
      for (const heading of ['Idea', 'Paused', 'Shipped'] as const) {
        const columnRegion = within(getKanbanRegion()).getByRole('region', {
          name: new RegExp(`^${heading}$`),
        })
        expect(
          within(columnRegion).queryByText(
            /no projects in this column|empty column|drop (a )?project|nothing here|no cards/i,
          ),
        ).toBeInTheDocument()
      }
    })
  })

  it('dedupes concurrent board-status attempts while the first PATCH is unresolved', async () => {
    let releaseFirstMutation: () => void = () => {}
    const { projectBoardStatusRequests } = installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        buildProject({
          id: 'p1',
          name: 'Concurrent one',
          venture_id: ventureBase.id,
          board_status: 'idea',
          kanban_order: 0,
        }),
        buildProject({
          id: 'p2',
          name: 'Concurrent two',
          venture_id: ventureBase.id,
          board_status: 'idea',
          kanban_order: 1,
        }),
      ],
      tasks: [],
      onProjectBoardStatus: (_, __body, count) => {
        if (count === 1) {
          return new Promise<Response | null>((resolve) => {
            releaseFirstMutation = () => resolve(null)
          })
        }
        return Promise.resolve(null)
      },
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')
    await waitForProjectKanbanCard('Concurrent one', /idea/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: 'p1',
      board_status: 'paused',
      kanban_order: 0,
    })
    await dispatchProjectKanbanDrop({
      projectId: 'p2',
      board_status: 'paused',
      kanban_order: 1,
    })

    await waitFor(() => expect(projectBoardStatusRequests.length).toBeLessThanOrEqual(1))
    releaseFirstMutation()
    await waitFor(() => expect(projectBoardStatusRequests.length).toBeGreaterThanOrEqual(1))
  })

  it('opens Edit project via an explicit title control without resurrecting noisy task-only drag buttons', async () => {
    const target = buildProject({
      id: 'p-edit',
      name: 'Editable card',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [target],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const card = await waitForProjectKanbanCard('Editable card', /active/i, PK_WAIT)
    expect(queryKanbanCardMoveButtons(card)).toHaveLength(0)

    await userEvent.click(within(card).getByTestId('kanban-project-title'))
    expect(await screen.findByRole('dialog', { name: /edit project/i })).toBeInTheDocument()
  })

  it('never lists archived active-directory projects alongside live Project Kanban cards', async () => {
    const visible = buildProject({
      id: 'p-vis',
      name: 'Included project',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 0,
      status: 'active',
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        visible,
        buildProject({
          id: 'p-arch',
          name: 'Archived direct',
          status: 'archived',
          venture_id: ventureBase.id,
          board_status: 'paused',
        }),
      ],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    await waitFor(() =>
      expect(within(getKanbanRegion()).queryByText(/archived direct/i)).not.toBeInTheDocument(),
    )
    await waitForProjectKanbanCard('Included project', /active/i, PK_WAIT)
  })

  it('excludes cascade-archived projects (archived alongside their venture)', async () => {
    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        buildProject({
          id: 'p-onboard',
          name: 'Post venture archive',
          venture_id: ventureBase.id,
          board_status: 'active',
        }),
        buildProject({
          id: 'p-cascade',
          name: 'Cascade hidden',
          venture_id: ventureBase.id,
          status: 'archived',
          archived_by_venture: true,
          board_status: 'paused',
          kanban_order: 2,
        }),
      ],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    expect(within(getKanbanRegion()).queryByText(/cascade hidden/i)).not.toBeInTheDocument()
    await waitForProjectKanbanCard('Post venture archive', /active/i, PK_WAIT)
  })

  it('shows full project identity fields on Project Kanban even when task-board display prefs hide project pills', async () => {
    window.localStorage.setItem(
      BOARD_DISPLAY_OPTIONS_STORAGE_KEY,
      JSON.stringify({
        showDueDate: false,
        showPriority: false,
        showActualHours: false,
        showProjectName: false,
      }),
    )

    const focus = buildProject({
      id: 'p-scope',
      name: 'Scoped name',
      colour: '#ddeeff',
      project_type: 'contract',
      venture_id: ventureBase.id,
      board_status: 'active',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [focus],
      tasks: [
        buildTask({
          project_id: focus.id,
          id: 't-multi',
          title: 'Contrast task',
          status: 'review',
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()

    await switchBoardViewTab('tasks')
    await waitForKanbanTaskVisible('Contrast task', /review/i)
    const reviewColumn = getKanbanColumn(/review/i)
    const taskTitleBtn = within(reviewColumn).getByTestId('kanban-task-title')
    const taskLi = taskTitleBtn.closest('li')
    if (taskLi) {
      expect(within(taskLi as HTMLElement).queryByText(/^Scoped name$/i)).not.toBeInTheDocument()
    }

    await switchBoardViewTab('projects')
    const card = await waitForProjectKanbanCard('Scoped name', /active/i, PK_WAIT)
    expect(
      card.querySelector('[data-testid="kanban-project-colour-dot"]'),
    ).toHaveStyle({ backgroundColor: '#ddeeff' })
    expect(within(card).getByText(/^contract$/i)).toBeInTheDocument()
  })

  it('disables project drag gestures while PATCH board-status is still awaiting the server response', async () => {
    let releasePatch: () => void = () => {}
    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [
        buildProject({
          id: 'drag-a',
          name: 'Drag Alpha',
          venture_id: ventureBase.id,
          board_status: 'active',
          kanban_order: 0,
        }),
      ],
      tasks: [],
      onProjectBoardStatus: (_, __body, count) => {
        if (count === 1) {
          return new Promise<Response | null>((resolve) => {
            releasePatch = () => resolve(null)
          })
        }
        return Promise.resolve(null)
      },
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')
    await waitForProjectKanbanCard('Drag Alpha', /active/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: 'drag-a',
      board_status: 'paused',
      kanban_order: 0,
    })

    await waitFor(() => {
      const region = getKanbanRegion()
      const dragHandles = [
        ...region.querySelectorAll(
          '[data-testid="kanban-project-drag-handle"], [aria-label="Drag project"], button[data-dnd-drag]',
        ),
      ]

      const suppressionMarkers = region.querySelectorAll('[data-dragging-suppressed-for-mutation]')

      const dragLocked =
        (dragHandles.length > 0 &&
          dragHandles.every(
            (node) =>
              node.getAttribute('aria-disabled') === 'true' ||
              node.hasAttribute('data-dnd-drag-disabled'),
          )) ||
        suppressionMarkers.length > 0 ||
        Boolean(within(region).queryByText(/saving .*board|persisting .*project/i))

      expect(dragLocked).toBe(true)
    })

    releasePatch()
  })
})
