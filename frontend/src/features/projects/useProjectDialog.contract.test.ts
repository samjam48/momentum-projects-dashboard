import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QueryProvider } from '../../test/QueryProvider'

import { useProjectDialog } from './useProjectDialog'

describe('useProjectDialog hook contract', () => {
  it('renders hook without throwing when composed from WorkspaceDialogs', () => {
    expect(() =>
      renderHook(() => useProjectDialog(), { wrapper: QueryProvider }),
    ).not.toThrow()
  })
})
