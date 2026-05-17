import { useEffect, useState } from 'react'

import { useProjects } from '../../api/projects'
import { useTasks } from '../../api/tasks'
import type { TaskDialogMode } from '../../components/WorkspaceDialogs'

type UseWorkspaceBootstrapArgs = {
  taskDialogMode: TaskDialogMode
}

type UseWorkspaceBootstrapResult = {
  projectsQuery: ReturnType<typeof useProjects>
  tasksQuery: ReturnType<typeof useTasks>
  workspaceReady: boolean
}

/**
 * Cold-load task priming, initial project evaluation, and the workspace ready gate
 * (loading shell vs full workspace).
 */
export function useWorkspaceBootstrap({
  taskDialogMode,
}: UseWorkspaceBootstrapArgs): UseWorkspaceBootstrapResult {
  const projectsQuery = useProjects()
  const [taskWorkspacePrimed, setTaskWorkspacePrimed] = useState(false)
  const [hasEvaluatedTaskWorkspaceBootstrap, setHasEvaluatedTaskWorkspaceBootstrap] =
    useState(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)

  const taskWorkspaceEnabled = taskWorkspacePrimed || taskDialogMode !== null
  const tasksQuery = useTasks({}, taskWorkspaceEnabled)

  useEffect(() => {
    if (!hasEvaluatedTaskWorkspaceBootstrap && !projectsQuery.isLoading) {
      setTaskWorkspacePrimed(projectsQuery.data.length > 0)
      setHasEvaluatedTaskWorkspaceBootstrap(true)
    }
  }, [
    hasEvaluatedTaskWorkspaceBootstrap,
    projectsQuery.data.length,
    projectsQuery.isLoading,
  ])

  useEffect(() => {
    if (
      !workspaceReady &&
      hasEvaluatedTaskWorkspaceBootstrap &&
      (!taskWorkspacePrimed || !tasksQuery.isLoading)
    ) {
      setWorkspaceReady(true)
    }
  }, [
    hasEvaluatedTaskWorkspaceBootstrap,
    taskWorkspacePrimed,
    tasksQuery.isLoading,
    workspaceReady,
  ])

  return { projectsQuery, tasksQuery, workspaceReady }
}
