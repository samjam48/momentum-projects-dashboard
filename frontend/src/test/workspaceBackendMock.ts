import type {
  ActivityType,
  Project,
  Task,
  TaskPayload,
  TaskStatus,
  TaskStatusPayload,
  TimeLog,
  TimeLogPayload,
  Venture,
  VentureCategoryLabel,
} from '../api/types'

import {
  buildActivityType,
  buildProject,
  buildTask,
  buildTimeLog,
  buildVenture,
  buildVentureCategoryLabel,
  MOCK_DEFAULT_VENTURE_ID,
} from './fixtures'

type MockResponseOptions = {
  body?: unknown
  status?: number
}

export type WorkspaceBackendOptions = {
  activityTypes?: ActivityType[]
  projects?: Project[]
  tasks?: Task[]
  timeLogs?: Record<string, TimeLog[]>
  onProjectCreate?: (
    payload: {
      name: string
      description: string | null
      colour: string | null
      venture_id?: string
      icon?: string | null
      project_type?: string
      board_status?: string
      finished?: boolean
    },
    count: number,
  ) => Response | Promise<Response> | null
  onProjectUpdate?: (
    projectId: string,
    payload: Record<string, unknown>,
  ) => Response | Promise<Response> | null
  onProjectArchive?: (projectId: string) => Response | Promise<Response> | null
  onTaskCreate?: (payload: TaskPayload, count: number) => Response | Promise<Response> | null
  onTaskStatusUpdate?: (
    taskId: string,
    payload: TaskStatusPayload,
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
  onProjectBoardStatus?: (
    projectId: string,
    payload: Record<string, unknown>,
    count: number,
  ) => Response | Promise<Response> | null
  ventures?: Venture[]
  ventureCategoryLabels?: VentureCategoryLabel[]
}

export type ProjectBoardStatusRequestRecord = {
  payload: Record<string, unknown>
  projectId: string
}

function defaultActivityTypes(): ActivityType[] {
  return [
    buildActivityType({
      id: 'at-seed-planning',
      name: 'planning',
      slug: 'planning',
      sort_order: 0,
    }),
    buildActivityType({
      id: 'at-seed-meeting',
      name: 'meeting',
      slug: 'meeting',
      sort_order: 1,
    }),
    buildActivityType({
      id: 'at-seed-admin',
      name: 'admin',
      slug: 'admin',
      sort_order: 2,
    }),
  ]
}

function defaultVentureCategoryLabels(): VentureCategoryLabel[] {
  const seeds = [
    ['Hustle', 'hustle'],
    ['Business', 'business'],
    ['Investment', 'investment'],
    ['Property', 'property'],
    ['Education', 'education'],
    ['Hobby', 'hobby'],
  ] as const

  return seeds.map(([name, slug], index) =>
    buildVentureCategoryLabel({
      id: `label-seed-${index + 1}`,
      name,
      slug,
    }),
  )
}

function jsonResponse({ body, status = 200 }: MockResponseOptions): Response {
  return new Response(JSON.stringify(body ?? null), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
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

function compareTasksForKanban(left: Task, right: Task): number {
  if (left.kanban_order !== null && right.kanban_order !== null) {
    if (left.kanban_order !== right.kanban_order) {
      return left.kanban_order - right.kanban_order
    }
  } else if (left.kanban_order !== null) {
    return -1
  } else if (right.kanban_order !== null) {
    return 1
  }

  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at)
  }

  return left.id.localeCompare(right.id)
}

function reorderTasksInColumn(
  tasks: Task[],
  taskId: string,
  nextStatus: TaskStatus,
  nextKanbanOrder: number | null,
): Task[] {
  const movedTask = tasks.find((task) => task.id === taskId)
  if (!movedTask) {
    return tasks
  }

  const sourceStatus = movedTask.status
  const sourceColumn = tasks
    .filter((task) => task.status === sourceStatus && task.id !== taskId)
    .sort(compareTasksForKanban)
  const targetColumn = tasks
    .filter((task) => task.status === nextStatus && task.id !== taskId)
    .sort(compareTasksForKanban)

  const insertionIndex =
    nextKanbanOrder === null
      ? targetColumn.length
      : Math.max(0, Math.min(nextKanbanOrder, targetColumn.length))

  targetColumn.splice(insertionIndex, 0, {
    ...movedTask,
    status: nextStatus,
    kanban_order: nextKanbanOrder,
    completed_date:
      nextStatus === 'done' ? movedTask.completed_date ?? '2026-05-26' : null,
    updated_at: '2026-05-13T09:30:00Z',
  })

  const rebalanceColumn = (columnTasks: Task[]): Map<string, number> =>
    new Map(columnTasks.map((task, index) => [task.id, index]))

  const sourceOrders = rebalanceColumn(sourceColumn)
  const targetOrders = rebalanceColumn(targetColumn)

  return tasks.map((task) => {
    if (targetOrders.has(task.id)) {
      return {
        ...(targetColumn.find((candidate) => candidate.id === task.id) ?? task),
        kanban_order: targetOrders.get(task.id) ?? null,
      }
    }

    if (sourceOrders.has(task.id)) {
      return {
        ...task,
        kanban_order: sourceOrders.get(task.id) ?? null,
      }
    }

    return task
  })
}

export type TaskStatusRequest = {
  payload: TaskStatusPayload
  taskId: string
}

export function installWorkspaceBackendMock(
  options: WorkspaceBackendOptions,
): {
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
  projectBoardStatusRequests: ProjectBoardStatusRequestRecord[]
  taskStatusRequests: TaskStatusRequest[]
} {
  const projects = [...(options.projects ?? [])]
  const activityTypes = [...(options.activityTypes ?? defaultActivityTypes())]
  const ventureLabels = [...(options.ventureCategoryLabels ?? defaultVentureCategoryLabels())]
  const ventures = [
    ...(options.ventures ?? [
      buildVenture({
        category_label: ventureLabels[0],
        category_label_id: ventureLabels[0]?.id ?? 'label-seed-1',
      }),
    ]),
  ]
  const tasks = [...(options.tasks ?? [])]
  const timeLogsByTask = new Map<string, TimeLog[]>(
    Object.entries(options.timeLogs ?? {}).map(([taskId, timeLogs]) => [
      taskId,
      [...timeLogs],
    ]),
  )
  let projectCreateCount = 0
  let taskCreateCount = 0
  let taskStatusUpdateCount = 0
  let timeLogCreateCount = 0
  const taskStatusRequests: TaskStatusRequest[] = []
  let projectBoardStatusUpdateCount = 0
  const projectBoardStatusRequests: ProjectBoardStatusRequestRecord[] = []

  const actualHoursForTask = (taskId: string): number => {
    const timeLogs = timeLogsByTask.get(taskId) ?? []
    return timeLogs.reduce((sum, timeLog) => sum + timeLog.hours, 0)
  }

  const withDerivedHours = (task: Task): Task => ({
    ...task,
    actual_hours:
      task.actual_hours !== null && task.actual_hours > 0
        ? task.actual_hours
        : actualHoursForTask(task.id),
  })

  const displayNameForActivityType = (name: string): string =>
    name
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

  const resolveActivityFieldsForTimeLog = (
    activityTypeId: string | null | undefined,
  ): Pick<TimeLog, 'activity_type_id' | 'activity_type_name' | 'activity_type_display_name'> => {
    if (!activityTypeId) {
      return {
        activity_type_id: null,
        activity_type_name: null,
        activity_type_display_name: 'uncategorised',
      }
    }

    const match = activityTypes.find(
      (type) => type.id === activityTypeId && type.status === 'active',
    )

    if (!match) {
      return {
        activity_type_id: null,
        activity_type_name: null,
        activity_type_display_name: 'uncategorised',
      }
    }

    return {
      activity_type_id: match.id,
      activity_type_name: match.name,
      activity_type_display_name: displayNameForActivityType(match.name),
    }
  }

  const scrubArchivedActivityFromTimeLogs = (archivedActivityTypeId: string): void => {
    for (const taskId of [...timeLogsByTask.keys()]) {
      const logs = timeLogsByTask.get(taskId) ?? []
      timeLogsByTask.set(
        taskId,
        logs.map((timeLog) =>
          timeLog.activity_type_id !== archivedActivityTypeId
            ? timeLog
            : {
                ...timeLog,
                activity_type_id: null,
                activity_type_name: null,
                activity_type_display_name: 'uncategorised',
              },
        ),
      )
    }
  }

  const fetchMock = vi.fn<typeof fetch>(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(readPath(input), 'http://localhost')
      const method = init?.method ?? 'GET'
      const pathname = url.pathname
      const body = parseJsonBody(init)

      if (method === 'GET' && pathname === '/api/v1/venture-category-labels') {
        return jsonResponse({ body: ventureLabels })
      }

      if (method === 'POST' && pathname === '/api/v1/venture-category-labels') {
        const payload = body as { name?: string }
        const trimmedName =
          typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : ''
        if (!trimmedName) {
          return jsonResponse({
            body: { detail: [{ loc: ['body', 'name'], msg: 'Name is required' }] },
            status: 422,
          })
        }

        const duplicate = ventureLabels.some(
          (label) => label.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        )
        if (duplicate) {
          return jsonResponse({
            body: {
              detail: [{ loc: ['body', 'name'], msg: 'A label with this name already exists' }],
            },
            status: 422,
          })
        }

        const slug = trimmedName.toLowerCase().replace(/\s+/g, '-')
        const createdLabel = buildVentureCategoryLabel({
          id: `label-created-${ventureLabels.length + 1}`,
          name: trimmedName,
          slug,
        })
        ventureLabels.push(createdLabel)
        return jsonResponse({ body: createdLabel, status: 201 })
      }

      if (method === 'GET' && pathname === '/api/v1/activity-types') {
        const statusParam = url.searchParams.get('status') ?? 'active'
        const filtered = activityTypes.filter((type) => type.status === statusParam)
        const items = [...filtered].sort((left, right) => {
          const leftOrder = left.sort_order ?? 999
          const rightOrder = right.sort_order ?? 999

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }

          return left.slug.localeCompare(right.slug)
        })
        return jsonResponse({ body: items })
      }

      if (method === 'POST' && pathname === '/api/v1/activity-types') {
        const payload = body as { name?: string }
        const trimmedName = typeof payload.name === 'string' ? payload.name.trim() : ''

        if (!trimmedName) {
          return jsonResponse({
            body: { detail: [{ loc: ['body', 'name'], msg: 'Name is required' }] },
            status: 422,
          })
        }

        if (trimmedName.length > 25) {
          return jsonResponse({
            body: {
              detail: [
                {
                  loc: ['body', 'name'],
                  msg: 'Activity type name must be at most 25 characters',
                },
              ],
            },
            status: 422,
          })
        }

        if (trimmedName.toLowerCase() === 'uncategorised') {
          return jsonResponse({
            body: {
              detail: [
                {
                  loc: ['body', 'name'],
                  msg: 'Reserved name "uncategorised" cannot be used for an activity type',
                },
              ],
            },
            status: 422,
          })
        }

        const duplicate = activityTypes.some(
          (type) => type.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        )
        if (duplicate) {
          return jsonResponse({
            body: {
              detail: [
                {
                  loc: ['body', 'name'],
                  msg: 'An activity type with this name already exists',
                },
              ],
            },
            status: 422,
          })
        }

        const activeCount = activityTypes.filter((type) => type.status === 'active').length
        const createdType = buildActivityType({
          id: `at-created-${activityTypes.length + 1}`,
          name: trimmedName,
          slug: trimmedName.toLowerCase().replace(/\s+/g, '-'),
          status: 'active',
          sort_order: activeCount,
        })
        activityTypes.push(createdType)
        return jsonResponse({ body: createdType, status: 201 })
      }

      const activityTypeArchiveMatch = pathname.match(
        /^\/api\/v1\/activity-types\/([^/]+)\/archive$/,
      )
      if (activityTypeArchiveMatch && method === 'PATCH') {
        const [, activityTypeId] = activityTypeArchiveMatch
        const typeIndex = activityTypes.findIndex((type) => type.id === activityTypeId)

        if (typeIndex < 0) {
          return jsonResponse({ body: { detail: 'Activity type not found' }, status: 404 })
        }

        activityTypes[typeIndex] = {
          ...activityTypes[typeIndex],
          status: 'archived',
          updated_at: '2026-05-13T12:00:00Z',
        }
        scrubArchivedActivityFromTimeLogs(activityTypeId)

        return new Response(null, { status: 204 })
      }

      const activityTypeMatch = pathname.match(/^\/api\/v1\/activity-types\/([^/]+)$/)
      if (activityTypeMatch && method === 'DELETE') {
        const [, activityTypeId] = activityTypeMatch
        const typeIndex = activityTypes.findIndex((type) => type.id === activityTypeId)

        if (typeIndex < 0) {
          return jsonResponse({ body: { detail: 'Activity type not found' }, status: 404 })
        }

        const referenced = [...timeLogsByTask.values()].some((logs) =>
          logs.some((timeLog) => timeLog.activity_type_id === activityTypeId),
        )

        if (referenced) {
          return jsonResponse({
            body: {
              detail: 'This activity type is referenced by time logs and cannot be deleted.',
            },
            status: 422,
          })
        }

        activityTypes.splice(typeIndex, 1)
        return new Response(null, { status: 204 })
      }

      if (method === 'GET' && pathname === '/api/v1/ventures') {
        const statusParam = url.searchParams.get('status') ?? 'active'
        const items = [
          ...new Map(
            ventures
              .filter((venture) => venture.status === statusParam)
              .map((venture) => [venture.id, venture]),
          ).values(),
        ]
        return jsonResponse({ body: items })
      }

      if (method === 'POST' && pathname === '/api/v1/ventures') {
        const payload = body as {
          category_label_id?: string
          colour?: string | null
          description?: string | null
          icon?: string | null
          name?: string
        }

        const name =
          typeof payload.name === 'string' ? payload.name.trim().slice(0, 200) : ''

        if (!name) {
          return jsonResponse({
            body: { detail: [{ loc: ['body', 'name'], msg: 'Name is required' }] },
            status: 422,
          })
        }

        let categoryLabelId = payload.category_label_id ?? ventureLabels[0]?.id
        let categoryLabel = ventureLabels.find((label) => label.id === categoryLabelId)

        if (!categoryLabel) {
          categoryLabel = ventureLabels[0]
          categoryLabelId = categoryLabel?.id
        }

        const createdVenture = buildVenture({
          id: `venture-created-${ventures.length + 1}`,
          name,
          description:
            typeof payload.description === 'string' ? payload.description.trim() || null : null,
          colour: typeof payload.colour === 'string' ? payload.colour : '#D97048',
          icon: typeof payload.icon === 'string' ? payload.icon.trim() || null : null,
          category_label_id: categoryLabelId ?? 'label-seed-1',
          category_label: categoryLabel ?? null,
          status: 'active',
        })
        ventures.push(createdVenture)
        return jsonResponse({ body: createdVenture, status: 201 })
      }

      const ventureArchiveMatch = pathname.match(/^\/api\/v1\/ventures\/([^/]+)\/unarchive$/)
      if (ventureArchiveMatch && method === 'PATCH') {
        const [, ventureId] = ventureArchiveMatch
        const ventureIndex = ventures.findIndex((candidate) => candidate.id === ventureId)

        if (ventureIndex < 0) {
          return jsonResponse({ body: { detail: 'Venture not found' }, status: 404 })
        }

        ventures[ventureIndex] = {
          ...ventures[ventureIndex],
          status: 'active',
          updated_at: '2026-05-13T11:00:00Z',
        }

        for (let index = 0; index < projects.length; index += 1) {
          const candidate = projects[index]
          if (candidate.venture_id !== ventureId || !candidate.archived_by_venture) {
            continue
          }

          projects[index] = {
            ...candidate,
            archived_by_venture: false,
            status: 'active',
            updated_at: '2026-05-13T11:00:00Z',
          }
        }

        return jsonResponse({ body: ventures[ventureIndex] })
      }

      const ventureIdMatch = pathname.match(/^\/api\/v1\/ventures\/([^/]+)$/)
      if (ventureIdMatch && method === 'GET') {
        const [, ventureId] = ventureIdMatch
        const venture = ventures.find((candidate) => candidate.id === ventureId)

        if (!venture) {
          return jsonResponse({ body: { detail: 'Venture not found' }, status: 404 })
        }

        return jsonResponse({ body: venture })
      }

      if (ventureIdMatch && method === 'PATCH') {
        const [, ventureId] = ventureIdMatch
        const ventureIndex = ventures.findIndex((candidate) => candidate.id === ventureId)

        if (ventureIndex < 0) {
          return jsonResponse({ body: { detail: 'Venture not found' }, status: 404 })
        }

        const currentVenture = ventures[ventureIndex]
        if (currentVenture.status === 'archived') {
          return jsonResponse({
            body: { detail: 'Archived ventures cannot be updated.' },
            status: 409,
          })
        }

        const payload = body as {
          category_label_id?: string
          colour?: string | null
          description?: string | null
          icon?: string | null
          name?: string
        }

        const nextName =
          typeof payload.name === 'string'
            ? payload.name.trim().slice(0, 200)
            : currentVenture.name

        if (!nextName) {
          return jsonResponse({
            body: { detail: [{ loc: ['body', 'name'], msg: 'Name is required' }] },
            status: 422,
          })
        }

        let nextCategoryLabelId = currentVenture.category_label_id
        let nextCategoryLabel = currentVenture.category_label

        if (typeof payload.category_label_id === 'string') {
          const matchedLabel = ventureLabels.find(
            (label) => label.id === payload.category_label_id,
          )
          if (matchedLabel) {
            nextCategoryLabelId = matchedLabel.id
            nextCategoryLabel = matchedLabel
          }
        }

        ventures[ventureIndex] = {
          ...currentVenture,
          name: nextName,
          description:
            typeof payload.description === 'string'
              ? payload.description.trim() || null
              : currentVenture.description,
          colour:
            typeof payload.colour === 'string'
              ? payload.colour
              : currentVenture.colour,
          icon:
            typeof payload.icon === 'string'
              ? payload.icon.trim() || null
              : currentVenture.icon,
          category_label_id: nextCategoryLabelId,
          category_label: nextCategoryLabel,
          updated_at: '2026-05-13T10:45:00Z',
        }

        return jsonResponse({ body: ventures[ventureIndex] })
      }

      if (ventureIdMatch && method === 'DELETE') {
        const [, ventureId] = ventureIdMatch
        const ventureIndex = ventures.findIndex((candidate) => candidate.id === ventureId)

        if (ventureIndex < 0) {
          return jsonResponse({ body: { detail: 'Venture not found' }, status: 404 })
        }

        ventures[ventureIndex] = {
          ...ventures[ventureIndex],
          status: 'archived',
          updated_at: '2026-05-13T10:30:00Z',
        }

        for (let index = 0; index < projects.length; index += 1) {
          const candidate = projects[index]
          if (candidate.venture_id !== ventureId || candidate.status !== 'active') {
            continue
          }

          projects[index] = {
            ...candidate,
            status: 'archived',
            archived_by_venture: true,
            updated_at: '2026-05-13T10:30:00Z',
          }
        }

        return new Response(null, { status: 204 })
      }

      if (method === 'GET' && pathname === '/api/v1/projects') {
        const statusParam = url.searchParams.get('status')
        let items =
          statusParam === 'archived'
            ? projects.filter((project) => project.status === 'archived')
            : projects.filter((project) => project.status === 'active')

        const ventureIdFilter = url.searchParams.get('venture_id')
        if (ventureIdFilter) {
          items = items.filter((project) => project.venture_id === ventureIdFilter)
        }

        const projectTypeFilter = url.searchParams.get('project_type')
        if (
          projectTypeFilter === 'project' ||
          projectTypeFilter === 'asset' ||
          projectTypeFilter === 'gig' ||
          projectTypeFilter === 'contract'
        ) {
          items = items.filter((project) => project.project_type === projectTypeFilter)
        }

        return jsonResponse({ body: items })
      }

      const projectBoardStatusMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/board-status$/)
      if (projectBoardStatusMatch && method === 'PATCH') {
        const [, projectId] = projectBoardStatusMatch
        const projectIndex = projects.findIndex((candidate) => candidate.id === projectId)

        if (projectIndex < 0) {
          return jsonResponse({ body: { detail: 'Project not found' }, status: 404 })
        }

        projectBoardStatusUpdateCount += 1
        projectBoardStatusRequests.push({ projectId, payload: body })

        const handlerResponse = options.onProjectBoardStatus
          ? await options.onProjectBoardStatus(projectId, body, projectBoardStatusUpdateCount)
          : null

        if (handlerResponse) {
          return handlerResponse
        }

        const current = projects[projectIndex]
        const nextBoardRaw = body.board_status
        const nextBoardStatus =
          nextBoardRaw === 'idea' ||
          nextBoardRaw === 'active' ||
          nextBoardRaw === 'paused' ||
          nextBoardRaw === 'shipped'
            ? nextBoardRaw
            : current.board_status

        const nextKanbanOrder =
          typeof body.kanban_order === 'number' ? body.kanban_order : current.kanban_order

        let nextFinished =
          typeof body.finished === 'boolean' ? body.finished : current.finished

        if (typeof body.finished !== 'boolean' && nextBoardStatus === 'shipped') {
          nextFinished = true
        }

        projects[projectIndex] = {
          ...current,
          board_status: nextBoardStatus,
          kanban_order: nextKanbanOrder,
          finished: nextFinished,
          updated_at: '2026-05-13T14:05:00Z',
        }

        return jsonResponse({ body: projects[projectIndex] })
      }

      if (method === 'POST' && pathname === '/api/v1/projects') {
        projectCreateCount += 1
        const payload = body as {
          colour: string | null
          board_status?: string
          description: string | null
          finished?: boolean
          icon?: string | null
          name: string
          project_type?: string
          venture_id?: string
        }
        const handlerResponse = options.onProjectCreate
          ? await options.onProjectCreate(payload, projectCreateCount)
          : null

        if (handlerResponse) {
          return handlerResponse
        }

        const ventureId =
          typeof payload.venture_id === 'string' && payload.venture_id.length > 0
            ? payload.venture_id
            : MOCK_DEFAULT_VENTURE_ID

        const createdProject = buildProject({
          id: `project-created-${projectCreateCount}`,
          name: payload.name,
          description: payload.description,
          colour: payload.colour,
          venture_id: ventureId,
          icon: typeof payload.icon === 'string' ? payload.icon : null,
          project_type:
            payload.project_type === 'asset' ||
            payload.project_type === 'gig' ||
            payload.project_type === 'contract'
              ? payload.project_type
              : 'project',
          board_status:
            payload.board_status === 'idea' ||
            payload.board_status === 'active' ||
            payload.board_status === 'paused' ||
            payload.board_status === 'shipped'
              ? payload.board_status
              : 'active',
          finished: typeof payload.finished === 'boolean' ? payload.finished : false,
          created_at: `2026-05-13T09:00:0${projectCreateCount}Z`,
          updated_at: `2026-05-13T09:00:0${projectCreateCount}Z`,
        })
        projects.push(createdProject)
        return jsonResponse({ body: createdProject, status: 201 })
      }

      const projectUnarchiveMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/unarchive$/)
      if (projectUnarchiveMatch && method === 'PATCH') {
        const [, projectId] = projectUnarchiveMatch
        const projectIndex = projects.findIndex((candidate) => candidate.id === projectId)

        if (projectIndex < 0) {
          return jsonResponse({ body: { detail: 'Project not found' }, status: 404 })
        }

        const candidate = projects[projectIndex]
        const parentVenture = ventures.find((venture) => venture.id === candidate.venture_id)

        if (parentVenture?.status === 'archived') {
          return jsonResponse({
            body: {
              detail: 'Unarchive the venture first to restore this project.',
            },
            status: 409,
          })
        }

        projects[projectIndex] = {
          ...candidate,
          status: 'active',
          archived_by_venture: false,
          updated_at: '2026-05-13T11:30:00Z',
        }

        return jsonResponse({ body: projects[projectIndex] })
      }

      const projectMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)$/)
      if (projectMatch) {
        const [, projectId] = projectMatch
        const projectIndex = projects.findIndex((candidate) => candidate.id === projectId)

        if (projectIndex < 0) {
          return jsonResponse({ body: { detail: 'Project not found' }, status: 404 })
        }

        if (method === 'PATCH') {
          const payload = body
          const handlerResponse = options.onProjectUpdate
            ? await options.onProjectUpdate(projectId, payload)
            : null

          if (handlerResponse) {
            return handlerResponse
          }

          const current = projects[projectIndex]
          const nextVentureId =
            typeof payload.venture_id === 'string' ? payload.venture_id : current.venture_id
          const nextName = typeof payload.name === 'string' ? payload.name : current.name
          const nextDescription =
            payload.description === null || typeof payload.description === 'string'
              ? payload.description
              : current.description
          const nextColour =
            payload.colour === null || typeof payload.colour === 'string'
              ? payload.colour
              : current.colour
          const nextIcon =
            payload.icon === null || typeof payload.icon === 'string' ? payload.icon : current.icon
          const nextProjectType =
            payload.project_type === 'asset' ||
            payload.project_type === 'gig' ||
            payload.project_type === 'contract' ||
            payload.project_type === 'project'
              ? payload.project_type
              : current.project_type
          const nextBoardStatus =
            payload.board_status === 'idea' ||
            payload.board_status === 'active' ||
            payload.board_status === 'paused' ||
            payload.board_status === 'shipped'
              ? payload.board_status
              : current.board_status
          const nextFinished =
            typeof payload.finished === 'boolean' ? payload.finished : current.finished

          projects[projectIndex] = {
            ...current,
            venture_id: nextVentureId,
            name: nextName,
            description: nextDescription,
            colour: nextColour,
            icon: nextIcon,
            project_type: nextProjectType,
            board_status: nextBoardStatus,
            finished: nextFinished,
            updated_at: '2026-05-13T10:00:00Z',
          }
          return jsonResponse({ body: projects[projectIndex] })
        }

        if (method === 'DELETE') {
          const handlerResponse = options.onProjectArchive
            ? await options.onProjectArchive(projectId)
            : null

          if (handlerResponse) {
            return handlerResponse
          }

          projects[projectIndex] = {
            ...projects[projectIndex],
            status: 'archived',
            updated_at: '2026-05-13T10:30:00Z',
          }
          return new Response(null, { status: 204 })
        }
      }

      if (method === 'GET' && pathname === '/api/v1/tasks') {
        const projectIdFilter = url.searchParams.get('project_id')
        const statusFilter = url.searchParams.get('status')
        const priorityFilter = url.searchParams.get('priority')

        const filteredTasks = tasks
          .filter((task) => projectIdFilter === null || task.project_id === projectIdFilter)
          .filter((task) => {
            if (statusFilter !== null) {
              return task.status === statusFilter
            }

            return task.status !== 'archived'
          })
          .filter((task) => priorityFilter === null || task.priority === priorityFilter)
          .map(withDerivedHours)

        return jsonResponse({ body: filteredTasks })
      }

      const taskTimeLogEntryMatch = pathname.match(
        /^\/api\/v1\/tasks\/([^/]+)\/time-logs\/([^/]+)$/,
      )
      if (taskTimeLogEntryMatch) {
        const [, taskId, timeLogId] = taskTimeLogEntryMatch
        const task = tasks.find((candidate) => candidate.id === taskId)

        if (!task) {
          return jsonResponse({ body: { detail: 'Task not found' }, status: 404 })
        }

        const existingTimeLogs = timeLogsByTask.get(taskId) ?? []
        const logIndex = existingTimeLogs.findIndex((timeLog) => timeLog.id === timeLogId)

        if (logIndex < 0) {
          return jsonResponse({ body: { detail: 'Time log not found' }, status: 404 })
        }

        if (method === 'DELETE') {
          const nextTimeLogs = existingTimeLogs.filter((timeLog) => timeLog.id !== timeLogId)
          timeLogsByTask.set(taskId, nextTimeLogs)
          const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId)
          if (taskIndex >= 0) {
            tasks[taskIndex] = {
              ...tasks[taskIndex],
              actual_hours: actualHoursForTask(taskId),
            }
          }

          return new Response(null, { status: 204 })
        }

        if (method === 'PATCH') {
          const payload = body as Partial<TimeLogPayload>
          const previousLog = existingTimeLogs[logIndex]
          const nextHours =
            typeof payload.hours === 'number' ? payload.hours : previousLog.hours
          const nextLoggedDate =
            typeof payload.logged_date === 'string'
              ? payload.logged_date
              : previousLog.logged_date
          const nextNotes =
            payload.notes !== undefined ? payload.notes : previousLog.notes
          const nextTitle =
            payload.title !== undefined ? payload.title : previousLog.title
          const nextLocation =
            payload.location !== undefined ? payload.location : previousLog.location

          const activityKey =
            payload.activity_type_id !== undefined
              ? payload.activity_type_id
              : previousLog.activity_type_id

          const activityFields = resolveActivityFieldsForTimeLog(activityKey)

          const updatedLog: TimeLog = {
            ...previousLog,
            hours: nextHours,
            logged_date: nextLoggedDate,
            notes: nextNotes,
            title: nextTitle,
            location: nextLocation,
            updated_at: '2026-05-13T12:30:00Z',
            ...activityFields,
          }

          const nextLogs = [...existingTimeLogs]
          nextLogs[logIndex] = updatedLog
          timeLogsByTask.set(taskId, nextLogs)

          const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId)
          if (taskIndex >= 0) {
            tasks[taskIndex] = {
              ...tasks[taskIndex],
              actual_hours: actualHoursForTask(taskId),
            }
          }

          return jsonResponse({ body: updatedLog })
        }
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
          const activityFields = resolveActivityFieldsForTimeLog(payload.activity_type_id)
          const createdTimeLog = buildTimeLog({
            id: `log-${timeLogCreateCount}`,
            task_id: taskId,
            project_id: task.project_id,
            hours: payload.hours,
            logged_date: payload.logged_date,
            notes: payload.notes,
            title: payload.title ?? null,
            location: payload.location ?? null,
            created_at: `2026-05-13T08:00:0${timeLogCreateCount}Z`,
            updated_at: `2026-05-13T08:00:0${timeLogCreateCount}Z`,
            ...activityFields,
          })

          timeLogsByTask.set(taskId, [...existingTimeLogs, createdTimeLog])
          const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId)
          if (taskIndex >= 0) {
            tasks[taskIndex] = {
              ...tasks[taskIndex],
              actual_hours: actualHoursForTask(taskId),
            }
          }
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

      const taskStatusMatch = pathname.match(/^\/api\/v1\/tasks\/([^/]+)\/status$/)
      if (taskStatusMatch && method === 'PATCH') {
        const [, taskId] = taskStatusMatch
        const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId)

        if (taskIndex < 0) {
          return jsonResponse({ body: { detail: 'Task not found' }, status: 404 })
        }

        taskStatusUpdateCount += 1
        const payload = body as TaskStatusPayload
        taskStatusRequests.push({ taskId, payload })

        const handlerResponse = options.onTaskStatusUpdate
          ? await options.onTaskStatusUpdate(taskId, payload, taskStatusUpdateCount)
          : null

        if (handlerResponse) {
          return handlerResponse
        }

        const nextTasks = reorderTasksInColumn(
          tasks,
          taskId,
          payload.status,
          payload.kanban_order,
        )
        tasks.splice(0, tasks.length, ...nextTasks)

        return jsonResponse({
          body: withDerivedHours(tasks[taskIndex]),
        })
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
  return { fetchMock, projectBoardStatusRequests, taskStatusRequests }
}
