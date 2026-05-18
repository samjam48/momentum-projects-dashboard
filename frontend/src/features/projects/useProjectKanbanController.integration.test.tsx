import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  buildProject,
  buildTask,
  buildVenture,
  buildVentureCategoryLabel,
} from '../../test/fixtures'
import { renderApp } from '../../test/renderApp'
import { resetBoardDisplayOptionsStore } from '../../stores/boardDisplayOptions'
import { resetProjectFilterStore } from '../../stores/projectFilter'
import { resetTestStorage } from '../../test/storage'
import { installWorkspaceBackendMock } from '../../test/workspaceBackendMock'
import {
  dispatchProjectKanbanDrop,
  expectProjectKanbanCardOrder,
  getKanbanColumn,
  getKanbanRegion,
  getSidebar,
  switchBoardViewTab,
  waitForProjectKanbanCard,
  waitForWorkspaceReady,
} from '../../test/workspaceQueries'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const labelSeed = buildVentureCategoryLabel({
  id: 'label-fr8',
  name: 'Hustle',
  slug: 'hustle',
})

const venture = buildVenture({
  id: 'venture-fr8',
  name: 'FR8 Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

/** Pre-implementation shorter timeout mirrors ProjectKanban.phase-1-6-10 tests. */
const PK_WAIT = { timeout: 2000 } satisfies { timeout: number }

/**
 * RTL integration spec for FR-8: behaviours that must survive extracting
 * `useProjectKanbanController` / optional `ProjectBoardView` out of App.
 * Extraction guards live in `useProjectKanbanController.extraction.test.ts`.
 */
describe('FR-8 project board controller orchestration (integration)', () => {
  const user = userEvent.setup()

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

  it('applies optimistic reorder for project-kanban:drop across columns and persists through board-status PATCH', async () => {
    const mover = buildProject({
      id: 'project-fr8-cross',
      name: 'Cross column',
      venture_id: venture.id,
      board_status: 'idea',
      kanban_order: 0,
    })

    const backend = installWorkspaceBackendMock({
      ventures: [venture],
      projects: [mover],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    await waitForProjectKanbanCard('Cross column', /idea/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: mover.id,
      board_status: 'active',
      kanban_order: 0,
    })

    await waitFor(() =>
      expect(backend.projectBoardStatusRequests).toEqual([
        {
          projectId: mover.id,
          payload: { board_status: 'active', kanban_order: 0 },
        },
      ]),
    )

    await waitForProjectKanbanCard('Cross column', /active/i, PK_WAIT)
  })

  it('applies optimistic same-column reorder and persists kanban_order through PATCH', async () => {
    let releasePatch: () => void = () => {}

    const first = buildProject({
      id: 'project-fr8-same-a',
      name: 'Same A',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 0,
    })
    const second = buildProject({
      id: 'project-fr8-same-b',
      name: 'Same B',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 1,
    })

    const backend = installWorkspaceBackendMock({
      ventures: [venture],
      projects: [first, second],
      tasks: [],
      onProjectBoardStatus: (_projectId, _body, count): Promise<Response | null> => {
        if (count === 1) {
          return new Promise<Response | null>((resolve) => {
            releasePatch = (): void => {
              resolve(null)
            }
          })
        }

        return Promise.resolve(null)
      },
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const column = getKanbanColumn(/active/i)
    await waitForProjectKanbanCard('Same A', /active/i, PK_WAIT)
    await waitForProjectKanbanCard('Same B', /active/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: first.id,
      board_status: 'active',
      kanban_order: 1,
    })

    await waitFor(() => {
      expectProjectKanbanCardOrder(column, ['Same B', 'Same A'])
    })

    releasePatch()

    await waitFor(() => {
      expect(backend.projectBoardStatusRequests).toEqual([
        {
          projectId: first.id,
          payload: { board_status: 'active', kanban_order: 1 },
        },
      ])
    })
  })

  it('sets finished semantics when transitioning into shipped (explicit finished in PATCH payload)', async () => {
    const shipMe = buildProject({
      id: 'project-fr8-shipped',
      name: 'Ship me',
      venture_id: venture.id,
      board_status: 'paused',
      kanban_order: 0,
      finished: false,
    })

    const backend = installWorkspaceBackendMock({
      ventures: [venture],
      projects: [shipMe],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    await waitForProjectKanbanCard('Ship me', /paused/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: shipMe.id,
      board_status: 'shipped',
      kanban_order: 0,
    })

    await waitFor(() => {
      expect(backend.projectBoardStatusRequests).toEqual([
        {
          projectId: shipMe.id,
          payload: { board_status: 'shipped', kanban_order: 0, finished: true },
        },
      ])
    })

    await waitForProjectKanbanCard('Ship me', /shipped/i, PK_WAIT)
  })

  it('does not send finished when reordering inside a non-shipped column (same-column active)', async () => {
    const pinned = buildProject({
      id: 'project-fr8-finish-held',
      name: 'Finish held',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 0,
      finished: false,
    })
    const mover = buildProject({
      id: 'project-fr8-finish-mover',
      name: 'Finish mover',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 1,
      finished: false,
    })

    const backend = installWorkspaceBackendMock({
      ventures: [venture],
      projects: [pinned, mover],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    await waitForProjectKanbanCard('Finish held', /active/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: mover.id,
      board_status: 'active',
      kanban_order: 0,
    })

    await waitFor(() => {
      expect(backend.projectBoardStatusRequests.length).toBe(1)
    })

    expect(Object.prototype.hasOwnProperty.call(backend.projectBoardStatusRequests[0].payload, 'finished')).toBe(
      false,
    )
  })

  it('runs board-status PATCH handlers strictly one-after-another on the enqueue lane while the first PATCH is unresolved', async () => {
    let releaseFirstMutation: () => void = () => {}

    const slowId = 'project-fr8-lane-slow'
    const fastId = 'project-fr8-lane-fast'

    const backend = installWorkspaceBackendMock({
      ventures: [venture],
      projects: [
        buildProject({
          id: slowId,
          name: 'Lane slow',
          venture_id: venture.id,
          board_status: 'active',
          kanban_order: 0,
        }),
        buildProject({
          id: fastId,
          name: 'Lane fast',
          venture_id: venture.id,
          board_status: 'active',
          kanban_order: 1,
        }),
      ],
      tasks: [],
      onProjectBoardStatus: (_projectId, _body, count): Promise<Response | null> => {
        if (count === 1) {
          return new Promise<Response | null>((resolve) => {
            releaseFirstMutation = (): void => {
              resolve(null)
            }
          })
        }

        return Promise.resolve(null)
      },
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    await waitForProjectKanbanCard('Lane slow', /active/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: slowId,
      board_status: 'paused',
      kanban_order: 0,
    })
    await dispatchProjectKanbanDrop({
      projectId: fastId,
      board_status: 'paused',
      kanban_order: 1,
    })

    await waitFor(() => expect(backend.projectBoardStatusRequests.length).toBeLessThanOrEqual(1))

    releaseFirstMutation()

    await waitFor(() => expect(backend.projectBoardStatusRequests.length).toBe(2))
    expect(backend.projectBoardStatusRequests.map((entry) => entry.projectId)).toEqual([
      slowId,
      fastId,
    ])
  })

  it('rolls back a failed board-status update yet still persists a subsequent queued PATCH cleanly', async () => {
    const bad = buildProject({
      id: 'project-fr8-queue-bad',
      name: 'Queue bad',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 0,
      finished: false,
    })

    const good = buildProject({
      id: 'project-fr8-queue-good',
      name: 'Queue good',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 1,
      finished: false,
    })

    const backend = installWorkspaceBackendMock({
      ventures: [venture],
      projects: [bad, good],
      tasks: [],
      onProjectBoardStatus: (projectId): Promise<Response> | Response | null =>
        projectId === bad.id
          ? Promise.resolve(jsonResponse({ detail: 'FR8 queued failure simulation.' }, 500))
          : null,
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const activeColumn = getKanbanColumn(/active/i)

    await waitForProjectKanbanCard('Queue bad', /active/i, PK_WAIT)

    await dispatchProjectKanbanDrop({
      projectId: bad.id,
      board_status: 'paused',
      kanban_order: 0,
    })

    await waitFor(() => {
      expect(screen.getByText(/fr8 queued failure simulation/i)).toBeInTheDocument()
    })

    expectProjectKanbanCardOrder(activeColumn, ['Queue bad', 'Queue good'])

    await dispatchProjectKanbanDrop({
      projectId: good.id,
      board_status: 'shipped',
      kanban_order: 0,
    })

    await waitFor(() => {
      expect(screen.queryByText(/fr8 queued failure simulation/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(backend.projectBoardStatusRequests).toHaveLength(2)
      expect(backend.projectBoardStatusRequests[1]).toEqual({
        projectId: good.id,
        payload: { board_status: 'shipped', kanban_order: 0, finished: true },
      })
    })

    await waitForProjectKanbanCard('Queue good', /shipped/i, PK_WAIT)
    expectProjectKanbanCardOrder(activeColumn, ['Queue bad'])
  })

  it('hides ventures-archived sibling projects from the board while keeping visibly scoped cards', async () => {
    const visible = buildProject({
      id: 'project-fr8-visible',
      name: 'Visible sibling',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 0,
    })
    const hiddenByVenture = buildProject({
      id: 'project-fr8-arch-venture',
      name: 'Hidden venture archive sibling',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 1,
      archived_by_venture: true,
    })

    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [visible, hiddenByVenture],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    await waitForProjectKanbanCard('Visible sibling', /active/i, PK_WAIT)

    await waitFor(() => {
      const region = getKanbanRegion()
      expect(within(region).queryByText(/Hidden venture archive sibling/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      const region = getKanbanRegion()
      expect(within(region).getAllByTestId('kanban-project-title')).toHaveLength(1)
      expect(within(region).getByTestId('kanban-project-title').textContent).toContain('Visible sibling')
    })
  })

  it('removes locally archived projects from the board immediately while keeping toolbar type filter controls rendered', async () => {
    const keeper = buildProject({
      id: 'project-fr8-local-keeper',
      name: 'Local keeper',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 0,
      project_type: 'project',
    })

    const removed = buildProject({
      id: 'project-fr8-local-archived',
      name: 'Local archive me',
      venture_id: venture.id,
      board_status: 'active',
      kanban_order: 1,
      project_type: 'gig',
    })

    installWorkspaceBackendMock({
      ventures: [venture],
      projects: [keeper, removed],
      tasks: [
        buildTask({
          id: 'task-fr8-open',
          project_id: removed.id,
          title: 'Open work for gigs',
          status: 'in_progress',
          kanban_order: 0,
        }),
      ],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    const gigBefore = await waitForProjectKanbanCard('Local archive me', /active/i, PK_WAIT)
    await waitFor(() =>
      expect(
        [...gigBefore.querySelectorAll('.kanban-project-meta-row .task-meta')]
          .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
          .some((line) => /^tasks\s+\d+$/i.test(line)),
      ).toBe(true),
    )

    await user.click(within(getSidebar()).getByRole('button', { name: /^Local archive me$/i }))
    const editDialog = await screen.findByRole('dialog', { name: /edit project/i })
    await user.click(within(editDialog).getByRole('button', { name: /archive project/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Local archive me$/i })).not.toBeInTheDocument()
    })

    const region = getKanbanRegion()

    await waitFor(() =>
      expect(within(region).queryByText(/Local archive me/i)).not.toBeInTheDocument(),
    )
    await waitForProjectKanbanCard('Local keeper', /active/i, PK_WAIT)

    const typeFilter = screen.getByRole('combobox', { name: /^project type filter$/i })
    expect(typeFilter).toBeInTheDocument()
    await user.selectOptions(typeFilter, 'contract')
    await waitFor(() => {
      expect((typeFilter as HTMLSelectElement).value).toBe('contract')
    })
    await user.selectOptions(typeFilter, 'all')
  })
})
