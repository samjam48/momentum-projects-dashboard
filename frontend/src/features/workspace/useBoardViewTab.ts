import { useState, type Dispatch, type SetStateAction } from 'react'

import type { ProjectType } from '../../api/types'

export type BoardViewTab = 'projects' | 'tasks'

type UseBoardViewTabResult = {
  boardViewTab: BoardViewTab
  setBoardViewTab: Dispatch<SetStateAction<BoardViewTab>>
  projectKanbanTypeFilter: 'all' | ProjectType
  setProjectKanbanTypeFilter: Dispatch<SetStateAction<'all' | ProjectType>>
}

export function useBoardViewTab(): UseBoardViewTabResult {
  const [boardViewTab, setBoardViewTab] = useState<BoardViewTab>('tasks')
  const [projectKanbanTypeFilter, setProjectKanbanTypeFilter] = useState<
    'all' | ProjectType
  >('all')

  return {
    boardViewTab,
    projectKanbanTypeFilter,
    setBoardViewTab,
    setProjectKanbanTypeFilter,
  }
}
