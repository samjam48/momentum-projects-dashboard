import { act, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { QueryProvider } from '../test/QueryProvider'
import { createAppQueryClient } from './queryClient'
import { projectQueryKeys } from './projects'
import { useVentureMutations, ventureQueryKeys } from './ventures'

type MockResponseOptions = {
  body?: unknown
  status?: number
}

function jsonResponse({ body, status = 200 }: MockResponseOptions): Response {
  if (status === 204) {
    return new Response(null, { status: 204 })
  }
  return new Response(JSON.stringify(body ?? null), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>

function installFetchMock(responses: Response[]): FetchMock {
  const fetchMock = vi.fn<typeof fetch>()
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function queryWrapperWithClient(client: ReturnType<typeof createAppQueryClient>): ({
  children,
}: {
  children: ReactNode
}) => ReactElement {
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryProvider client={client}>{children}</QueryProvider>
  }
  return Wrapper
}

function createTrackedQueryClient() {
  const client = createAppQueryClient()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  return { client, invalidateSpy }
}

describe('Phase 1.6-12 — cross-surface cache coherence after venture mutations', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('invalidates project board queries when a venture is archived (avoids stale Project Kanban)', async () => {
    const { client, invalidateSpy } = createTrackedQueryClient()
    installFetchMock([jsonResponse({ body: null, status: 204 })])
    const { result } = renderHook(() => useVentureMutations(), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await result.current.archive('venture-1')
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ventureQueryKeys.list('active') }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ventureQueryKeys.list('archived') }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.lists() }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.board() }),
    )
  })
})
