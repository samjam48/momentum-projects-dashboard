import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTaskMutations } from '../../api/tasks'
import { QueryProvider } from '../../test/QueryProvider'

import { useTaskDialog } from './useTaskDialog'

function useTaskDialogContractHarness() {
  const taskMutations = useTaskMutations(async () => {})

  return useTaskDialog({
    activeProjects: [],
    activeTaskId: null,
    onTableTitleDisambiguation: () => {},
    onTasksReload: async () => {},
    selectedTask: null,
    setActiveTaskId: vi.fn(),
    setTaskDialogMode: vi.fn(),
    sidebarSelectedProjectIds: [],
    taskDialogMode: null,
    taskMutations,
  })
}

describe('FR-11 useTaskDialog contract', () => {
  it('renders hook without throwing after WorkspaceDialogs task split lands', () => {
    expect(() =>
      renderHook(useTaskDialogContractHarness, { wrapper: QueryProvider }),
    ).not.toThrow()
  })
})
