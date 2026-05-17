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
import type {
  Project,
  ProjectBoardStatus,
  ProjectType,
  Task,
  TaskStatus,
} from './api/types'
import { AppShell } from './components/layout/AppShell'
import { ProjectKanbanBoard } from './components/ProjectKanbanBoard'
import { TaskKanbanBoard } from './components/TaskKanbanBoard'
import { TaskSummaryTable } from './components/TaskSummaryTable'
import {
  useWorkspaceDialogs,
  type TaskDialogMode,
} from './components/WorkspaceDialogs'
import { deriveOpenTaskCountsByProjectId } from './features/projects/openTaskCounts'
import {
  sortTasks,
  type TaskSortKey,
  type TaskSortState,
} from './features/tasks/taskTableSort'
import { ProjectsPage } from './pages/ProjectsPage'
import {
  projectOrderByBoardStatus,
  sortProjectsForKanbanBoard,
  sortTasksForKanban,
  taskOrderByStatus,
} from './lib/kanbanSort'
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

const KANBAN_COLUMN_ID_PREFIX = 'kanban-column:'
const KANBAN_TASK_ID_PREFIX = 'kanban-task:'

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

const KANBAN_PROJECT_COLUMN_ID_PREFIX = 'kanban-project-column:'
const KANBAN_PROJECT_CARD_ID_PREFIX = 'kanban-project:'

type ProjectKanbanDropDetail = {
  board_status: ProjectBoardStatus
  kanban_order: number | null
  projectId: string
}

type ProjectKanbanDragColumnData = {
  board_status: ProjectBoardStatus
  type: 'column'
}

type ProjectKanbanDragProjectData = {
  board_status: ProjectBoardStatus
  projectId: string
  type: 'project'
}

function readProjectIdFromKanbanCardId(value: string): string | null {
  return value.startsWith(KANBAN_PROJECT_CARD_ID_PREFIX)
    ? value.slice(KANBAN_PROJECT_CARD_ID_PREFIX.length)
    : null
}

function readBoardStatusFromProjectKanbanColumnId(value: string): ProjectBoardStatus | null {
  if (!value.startsWith(KANBAN_PROJECT_COLUMN_ID_PREFIX)) {
    return null
  }

  const raw = value.slice(KANBAN_PROJECT_COLUMN_ID_PREFIX.length)
  if (
    raw === 'idea' ||
    raw === 'active' ||
    raw === 'paused' ||
    raw === 'shipped'
  ) {
    return raw
  }

  return null
}

function isProjectKanbanDragProjectData(value: unknown): value is ProjectKanbanDragProjectData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'type' in value &&
    value.type === 'project' &&
    'projectId' in value &&
    typeof value.projectId === 'string' &&
    'board_status' in value &&
    typeof value.board_status === 'string'
  )
}

function isProjectKanbanDragColumnData(value: unknown): value is ProjectKanbanDragColumnData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'type' in value &&
    value.type === 'column' &&
    'board_status' in value &&
    typeof value.board_status === 'string'
  )
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

function reorderProjectsForKanban(
  projects: Project[],
  projectId: string,
  nextBoardStatus: ProjectBoardStatus,
  nextKanbanOrder: number | null,
): Project[] {
  const movedProject = projects.find((project) => project.id === projectId)
  if (!movedProject) {
    return projects
  }

  const sourceStatus = movedProject.board_status
  const sourceColumn = sortProjectsForKanbanBoard(
    projects.filter((project) => project.board_status === sourceStatus && project.id !== projectId),
  )
  const targetColumn = sortProjectsForKanbanBoard(
    projects.filter(
      (project) => project.board_status === nextBoardStatus && project.id !== projectId,
    ),
  )

  const insertionIndex =
    nextKanbanOrder === null
      ? targetColumn.length
      : Math.max(0, Math.min(nextKanbanOrder, targetColumn.length))

  const nextFinished = nextBoardStatus === 'shipped' ? true : movedProject.finished

  targetColumn.splice(insertionIndex, 0, {
    ...movedProject,
    board_status: nextBoardStatus,
    kanban_order: insertionIndex,
    finished: nextFinished,
  })

  const rebalanceColumn = (columnProjects: Project[]): Map<string, number> =>
    new Map(columnProjects.map((project, index) => [project.id, index]))

  const sourceOrders = rebalanceColumn(sourceColumn)
  const targetOrders = rebalanceColumn(targetColumn)

  return projects.map((project) => {
    const targetOrder = targetOrders.get(project.id)
    if (targetOrder !== undefined) {
      const nextProject = targetColumn.find((candidate) => candidate.id === project.id) ?? project
      return {
        ...nextProject,
        kanban_order: targetOrder,
      }
    }

    const sourceOrder = sourceOrders.get(project.id)
    if (sourceOrder !== undefined) {
      return {
        ...project,
        kanban_order: sourceOrder,
      }
    }

    return project
  })
}

function projectKanbanComparableSnapshot(
  projects: Project[],
): Map<string, { board_status: ProjectBoardStatus; finished: boolean; kanban_order: number | null }> {
  return new Map(
    projects.map((project) => [
      project.id,
      {
        board_status: project.board_status,
        finished: project.finished,
        kanban_order: project.kanban_order,
      },
    ]),
  )
}

function hasProjectKanbanComparableChanged(previousProjects: Project[], nextProjects: Project[]): boolean {
  const previousSnapshot = projectKanbanComparableSnapshot(previousProjects)
  const nextSnapshot = projectKanbanComparableSnapshot(nextProjects)

  if (previousSnapshot.size !== nextSnapshot.size) {
    return true
  }

  for (const [projectId, nextValue] of nextSnapshot) {
    const previousValue = previousSnapshot.get(projectId)
    if (!previousValue) {
      return true
    }

    if (
      previousValue.board_status !== nextValue.board_status ||
      previousValue.kanban_order !== nextValue.kanban_order ||
      previousValue.finished !== nextValue.finished
    ) {
      return true
    }
  }

  return false
}

function getProjectKanbanDropDetailFromDragEvent(
  projects: Project[],
  event: DragEndEvent,
): ProjectKanbanDropDetail | null {
  if (!event.over) {
    return null
  }

  const activeProjectId = readProjectIdFromKanbanCardId(String(event.active.id))
  if (!activeProjectId) {
    return null
  }

  const activeProject = projects.find((project) => project.id === activeProjectId)
  if (!activeProject) {
    return null
  }

  const overData = event.over.data.current
  let nextBoardStatus: ProjectBoardStatus | null = null
  let nextKanbanOrder: number | null = null

  if (isProjectKanbanDragProjectData(overData)) {
    nextBoardStatus = overData.board_status
    const targetColumn = projectOrderByBoardStatus(projects, nextBoardStatus).filter(
      (project) => project.id !== activeProjectId,
    )
    const insertionIndex = targetColumn.findIndex((project) => project.id === overData.projectId)
    nextKanbanOrder = insertionIndex < 0 ? targetColumn.length : insertionIndex
  } else if (isProjectKanbanDragColumnData(overData)) {
    nextBoardStatus = overData.board_status
    nextKanbanOrder = projectOrderByBoardStatus(projects, nextBoardStatus).filter(
      (project) => project.id !== activeProjectId,
    ).length
  } else {
    nextBoardStatus = readBoardStatusFromProjectKanbanColumnId(String(event.over.id))
    nextKanbanOrder =
      nextBoardStatus === null
        ? null
        : projectOrderByBoardStatus(projects, nextBoardStatus).filter(
            (project) => project.id !== activeProjectId,
          ).length
  }

  if (nextBoardStatus === null) {
    return null
  }

  const nextProjects = reorderProjectsForKanban(
    projects,
    activeProjectId,
    nextBoardStatus,
    nextKanbanOrder,
  )

  if (!hasProjectKanbanComparableChanged(projects, nextProjects)) {
    return null
  }

  return {
    projectId: activeProjectId,
    board_status: nextBoardStatus,
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
  const displayTasks = optimisticTasks ?? visibleTasks
  const openTaskCountsByProjectId = useMemo(
    () => deriveOpenTaskCountsByProjectId(activeProjects, tasksQuery.data),
    [activeProjects, tasksQuery.data],
  )
  const previousFilterKeyRef = useRef(storedProjectIdsKey)
  const previousTasksDataRef = useRef(tasksQuery.data)
  const previousProjectsDataRef = useRef(projectsQuery.data)

  useEffect(() => {
    if (previousFilterKeyRef.current === storedProjectIdsKey) {
      return
    }
    previousFilterKeyRef.current = storedProjectIdsKey
    setOptimisticTasks((current) => (current !== null ? null : current))
    setKanbanMutationError((current) => (current !== null ? null : current))
    setOptimisticProjects((current) => (current !== null ? null : current))
    setProjectKanbanMutationError((current) => (current !== null ? null : current))
  }, [storedProjectIdsKey])

  useEffect(() => {
    if (previousTasksDataRef.current === tasksQuery.data) {
      return
    }
    previousTasksDataRef.current = tasksQuery.data
    setOptimisticTasks((current) => (current !== null ? null : current))
  }, [tasksQuery.data])

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
  const projectBoardInteractionDisabled =
    projectsQuery.isLoading || projectBoardLaneBusyCount > 0

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

  const handleProjectKanbanDrop = useCallback(
    async (detail: ProjectKanbanDropDetail): Promise<void> => {
      const nextProjects = reorderProjectsForKanban(
        displayProjectsForBoard,
        detail.projectId,
        detail.board_status,
        detail.kanban_order,
      )

      if (!hasProjectKanbanComparableChanged(displayProjectsForBoard, nextProjects)) {
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
    const detail = getProjectKanbanDropDetailFromDragEvent(displayProjectsForBoard, event)
    if (!detail) {
      return
    }

    void handleProjectKanbanDrop(detail)
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
