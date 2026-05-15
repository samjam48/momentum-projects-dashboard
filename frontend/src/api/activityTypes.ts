import { useCallback, useEffect, useState } from 'react'

import { ApiError, apiRequest } from './client'
import type { ActivityType, ActivityTypePayload, ActivityTypeStatus } from './types'

// TanStack Query migration target: @tanstack/react-query useQuery/useMutation queryKey invalidateQueries
export const activityTypeQueryKeys = {
  all: ['activity-types'] as const,
  list: (status: ActivityTypeStatus) => [...activityTypeQueryKeys.all, { status }] as const,
}

type QueryState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  reload: () => Promise<void>
}

type QueryInvalidator = {
  invalidateQueries: (options: { queryKey: readonly unknown[] }) => Promise<void>
}

function extractActivityTypes(payload: unknown): ActivityType[] {
  if (Array.isArray(payload)) {
    return payload as ActivityType[]
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    Array.isArray(payload.items)
  ) {
    return payload.items as ActivityType[]
  }

  return []
}

export async function listActivityTypes(
  status: ActivityTypeStatus = 'active',
): Promise<ActivityType[]> {
  const query = new URLSearchParams({ status })
  const payload = await apiRequest<unknown>(`/api/v1/activity-types?${query.toString()}`)
  return extractActivityTypes(payload)
}

export async function createActivityType(payload: ActivityTypePayload): Promise<ActivityType> {
  return apiRequest<ActivityType>('/api/v1/activity-types', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateActivityType(
  activityTypeId: string,
  payload: ActivityTypePayload,
): Promise<ActivityType> {
  return apiRequest<ActivityType>(`/api/v1/activity-types/${activityTypeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function archiveActivityType(activityTypeId: string): Promise<void> {
  await apiRequest<null>(`/api/v1/activity-types/${activityTypeId}/archive`, {
    method: 'PATCH',
  })
}

export async function deleteActivityType(activityTypeId: string): Promise<void> {
  await apiRequest<null>(`/api/v1/activity-types/${activityTypeId}`, {
    method: 'DELETE',
  })
}

export function useActivityTypes(status: ActivityTypeStatus = 'active'): QueryState<ActivityType[]> {
  const [data, setData] = useState<ActivityType[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await listActivityTypes(status))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unable to load activity types.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [status])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, isLoading, reload }
}

export function useActivityTypeMutations(
  onSettled: () => Promise<void>,
): {
  create: (payload: ActivityTypePayload) => Promise<ActivityType>
  update: (activityTypeId: string, payload: ActivityTypePayload) => Promise<ActivityType>
  archive: (activityTypeId: string) => Promise<void>
  remove: (activityTypeId: string) => Promise<void>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
  invalidateQueries: (queryClient: QueryInvalidator) => Promise<void>
} {
  const [error, setError] = useState<ApiError | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const runMutation = useCallback(
    async <T>(callback: () => Promise<T>): Promise<T> => {
      setIsSaving(true)
      setError(null)
      try {
        const result = await callback()
        await onSettled()
        return result
      } catch (caughtError) {
        if (caughtError instanceof ApiError) {
          setError(caughtError)
          throw caughtError
        }
        const fallbackError = new ApiError('Unable to save activity type.', 500)
        setError(fallbackError)
        throw fallbackError
      } finally {
        setIsSaving(false)
      }
    },
    [onSettled],
  )

  return {
    create: (payload) => runMutation(() => createActivityType(payload)),
    update: (activityTypeId, payload) =>
      runMutation(() => updateActivityType(activityTypeId, payload)),
    archive: (activityTypeId) => runMutation(() => archiveActivityType(activityTypeId)),
    remove: (activityTypeId) => runMutation(() => deleteActivityType(activityTypeId)),
    error,
    isSaving,
    resetError: () => setError(null),
    invalidateQueries: async (queryClient) => {
      await queryClient.invalidateQueries({ queryKey: activityTypeQueryKeys.list('active') })
      await queryClient.invalidateQueries({ queryKey: activityTypeQueryKeys.list('archived') })
    },
  }
}
