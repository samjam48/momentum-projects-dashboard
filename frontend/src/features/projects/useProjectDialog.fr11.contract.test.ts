import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QueryProvider } from '../../test/QueryProvider'

import { useProjectDialog } from './useProjectDialog'

describe('FR-11 useProjectDialog contract', () => {
  it('renders hook without throwing after WorkspaceDialogs project split lands', () => {
    expect(() =>
      renderHook(() => useProjectDialog(), { wrapper: QueryProvider }),
    ).not.toThrow()
  })
})
