import type { Project, Task, TaskPayload, TaskStatus, TaskStatusPayload, TimeLog, TimeLogPayload } from '../api/types'

import { buildProject, buildTask, buildTimeLog } from './fixtures'

type MockResponseOptions = {
  body?: unknown
  status?: number
}

export type WorkspaceBackendOptions = {
  projects?: Project[]
  tasks?: Task[]
  timeLogs?: Record<string, TimeLog[]>
  onProjectCreate?: (
    payload: { name: string; description: string | null; colour: string },
    count: number,
  ) => Response | Promise<Response> | null
  onProjectUpdate?: (
    projectId: string,
    payload: { name: string; description: string | null; colour: string },
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

export function installWorkspaceBackendMock(
  options: WorkspaceBackendOptions,
): { fetchMock: ReturnType<typeof vi.fn<typeof fetch>> } {
  const projects = [...(options.projects ?? [])]
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

  const actualHoursForTask = (taskId: string): number => {
    const timeLogs = timeLogsByTask.get(taskId) ?? []
    return timeLogs.reduce((sum, timeLog) => sum + timeLog.hours, 0)
  }

  const withDerivedHours = (task: Task): Task => ({
    ...task,
    actual_hours: actualHoursForTask(task.id),
  })

  const fetchMock = vi.fn<typeof fetch>(
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

      if (method === 'POST' && pathname === '/api/v1/projects') {
        projectCreateCount += 1
        const payload = body as { name: string; description: string | null; colour: string }
        const handlerResponse = options.onProjectCreate
          ? await options.onProjectCreate(payload, projectCreateCount)
          : null

        if (handlerResponse) {
          return handlerResponse
        }

        const createdProject = buildProject({
          id: `project-created-${projectCreateCount}`,
          name: payload.name,
          description: payload.description,
          colour: payload.colour,
          created_at: `2026-05-13T09:00:0${projectCreateCount}Z`,
          updated_at: `2026-05-13T09:00:0${projectCreateCount}Z`,
        })
        projects.push(createdProject)
        return jsonResponse({ body: createdProject, status: 201 })
      }

      const projectMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)$/)
      if (projectMatch) {
        const [, projectId] = projectMatch
        const projectIndex = projects.findIndex((candidate) => candidate.id === projectId)

        if (projectIndex < 0) {
          return jsonResponse({ body: { detail: 'Project not found' }, status: 404 })
        }

        if (method === 'PATCH') {
          const payload = body as { name: string; description: string | null; colour: string }
          const handlerResponse = options.onProjectUpdate
            ? await options.onProjectUpdate(projectId, payload)
            : null

          if (handlerResponse) {
            return handlerResponse
          }

          projects[projectIndex] = {
            ...projects[projectIndex],
            ...payload,
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

      const taskStatusMatch = pathname.match(/^\/api\/v1\/tasks\/([^/]+)\/status$/)
      if (taskStatusMatch && method === 'PATCH') {
        const [, taskId] = taskStatusMatch
        const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId)

        if (taskIndex < 0) {
          return jsonResponse({ body: { detail: 'Task not found' }, status: 404 })
        }

        taskStatusUpdateCount += 1
        const payload = body as TaskStatusPayload

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
  return { fetchMock }
}
