import { useCallback, useEffect, useState } from 'react'

import { ApiError, apiRequest } from './client'
import type { Venture, VenturePayload, VentureStatus } from './types'

// TanStack Query migration target: @tanstack/react-query useQuery/useMutation queryKey invalidateQueries
export const ventureQueryKeys = {
  all: ['ventures'] as const,
  list: (status: VentureStatus) => [...ventureQueryKeys.all, { status }] as const,
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

function extractVentures(payload: unknown): Venture[] {
  if (Array.isArray(payload)) {
    return payload as Venture[]
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    Array.isArray(payload.items)
  ) {
    return payload.items as Venture[]
  }

  return []
}

export async function listVentures(status: VentureStatus = 'active'): Promise<Venture[]> {
  const query = new URLSearchParams({ status })
  const payload = await apiRequest<unknown>(`/api/v1/ventures?${query.toString()}`)
  return extractVentures(payload)
}

export async function createVenture(payload: VenturePayload): Promise<Venture> {
  return apiRequest<Venture>('/api/v1/ventures', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateVenture(ventureId: string, payload: VenturePayload): Promise<Venture> {
  return apiRequest<Venture>(`/api/v1/ventures/${ventureId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function archiveVenture(ventureId: string): Promise<void> {
  await apiRequest<null>(`/api/v1/ventures/${ventureId}`, { method: 'DELETE' })
}

export async function unarchiveVenture(ventureId: string): Promise<Venture> {
  return apiRequest<Venture>(`/api/v1/ventures/${ventureId}/unarchive`, { method: 'PATCH' })
}

export function useVentures(status: VentureStatus = 'active'): QueryState<Venture[]> {
  const [data, setData] = useState<Venture[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await listVentures(status))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load ventures.')
    } finally {
      setIsLoading(false)
    }
  }, [status])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, isLoading, reload }
}

export function useVentureMutations(
  onSettled: () => Promise<void>,
): {
  create: (payload: VenturePayload) => Promise<Venture>
  update: (ventureId: string, payload: VenturePayload) => Promise<Venture>
  archive: (ventureId: string) => Promise<void>
  unarchive: (ventureId: string) => Promise<Venture>
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
        const fallbackError = new ApiError('Unable to save venture.', 500)
        setError(fallbackError)
        throw fallbackError
      } finally {
        setIsSaving(false)
      }
    },
    [onSettled],
  )

  return {
    create: (payload) => runMutation(() => createVenture(payload)),
    update: (ventureId, payload) => runMutation(() => updateVenture(ventureId, payload)),
    archive: (ventureId) => runMutation(() => archiveVenture(ventureId)),
    unarchive: (ventureId) => runMutation(() => unarchiveVenture(ventureId)),
    error,
    isSaving,
    resetError: () => setError(null),
    invalidateQueries: async (queryClient) => {
      await queryClient.invalidateQueries({ queryKey: ventureQueryKeys.list('active') })
      await queryClient.invalidateQueries({ queryKey: ventureQueryKeys.list('archived') })
    },
  }
}
