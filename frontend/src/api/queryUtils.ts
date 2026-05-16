import type { QueryObserverResult } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

export type QueryState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  reload: () => Promise<T>
}

/** Build query view state with a stable `reload` identity across rerenders. */
export function useQueryState<T>(
  query: Pick<QueryObserverResult<T, Error>, 'data' | 'error' | 'isLoading' | 'refetch'>,
  fallback: T,
): QueryState<T> {
  const { data, error, isLoading, refetch } = query
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback

  const reload = useCallback(async (): Promise<T> => {
    const result = await refetch()
    return result.data ?? fallbackRef.current
  }, [refetch])

  return {
    data: data ?? fallback,
    error: error?.message ?? null,
    isLoading,
    reload,
  }
}
