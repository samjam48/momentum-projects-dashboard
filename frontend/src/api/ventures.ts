import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, apiRequest } from './client'
import { projectQueryKeys } from './projects'
import { toQueryState, type QueryState } from './queryUtils'
import type { Venture, VenturePayload, VentureStatus } from './types'

export const ventureQueryKeys = {
  all: ['ventures'] as const,
  list: (status: VentureStatus) => [...ventureQueryKeys.all, { status }] as const,
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

function dedupeVenturesById(ventures: Venture[]): Venture[] {
  return [...new Map(ventures.map((venture) => [venture.id, venture])).values()]
}

export async function listVentures(status: VentureStatus = 'active'): Promise<Venture[]> {
  const query = new URLSearchParams({ status })
  const payload = await apiRequest<unknown>(`/api/v1/ventures?${query.toString()}`)
  return dedupeVenturesById(extractVentures(payload))
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

async function invalidateVentureAndProjectQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ventureQueryKeys.list('active') }),
    queryClient.invalidateQueries({ queryKey: ventureQueryKeys.list('archived') }),
    queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() }),
  ])
}

function useVentureMutationErrorState(): {
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
      const fallbackError = new ApiError('Unable to save venture.', 500)
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

export function useVentures(status: VentureStatus = 'active'): QueryState<Venture[]> {
  const query = useQuery({
    queryKey: ventureQueryKeys.list(status),
    queryFn: () => listVentures(status),
  })

  return toQueryState(query, [])
}

export function useVentureMutations(): {
  create: (payload: VenturePayload) => Promise<Venture>
  update: (ventureId: string, payload: VenturePayload) => Promise<Venture>
  archive: (ventureId: string) => Promise<void>
  unarchive: (ventureId: string) => Promise<Venture>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
} {
  const queryClient = useQueryClient()
  const { error, isSaving, resetError, runMutation } = useVentureMutationErrorState()

  const onSettled = async (): Promise<void> => {
    await invalidateVentureAndProjectQueries(queryClient)
  }

  const createMutation = useMutation({
    mutationFn: createVenture,
    onSettled,
  })
  const updateMutation = useMutation({
    mutationFn: ({ ventureId, payload }: { ventureId: string; payload: VenturePayload }) =>
      updateVenture(ventureId, payload),
    onSettled,
  })
  const archiveMutation = useMutation({
    mutationFn: archiveVenture,
    onSettled,
  })
  const unarchiveMutation = useMutation({
    mutationFn: unarchiveVenture,
    onSettled,
  })

  return {
    create: (payload) => runMutation(() => createMutation.mutateAsync(payload)),
    update: (ventureId, payload) =>
      runMutation(() => updateMutation.mutateAsync({ ventureId, payload })),
    archive: (ventureId) => runMutation(() => archiveMutation.mutateAsync(ventureId)),
    unarchive: (ventureId) => runMutation(() => unarchiveMutation.mutateAsync(ventureId)),
    error,
    isSaving,
    resetError,
  }
}
