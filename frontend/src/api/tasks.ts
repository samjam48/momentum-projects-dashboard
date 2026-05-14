import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, apiRequest } from './client'
import type {
  Task,
  TaskFilters,
  TaskPayload,
  TaskStatusPayload,
} from './types'

type QueryState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  reload: () => Promise<void>
}

function extractTasks(payload: unknown): Task[] {
  if (Array.isArray(payload)) {
    return payload as Task[]
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    Array.isArray(payload.items)
  ) {
    return payload.items as Task[]
  }

  return []
}

function buildTaskQuery(filters: TaskFilters): string {
  const query = new URLSearchParams()

  if (filters.projectId) {
    query.set('project_id', filters.projectId)
  }

  if (filters.status) {
    query.set('status', filters.status)
  }

  if (filters.priority) {
    query.set('priority', filters.priority)
  }

  return query.toString()
}

export async function listTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const query = buildTaskQuery(filters)
  const path = query ? `/api/v1/tasks?${query}` : '/api/v1/tasks'
  const payload = await apiRequest<unknown>(path)
  return extractTasks(payload)
}

export async function createTask(payload: TaskPayload): Promise<Task> {
  return apiRequest<Task>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTask(taskId: string, payload: TaskPayload): Promise<Task> {
  return apiRequest<Task>(`/api/v1/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiRequest<null>(`/api/v1/tasks/${taskId}`, {
    method: 'DELETE',
  })
}

export async function updateTaskStatus(
  taskId: string,
  payload: TaskStatusPayload,
): Promise<Task> {
  return apiRequest<Task>(`/api/v1/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function useTasks(filters: TaskFilters = {}, enabled = true): QueryState<Task[]> {
  const [data, setData] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const { priority, projectId, status } = filters

  const reload = useCallback(async () => {
    if (!enabled) {
      setData([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      setData(await listTasks({ priority, projectId, status }))
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError('Unable to load tasks.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [enabled, priority, projectId, status])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, isLoading, reload }
}

type TaskMutations = {
  create: (payload: TaskPayload) => Promise<Task>
  update: (taskId: string, payload: TaskPayload) => Promise<Task>
  remove: (taskId: string) => Promise<void>
  updateStatus: (taskId: string, payload: TaskStatusPayload) => Promise<Task>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
}

export function useTaskMutations(onSettled: () => Promise<void>): TaskMutations {
  const [error, setError] = useState<ApiError | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const onSettledRef = useRef(onSettled)

  useEffect(() => {
    onSettledRef.current = onSettled
  }, [onSettled])

  const runMutation = useCallback(
    async <T>(callback: () => Promise<T>, fallbackMessage: string): Promise<T> => {
      setIsSaving(true)
      setError(null)

      try {
        const result = await callback()
        await onSettledRef.current()
        return result
      } catch (caughtError) {
        if (caughtError instanceof ApiError) {
          setError(caughtError)
          throw caughtError
        }

        const fallbackError = new ApiError(fallbackMessage, 500)
        setError(fallbackError)
        throw fallbackError
      } finally {
        setIsSaving(false)
      }
    },
    [],
  )

  return {
    create: (payload) => runMutation(() => createTask(payload), 'Unable to create task.'),
    update: (taskId, payload) =>
      runMutation(() => updateTask(taskId, payload), 'Unable to update task.'),
    remove: (taskId) => runMutation(() => deleteTask(taskId), 'Unable to delete task.'),
    updateStatus: (taskId, payload) =>
      runMutation(
        () => updateTaskStatus(taskId, payload),
        'Unable to update task status.',
      ),
    error,
    isSaving,
    resetError: () => setError(null),
  }
}
