import type { DragEndEvent } from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { ApiError } from './api/client'
import {
  projectQueryKeys,
  updateProjectBoardStatus,
  useProjects,
  type UpdateProjectBoardStatusPayload,
} from './api/projects'
import { useTaskMutations, useTasks } from './api/tasks'
import type { Project, ProjectBoardStatus, ProjectType } from './api/types'
import { AppShell } from './components/layout/AppShell'
import { ProjectKanbanBoard } from './components/ProjectKanbanBoard'
import { TaskKanbanBoard } from './components/TaskKanbanBoard'
import { TaskSummaryTable } from './components/TaskSummaryTable'
import {
  useWorkspaceDialogs,
  type TaskDialogMode,
} from './components/WorkspaceDialogs'
import { deriveOpenTaskCountsByProjectId } from './features/projects/openTaskCounts'
import { useTaskKanbanController } from './features/tasks/useTaskKanbanController'
import {
  sortTasks,
  type TaskSortKey,
  type TaskSortState,
} from './features/tasks/taskTableSort'
import { ProjectsPage } from './pages/ProjectsPage'
import {
  getDropDetailFromDragEvent,
  hasKanbanComparableChanged,
  reorderKanbanItems,
  type DropDetail,
  type KanbanDndConfig,
} from './lib/kanbanDnd'
import { sortProjectsForKanbanBoard } from './lib/kanbanSort'
import {
  DEFAULT_PROJECT_FILTER,
  deriveToolbarProjectId,
  getSidebarSelectedProjectIds,
  useProjectFilterStore,
} from './stores/projectFilter'
import type { ProjectFilterState } from './stores/projectFilter'
import { useBoardDisplayOptionsStore, hydrateBoardDisplayOptionsFromStorage } from './stores/boardDisplayOptions'

type ProjectKanbanDropDetail = {
  board_status: ProjectBoardStatus
  kanban_order: number | null
  projectId: string
}

function isProjectKanbanDropDetail(value: unknown): value is ProjectKanbanDropDetail {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'projectId' in value &&
    typeof value.projectId === 'string' &&
    'board_status' in value &&
    typeof value.board_status === 'string' &&
    'kanban_order' in value &&
    (typeof value.kanban_order === 'number' || value.kanban_order === null)
  )
}
const projectKanbanDndConfig: KanbanDndConfig<Project, ProjectBoardStatus> = {
  columnIdPrefix: 'kanban-project-column:',
  cardIdPrefix: 'kanban-project:',
  getColumnKey: (project) => project.board_status,
  getOrder: (project) => project.kanban_order,
  setColumnAndOrder: (project, column, order) => ({
    ...project,
    board_status: column,
    kanban_order: order,
    finished: column === 'shipped' ? true : project.finished,
  }),
  orderItemsInColumn: (items, column) =>
    sortProjectsForKanbanBoard(
      items.filter((project) => project.board_status === column),
    ),
}

function toProjectKanbanDropDetail(
  detail: DropDetail<ProjectBoardStatus>,
): ProjectKanbanDropDetail {
  return {
    projectId: detail.itemId,
    board_status: detail.columnKey,
    kanban_order: detail.kanban_order,
  }
}

function projectKanbanComparable(project: Project): {
  board_status: ProjectBoardStatus
  finished: boolean
  kanban_order: number | null
} {
  return {
    board_status: project.board_status,
    kanban_order: project.kanban_order,
    finished: project.finished,
  }
}


function App() {
  const kanbanBoardRef = useRef<HTMLDivElement | null>(null)
  const projectsQuery = useProjects()
  const selectedProjectId = useProjectFilterStore(
    (state: ProjectFilterState): string => state.selectedProjectId,
  )
  const selectedProjectIds = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['selectedProjectIds'] =>
      state.selectedProjectIds,
  )
  const setToolbarProjectFilter = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['setToolbarProjectFilter'] =>
      state.setToolbarProjectFilter,
  )
  const resetSidebarToAllProjects = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['resetSidebarToAllProjects'] =>
      state.resetSidebarToAllProjects,
  )
  const [locallyArchivedProjectIds, setLocallyArchivedProjectIds] = useState<string[]>([])
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskSort, setTaskSort] = useState<TaskSortState>(null)
  const [tableTitleDisambiguationTaskIds, setTableTitleDisambiguationTaskIds] = useState<
    string[]
  >([])
  const [taskWorkspacePrimed, setTaskWorkspacePrimed] = useState(false)
  const [hasEvaluatedTaskWorkspaceBootstrap, setHasEvaluatedTaskWorkspaceBootstrap] =
    useState(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [boardViewTab, setBoardViewTab] = useState<'projects' | 'tasks'>('tasks')
  const [projectKanbanTypeFilter, setProjectKanbanTypeFilter] = useState<
    'all' | ProjectType
  >('all')
  const [optimisticProjects, setOptimisticProjects] = useState<Project[] | null>(null)
  const [projectKanbanMutationError, setProjectKanbanMutationError] = useState<
    string | null
  >(null)
  const queryClient = useQueryClient()
  const updateProjectBoardStatusMutation = useMutation({
    mutationFn: (vars: { payload: UpdateProjectBoardStatusPayload; projectId: string }) =>
      updateProjectBoardStatus(vars.projectId, vars.payload),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: projectQueryKeys.board() }),
      ])
    },
  })
  const projectBoardQueueTailRef = useRef(Promise.resolve())
  const [projectBoardLaneBusyCount, setProjectBoardLaneBusyCount] = useState(0)
  const boardDisplayOptions = useBoardDisplayOptionsStore(
    useShallow((state) => ({
      showActualHours: state.showActualHours,
      showDueDate: state.showDueDate,
      showPriority: state.showPriority,
      showProjectName: state.showProjectName,
    })),
  )

  const activeProjects = projectsQuery.data.filter(
    (project) =>
      project.status === 'active' && !locallyArchivedProjectIds.includes(project.id),
  )
  const activeProjectIds = activeProjects.map((project) => project.id)
  const activeProjectIdsKey = activeProjectIds.join('|')
  const storedProjectIdsKey = selectedProjectIds?.join('|') ?? ''
  const sidebarSelectedProjectIds = getSidebarSelectedProjectIds(
    selectedProjectIds,
    activeProjectIds,
  )
  const hasSidebarProjectSelection = sidebarSelectedProjectIds.length > 0
  const projectsById = activeProjects.reduce<Record<string, Project>>((projectMap, project) => {
    projectMap[project.id] = project
    return projectMap
  }, {})
  const sidebarScopedBoardProjects = useMemo(
    () =>
      activeProjects.filter(
        (project) =>
          sidebarSelectedProjectIds.includes(project.id) && !project.archived_by_venture,
      ),
    [activeProjects, sidebarSelectedProjectIds],
  )
  const typeFilteredBoardProjects = useMemo(() => {
    if (projectKanbanTypeFilter === 'all') {
      return sidebarScopedBoardProjects
    }

    return sidebarScopedBoardProjects.filter(
      (project) => project.project_type === projectKanbanTypeFilter,
    )
  }, [projectKanbanTypeFilter, sidebarScopedBoardProjects])
  const filterMatchedProjectKanban =
    projectKanbanTypeFilter === 'all'
      ? sidebarScopedBoardProjects.length > 0
      : typeFilteredBoardProjects.length > 0
  const displayProjectsForBoard = optimisticProjects ?? typeFilteredBoardProjects
  const taskWorkspaceEnabled = taskWorkspacePrimed || taskDialogMode !== null
  const tasksQuery = useTasks({}, taskWorkspaceEnabled)
  const visibleTasks = tasksQuery.data
    .filter((task) => task.status !== 'archived')
    .filter((task) => task.project_id in projectsById)
    .filter((task) => sidebarSelectedProjectIds.includes(task.project_id))
  const openTaskCountsByProjectId = useMemo(
    () => deriveOpenTaskCountsByProjectId(activeProjects, tasksQuery.data),
    [activeProjects, tasksQuery.data],
  )
  const previousFilterKeyRef = useRef(storedProjectIdsKey)
  const previousProjectsDataRef = useRef(projectsQuery.data)

  useEffect(() => {
    if (previousFilterKeyRef.current === storedProjectIdsKey) {
      return
    }
    previousFilterKeyRef.current = storedProjectIdsKey
    setOptimisticProjects((current) => (current !== null ? null : current))
    setProjectKanbanMutationError((current) => (current !== null ? null : current))
  }, [storedProjectIdsKey])

  useEffect(() => {
    if (previousProjectsDataRef.current === projectsQuery.data) {
      return
    }
    previousProjectsDataRef.current = projectsQuery.data
    setOptimisticProjects((current) => (current !== null ? null : current))
  }, [projectsQuery.data])

  useEffect(() => {
    setOptimisticProjects((current) => (current !== null ? null : current))
    setProjectKanbanMutationError((current) => (current !== null ? null : current))
  }, [projectKanbanTypeFilter])

  const selectedTask = tasksQuery.data.find((task) => task.id === activeTaskId) ?? null
  const taskMutations = useTaskMutations(async () => {
    await tasksQuery.reload()
  })
  const {
    handleProjectEdit,
    openCreateProjectDialog,
    openCreateTaskDialog,
    openEditTaskDialog,
    workspaceDialogs,
  } = useWorkspaceDialogs({
    activeProjectIds,
    activeProjects,
    activeTaskId,
    onProjectsReload: async () => {
      await projectsQuery.reload()
    },
    onTableTitleDisambiguation: (taskId) => {
      setTableTitleDisambiguationTaskIds((currentIds) =>
        currentIds.includes(taskId) ? currentIds : [...currentIds, taskId],
      )
    },
    onTasksReload: async () => {
      await tasksQuery.reload()
    },
    projectsQueryData: projectsQuery.data,
    resetSidebarToAllProjects,
    selectedProjectId,
    selectedProjectIds,
    selectedTask,
    setActiveTaskId,
    setLocallyArchivedProjectIds,
    setTaskDialogMode,
    setToolbarProjectFilter,
    sidebarSelectedProjectIds,
    taskDialogMode,
    taskMutations,
  })
  const boardInteractionDisabled = tasksQuery.isLoading || taskMutations.isSaving
  const projectBoardInteractionDisabled =
    projectsQuery.isLoading || projectBoardLaneBusyCount > 0

  const {
    displayTasks,
    handleKanbanDragEnd,
    kanbanMutationError,
  } = useTaskKanbanController({
    boardInteractionDisabled,
    boardRef: kanbanBoardRef,
    storedProjectIdsKey,
    taskMutations,
    tasksData: tasksQuery.data,
    visibleTasks,
  })

  const visibleDisambiguationTaskIds = tableTitleDisambiguationTaskIds.filter((taskId) =>
    displayTasks.some((task) => task.id === taskId),
  )
  const sortedTasks = sortTasks(displayTasks, projectsById, taskSort)

  const enqueueProjectBoardLane = useCallback((task: () => Promise<void>) => {
    setProjectBoardLaneBusyCount((count) => count + 1)

    const wrapped = async (): Promise<void> => {
      try {
        await task()
      } finally {
        setProjectBoardLaneBusyCount((count) => count - 1)
      }
    }

    const executed = projectBoardQueueTailRef.current.then(wrapped)
    projectBoardQueueTailRef.current = executed.catch(() => undefined)
    return executed
  }, [])

  useEffect(() => {
    hydrateBoardDisplayOptionsFromStorage()
  }, [])

  useEffect(() => {
    const projectIds =
      activeProjectIdsKey.length > 0 ? activeProjectIdsKey.split('|') : []
    if (projectIds.length === 0) {
      return
    }

    const sidebarIds = getSidebarSelectedProjectIds(selectedProjectIds, projectIds)
    const toolbarProjectId = deriveToolbarProjectId(sidebarIds, projectIds)

    if (selectedProjectId !== toolbarProjectId) {
      useProjectFilterStore.setState({ selectedProjectId: toolbarProjectId })
    }
  }, [activeProjectIdsKey, selectedProjectId, storedProjectIdsKey, selectedProjectIds])

  useEffect(() => {
    const projectIds =
      activeProjectIdsKey.length > 0 ? activeProjectIdsKey.split('|') : []
    if (projectIds.length === 0) {
      return
    }

    if (
      selectedProjectId !== DEFAULT_PROJECT_FILTER &&
      !projectIds.includes(selectedProjectId)
    ) {
      setToolbarProjectFilter(DEFAULT_PROJECT_FILTER, projectIds)
    }
  }, [activeProjectIdsKey, selectedProjectId, setToolbarProjectFilter])

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

  const handleTaskSort = (key: TaskSortKey): void => {
    setTaskSort((currentSort) => {
      if (!currentSort || currentSort.key !== key) {
        return {
          key,
          direction: 'asc',
        }
      }

      return {
        key,
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
      }
    })
  }

  const handleProjectKanbanDrop = useCallback(
    async (detail: ProjectKanbanDropDetail): Promise<void> => {
      const nextProjects = reorderKanbanItems(
        displayProjectsForBoard,
        detail.projectId,
        detail.board_status,
        detail.kanban_order,
        projectKanbanDndConfig,
      )

      if (
        !hasKanbanComparableChanged(
          displayProjectsForBoard,
          nextProjects,
          projectKanbanComparable,
        )
      ) {
        return
      }

      setProjectKanbanMutationError(null)
      setOptimisticProjects(nextProjects)

      const payload: UpdateProjectBoardStatusPayload = {
        board_status: detail.board_status,
        kanban_order:
          detail.kanban_order === null ? undefined : detail.kanban_order,
      }

      if (detail.board_status === 'shipped') {
        payload.finished = true
      }

      await enqueueProjectBoardLane(async () => {
        try {
          await updateProjectBoardStatusMutation.mutateAsync({
            payload,
            projectId: detail.projectId,
          })
          setOptimisticProjects(null)
        } catch (caughtError) {
          setOptimisticProjects(null)

          if (caughtError instanceof ApiError) {
            setProjectKanbanMutationError(
              caughtError.formError ?? caughtError.message,
            )
            return
          }

          setProjectKanbanMutationError('Unable to persist project board changes.')
        }
      })
    },
    [
      displayProjectsForBoard,
      enqueueProjectBoardLane,
      updateProjectBoardStatusMutation,
    ],
  )

  const handleProjectKanbanDragEnd = (event: DragEndEvent): void => {
    const detail = getDropDetailFromDragEvent(
      displayProjectsForBoard,
      event,
      projectKanbanDndConfig,
    )
    if (!detail) {
      return
    }

    void handleProjectKanbanDrop(toProjectKanbanDropDetail(detail))
  }

  useEffect(() => {
    const kanbanBoard = kanbanBoardRef.current
    if (!kanbanBoard) {
      return
    }

    const handleProjectKanbanTestDrop = (event: Event): void => {
      if (!(event instanceof CustomEvent) || !isProjectKanbanDropDetail(event.detail)) {
        return
      }

      void handleProjectKanbanDrop(event.detail)
    }

    kanbanBoard.addEventListener('project-kanban:drop', handleProjectKanbanTestDrop)
    return () => {
      kanbanBoard.removeEventListener('project-kanban:drop', handleProjectKanbanTestDrop)
    }
  }, [handleProjectKanbanDrop])

  const projectFilterLabel =
    sidebarSelectedProjectIds.length === 0
      ? 'No projects'
      : sidebarSelectedProjectIds.length === activeProjects.length
        ? 'All projects'
        : sidebarSelectedProjectIds.length === 1
          ? (projectsById[sidebarSelectedProjectIds[0]]?.name ?? '1 project')
          : `${sidebarSelectedProjectIds.length} projects`
  const tasksAreBlocked = activeProjects.length === 0
  const isSingleProjectView = selectedProjectId !== DEFAULT_PROJECT_FILTER
  const showProjectNameOnCard =
    !isSingleProjectView || boardDisplayOptions.showProjectName

  if (!workspaceReady) {
    return (
      <AppShell
        activeProjects={[]}
        onCreateProject={() => undefined}
        onEditProject={() => undefined}
        onEditTask={() => undefined}
        projectsError={null}
        projectsLoading
        reloadProjects={() => Promise.resolve([])}
      >
        <section className="workspace-panel">
          <p className="muted-copy">Loading workspace…</p>
        </section>
      </AppShell>
    )
  }

  const kanbanSection =
    boardViewTab === 'tasks' ? (
      <TaskKanbanBoard
        boardDisplayOptions={boardDisplayOptions}
        boardInteractionDisabled={boardInteractionDisabled}
        boardRef={kanbanBoardRef}
        displayTasks={displayTasks}
        hasSidebarProjectSelection={hasSidebarProjectSelection}
        kanbanMutationError={kanbanMutationError}
        onDragEnd={handleKanbanDragEnd}
        onOpenTask={openEditTaskDialog}
        projectsById={projectsById}
        showProjectNameOnCard={showProjectNameOnCard}
        tasksError={tasksQuery.error}
        tasksLoading={tasksQuery.isLoading}
      />
    ) : (
      <ProjectKanbanBoard
        boardInteractionDisabled={projectBoardInteractionDisabled}
        boardRef={kanbanBoardRef}
        displayProjects={displayProjectsForBoard}
        filterMatchedProjects={filterMatchedProjectKanban}
        hasSidebarProjectSelection={hasSidebarProjectSelection}
        kanbanMutationError={projectKanbanMutationError}
        onDragEnd={handleProjectKanbanDragEnd}
        onOpenProject={handleProjectEdit}
        openTaskCounts={openTaskCountsByProjectId}
        projectsError={projectsQuery.error}
        projectsLoading={projectsQuery.isLoading}
      />
    )

  const tableSection = (
    <TaskSummaryTable
      activeProjects={activeProjects}
      hasSidebarProjectSelection={hasSidebarProjectSelection}
      onOpenEditTask={openEditTaskDialog}
      onSort={handleTaskSort}
      projectsById={projectsById}
      selectedProjectId={selectedProjectId}
      sidebarSelectedProjectIds={sidebarSelectedProjectIds}
      sortedTasks={sortedTasks}
      tableTitleDisambiguationTaskIds={visibleDisambiguationTaskIds}
      taskSort={taskSort}
      tasksError={tasksQuery.error}
      tasksLoading={tasksQuery.isLoading}
    />
  )

  return (
    <AppShell
      activeProjects={activeProjects}
      onCreateProject={(ventureId) => openCreateProjectDialog(ventureId)}
      onEditProject={handleProjectEdit}
      onEditTask={openEditTaskDialog}
      projectsError={projectsQuery.error}
      projectsLoading={projectsQuery.isLoading}
      reloadProjects={projectsQuery.reload}
    >
      <ProjectsPage
        activeProjects={activeProjects}
        boardViewTab={boardViewTab}
        kanbanSection={kanbanSection}
        onBoardViewTabChange={setBoardViewTab}
        onOpenCreateTask={openCreateTaskDialog}
        onProjectKanbanTypeFilterChange={setProjectKanbanTypeFilter}
        projectFilterLabel={projectFilterLabel}
        projectKanbanTypeFilter={projectKanbanTypeFilter}
        selectedProjectId={selectedProjectId}
        setToolbarProjectFilter={(projectId) => {
          setToolbarProjectFilter(projectId, activeProjectIds)
        }}
        tableSection={tableSection}
        tasksAreBlocked={tasksAreBlocked}
      />

      {workspaceDialogs}
    </AppShell>
  )
}

export default App
