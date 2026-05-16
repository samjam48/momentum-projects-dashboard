import { renderHook, waitFor } from '@testing-library/react'
import type { JSX, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useProjects } from './projects'
import { useVentures } from './ventures'
import { QueryProvider } from '../test/QueryProvider'
import { installWorkspaceBackendMock } from '../test/workspaceBackendMock'

describe('hook QueryState.reload — Chore 1.6-C1 stable identities', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function queryWrapper(): ({ children }: { children: ReactNode }) => JSX.Element {
    installWorkspaceBackendMock({ projects: [] })
    return function Wrapper({ children }: { children: ReactNode }): JSX.Element {
      return <QueryProvider>{children}</QueryProvider>
    }
  }

  it('keeps useProjects.reload referentially identical across benign rerenders', async () => {
    const Wrapper = queryWrapper()

    const { result, rerender } = renderHook(() => useProjects(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const firstReload = result.current.reload

    rerender()

    expect(result.current.reload).toBe(firstReload)
    expect(firstReload).toBeTypeOf('function')
  })

  it('keeps useVentures.reload referentially identical across benign rerenders', async () => {
    const Wrapper = queryWrapper()

    const { result, rerender } = renderHook(() => useVentures('active'), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const firstReload = result.current.reload

    rerender()

    expect(result.current.reload).toBe(firstReload)
    expect(firstReload).toBeTypeOf('function')
  })
})
