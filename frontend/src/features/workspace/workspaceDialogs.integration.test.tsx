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
  getKanbanColumn,
  getSidebar,
  switchBoardViewTab,
  waitForProjectKanbanCard,
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

function parseBodiesForTaskPatch(fetchMock: ReturnType<typeof vi.fn>, taskId: string): unknown[] {
  const parsed: unknown[] = []
  for (const call of fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit | undefined]>) {
    const [input, init] = call
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method !== 'PATCH') {
      continue
    }

    const url = new URL(readFetchUrl(input), 'http://localhost')
    if (url.pathname !== `/api/v1/tasks/${taskId}`) {
      continue
    }

    const rawBody = init?.body
    if (typeof rawBody !== 'string') {
      continue
    }

    parsed.push(JSON.parse(rawBody) as unknown)
  }

  return parsed
}

function parseBodiesForProjectPatch(
  fetchMock: ReturnType<typeof vi.fn>,
  projectId: string,
): unknown[] {
  const parsed: unknown[] = []
  for (const call of fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit | undefined]>) {
    const [input, init] = call
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method !== 'PATCH') {
      continue
    }

    const url = new URL(readFetchUrl(input), 'http://localhost')
    if (url.pathname !== `/api/v1/projects/${projectId}`) {
      continue
    }

    const rawBody = init?.body
    if (typeof rawBody !== 'string') {
      continue
    }

    parsed.push(JSON.parse(rawBody) as unknown)
  }

  return parsed
}

async function dismissProjectDialogEscape(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.keyboard('{Escape}')
}

const labelSeed = buildVentureCategoryLabel({
  id: 'label-ws-dlg',
  name: 'Hustle',
  slug: 'hustle',
})

const activeVenture = buildVenture({
  id: 'venture-ws-dlg',
  name: 'Dialog Fixture Venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

const archivedProjectSeed = buildProject({
  id: 'project-ws-dlg-archive',
  name: 'Archive Me Project',
  venture_id: activeVenture.id,
  colour: '#5B7C99',
})

const taskDiscardSeed = buildTask({
  id: 'task-ws-dlg-discard-title',
  project_id: archivedProjectSeed.id,
  title: 'Fixture Keep Title',
  status: 'backlog',
})

const taskSaveSeed = buildTask({
  id: 'task-ws-dlg-save-close',
  project_id: archivedProjectSeed.id,
  title: 'Fixture Save Close Before',
  status: 'backlog',
})

const taskArchiveSeed = buildTask({
  id: 'task-ws-dlg-archive',
  project_id: archivedProjectSeed.id,
  title: 'Fixture Archive Task',
  status: 'backlog',
})

/**
 * Workspace dialog controllers: project + task entry points, save/cancel,
 * archive triggers, and Venture category CreatableCombobox behaviour.
 */
describe('Workspace dialogs (integration)', () => {
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

  it('opens and closes New project dialog from sidebar +project entry point', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProjectSeed],
      tasks: [],
    })

    await renderApp()

    const sidebar = getSidebar()
    await user.click(within(sidebar).getByRole('link', { name: /^\+\s*project$/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /^new project$/i })).toBeVisible()
    })

    await dismissProjectDialogEscape(user)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^new project$/i })).not.toBeInTheDocument()
    })
  })

  it('opens and closes New task dialog from Projects toolbar (+ New task) via Cancel', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProjectSeed],
      tasks: [],
    })

    await renderApp()

    await user.click(screen.getByRole('button', { name: /\+\s*new task/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /^new task$/i })).toBeVisible()
    })

    const taskDialog = screen.getByRole('dialog', { name: /^new task$/i })

    await user.click(within(taskDialog).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^new task$/i })).not.toBeInTheDocument()
    })
  })

  it(
    [
      'discard dirty task edits via Cancel without PATCHing description',
      '(expects cancel to discard before blur-driven save)',
    ].join(' '),
    async () => {
    const user = userEvent.setup()

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProjectSeed],
      tasks: [taskDiscardSeed],
    })

    await renderApp()

    const column = getKanbanColumn(/backlog/i)
    await user.click(within(column).getByTestId('kanban-task-title'))

    const editDialog = await screen.findByRole('dialog', { name: /^edit task$/i })

    const descriptionInput = within(editDialog).getByRole('textbox', { name: /^description$/i })
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Fixture phantom description drift')

    await user.click(within(editDialog).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^edit task$/i })).not.toBeInTheDocument()
    })

    const bodiesBeforeReopen = parseBodiesForTaskPatch(fetchMock, taskDiscardSeed.id)
    expect(
      bodiesBeforeReopen.some(
        (body) =>
          (body as { description?: string | null }).description?.includes(
            'Fixture phantom description drift',
          ),
      ),
    ).toBe(false)

    await user.click(within(column).getByTestId('kanban-task-title'))
    const reopened = await screen.findByRole('dialog', { name: /^edit task$/i })

    const reopenedDescription = within(reopened).getByRole('textbox', { name: /^description$/i })
    expect(reopenedDescription).toHaveValue(taskDiscardSeed.description ?? '')
  })

  it('autosaves touched task edits when closing Edit task dialog from X', async () => {
    const user = userEvent.setup()

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProjectSeed],
      tasks: [taskSaveSeed],
    })

    await renderApp()

    const column = getKanbanColumn(/backlog/i)
    await user.click(within(column).getByTestId('kanban-task-title'))

    const editDialog = await screen.findByRole('dialog', { name: /^edit task$/i })
    const descriptionInput = within(editDialog).getByRole('textbox', { name: /^description$/i })
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Fixture saved on close description')

    await user.click(within(editDialog).getByRole('button', { name: /^close task$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^edit task$/i })).not.toBeInTheDocument()
    })

    const patches = parseBodiesForTaskPatch(fetchMock, taskSaveSeed.id)
    expect(
      patches.some((body) => {
        const desc = (body as { description?: string | null }).description
        return typeof desc === 'string' && desc.includes('Fixture saved on close description')
      }),
    ).toBe(true)

    await user.click(within(column).getByTestId('kanban-task-title'))
    await screen.findByRole('dialog', { name: /^edit task$/i })

    expect(
      within(screen.getByRole('dialog', { name: /^edit task$/i })).getByRole('textbox', {
        name: /^description$/i,
      }),
    ).toHaveValue('Fixture saved on close description')
  })

  it('discard touched project edits via Cancel without PATCHing description', async () => {
    const user = userEvent.setup()

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProjectSeed],
      tasks: [],
    })

    await renderApp()

    const sidebar = getSidebar()
    await user.click(within(sidebar).getByRole('button', { name: /archive me project/i }))

    const projectDialogFirst = screen.getByRole('dialog', { name: /^edit project$/i })
    const descriptionControl = within(projectDialogFirst).getByRole('textbox', {
      name: /^project description$/i,
    })
    await user.clear(descriptionControl)
    await user.type(descriptionControl, 'Phantom project description drift')

    await user.click(within(projectDialogFirst).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^edit project$/i })).not.toBeInTheDocument()
    })

    const patchesDuringFlow = parseBodiesForProjectPatch(fetchMock, archivedProjectSeed.id)
    expect(
      patchesDuringFlow.some(
        (body) => (body as { description?: string | null }).description === 'Phantom project description drift',
      ),
    ).toBe(false)

    await user.click(within(sidebar).getByRole('button', { name: /archive me project/i }))
    const projectDialogAgain = screen.getByRole('dialog', { name: /^edit project$/i })
    expect(within(projectDialogAgain).getByRole('textbox', { name: /^project description$/i })).toHaveValue(
      archivedProjectSeed.description ?? '',
    )
    await user.click(within(projectDialogAgain).getByRole('button', { name: /^cancel$/i }))
  })

  it('archives active project via Edit project dialog destructive action', async () => {
    const user = userEvent.setup()

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [
        archivedProjectSeed,
        buildProject({
          id: 'project-ws-dlg-extra',
          name: 'Other Project',
          venture_id: activeVenture.id,
        }),
      ],
      tasks: [],
    })

    await renderApp()

    const sidebar = getSidebar()
    await user.click(within(sidebar).getByRole('button', { name: /archive me project/i }))

    const projectDialog = await screen.findByRole('dialog', { name: /^edit project$/i })
    await user.click(within(projectDialog).getByRole('button', { name: /archive project/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^edit project$/i })).not.toBeInTheDocument()
    })

    await waitFor(() => {
      const deletes = fetchMock.mock.calls.filter(([input, init]) => {
        const method = ((init)?.method ?? 'GET').toUpperCase()
        if (method !== 'DELETE') {
          return false
        }
        const url = new URL(readFetchUrl(input), 'http://localhost')
        return url.pathname === `/api/v1/projects/${archivedProjectSeed.id}`
      })
      expect(deletes.length).toBeGreaterThan(0)
    })

    await waitFor(() => {
      expect(within(sidebar).queryByRole('button', { name: /archive me project/i })).not.toBeInTheDocument()
    })
  })

  it('archives task via Edit task dialog Archive control', async () => {
    const user = userEvent.setup()

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProjectSeed],
      tasks: [taskArchiveSeed],
    })

    await renderApp()

    const column = getKanbanColumn(/backlog/i)
    await user.click(within(column).getByTestId('kanban-task-title'))

    const editDialog = await screen.findByRole('dialog', { name: /^edit task$/i })
    await user.click(within(editDialog).getByRole('button', { name: /^archive$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^edit task$/i })).not.toBeInTheDocument()
    })

    await waitFor(() => {
      const patches = parseBodiesForTaskPatch(fetchMock, taskArchiveSeed.id)
      expect(patches.some((body) => (body as { status?: string }).status === 'archived')).toBe(true)
    })

    await waitFor(() => {
      expect(within(column).queryByTestId('kanban-task-title')).not.toBeInTheDocument()
    })
  })

  /**
   * Venture dialog: category create-or-select in a single Creatable combobox.
   * (accessible name stable for tests). Depends on VentureDialog refactor + backend label contract.
   */
  it('creates venture with a freshly created category via Venture category Creatable combobox', async () => {
    const user = userEvent.setup()

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [],
      projects: [],
      tasks: [],
    })

    await renderApp()
    await user.click(screen.getByRole('button', { name: /^\+\s*hustle$/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /^new venture$/i })).toBeVisible()
    })

    const ventureDialog = screen.getByRole('dialog', { name: /^new venture$/i })
    await user.type(within(ventureDialog).getByRole('textbox', { name: /^name$/i }), 'Momentum Side Venture')

    const categoryCombo = within(ventureDialog).getByRole('combobox', {
      name: /^venture category$/i,
    })
    await user.click(categoryCombo)
    await user.clear(categoryCombo)

    await user.type(categoryCombo, 'Momentum Sidecar')

    const createOpt = await screen.findByRole('option', {
      name: /create .*momentum sidecar/i,
    })
    await user.click(createOpt)

    await user.click(within(ventureDialog).getByRole('button', { name: /^create venture$/i }))

    await waitFor(() => {
      const labelPosts = fetchMock.mock.calls.filter(([input, init]) => {
        const method = ((init)?.method ?? 'GET').toUpperCase()
        const url = new URL(readFetchUrl(input), 'http://localhost')
        return (
          method === 'POST' && url.pathname === '/api/v1/venture-category-labels'
        )
      })

      expect(labelPosts.length).toBeGreaterThan(0)

      const createBodyRaw = (
        labelPosts[labelPosts.length - 1] as [unknown, RequestInit | undefined]
      )[1]?.body

      expect(typeof createBodyRaw).toBe('string')
      const createdName = JSON.parse(createBodyRaw as string) as { name?: string }
      expect(createdName.name?.toLowerCase()).toBe('momentum sidecar')
    })

    await waitFor(() => {
      const venturePosts = fetchMock.mock.calls.filter(([input, init]) => {
        const method = ((init)?.method ?? 'GET').toUpperCase()
        const url = new URL(readFetchUrl(input), 'http://localhost')
        return method === 'POST' && url.pathname === '/api/v1/ventures'
      })
      expect(venturePosts.length).toBeGreaterThan(0)

      const bodyRaw = (venturePosts[venturePosts.length - 1] as [unknown, RequestInit | undefined])[1]
        ?.body
      expect(typeof bodyRaw).toBe('string')
      const ventureBody = JSON.parse(bodyRaw as string) as {
        category_label_id?: string
        name?: string
      }

      expect(ventureBody.name).toBe('Momentum Side Venture')
      expect(typeof ventureBody.category_label_id).toBe('string')
      expect(/label-created-/u.test((ventureBody.category_label_id ?? '').trim())).toBe(true)
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^new venture$/i })).not.toBeInTheDocument()
    })
  })

  /** Guard: archiving from project board still drives WorkspaceDialogs-controlled archive mutation. */
  it('supports archive project intent from Projects kanban open handler', async () => {
    const user = userEvent.setup()

    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [
        archivedProjectSeed,
        buildProject({
          id: 'project-ws-dlg-other',
          name: 'Separate Row',
          venture_id: activeVenture.id,
        }),
      ],
      tasks: [],
    })

    await renderApp()
    await switchBoardViewTab('projects')

    const row = await waitForProjectKanbanCard('Archive Me Project', /active/i, {
      timeout: 5000,
    })

    await user.click(within(row).getByTestId('kanban-project-title'))

    const projectDialog = await screen.findByRole('dialog', { name: /^edit project$/i })
    await user.click(within(projectDialog).getByRole('button', { name: /archive project/i }))

    await waitFor(() => {
      const deletes = fetchMock.mock.calls.filter(([input, init]) => {
        const method = ((init)?.method ?? 'GET').toUpperCase()
        if (method !== 'DELETE') {
          return false
        }
        const url = new URL(readFetchUrl(input), 'http://localhost')
        return url.pathname === `/api/v1/projects/${archivedProjectSeed.id}`
      })
      expect(deletes.length).toBeGreaterThan(0)
    })
  })
})

