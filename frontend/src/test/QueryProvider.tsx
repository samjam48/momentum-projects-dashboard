import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { createAppQueryClient } from '../api/queryClient'

type QueryProviderProps = {
  children: ReactNode
  client?: ReturnType<typeof createAppQueryClient>
}

export function QueryProvider({
  children,
  client: clientProp,
}: QueryProviderProps): JSX.Element {
  const [defaultClient] = useState(() => createAppQueryClient())
  const client = clientProp ?? defaultClient
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
