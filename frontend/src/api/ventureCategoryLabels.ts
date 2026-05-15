import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, apiRequest } from './client'
import { toQueryState, type QueryState } from './queryUtils'
import type { VentureCategoryLabel, VentureCategoryLabelPayload } from './types'
import { ventureQueryKeys } from './ventures'

export const ventureCategoryLabelQueryKeys = {
  all: ['venture-category-labels'] as const,
  list: () => [...ventureCategoryLabelQueryKeys.all, 'list'] as const,
}

function extractLabels(payload: unknown): VentureCategoryLabel[] {
  if (Array.isArray(payload)) {
    return payload as VentureCategoryLabel[]
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    Array.isArray(payload.items)
  ) {
    return payload.items as VentureCategoryLabel[]
  }

  return []
}

export async function listVentureCategoryLabels(): Promise<VentureCategoryLabel[]> {
  const payload = await apiRequest<unknown>('/api/v1/venture-category-labels')
  return extractLabels(payload)
}

export async function createVentureCategoryLabel(
  payload: VentureCategoryLabelPayload,
): Promise<VentureCategoryLabel> {
  return apiRequest<VentureCategoryLabel>('/api/v1/venture-category-labels', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateVentureCategoryLabel(
  labelId: string,
  payload: VentureCategoryLabelPayload,
): Promise<VentureCategoryLabel> {
  return apiRequest<VentureCategoryLabel>(`/api/v1/venture-category-labels/${labelId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteVentureCategoryLabel(labelId: string): Promise<void> {
  await apiRequest<null>(`/api/v1/venture-category-labels/${labelId}`, {
    method: 'DELETE',
  })
}

function useLabelMutationErrorState(): {
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
      const fallbackError = new ApiError('Unable to save label.', 500)
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

export function useVentureCategoryLabels(): QueryState<VentureCategoryLabel[]> {
  const query = useQuery({
    queryKey: ventureCategoryLabelQueryKeys.list(),
    queryFn: listVentureCategoryLabels,
  })

  return toQueryState(query, [])
}

export function useVentureCategoryLabelMutations(): {
  create: (payload: VentureCategoryLabelPayload) => Promise<VentureCategoryLabel>
  update: (labelId: string, payload: VentureCategoryLabelPayload) => Promise<VentureCategoryLabel>
  remove: (labelId: string) => Promise<void>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
} {
  const queryClient = useQueryClient()
  const { error, isSaving, resetError, runMutation } = useLabelMutationErrorState()

  const onSettled = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ventureCategoryLabelQueryKeys.list() }),
      queryClient.invalidateQueries({ queryKey: ventureQueryKeys.list('active') }),
      queryClient.invalidateQueries({ queryKey: ventureQueryKeys.list('archived') }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: createVentureCategoryLabel,
    onSettled,
  })
  const updateMutation = useMutation({
    mutationFn: ({ labelId, payload }: { labelId: string; payload: VentureCategoryLabelPayload }) =>
      updateVentureCategoryLabel(labelId, payload),
    onSettled,
  })
  const removeMutation = useMutation({
    mutationFn: deleteVentureCategoryLabel,
    onSettled,
  })

  return {
    create: (payload) => runMutation(() => createMutation.mutateAsync(payload)),
    update: (labelId, payload) =>
      runMutation(() => updateMutation.mutateAsync({ labelId, payload })),
    remove: (labelId) => runMutation(() => removeMutation.mutateAsync(labelId)),
    error,
    isSaving,
    resetError,
  }
}
