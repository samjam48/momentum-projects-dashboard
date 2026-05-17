import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useTaskMutations } from './api/tasks'
import type { Project } from './api/types'
import { AppShell } from './components/layout/AppShell'
import { ProjectKanbanBoard } from './components/ProjectKanbanBoard'
import { TaskKanbanBoard } from './components/TaskKanbanBoard'
import { TaskSummaryTable } from './components/TaskSummaryTable'
import {
  useWorkspaceDialogs,
  type TaskDialogMode,
} from './components/WorkspaceDialogs'
import { deriveOpenTaskCountsByProjectId } from './features/projects/openTaskCounts'
import { useProjectKanbanController } from './features/projects/useProjectKanbanController'
import { useTaskKanbanController } from './features/tasks/useTaskKanbanController'
import {
  sortTasks,
  type TaskSortKey,
  type TaskSortState,
} from './features/tasks/taskTableSort'
import { ProjectsPage } from './pages/ProjectsPage'
import {
  DEFAULT_PROJECT_FILTER,
  getSidebarSelectedProjectIds,
  useProjectFilterStore,
} from './stores/projectFilter'
import type { ProjectFilterState } from './stores/projectFilter'
import { useBoardDisplayOptionsStore, hydrateBoardDisplayOptionsFromStorage } from './stores/boardDisplayOptions'
import { useBoardViewTab } from './features/workspace/useBoardViewTab'
import { useProjectFilterSync } from './features/workspace/useProjectFilterSync'
import { useWorkspaceBootstrap } from './features/workspace/useWorkspaceBootstrap'

function App() {
  const kanbanBoardRef = useRef<HTMLDivElement | null>(null)
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode>(null)
  const { projectsQuery, tasksQuery, workspaceReady } = useWorkspaceBootstrap({
    taskDialogMode,
  })
  const {
    boardViewTab,
    projectKanbanTypeFilter,
    setBoardViewTab,
    setProjectKanbanTypeFilter,
  } = useBoardViewTab()
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskSort, setTaskSort] = useState<TaskSortState>(null)
  const [tableTitleDisambiguationTaskIds, setTableTitleDisambiguationTaskIds] = useState<
    string[]
  >([])
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
  useProjectFilterSync({ activeProjectIds })
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
  const {
    displayProjectsForBoard,
    filterMatchedProjectKanban,
    handleProjectKanbanDragEnd,
    projectBoardInteractionDisabled,
    projectKanbanMutationError,
  } = useProjectKanbanController({
    boardRef: kanbanBoardRef,
    projectKanbanTypeFilter,
    projectsQuery,
    sidebarScopedBoardProjects,
    storedProjectIdsKey,
  })
  const visibleTasks = tasksQuery.data
    .filter((task) => task.status !== 'archived')
    .filter((task) => task.project_id in projectsById)
    .filter((task) => sidebarSelectedProjectIds.includes(task.project_id))
  const openTaskCountsByProjectId = useMemo(
    () => deriveOpenTaskCountsByProjectId(activeProjects, tasksQuery.data),
    [activeProjects, tasksQuery.data],
  )

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

  useEffect(() => {
    hydrateBoardDisplayOptionsFromStorage()
  }, [])

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
      onArchivedTaskRestored={tasksQuery.reload}
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
