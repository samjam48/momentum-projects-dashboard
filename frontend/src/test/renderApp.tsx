import { render, type RenderOptions, type RenderResult } from '@testing-library/react'

import App from '../App'

import { flushAct } from './actUtils'
import { QueryProvider } from './QueryProvider'
import { waitForWorkspaceReady } from './workspaceQueries'

export function renderAppBare(options?: RenderOptions): RenderResult {
  return render(
    <QueryProvider>
      <App />
    </QueryProvider>,
    options,
  )
}

export async function renderApp(options?: RenderOptions): Promise<RenderResult> {
  const view = renderAppBare(options)
  await waitForWorkspaceReady()
  await flushAct()
  return view
}
