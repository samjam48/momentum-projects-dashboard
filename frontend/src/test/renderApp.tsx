import type { ReactElement } from 'react'

import { render, type RenderOptions, type RenderResult } from '@testing-library/react'

import App from '../App'

import { flushAct } from './actUtils'
import { QueryProvider } from './QueryProvider'
import { waitForWorkspaceReady } from './workspaceQueries'

export function renderWithQueryClient(ui: ReactElement, options?: RenderOptions): RenderResult {
  return render(<QueryProvider>{ui}</QueryProvider>, options)
}

export function renderAppBare(options?: RenderOptions): RenderResult {
  return renderWithQueryClient(<App />, options)
}

export async function renderApp(options?: RenderOptions): Promise<RenderResult> {
  const view = renderAppBare(options)
  await waitForWorkspaceReady()
  await flushAct()
  return view
}
