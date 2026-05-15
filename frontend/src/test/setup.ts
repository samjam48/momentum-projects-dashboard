import '@testing-library/jest-dom'

import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { flushAct } from './actUtils'
import { ensureTestStorage } from './storage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

configure({
  asyncUtilTimeout: 5000,
})

// Remaining act warnings come from Radix menu/checkbox focus and zustand
// subscribers that flush after @testing-library/user-event's act boundary.
// Real fixes (renderApp, act-safe helpers, dnd-kit test mocks, render-time
// App state sync) reduced warnings from 243 to a small residual set.
const originalConsoleError = console.error

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
      return
    }

    originalConsoleError(...args)
  }
})

afterAll(() => {
  console.error = originalConsoleError
})

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const React = await import('react')
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()

  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>()

  return {
    ...actual,
    useSortable: () => ({
      attributes: {},
      isDragging: false,
      listeners: {},
      setNodeRef: () => undefined,
      transform: null,
      transition: null,
    }),
  }
})

afterEach(async () => {
  await flushAct()
  cleanup()
})

ensureTestStorage()
