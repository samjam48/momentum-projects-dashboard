import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'

import { createAppQueryClient } from '../api/queryClient'

type QueryProviderProps = {
  children: ReactNode
  client?: ReturnType<typeof createAppQueryClient>
}

export function QueryProvider({
  children,
  client: clientProp,
}: QueryProviderProps): JSX.Element {
  const [defaultClient] = useState(() => {
    const client = createAppQueryClient()
    const defaultOptions = client.getDefaultOptions()

    client.setDefaultOptions({
      queries: {
        ...defaultOptions.queries,
        gcTime: Infinity,
      },
      mutations: {
        ...defaultOptions.mutations,
        gcTime: Infinity,
      },
    })

    return client
  })
  const client = clientProp ?? defaultClient

  useEffect(() => {
    if (clientProp) {
      return undefined
    }

    return () => {
      defaultClient.clear()
    }
  }, [clientProp, defaultClient])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
