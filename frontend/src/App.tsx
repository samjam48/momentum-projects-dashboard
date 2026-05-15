import type { DragEndEvent } from '@dnd-kit/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { ApiError } from './api/client'
import { useProjects } from './api/projects'
import { useTaskMutations, useTasks } from './api/tasks'
import type { Project, Task, TaskPriority, TaskStatus } from './api/types'
import { AppShell } from './components/layout/AppShell'
import { TaskKanbanBoard } from './components/TaskKanbanBoard'
import { TaskSummaryTable, type TaskSortKey, type TaskSortState } from './components/TaskSummaryTable'
import {
  useWorkspaceDialogs,
  type TaskDialogMode,
} from './components/WorkspaceDialogs'
import { ProjectsPage } from './pages/ProjectsPage'
import { sortTasksForKanban, taskOrderByStatus } from './lib/kanbanSort'
import {
  DEFAULT_PROJECT_FILTER,
  deriveToolbarProjectId,
  getSidebarSelectedProjectIds,
  useProjectFilterStore,
} from './stores/projectFilter'
import type { ProjectFilterState } from './stores/projectFilter'
import { useBoardDisplayOptionsStore, hydrateBoardDisplayOptionsFromStorage } from './stores/boardDisplayOptions'

type KanbanDropDetail = {
  kanban_order: number | null
  status: TaskStatus
  taskId: string
}

type KanbanDragColumnData = {
  status: TaskStatus
  type: 'column'
}

type KanbanDragTaskData = {
  status: TaskStatus
  taskId: string
  type: 'task'
}

const PRIORITY_SORT_WEIGHT: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
}

const KANBAN_COLUMN_ID_PREFIX = 'kanban-column:'
const KANBAN_TASK_ID_PREFIX = 'kanban-task:'

function compareTasks(
  leftTask: Task,
  rightTask: Task,
  projectsById: Record<string, Project>,
  sortState: TaskSortState,
  leftIndex: number,
  rightIndex: number,
): number {
  if (!sortState) {
    return leftIndex - rightIndex
  }

  const directionWeight = sortState.direction === 'asc' ? 1 : -1

  if (sortState.key === 'project_name') {
    const leftName = projectsById[leftTask.project_id]?.name ?? ''
    const rightName = projectsById[rightTask.project_id]?.name ?? ''
    const nameComparison = leftName.localeCompare(rightName, undefined, {
      sensitivity: 'base',
    })

    if (nameComparison !== 0) {
      return nameComparison * directionWeight
    }
  }

  if (sortState.key === 'priority') {
    const priorityComparison =
      PRIORITY_SORT_WEIGHT[leftTask.priority] -
      PRIORITY_SORT_WEIGHT[rightTask.priority]

    if (priorityComparison !== 0) {
      return priorityComparison * directionWeight
    }
  }

  if (sortState.key === 'target_date') {
    const leftDate = leftTask.target_date
    const rightDate = rightTask.target_date

    if (leftDate === null && rightDate !== null) {
      return 1
    }

    if (leftDate !== null && rightDate === null) {
      return -1
    }

    if (leftDate !== null && rightDate !== null) {
      const dateComparison = leftDate.localeCompare(rightDate)
      if (dateComparison !== 0) {
        return dateComparison * directionWeight
      }
    }
  }

  return leftIndex - rightIndex
}

function sortTasks(
  tasks: Task[],
  projectsById: Record<string, Project>,
  sortState: TaskSortState,
): Task[] {
  if (!sortState) {
    return tasks
  }

  const indexedTasks = tasks.map((task, index) => ({ index, task }))

  return indexedTasks
    .sort((leftEntry, rightEntry) =>
      compareTasks(
        leftEntry.task,
        rightEntry.task,
        projectsById,
        sortState,
        leftEntry.index,
        rightEntry.index,
      ),
    )
    .map((entry) => entry.task)
}

function reorderTasksForKanban(
  tasks: Task[],
  taskId: string,
  nextStatus: TaskStatus,
  nextKanbanOrder: number | null,
): Task[] {
  const movedTask = tasks.find((task) => task.id === taskId)
  if (!movedTask) {
    return tasks
  }

  const sourceStatus = movedTask.status
  const sourceColumn = sortTasksForKanban(
    tasks.filter((task) => task.status === sourceStatus && task.id !== taskId),
  )
  const targetColumn = sortTasksForKanban(
    tasks.filter((task) => task.status === nextStatus && task.id !== taskId),
  )
  const insertionIndex =
    nextKanbanOrder === null
      ? targetColumn.length
      : Math.max(0, Math.min(nextKanbanOrder, targetColumn.length))

  targetColumn.splice(insertionIndex, 0, {
    ...movedTask,
    status: nextStatus,
    kanban_order: insertionIndex,
    completed_date: nextStatus === 'done' ? movedTask.completed_date : null,
  })

  const rebalanceColumn = (columnTasks: Task[]): Map<string, number> =>
    new Map(columnTasks.map((task, index) => [task.id, index]))

  const sourceOrders = rebalanceColumn(sourceColumn)
  const targetOrders = rebalanceColumn(targetColumn)

  return tasks.map((task) => {
    const targetOrder = targetOrders.get(task.id)
    if (targetOrder !== undefined) {
      const nextTask = targetColumn.find((candidate) => candidate.id === task.id) ?? task
      return {
        ...nextTask,
        kanban_order: targetOrder,
      }
    }

    const sourceOrder = sourceOrders.get(task.id)
    if (sourceOrder !== undefined) {
      return {
        ...task,
        kanban_order: sourceOrder,
      }
    }

    return task
  })
}

function hasKanbanStateChanged(previousTasks: Task[], nextTasks: Task[]): boolean {
  if (previousTasks.length !== nextTasks.length) {
    return true
  }

  return previousTasks.some((task, index) => {
    const nextTask = nextTasks[index]
    return (
      task.id !== nextTask.id ||
      task.status !== nextTask.status ||
      task.kanban_order !== nextTask.kanban_order ||
      task.completed_date !== nextTask.completed_date
    )
  })
}

function readTaskIdFromKanbanId(value: string): string | null {
  return value.startsWith(KANBAN_TASK_ID_PREFIX)
    ? value.slice(KANBAN_TASK_ID_PREFIX.length)
    : null
}

function readStatusFromKanbanId(value: string): TaskStatus | null {
  return value.startsWith(KANBAN_COLUMN_ID_PREFIX)
    ? (value.slice(KANBAN_COLUMN_ID_PREFIX.length) as TaskStatus)
    : null
}

function isKanbanDragTaskData(value: unknown): value is KanbanDragTaskData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'type' in value &&
    value.type === 'task' &&
    'taskId' in value &&
    typeof value.taskId === 'string' &&
    'status' in value &&
    typeof value.status === 'string'
  )
}

function isKanbanDragColumnData(value: unknown): value is KanbanDragColumnData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'type' in value &&
    value.type === 'column' &&
    'status' in value &&
    typeof value.status === 'string'
  )
}

function isKanbanDropDetail(value: unknown): value is KanbanDropDetail {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'taskId' in value &&
    typeof value.taskId === 'string' &&
    'status' in value &&
    typeof value.status === 'string' &&
    'kanban_order' in value &&
    (typeof value.kanban_order === 'number' || value.kanban_order === null)
  )
}

function getKanbanDropDetailFromDragEvent(
  tasks: Task[],
  event: DragEndEvent,
): KanbanDropDetail | null {
  if (!event.over) {
    return null
  }

  const activeTaskId = readTaskIdFromKanbanId(String(event.active.id))
  if (!activeTaskId) {
    return null
  }

  const activeTask = tasks.find((task) => task.id === activeTaskId)
  if (!activeTask) {
    return null
  }

  const overData = event.over.data.current
  let nextStatus: TaskStatus | null = null
  let nextKanbanOrder: number | null = null

  if (isKanbanDragTaskData(overData)) {
    nextStatus = overData.status
    const targetColumn = taskOrderByStatus(tasks, nextStatus).filter(
      (task) => task.id !== activeTaskId,
    )
    const insertionIndex = targetColumn.findIndex((task) => task.id === overData.taskId)
    nextKanbanOrder = insertionIndex < 0 ? targetColumn.length : insertionIndex
  } else if (isKanbanDragColumnData(overData)) {
    nextStatus = overData.status
    nextKanbanOrder = taskOrderByStatus(tasks, nextStatus).filter(
      (task) => task.id !== activeTaskId,
    ).length
  } else {
    nextStatus = readStatusFromKanbanId(String(event.over.id))
    nextKanbanOrder =
      nextStatus === null
        ? null
        : taskOrderByStatus(tasks, nextStatus).filter((task) => task.id !== activeTaskId)
            .length
  }

  if (nextStatus === null) {
    return null
  }

  const nextTasks = reorderTasksForKanban(tasks, activeTaskId, nextStatus, nextKanbanOrder)
  if (!hasKanbanStateChanged(tasks, nextTasks)) {
    return null
  }

  return {
    taskId: activeTaskId,
    status: nextStatus,
    kanban_order: nextKanbanOrder,
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
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null)
  const [kanbanMutationError, setKanbanMutationError] = useState<string | null>(null)
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
  const taskWorkspaceEnabled = taskWorkspacePrimed || taskDialogMode !== null
  const tasksQuery = useTasks({}, taskWorkspaceEnabled)
  const visibleTasks = tasksQuery.data
    .filter((task) => task.status !== 'archived')
    .filter((task) => task.project_id in projectsById)
    .filter((task) => sidebarSelectedProjectIds.includes(task.project_id))
  const displayTasks = optimisticTasks ?? visibleTasks
  const previousFilterKeyRef = useRef(storedProjectIdsKey)
  const previousTasksDataRef = useRef(tasksQuery.data)

  if (previousFilterKeyRef.current !== storedProjectIdsKey) {
    previousFilterKeyRef.current = storedProjectIdsKey
    if (optimisticTasks !== null) {
      setOptimisticTasks(null)
    }
    if (kanbanMutationError !== null) {
      setKanbanMutationError(null)
    }
  }

  if (previousTasksDataRef.current !== tasksQuery.data) {
    previousTasksDataRef.current = tasksQuery.data
    if (optimisticTasks !== null) {
      setOptimisticTasks(null)
    }
  }

  const visibleDisambiguationTaskIds = tableTitleDisambiguationTaskIds.filter((taskId) =>
    displayTasks.some((task) => task.id === taskId),
  )
  const sortedTasks = sortTasks(displayTasks, projectsById, taskSort)
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

  const handleKanbanDrop = useCallback(
    async (detail: KanbanDropDetail): Promise<void> => {
      if (boardInteractionDisabled) {
        return
      }

      const nextTasks = reorderTasksForKanban(
        displayTasks,
        detail.taskId,
        detail.status,
        detail.kanban_order,
      )
      if (!hasKanbanStateChanged(displayTasks, nextTasks)) {
        return
      }

      setKanbanMutationError(null)
      taskMutations.resetError()
      setOptimisticTasks(nextTasks)

      try {
        await taskMutations.updateStatus(detail.taskId, {
          status: detail.status,
          kanban_order: detail.kanban_order,
        })
        setOptimisticTasks(null)
      } catch (caughtError) {
        setOptimisticTasks(null)

        if (caughtError instanceof ApiError) {
          setKanbanMutationError(caughtError.formError ?? caughtError.message)
          return
        }

        setKanbanMutationError('Unable to update task status.')
      }
    },
    [boardInteractionDisabled, displayTasks, taskMutations],
  )

  const handleKanbanDragEnd = (event: DragEndEvent): void => {
    const detail = getKanbanDropDetailFromDragEvent(displayTasks, event)
    if (!detail) {
      return
    }

    void handleKanbanDrop(detail)
  }

  useEffect(() => {
    const kanbanBoard = kanbanBoardRef.current
    if (!kanbanBoard) {
      return
    }

    const handleTestDrop = (event: Event): void => {
      if (!(event instanceof CustomEvent) || !isKanbanDropDetail(event.detail)) {
        return
      }

      void handleKanbanDrop(event.detail)
    }

    kanbanBoard.addEventListener('kanban:drop', handleTestDrop)
    return () => {
      kanbanBoard.removeEventListener('kanban:drop', handleTestDrop)
    }
  }, [handleKanbanDrop])

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
        reloadProjects={async () => Promise.resolve()}
      >
        <section className="workspace-panel">
          <p className="muted-copy">Loading workspace…</p>
        </section>
      </AppShell>
    )
  }

  const kanbanSection = (
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
      onCreateProject={openCreateProjectDialog}
      onEditProject={handleProjectEdit}
      onEditTask={openEditTaskDialog}
      projectsError={projectsQuery.error}
      projectsLoading={projectsQuery.isLoading}
      reloadProjects={async () => {
        await projectsQuery.reload()
      }}
    >
      <ProjectsPage
        activeProjects={activeProjects}
        kanbanSection={kanbanSection}
        onOpenCreateProject={openCreateProjectDialog}
        onOpenCreateTask={openCreateTaskDialog}
        projectFilterLabel={projectFilterLabel}
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
