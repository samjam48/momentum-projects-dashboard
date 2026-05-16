import type { ReactElement, ReactNode } from 'react'

import { renderHook, screen } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'

import { resetProjectFilterStore } from '../stores/projectFilter'

import { buildProject } from './fixtures'
import { renderApp, renderAppBare } from './renderApp'
import { QueryProvider } from './QueryProvider'
import { resetTestStorage } from './storage'
import { installWorkspaceBackendMock } from './workspaceBackendMock'

/** Same composition as `queryWrapper` in `modules.test.tsx`. */
function queryWrapper({ children }: { children: ReactNode }): ReactElement {
  return <QueryProvider>{children}</QueryProvider>
}

describe('renderApp harness — QueryClientProvider (Phase 1.6-C2)', () => {
  const alphaProject = buildProject({
    id: 'project-alpha',
    name: 'Alpha Client',
    colour: '#5B7C99',
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    resetTestStorage()
    resetProjectFilterStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetTestStorage()
    resetProjectFilterStore()
  })

  it('TanStack Query hooks throw without QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useQueryClient())
    }).toThrow(/No QueryClient set/i)
  })

  it('QueryProvider supplies QueryClient (see modules.test.tsx / QueryProvider.tsx)', () => {
    const { result } = renderHook(() => useQueryClient(), { wrapper: queryWrapper })

    expect(result.current.getQueryCache()).toBeDefined()
  })

  it('renderAppBare must wrap App with QueryClientProvider (Implementer: wire renderApp.tsx)', () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [],
    })

    expect(() => {
      renderAppBare()
    }).not.toThrow()
  })

  it('renderApp must wrap App with QueryClientProvider (Implementer: wire renderApp.tsx)', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [],
    })

    await expect(renderApp()).resolves.toBeDefined()
    await screen.findByRole('complementary', { name: /projects sidebar/i })
  })
})
