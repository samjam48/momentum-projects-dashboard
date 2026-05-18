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

describe('useTaskDialog hook contract', () => {
  it('renders hook without throwing when composed from WorkspaceDialogs', () => {
    expect(() =>
      renderHook(useTaskDialogContractHarness, { wrapper: QueryProvider }),
    ).not.toThrow()
  })
})
