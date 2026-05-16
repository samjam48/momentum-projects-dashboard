import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, apiRequest } from './client'
import { useQueryState, type QueryState } from './queryUtils'
import { timeLogQueryKeys } from './timeLogs'
import type { ActivityType, ActivityTypePayload, ActivityTypeStatus } from './types'

export const activityTypeQueryKeys = {
  all: ['activity-types'] as const,
  list: (status: ActivityTypeStatus) => [...activityTypeQueryKeys.all, { status }] as const,
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

function useActivityTypeMutationErrorState(): {
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
      const fallbackError = new ApiError('Unable to save activity type.', 500)
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

export function useActivityTypes(status: ActivityTypeStatus = 'active'): QueryState<ActivityType[]> {
  const query = useQuery({
    queryKey: activityTypeQueryKeys.list(status),
    queryFn: () => listActivityTypes(status),
  })

  return useQueryState(query, [])
}

export function useActivityTypeMutations(): {
  create: (payload: ActivityTypePayload) => Promise<ActivityType>
  update: (activityTypeId: string, payload: ActivityTypePayload) => Promise<ActivityType>
  archive: (activityTypeId: string) => Promise<void>
  remove: (activityTypeId: string) => Promise<void>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
} {
  const queryClient = useQueryClient()
  const { error, isSaving, resetError, runMutation } = useActivityTypeMutationErrorState()

  const onSettled = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: activityTypeQueryKeys.list('active') }),
      queryClient.invalidateQueries({ queryKey: activityTypeQueryKeys.list('archived') }),
      queryClient.invalidateQueries({ queryKey: timeLogQueryKeys.all }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: createActivityType,
    onSettled,
  })
  const updateMutation = useMutation({
    mutationFn: ({
      activityTypeId,
      payload,
    }: {
      activityTypeId: string
      payload: ActivityTypePayload
    }) => updateActivityType(activityTypeId, payload),
    onSettled,
  })
  const archiveMutation = useMutation({
    mutationFn: archiveActivityType,
    onSettled,
  })
  const removeMutation = useMutation({
    mutationFn: deleteActivityType,
    onSettled,
  })

  return {
    create: (payload) => runMutation(() => createMutation.mutateAsync(payload)),
    update: (activityTypeId, payload) =>
      runMutation(() => updateMutation.mutateAsync({ activityTypeId, payload })),
    archive: (activityTypeId) => runMutation(() => archiveMutation.mutateAsync(activityTypeId)),
    remove: (activityTypeId) => runMutation(() => removeMutation.mutateAsync(activityTypeId)),
    error,
    isSaving,
    resetError,
  }
}
