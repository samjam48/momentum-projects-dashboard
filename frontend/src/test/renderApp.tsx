import { act, render, type RenderOptions, type RenderResult } from '@testing-library/react'

import App from '../App'

import { flushAct } from './actUtils'
import { waitForWorkspaceReady } from './workspaceQueries'

export function renderAppBare(options?: RenderOptions): RenderResult {
  let view!: RenderResult
  act(() => {
    view = render(<App />, options)
  })
  return view
}

export async function renderApp(options?: RenderOptions): Promise<RenderResult> {
  const view = renderAppBare(options)
  await waitForWorkspaceReady()
  await flushAct()
  return view
}
