import type { QueryObserverResult } from '@tanstack/react-query'

export type QueryState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  reload: () => Promise<void>
}

export function toQueryState<T>(
  query: Pick<QueryObserverResult<T, Error>, 'data' | 'error' | 'isLoading' | 'refetch'>,
  fallback: T,
): QueryState<T> {
  return {
    data: query.data ?? fallback,
    error: query.error?.message ?? null,
    isLoading: query.isLoading,
    reload: async () => {
      await query.refetch()
    },
  }
}
