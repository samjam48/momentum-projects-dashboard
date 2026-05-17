import { useMemo } from 'react'
import type { ReactElement } from 'react'

import type { Project } from '../api/types'
import { useProjectDialog } from '../features/projects/useProjectDialog'
import { useTaskDialog } from '../features/tasks/useTaskDialog'
import type { UseWorkspaceDialogsParams } from '../features/workspace/workspaceDialogTypes'
import { getSidebarSelectedProjectIds } from '../stores/projectFilter'

export type { TaskDialogMode, UseWorkspaceDialogsParams } from '../features/workspace/workspaceDialogTypes'

export function useWorkspaceDialogs(params: UseWorkspaceDialogsParams): {
  activeProjectIds: string[]
  activeProjects: Project[]
  handleProjectEdit: ReturnType<typeof useProjectDialog>['handleProjectEdit']
  openCreateProjectDialog: ReturnType<typeof useProjectDialog>['openCreateProjectDialog']
  openCreateTaskDialog: ReturnType<typeof useTaskDialog>['openCreateTaskDialog']
  openEditTaskDialog: ReturnType<typeof useTaskDialog>['openEditTaskDialog']
  workspaceDialogs: ReactElement
} {
  const {
    activeTaskId,
    onProjectsReload,
    onTableTitleDisambiguation,
    onTasksReload,
    projectsQueryData,
    resetSidebarToAllProjects,
    selectedProjectId,
    selectedProjectIds,
    selectedTask,
    setActiveTaskId,
    setTaskDialogMode,
    setToolbarProjectFilter,
    taskDialogMode,
    taskMutations,
  } = params

  const projectHandles = useProjectDialog({
    onProjectsReload,
    onTasksReload,
    projectsQueryData,
    resetSidebarToAllProjects,
    selectedProjectId,
    selectedProjectIds,
    setToolbarProjectFilter,
  })

  const activeProjects = useMemo(
    () =>
      projectsQueryData.filter(
        (project) =>
          project.status === 'active' &&
          !projectHandles.locallyArchivedProjectIds.includes(project.id),
      ),
    [projectsQueryData, projectHandles.locallyArchivedProjectIds],
  )

  const activeProjectIds = useMemo(
    () => activeProjects.map((project) => project.id),
    [activeProjects],
  )

  const sidebarSelectedProjectIds = getSidebarSelectedProjectIds(
    selectedProjectIds,
    activeProjectIds,
  )

  const taskHandles = useTaskDialog({
    activeProjects,
    activeTaskId,
    onTableTitleDisambiguation,
    onTasksReload,
    selectedTask,
    setActiveTaskId,
    setTaskDialogMode,
    sidebarSelectedProjectIds,
    taskDialogMode,
    taskMutations,
  })

  return {
    activeProjectIds,
    activeProjects,
    handleProjectEdit: projectHandles.handleProjectEdit,
    openCreateProjectDialog: projectHandles.openCreateProjectDialog,
    openCreateTaskDialog: taskHandles.openCreateTaskDialog,
    openEditTaskDialog: taskHandles.openEditTaskDialog,
    workspaceDialogs: (
      <>
        {projectHandles.projectDialog}
        {taskHandles.taskDialog}
      </>
    ),
  }
}
