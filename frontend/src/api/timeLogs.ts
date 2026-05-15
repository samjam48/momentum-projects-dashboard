import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, apiRequest } from './client'
import { useQueryState, type QueryState } from './queryUtils'
import type { TimeLog, TimeLogPayload } from './types'

export const timeLogQueryKeys = {
  all: ['time-logs'] as const,
  list: (taskId: string) => [...timeLogQueryKeys.all, { taskId }] as const,
}

function extractTimeLogs(payload: unknown): TimeLog[] {
  if (Array.isArray(payload)) {
    return payload as TimeLog[]
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    Array.isArray(payload.items)
  ) {
    return payload.items as TimeLog[]
  }

  return []
}

export async function listTimeLogs(taskId: string): Promise<TimeLog[]> {
  const payload = await apiRequest<unknown>(`/api/v1/tasks/${taskId}/time-logs`)
  return extractTimeLogs(payload)
}

export async function createTimeLog(
  taskId: string,
  payload: TimeLogPayload,
): Promise<TimeLog> {
  const body = {
    ...payload,
    activity_type_id: payload.activity_type_id ?? null,
  }

  return apiRequest<TimeLog>(`/api/v1/tasks/${taskId}/time-logs`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function deleteTimeLog(taskId: string, timeLogId: string): Promise<void> {
  await apiRequest<null>(`/api/v1/tasks/${taskId}/time-logs/${timeLogId}`, {
    method: 'DELETE',
  })
}

export async function updateTimeLog(
  taskId: string,
  timeLogId: string,
  payload: TimeLogPayload,
): Promise<TimeLog> {
  const body = {
    ...payload,
    activity_type_id: payload.activity_type_id ?? null,
  }

  return apiRequest<TimeLog>(`/api/v1/tasks/${taskId}/time-logs/${timeLogId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function useTaskTimeLogs(taskId: string | null): QueryState<TimeLog[]> {
  const query = useQuery({
    queryKey: taskId ? timeLogQueryKeys.list(taskId) : ['time-logs', 'disabled'],
    queryFn: () => {
      if (!taskId) {
        return Promise.resolve([])
      }
      return listTimeLogs(taskId)
    },
    enabled: taskId !== null,
  })

  return useQueryState(query, [])
}

function useTimeLogMutationErrorState(): {
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
  runMutation: <T>(callback: () => Promise<T>) => Promise<T>
} {
  const [error, setError] = useState<ApiError | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const runMutation = async <T>(callback: () => Promise<T>): Promise<T> => {
    setIsSaving(true)
    setError(null)
    try {
      return await callback()
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError)
        throw caughtError
      }
      const fallbackError = new ApiError('Unable to save time log.', 500)
      setError(fallbackError)
      throw fallbackError
    } finally {
      setIsSaving(false)
    }
  }

  return {
    error,
    isSaving,
    resetError: () => setError(null),
    runMutation,
  }
}

export function useTimeLogMutations(taskId: string | null): {
  create: (payload: TimeLogPayload) => Promise<TimeLog>
  error: ApiError | null
  isSaving: boolean
  remove: (timeLogId: string) => Promise<void>
  resetError: () => void
  update: (timeLogId: string, payload: TimeLogPayload) => Promise<TimeLog>
} {
  const queryClient = useQueryClient()
  const { error, isSaving, resetError, runMutation } = useTimeLogMutationErrorState()

  const onSettled = async (): Promise<void> => {
    if (taskId) {
      await queryClient.invalidateQueries({ queryKey: timeLogQueryKeys.list(taskId) })
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: TimeLogPayload) => {
      if (!taskId) {
        throw new ApiError('A task is required.', 400)
      }
      return createTimeLog(taskId, payload)
    },
    onSettled,
  })

  const removeMutation = useMutation({
    mutationFn: (timeLogId: string) => {
      if (!taskId) {
        throw new ApiError('A task is required.', 400)
      }
      return deleteTimeLog(taskId, timeLogId)
    },
    onSettled,
  })

  const updateMutation = useMutation({
    mutationFn: ({ timeLogId, payload }: { timeLogId: string; payload: TimeLogPayload }) => {
      if (!taskId) {
        throw new ApiError('A task is required.', 400)
      }
      return updateTimeLog(taskId, timeLogId, payload)
    },
    onSettled,
  })

  return {
    create: (payload) => runMutation(() => createMutation.mutateAsync(payload)),
    remove: (timeLogId) => runMutation(() => removeMutation.mutateAsync(timeLogId)),
    update: (timeLogId, payload) =>
      runMutation(() => updateMutation.mutateAsync({ timeLogId, payload })),
    error,
    isSaving,
    resetError,
  }
}
