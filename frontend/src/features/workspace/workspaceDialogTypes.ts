import type { Dispatch, SetStateAction } from 'react'

import { useTaskMutations } from '../../api/tasks'
import type { Project, Task } from '../../api/types'
import type { ProjectFilterState } from '../../stores/projectFilter'

export type TaskDialogMode = 'create' | 'edit' | null

export type UseWorkspaceDialogsParams = {
  activeTaskId: string | null
  onProjectsReload: () => Promise<void>
  onTableTitleDisambiguation: (taskId: string) => void
  onTasksReload: () => Promise<void>
  projectsQueryData: Project[]
  resetSidebarToAllProjects: ProjectFilterState['resetSidebarToAllProjects']
  selectedProjectId: string
  selectedProjectIds: ProjectFilterState['selectedProjectIds']
  selectedTask: Task | null
  setActiveTaskId: Dispatch<SetStateAction<string | null>>
  setTaskDialogMode: Dispatch<SetStateAction<TaskDialogMode>>
  setToolbarProjectFilter: ProjectFilterState['setToolbarProjectFilter']
  taskDialogMode: TaskDialogMode
  taskMutations: ReturnType<typeof useTaskMutations>
}
