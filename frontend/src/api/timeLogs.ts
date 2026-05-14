import { useCallback, useEffect, useState } from 'react'

import { ApiError, apiRequest } from './client'
import type { TimeLog, TimeLogPayload } from './types'

type QueryState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  reload: () => Promise<void>
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
  return apiRequest<TimeLog>(`/api/v1/tasks/${taskId}/time-logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function useTaskTimeLogs(taskId: string | null): QueryState<TimeLog[]> {
  const [data, setData] = useState<TimeLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(taskId !== null)

  const reload = useCallback(async () => {
    if (!taskId) {
      setData([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      setData(await listTimeLogs(taskId))
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError('Unable to load time logs.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, isLoading, reload }
}

type TimeLogMutations = {
  create: (payload: TimeLogPayload) => Promise<TimeLog>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
}

export function useTimeLogMutations(
  taskId: string | null,
  onSettled: () => Promise<void>,
): TimeLogMutations {
  const [error, setError] = useState<ApiError | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const create = useCallback(
    async (payload: TimeLogPayload): Promise<TimeLog> => {
      if (!taskId) {
        const missingTaskError = new ApiError('A task is required.', 400)
        setError(missingTaskError)
        throw missingTaskError
      }

      setIsSaving(true)
      setError(null)

      try {
        const result = await createTimeLog(taskId, payload)
        await onSettled()
        return result
      } catch (caughtError) {
        if (caughtError instanceof ApiError) {
          setError(caughtError)
          throw caughtError
        }

        const fallbackError = new ApiError('Unable to create time log.', 500)
        setError(fallbackError)
        throw fallbackError
      } finally {
        setIsSaving(false)
      }
    },
    [onSettled, taskId],
  )

  return {
    create,
    error,
    isSaving,
    resetError: () => setError(null),
  }
}
