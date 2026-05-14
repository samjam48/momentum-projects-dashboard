import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import App from './App'
import type { Project, Task, TaskPayload, TimeLog, TimeLogPayload } from './api/types'
import { resetProjectFilterStore } from './stores/projectFilter'

type MockResponseOptions = {
  body?: unknown
  status?: number
}

type FetchMock = ReturnType<typeof vi.fn<Promise<Response>, Parameters<typeof fetch>>>

function jsonResponse({ body, status = 200 }: MockResponseOptions): Response {
  return new Response(JSON.stringify(body ?? null), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function installFetchMock(responses: Response[]): FetchMock {
  const fetchMock = vi.fn<Promise<Response>, Parameters<typeof fetch>>()
  fetchMock.mockResolvedValue(jsonResponse({ body: [] }))
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

type BackendHandlers = {
  onTaskCreate?: (
    payload: TaskPayload,
    count: number,
  ) => Response | Promise<Response> | null
  onTaskUpdate?: (
    taskId: string,
    payload: Partial<TaskPayload>,
  ) => Response | Promise<Response> | null
  onTimeLogCreate?: (
    taskId: string,
    payload: TimeLogPayload,
    count: number,
  ) => Response | Promise<Response> | null
}

type BackendOptions = BackendHandlers & {
  projects?: Project[]
  tasks?: Task[]
  timeLogs?: Record<string, TimeLog[]>
}

function buildProject(overrides: Partial<Project>): Project {
  return {
    id: overrides.id ?? 'project-default',
    name: overrides.name ?? 'Default Project',
    description: overrides.description ?? null,
    colour: overrides.colour ?? '#D97048',
    status: overrides.status ?? 'active',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

function buildTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? 'task-default',
    project_id: overrides.project_id ?? 'project-default',
    title: overrides.title ?? 'Default task',
    description: overrides.description ?? null,
    status: overrides.status ?? 'backlog',
    priority: overrides.priority ?? 'medium',
    target_date: overrides.target_date ?? null,
    estimated_hours: overrides.estimated_hours ?? null,
    actual_hours: overrides.actual_hours ?? 0,
    kanban_order: overrides.kanban_order ?? null,
    completed_date: overrides.completed_date ?? null,
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

function buildTimeLog(overrides: Partial<TimeLog>): TimeLog {
  return {
    id: overrides.id ?? 'log-default',
    task_id: overrides.task_id ?? 'task-default',
    project_id: overrides.project_id ?? 'project-default',
    hours: overrides.hours ?? 1,
    logged_date: overrides.logged_date ?? '2026-05-13',
    notes: overrides.notes ?? null,
    source: 'manual',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

function readPath(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

function parseJsonBody(init: RequestInit | undefined): Record<string, unknown> {
  if (!init?.body || typeof init.body !== 'string') {
    return {}
  }

  const parsedBody = JSON.parse(init.body) as unknown
  return typeof parsedBody === 'object' && parsedBody !== null
    ? (parsedBody as Record<string, unknown>)
    : {}
}

function installTaskWorkspaceBackendMock(options: BackendOptions): void {
  const projects = [...(options.projects ?? [])]
  const tasks = [...(options.tasks ?? [])]
  const timeLogsByTask = new Map<string, TimeLog[]>(
    Object.entries(options.timeLogs ?? {}).map(([taskId, timeLogs]) => [
      taskId,
      [...timeLogs],
    ]),
  )
  let taskCreateCount = 0
  let timeLogCreateCount = 0

  const actualHoursForTask = (taskId: string): number => {
    const timeLogs = timeLogsByTask.get(taskId) ?? []
    return timeLogs.reduce((sum, timeLog) => sum + timeLog.hours, 0)
  }

  const withDerivedHours = (task: Task): Task => ({
    ...task,
    actual_hours: actualHoursForTask(task.id),
  })

  const fetchMock = vi.fn<Promise<Response>, Parameters<typeof fetch>>(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(readPath(input), 'http://localhost')
      const method = init?.method ?? 'GET'
      const pathname = url.pathname
      const body = parseJsonBody(init)

      if (method === 'GET' && pathname === '/api/v1/projects') {
        const status = url.searchParams.get('status')
        const items =
          status === 'archived'
            ? projects.filter((project) => project.status === 'archived')
            : projects.filter((project) => project.status === 'active')

        return jsonResponse({ body: items })
      }

      if (method === 'GET' && pathname === '/api/v1/tasks') {
        const projectIdFilter = url.searchParams.get('project_id')
        const statusFilter = url.searchParams.get('status')
        const priorityFilter = url.searchParams.get('priority')

        const filteredTasks = tasks
          .filter((task) => projectIdFilter === null || task.project_id === projectIdFilter)
          .filter((task) => statusFilter === null || task.status === statusFilter)
          .filter((task) => priorityFilter === null || task.priority === priorityFilter)
          .map(withDerivedHours)

        return jsonResponse({ body: filteredTasks })
      }

      const taskTimeLogsMatch = pathname.match(/^\/api\/v1\/tasks\/([^/]+)\/time-logs$/)
      if (taskTimeLogsMatch) {
        const [, taskId] = taskTimeLogsMatch
        const task = tasks.find((candidate) => candidate.id === taskId)

        if (!task) {
          return jsonResponse({ body: { detail: 'Task not found' }, status: 404 })
        }

        if (method === 'GET') {
          const timeLogs = [...(timeLogsByTask.get(taskId) ?? [])].sort((left, right) => {
            if (left.logged_date !== right.logged_date) {
              return right.logged_date.localeCompare(left.logged_date)
            }

            return right.created_at.localeCompare(left.created_at)
          })

          return jsonResponse({ body: timeLogs })
        }

        if (method === 'POST') {
          timeLogCreateCount += 1
          const payload = body as TimeLogPayload
          const handlerResponse = options.onTimeLogCreate
            ? await options.onTimeLogCreate(taskId, payload, timeLogCreateCount)
            : null

          if (handlerResponse) {
            return handlerResponse
          }

          const existingTimeLogs = timeLogsByTask.get(taskId) ?? []
          const createdTimeLog = buildTimeLog({
            id: `log-${timeLogCreateCount}`,
            task_id: taskId,
            project_id: task.project_id,
            hours: payload.hours,
            logged_date: payload.logged_date,
            notes: payload.notes,
            created_at: `2026-05-13T08:00:0${timeLogCreateCount}Z`,
            updated_at: `2026-05-13T08:00:0${timeLogCreateCount}Z`,
          })

          timeLogsByTask.set(taskId, [...existingTimeLogs, createdTimeLog])
          return jsonResponse({ body: createdTimeLog, status: 201 })
        }
      }

      const taskMatch = pathname.match(/^\/api\/v1\/tasks\/([^/]+)$/)
      if (taskMatch) {
        const [, taskId] = taskMatch
        const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId)

        if (taskIndex < 0) {
          return jsonResponse({ body: { detail: 'Task not found' }, status: 404 })
        }

        if (method === 'GET') {
          return jsonResponse({ body: withDerivedHours(tasks[taskIndex]) })
        }

        if (method === 'PATCH') {
          const payload = body as Partial<TaskPayload>
          const handlerResponse = options.onTaskUpdate
            ? await options.onTaskUpdate(taskId, payload)
            : null

          if (handlerResponse) {
            return handlerResponse
          }

          const nextStatus = payload.status ?? tasks[taskIndex].status
          tasks[taskIndex] = {
            ...tasks[taskIndex],
            ...payload,
            status: nextStatus,
            completed_date:
              nextStatus === 'done'
                ? tasks[taskIndex].completed_date ?? '2026-05-24'
                : null,
            updated_at: '2026-05-13T09:15:00Z',
          }

          return jsonResponse({ body: withDerivedHours(tasks[taskIndex]) })
        }
      }

      if (method === 'POST' && pathname === '/api/v1/tasks') {
        taskCreateCount += 1
        const payload = body as TaskPayload
        const handlerResponse = options.onTaskCreate
          ? await options.onTaskCreate(payload, taskCreateCount)
          : null

        if (handlerResponse) {
          return handlerResponse
        }

        const project = projects.find((candidate) => candidate.id === payload.project_id)
        if (!project || project.status !== 'active') {
          return jsonResponse({ body: { detail: 'Project not found' }, status: 404 })
        }

        const createdTask = buildTask({
          id: `task-created-${taskCreateCount}`,
          project_id: payload.project_id,
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          target_date: payload.target_date,
          estimated_hours: payload.estimated_hours,
          completed_date: payload.status === 'done' ? '2026-05-24' : null,
          kanban_order: tasks.length,
          created_at: `2026-05-13T09:00:0${taskCreateCount}Z`,
          updated_at: `2026-05-13T09:00:0${taskCreateCount}Z`,
        })

        tasks.push(createdTask)
        return jsonResponse({ body: withDerivedHours(createdTask), status: 201 })
      }

      return jsonResponse({
        body: { detail: `Unhandled request: ${method} ${pathname}` },
        status: 500,
      })
    },
  )

  vi.stubGlobal('fetch', fetchMock)
}

function getSectionByHeading(name: RegExp): HTMLElement {
  const heading = screen.getByRole('heading', { name })
  const section = heading.closest('section')

  if (!(section instanceof HTMLElement)) {
    throw new Error(`Expected heading ${String(name)} to be inside a section.`)
  }

  return section
}

function expectTableTaskOrder(table: HTMLElement, titles: string[]): void {
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(titles.length)

  const actualOrder = rows.map((row) => {
    const text = row.textContent ?? ''
    const matchedTitle = titles.find((title) => text.includes(title))
    return matchedTitle ?? text
  })

  expect(actualOrder).toEqual(titles)
}

const taskWorkspaceProjects = [
  buildProject({ id: 'project-alpha', name: 'Alpha Client', colour: '#123ABC' }),
  buildProject({ id: 'project-beta', name: 'Beta Podcast', colour: '#D97048' }),
]

const taskWorkspaceTasks = [
  buildTask({
    id: 'task-record-intro',
    project_id: 'project-beta',
    title: 'Record intro',
    priority: 'high',
    target_date: null,
    status: 'backlog',
  }),
  buildTask({
    id: 'task-ship-landing-page',
    project_id: 'project-alpha',
    title: 'Ship landing page',
    priority: 'urgent',
    target_date: '2026-05-20',
    status: 'review',
  }),
  buildTask({
    id: 'task-write-release-notes',
    project_id: 'project-alpha',
    title: 'Write release notes',
    priority: 'low',
    target_date: '2026-05-18',
    status: 'done',
    completed_date: '2026-05-18',
  }),
  buildTask({
    id: 'task-inbox-triage',
    project_id: 'project-beta',
    title: 'Inbox triage',
    priority: 'medium',
    target_date: null,
    status: 'in_progress',
  }),
]

describe('Ticket 3 project management and shared data layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetProjectFilterStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetProjectFilterStore()
  })

  it('renders active projects, colour tags, and shared filter targets', async () => {
    installFetchMock([
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter',
            description: 'Weekly letters',
            colour: '#123ABC',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T09:00:00Z',
          },
        ],
      }),
    ])

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /projects \+ tasks workspace/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('project-card-project-podcast')).toBeInTheDocument()
    expect(screen.getByTestId('project-card-project-newsletter')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('project-card-project-podcast')).getByText('#D97048'),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /project filter/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /kanban board/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /task summary table/i }),
    ).toBeInTheDocument()
  })

  it('supports create, edit, and archive flows without a page reload', async () => {
    installFetchMock([
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
        ],
      }),
      jsonResponse({ body: [] }),
      jsonResponse({
        body: {
          id: 'project-newsletter',
          name: 'Newsletter',
          description: 'Weekly letters',
          colour: '#123ABC',
          status: 'active',
          created_at: '2026-05-13T09:00:00Z',
          updated_at: '2026-05-13T09:00:00Z',
        },
        status: 201,
      }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter',
            description: 'Weekly letters',
            colour: '#123ABC',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T09:00:00Z',
          },
        ],
      }),
      jsonResponse({
        body: {
          id: 'project-newsletter',
          name: 'Newsletter Updated',
          description: 'Weekly letters revised',
          colour: '#456DEF',
          status: 'active',
          created_at: '2026-05-13T09:00:00Z',
          updated_at: '2026-05-13T10:00:00Z',
        },
      }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter Updated',
            description: 'Weekly letters revised',
            colour: '#456DEF',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T10:00:00Z',
          },
        ],
      }),
      new Response(null, { status: 204 }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
        ],
      }),
    ])

    render(<App />)

    await screen.findByTestId('project-card-project-podcast')

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Newsletter' },
    })
    fireEvent.change(screen.getByLabelText(/project description/i), {
      target: { value: 'Weekly letters' },
    })
    fireEvent.change(screen.getByLabelText(/project colour/i), {
      target: { value: '#123ABC' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    expect(await screen.findByTestId('project-card-project-newsletter')).toBeInTheDocument()

    const newsletterCard = screen.getByTestId('project-card-project-newsletter')
    fireEvent.click(within(newsletterCard).getByRole('button', { name: /edit/i }))
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Newsletter Updated' },
    })
    fireEvent.change(screen.getByLabelText(/project description/i), {
      target: { value: 'Weekly letters revised' },
    })
    fireEvent.change(screen.getByLabelText(/project colour/i), {
      target: { value: '#456DEF' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      expect(screen.getByTestId('project-card-project-newsletter')).toHaveTextContent(
        'Newsletter Updated',
      )
    })

    const updatedCard = screen.getByTestId('project-card-project-newsletter')
    fireEvent.click(within(updatedCard).getByRole('button', { name: /archive/i }))

    await waitFor(() => {
      expect(screen.queryByTestId('project-card-project-newsletter')).not.toBeInTheDocument()
    })
  })

  it('shows inline validation errors and preserves form values after server rejection', async () => {
    installFetchMock([
      jsonResponse({ body: [] }),
      jsonResponse({
        body: { detail: 'colour must match #RRGGBB' },
        status: 422,
      }),
    ])

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Podcast' },
    })
    fireEvent.change(screen.getByLabelText(/project colour/i), {
      target: { value: 'orange' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    expect(await screen.findByText(/colour must match/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/project name/i)).toHaveValue('Podcast')
    expect(screen.getByLabelText(/project colour/i)).toHaveValue('orange')
  })

  it('falls back to all projects when the selected project is archived', async () => {
    installFetchMock([
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter',
            description: 'Weekly letters',
            colour: '#123ABC',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T09:00:00Z',
          },
        ],
      }),
      new Response(null, { status: 204 }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
        ],
      }),
    ])

    render(<App />)

    const filter = await screen.findByRole('combobox', { name: /project filter/i })
    fireEvent.change(filter, { target: { value: 'project-newsletter' } })
    expect(filter).toHaveValue('project-newsletter')

    const newsletterCard = screen.getByTestId('project-card-project-newsletter')
    fireEvent.click(within(newsletterCard).getByRole('button', { name: /archive/i }))

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /project filter/i })).toHaveValue('all')
    })
  })

  it('blocks task creation when there are no active projects', async () => {
    installFetchMock([jsonResponse({ body: [] })])

    render(<App />)

    expect(await screen.findByText(/create a project first/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new task/i })).toBeDisabled()
  })
})

describe('Ticket 4 task summary table, task modal, and manual time logs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetProjectFilterStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetProjectFilterStore()
  })

  it('renders a sortable summary table and applies the shared project filter to table rows and new-task defaults', async () => {
    installTaskWorkspaceBackendMock({
      projects: taskWorkspaceProjects,
      tasks: taskWorkspaceTasks,
    })

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    const tableSection = getSectionByHeading(/task summary table/i)
    const table = within(tableSection).getByRole('table')

    expectTableTaskOrder(table, [
      'Record intro',
      'Ship landing page',
      'Write release notes',
      'Inbox triage',
    ])

    fireEvent.click(within(tableSection).getByRole('button', { name: /target date/i }))

    await waitFor(() => {
      expectTableTaskOrder(table, [
        'Write release notes',
        'Ship landing page',
        'Record intro',
        'Inbox triage',
      ])
    })

    fireEvent.click(within(tableSection).getByRole('button', { name: /priority/i }))

    await waitFor(() => {
      expectTableTaskOrder(table, [
        'Write release notes',
        'Inbox triage',
        'Record intro',
        'Ship landing page',
      ])
    })

    fireEvent.click(within(tableSection).getByRole('button', { name: /project/i }))

    await waitFor(() => {
      expectTableTaskOrder(table, [
        'Ship landing page',
        'Write release notes',
        'Record intro',
        'Inbox triage',
      ])
    })

    fireEvent.change(screen.getByRole('combobox', { name: /project filter/i }), {
      target: { value: 'project-beta' },
    })

    await waitFor(() => {
      expect(within(table).getByText('Record intro')).toBeInTheDocument()
      expect(within(table).getByText('Inbox triage')).toBeInTheDocument()
      expect(within(table).queryByText('Ship landing page')).not.toBeInTheDocument()
      expect(within(table).queryByText('Write release notes')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /new task/i }))

    const dialog = await screen.findByRole('dialog', { name: /new task/i })
    expect(within(dialog).getByRole('combobox', { name: /^project$/i })).toHaveValue(
      'project-beta',
    )
  })

  it('keeps the summary table and kanban board populated when all projects is selected and there is exactly one active project', async () => {
    installTaskWorkspaceBackendMock({
      projects: [
        buildProject({
          id: 'project-solo',
          name: 'Solo Project',
          colour: '#3366FF',
        }),
      ],
      tasks: [
        buildTask({
          id: 'task-solo-launch',
          project_id: 'project-solo',
          title: 'Launch solo workspace',
          status: 'backlog',
        }),
      ],
    })

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    expect(screen.getByRole('combobox', { name: /project filter/i })).toHaveValue('all')

    const tableSection = getSectionByHeading(/task summary table/i)
    const kanbanSection = getSectionByHeading(/kanban board/i)

    await waitFor(() => {
      expect(within(tableSection).getByText('Launch solo workspace')).toBeInTheDocument()
      expect(within(kanbanSection).getByText('Launch solo workspace')).toBeInTheDocument()
    })
  })

  it('exposes create and edit task flows with all required fields and refreshes the summary table and kanban board after save', async () => {
    installTaskWorkspaceBackendMock({
      projects: taskWorkspaceProjects,
      tasks: taskWorkspaceTasks,
    })

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    fireEvent.click(screen.getByRole('button', { name: /new task/i }))

    const createDialog = await screen.findByRole('dialog', { name: /new task/i })
    fireEvent.change(within(createDialog).getByLabelText(/title/i), {
      target: { value: 'Publish sprint notes' },
    })
    fireEvent.change(within(createDialog).getByLabelText(/description/i), {
      target: { value: 'Summarise Ticket 4 progress' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /^project$/i }), {
      target: { value: 'project-alpha' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /status/i }), {
      target: { value: 'review' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /priority/i }), {
      target: { value: 'high' },
    })
    fireEvent.change(within(createDialog).getByLabelText(/target date/i), {
      target: { value: '2026-05-25' },
    })
    fireEvent.change(within(createDialog).getByLabelText(/estimated hours/i), {
      target: { value: '2.5' },
    })
    fireEvent.click(within(createDialog).getByRole('button', { name: /create task/i }))

    await waitFor(() => {
      expect(screen.getByText('Publish sprint notes')).toBeInTheDocument()
    })

    const kanbanSection = getSectionByHeading(/kanban board/i)
    expect(within(kanbanSection).getByText('Publish sprint notes')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /edit task publish sprint notes/i }),
    )

    const editDialog = await screen.findByRole('dialog', { name: /edit task/i })
    fireEvent.change(within(editDialog).getByRole('combobox', { name: /status/i }), {
      target: { value: 'done' },
    })
    fireEvent.change(within(editDialog).getByLabelText(/estimated hours/i), {
      target: { value: '3' },
    })
    fireEvent.click(within(editDialog).getByRole('button', { name: /save task/i }))

    await waitFor(() => {
      expect(within(kanbanSection).getByText('Publish sprint notes')).toBeInTheDocument()
      expect(screen.getByText('2026-05-24')).toBeInTheDocument()
    })
  })

  it('shows backend-derived actual hours and completed date, lists manual time logs, and refreshes hours after a new manual log', async () => {
    installTaskWorkspaceBackendMock({
      projects: taskWorkspaceProjects,
      tasks: taskWorkspaceTasks,
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-release-1',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            hours: 1.5,
            logged_date: '2026-05-13',
            notes: 'Drafted launch copy',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T09:00:00Z',
          }),
          buildTimeLog({
            id: 'log-release-2',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            hours: 0.5,
            logged_date: '2026-05-10',
            notes: 'Adjusted final wording',
            created_at: '2026-05-10T08:00:00Z',
            updated_at: '2026-05-10T08:00:00Z',
          }),
        ],
      },
    })

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    fireEvent.click(
      screen.getByRole('button', { name: /edit task write release notes/i }),
    )

    const dialog = await screen.findByRole('dialog', { name: /edit task/i })
    expect(within(dialog).getByText(/actual hours/i)).toBeInTheDocument()
    expect(within(dialog).getByText('2')).toBeInTheDocument()
    expect(within(dialog).getByText(/completed date/i)).toBeInTheDocument()
    expect(within(dialog).getByText('2026-05-18')).toBeInTheDocument()
    expect(within(dialog).getByText('Drafted launch copy')).toBeInTheDocument()
    expect(within(dialog).getByText('Adjusted final wording')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/logged date/i), {
      target: { value: '2026-05-14' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^hours$/i), {
      target: { value: '1.5' },
    })
    fireEvent.change(within(dialog).getByLabelText(/notes/i), {
      target: { value: 'Final review and polish' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /add time log/i }))

    await waitFor(() => {
      expect(within(dialog).getByText('3.5')).toBeInTheDocument()
      expect(within(dialog).getByText('Final review and polish')).toBeInTheDocument()
    })

    const tableSection = getSectionByHeading(/task summary table/i)
    const kanbanSection = getSectionByHeading(/kanban board/i)
    expect(within(tableSection).getByText('3.5')).toBeInTheDocument()
    expect(within(kanbanSection).getByText('3.5')).toBeInTheDocument()
  })

  it('does not show a status enum error when a done task only has a blank-title validation error', async () => {
    installTaskWorkspaceBackendMock({
      projects: taskWorkspaceProjects,
      tasks: taskWorkspaceTasks,
    })

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    fireEvent.click(screen.getByRole('button', { name: /new task/i }))

    const createDialog = await screen.findByRole('dialog', { name: /new task/i })
    fireEvent.change(within(createDialog).getByLabelText(/title/i), {
      target: { value: '   ' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /^project$/i }), {
      target: { value: 'project-alpha' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /status/i }), {
      target: { value: 'done' },
    })
    fireEvent.click(within(createDialog).getByRole('button', { name: /create task/i }))

    expect(await within(createDialog).findByText(/title must not be blank/i)).toBeInTheDocument()
    expect(
      within(createDialog).queryByText(
        /input should be 'backlog', 'in_progress', 'review' or 'done'/i,
      ),
    ).not.toBeInTheDocument()
  })

  it('does not show a status enum error when a done task only has an estimated-hours validation error', async () => {
    installTaskWorkspaceBackendMock({
      projects: taskWorkspaceProjects,
      tasks: taskWorkspaceTasks,
    })

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    fireEvent.click(screen.getByRole('button', { name: /new task/i }))

    const createDialog = await screen.findByRole('dialog', { name: /new task/i })
    fireEvent.change(within(createDialog).getByLabelText(/title/i), {
      target: { value: 'Fix completed task validation' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /^project$/i }), {
      target: { value: 'project-alpha' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /status/i }), {
      target: { value: 'done' },
    })
    fireEvent.change(within(createDialog).getByLabelText(/estimated hours/i), {
      target: { value: '-1' },
    })
    fireEvent.click(within(createDialog).getByRole('button', { name: /create task/i }))

    expect(
      within(createDialog).getByText(/estimated_hours must be non-negative/i),
    ).toBeInTheDocument()
    expect(
      within(createDialog).queryByText(
        /input should be 'backlog', 'in_progress', 'review' or 'done'/i,
      ),
    ).not.toBeInTheDocument()
  })

  it('keeps task-form and time-log validation errors visible until the invalid fields are corrected', async () => {
    installTaskWorkspaceBackendMock({
      projects: taskWorkspaceProjects,
      tasks: taskWorkspaceTasks,
      onTimeLogCreate: (_taskId, _payload, count) =>
        count === 1
          ? jsonResponse({
              body: {
                detail: [{ loc: ['body', 'hours'], msg: 'hours must be greater than zero' }],
              },
              status: 422,
            })
          : null,
    })

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    fireEvent.click(screen.getByRole('button', { name: /new task/i }))

    const createDialog = await screen.findByRole('dialog', { name: /new task/i })
    fireEvent.change(within(createDialog).getByLabelText(/title/i), {
      target: { value: '   ' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /^project$/i }), {
      target: { value: 'project-alpha' },
    })
    fireEvent.change(within(createDialog).getByRole('combobox', { name: /status/i }), {
      target: { value: 'done' },
    })
    fireEvent.change(within(createDialog).getByLabelText(/estimated hours/i), {
      target: { value: '-1' },
    })
    fireEvent.click(within(createDialog).getByRole('button', { name: /create task/i }))

    expect(await within(createDialog).findByText(/title must not be blank/i)).toBeInTheDocument()
    expect(
      within(createDialog).getByText(/estimated_hours must be non-negative/i),
    ).toBeInTheDocument()

    fireEvent.change(within(createDialog).getByLabelText(/estimated hours/i), {
      target: { value: '2' },
    })
    expect(
      within(createDialog).queryByText(/estimated_hours must be non-negative/i),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /edit task write release notes/i }),
    )

    const detailDialog = await screen.findByRole('dialog', { name: /edit task/i })
    fireEvent.change(within(detailDialog).getByLabelText(/logged date/i), {
      target: { value: '2026-05-14' },
    })
    fireEvent.change(within(detailDialog).getByLabelText(/^hours$/i), {
      target: { value: '0' },
    })
    fireEvent.click(within(detailDialog).getByRole('button', { name: /add time log/i }))

    expect(
      await within(detailDialog).findByText(/hours must be greater than zero/i),
    ).toBeInTheDocument()

    fireEvent.change(within(detailDialog).getByLabelText(/^hours$/i), {
      target: { value: '1.25' },
    })
    expect(
      within(detailDialog).queryByText(/hours must be greater than zero/i),
    ).not.toBeInTheDocument()
  })
})
