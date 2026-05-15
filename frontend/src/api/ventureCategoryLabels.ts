import { useCallback, useEffect, useState } from 'react'

import { ApiError, apiRequest } from './client'
import type { VentureCategoryLabel, VentureCategoryLabelPayload } from './types'

// TanStack Query migration target: @tanstack/react-query useQuery/useMutation queryKey invalidateQueries
export const ventureCategoryLabelQueryKeys = {
  all: ['venture-category-labels'] as const,
  list: () => [...ventureCategoryLabelQueryKeys.all, 'list'] as const,
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

export function useVentureCategoryLabels(): QueryState<VentureCategoryLabel[]> {
  const [data, setData] = useState<VentureCategoryLabel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await listVentureCategoryLabels())
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load labels.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, isLoading, reload }
}

export function useVentureCategoryLabelMutations(
  onSettled: () => Promise<void>,
): {
  create: (payload: VentureCategoryLabelPayload) => Promise<VentureCategoryLabel>
  update: (labelId: string, payload: VentureCategoryLabelPayload) => Promise<VentureCategoryLabel>
  remove: (labelId: string) => Promise<void>
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
        const fallbackError = new ApiError('Unable to save label.', 500)
        setError(fallbackError)
        throw fallbackError
      } finally {
        setIsSaving(false)
      }
    },
    [onSettled],
  )

  return {
    create: (payload) => runMutation(() => createVentureCategoryLabel(payload)),
    update: (labelId, payload) => runMutation(() => updateVentureCategoryLabel(labelId, payload)),
    remove: (labelId) => runMutation(() => deleteVentureCategoryLabel(labelId)),
    error,
    isSaving,
    resetError: () => setError(null),
    invalidateQueries: async (queryClient) => {
      await queryClient.invalidateQueries({ queryKey: ventureCategoryLabelQueryKeys.list() })
    },
  }
}
