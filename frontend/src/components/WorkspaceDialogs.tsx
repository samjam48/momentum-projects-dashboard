import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../api/client'
import { useProjectMutations } from '../api/projects'
import type { useTaskMutations } from '../api/tasks'
import { useTaskTimeLogs, useTimeLogMutations } from '../api/timeLogs'
import type {
  KanbanTaskStatus,
  Project,
  ProjectPayload,
  Task,
  TaskPayload,
  TaskUpdatePayload,
  TimeLogPayload,
} from '../api/types'
import { DEFAULT_PROJECT_COLOUR } from '../lib/projectPalette'
import {
  DEFAULT_PROJECT_FILTER,
  SIDEBAR_PROJECT_FILTER_STORAGE_KEY,
  useProjectFilterStore,
  type ProjectFilterState,
} from '../stores/projectFilter'
import { ProjectDialog } from './ProjectDialog'
import {
  TaskDialog,
  type TaskFormErrors,
  type TaskFormState,
} from './TaskDialog'

type ProjectFormState = {
  colour: string
  description: string
  name: string
}

type ProjectFormErrors = {
  colour?: string
  description?: string
  form?: string
  name?: string
}

type ProjectDialogMode = 'create' | 'edit' | null

export type TaskDialogMode = 'create' | 'edit' | null

const EMPTY_PROJECT_FORM: ProjectFormState = {
  colour: '',
  description: '',
  name: '',
}

const KANBAN_STATUSES: KanbanTaskStatus[] = ['backlog', 'in_progress', 'review', 'done']

function projectPayloadFromForm(formState: ProjectFormState): ProjectPayload {
  return {
    colour: formState.colour.trim() || null,
    description: formState.description.trim() || null,
    name: formState.name.trim(),
  }
}

function formStateFromProject(project: Project): ProjectFormState {
  return {
    colour: project.colour ?? '',
    description: project.description ?? '',
    name: project.name,
  }
}

function projectFieldErrors(error: ApiError | null): ProjectFormErrors {
  if (!error) {
    return {}
  }

  return {
    colour: error.fieldErrors.colour,
    description: error.fieldErrors.description,
    form: error.formError ?? undefined,
    name: error.fieldErrors.name,
  }
}

function taskFieldErrors(error: ApiError | null): TaskFormErrors {
  if (!error) {
    return {}
  }

  return {
    description: error.fieldErrors.description,
    estimated_hours: error.fieldErrors.estimated_hours,
    form: error.formError ?? undefined,
    priority: error.fieldErrors.priority,
    project_id: error.fieldErrors.project_id,
    status: error.fieldErrors.status,
    target_date: error.fieldErrors.target_date,
    title: error.fieldErrors.title,
  }
}

function defaultTaskForm(projectId: string): TaskFormState {
  return {
    description: '',
    estimated_hours: '',
    priority: 'medium',
    project_id: projectId,
    status: 'backlog',
    target_date: '',
    title: '',
  }
}

function taskFormFromTask(task: Task): TaskFormState {
  return {
    description: task.description ?? '',
    estimated_hours: task.estimated_hours === null ? '' : String(task.estimated_hours),
    priority: task.priority,
    project_id: task.project_id,
    status: task.status === 'archived' ? 'backlog' : task.status,
    target_date: task.target_date ?? '',
    title: task.title,
  }
}

function taskPayloadFromForm(formState: TaskFormState): TaskPayload {
  const estimatedHours = formState.estimated_hours.trim()

  return {
    description: formState.description.trim() || null,
    estimated_hours: estimatedHours === '' ? null : Number(estimatedHours),
    priority: formState.priority,
    project_id: formState.project_id,
    status: formState.status as KanbanTaskStatus,
    target_date: formState.target_date || null,
    title: formState.title.trim(),
  }
}

function validateTaskForm(formState: TaskFormState): TaskFormErrors {
  const errors: TaskFormErrors = {}
  const estimatedHours = formState.estimated_hours.trim()

  if (formState.title.trim() === '') {
    errors.title = 'title must not be blank'
  }

  if (estimatedHours !== '' && Number(estimatedHours) < 0) {
    errors.estimated_hours = 'estimated_hours must be non-negative'
  }

  if (!KANBAN_STATUSES.includes(formState.status as KanbanTaskStatus)) {
    errors.status = "Input should be 'backlog', 'in_progress', 'review' or 'done'"
  }

  return errors
}

function formsEqual(left: TaskFormState, right: TaskFormState): boolean {
  return (
    left.description === right.description &&
    left.estimated_hours === right.estimated_hours &&
    left.priority === right.priority &&
    left.project_id === right.project_id &&
    left.status === right.status &&
    left.target_date === right.target_date &&
    left.title === right.title
  )
}

export type UseWorkspaceDialogsParams = {
  activeProjectIds: string[]
  activeProjects: Project[]
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
  setLocallyArchivedProjectIds: Dispatch<SetStateAction<string[]>>
  setTaskDialogMode: Dispatch<SetStateAction<TaskDialogMode>>
  setToolbarProjectFilter: ProjectFilterState['setToolbarProjectFilter']
  sidebarSelectedProjectIds: string[]
  taskDialogMode: TaskDialogMode
  taskMutations: ReturnType<typeof useTaskMutations>
}

export function useWorkspaceDialogs({
  activeProjectIds,
  activeProjects,
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
  setLocallyArchivedProjectIds,
  setTaskDialogMode,
  setToolbarProjectFilter,
  sidebarSelectedProjectIds,
  taskDialogMode,
  taskMutations,
}: UseWorkspaceDialogsParams) {
  const [projectDialogMode, setProjectDialogMode] = useState<ProjectDialogMode>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)
  const [projectFormErrors, setProjectFormErrors] = useState<ProjectFormErrors>({})
  const [taskForm, setTaskForm] = useState<TaskFormState>(defaultTaskForm(''))
  const [taskFormErrors, setTaskFormErrors] = useState<TaskFormErrors>({})
  const [editingTaskSnapshot, setEditingTaskSnapshot] = useState<Task | null>(null)
  const savedTaskFormRef = useRef<TaskFormState>(defaultTaskForm(''))
  const effectiveSelectedTask = selectedTask ?? editingTaskSnapshot

  const projectsById = activeProjects.reduce<Record<string, Project>>((projectMap, project) => {
    projectMap[project.id] = project
    return projectMap
  }, {})

  const timeLogsQuery = useTaskTimeLogs(taskDialogMode === 'edit' ? activeTaskId : null)
  const projectMutations = useProjectMutations(onProjectsReload)
  const timeLogMutations = useTimeLogMutations(
    taskDialogMode === 'edit' ? activeTaskId : null,
    async () => {
      await onTasksReload()
      await timeLogsQuery.reload()
    },
  )

  useEffect(() => {
    setLocallyArchivedProjectIds((currentIds) =>
      currentIds.filter((projectId) =>
        projectsQueryData.some((project) => project.id === projectId),
      ),
    )
  }, [projectsQueryData, setLocallyArchivedProjectIds])

  useEffect(() => {
    if (taskDialogMode === 'edit' && activeTaskId && !effectiveSelectedTask) {
      setTaskDialogMode(null)
      setActiveTaskId(null)
      setEditingTaskSnapshot(null)
      setTaskFormErrors({})
    }
  }, [
    activeTaskId,
    effectiveSelectedTask,
    setActiveTaskId,
    setTaskDialogMode,
    taskDialogMode,
  ])

  const resetTaskDialogState = (): void => {
    setTaskDialogMode(null)
    setActiveTaskId(null)
    setEditingTaskSnapshot(null)
    setTaskFormErrors({})
    taskMutations.resetError()
    timeLogMutations.resetError()
  }

  const openCreateTaskDialog = (): void => {
    const defaultProjectId =
      sidebarSelectedProjectIds.length === 1 &&
      sidebarSelectedProjectIds[0] in projectsById
        ? sidebarSelectedProjectIds[0]
        : activeProjects[0]?.id ?? ''

    const nextForm = defaultTaskForm(defaultProjectId)
    setTaskDialogMode('create')
    setActiveTaskId(null)
    setEditingTaskSnapshot(null)
    setTaskForm(nextForm)
    savedTaskFormRef.current = nextForm
    setTaskFormErrors({})
    taskMutations.resetError()
    timeLogMutations.resetError()
  }

  const openEditTaskDialog = (task: Task): void => {
    const nextForm = taskFormFromTask(task)
    setTaskDialogMode('edit')
    setActiveTaskId(task.id)
    setEditingTaskSnapshot(task)
    setTaskForm(nextForm)
    savedTaskFormRef.current = nextForm
    setTaskFormErrors({})
    taskMutations.resetError()
    timeLogMutations.resetError()
  }

  const handleTaskInputChange = (field: keyof TaskFormState, value: string): void => {
    setTaskForm((currentState) => ({ ...currentState, [field]: value }))
    setTaskFormErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      form: undefined,
    }))
    taskMutations.resetError()
  }

  const saveTaskIfDirty = async (): Promise<boolean> => {
    if (taskDialogMode !== 'edit' || !activeTaskId) {
      return true
    }

    if (formsEqual(taskForm, savedTaskFormRef.current)) {
      return true
    }

    const localErrors = validateTaskForm(taskForm)
    if (Object.keys(localErrors).length > 0) {
      setTaskFormErrors(localErrors)
      return false
    }

    try {
      const payload: TaskUpdatePayload = taskPayloadFromForm(taskForm)
      await taskMutations.update(activeTaskId, payload)
      savedTaskFormRef.current = taskForm
      setTaskFormErrors({})
      return true
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setTaskFormErrors(taskFieldErrors(caughtError))
        return false
      }

      setTaskFormErrors({ form: 'Unable to save task.' })
      return false
    }
  }

  const handleTaskCreateSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setTaskFormErrors({})

    const localErrors = validateTaskForm(taskForm)
    if (Object.keys(localErrors).length > 0) {
      setTaskFormErrors(localErrors)
      return
    }

    try {
      const createdTask = await taskMutations.create(taskPayloadFromForm(taskForm))
      onTableTitleDisambiguation(createdTask.id)
      resetTaskDialogState()
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setTaskFormErrors(taskFieldErrors(caughtError))
        return
      }

      setTaskFormErrors({ form: 'Unable to save task.' })
    }
  }

  const handleTaskClose = async (): Promise<void> => {
    if (taskDialogMode === 'edit') {
      const saved = await saveTaskIfDirty()
      if (!saved) {
        return
      }
    }

    resetTaskDialogState()
  }

  const handleTaskCancel = (): void => {
    if (taskDialogMode === 'edit') {
      setTaskForm(savedTaskFormRef.current)
    }

    resetTaskDialogState()
  }

  const handleTaskArchive = async (): Promise<void> => {
    if (!activeTaskId) {
      return
    }

    const saved = await saveTaskIfDirty()
    if (!saved) {
      return
    }

    try {
      await taskMutations.archive(activeTaskId)
      resetTaskDialogState()
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setTaskFormErrors(taskFieldErrors(caughtError))
        return
      }

      setTaskFormErrors({ form: 'Unable to archive task.' })
    }
  }

  const handleTimeLogCreate = async (payload: {
    hours: number
    location: string | null
    logged_date: string
    notes: string | null
    title: string | null
  }): Promise<void> => {
    const timeLogPayload: TimeLogPayload = {
      hours: payload.hours,
      location: payload.location,
      logged_date: payload.logged_date,
      notes: payload.notes,
      title: payload.title,
    }

    await timeLogMutations.create(timeLogPayload)
  }

  const handleTimeLogDelete = async (timeLogId: string): Promise<void> => {
    await timeLogMutations.remove(timeLogId)
  }

  const handleProjectInputChange = (
    field: keyof ProjectFormState,
    value: string,
  ): void => {
    setProjectForm((currentState) => ({ ...currentState, [field]: value }))
    setProjectFormErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      form: undefined,
    }))
    projectMutations.resetError()
  }

  const resetProjectForm = (): void => {
    setProjectDialogMode(null)
    setEditingProjectId(null)
    setProjectForm(EMPTY_PROJECT_FORM)
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const openCreateProjectDialog = (): void => {
    setProjectDialogMode('create')
    setEditingProjectId(null)
    setProjectForm({
      ...EMPTY_PROJECT_FORM,
      colour: DEFAULT_PROJECT_COLOUR,
    })
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const handleProjectSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    setProjectFormErrors({})

    try {
      if (editingProjectId) {
        await projectMutations.update(editingProjectId, projectPayloadFromForm(projectForm))
      } else {
        await projectMutations.create(projectPayloadFromForm(projectForm))
      }

      resetProjectForm()
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setProjectFormErrors(projectFieldErrors(caughtError))
        return
      }

      setProjectFormErrors({ form: 'Unable to save project.' })
    }
  }

  const handleProjectEdit = (project: Project): void => {
    setProjectDialogMode('edit')
    setEditingProjectId(project.id)
    setProjectForm(formStateFromProject(project))
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const handleProjectArchive = async (projectId: string): Promise<void> => {
    setProjectFormErrors({})
    const wasOnlySidebarSelection =
      sidebarSelectedProjectIds.length === 1 && sidebarSelectedProjectIds[0] === projectId
    const toolbarFilteredToArchivedProject = selectedProjectId === projectId
    const filterSnapshot = {
      selectedProjectId,
      selectedProjectIds,
    }

    setLocallyArchivedProjectIds((currentIds) =>
      currentIds.includes(projectId) ? currentIds : [...currentIds, projectId],
    )

    try {
      await projectMutations.archive(projectId)
      await onProjectsReload()
      const remainingActiveProjectIds = activeProjectIds.filter(
        (activeProjectId) => activeProjectId !== projectId,
      )
      if (toolbarFilteredToArchivedProject) {
        setToolbarProjectFilter(DEFAULT_PROJECT_FILTER, remainingActiveProjectIds)
      }
      if (wasOnlySidebarSelection) {
        resetSidebarToAllProjects(remainingActiveProjectIds)
      }
      await onTasksReload()
      resetProjectForm()
    } catch (caughtError) {
      setLocallyArchivedProjectIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== projectId),
      )

      if (filterSnapshot.selectedProjectIds === null) {
        localStorage.removeItem(SIDEBAR_PROJECT_FILTER_STORAGE_KEY)
      } else {
        localStorage.setItem(
          SIDEBAR_PROJECT_FILTER_STORAGE_KEY,
          JSON.stringify(filterSnapshot.selectedProjectIds),
        )
      }
      useProjectFilterStore.setState({
        selectedProjectId: filterSnapshot.selectedProjectId,
        selectedProjectIds: filterSnapshot.selectedProjectIds,
      })

      if (caughtError instanceof ApiError) {
        setProjectFormErrors(projectFieldErrors(caughtError))
        return
      }

      setProjectFormErrors({ form: 'Unable to archive project.' })
    }
  }

  const workspaceDialogs = (
    <>
      {projectDialogMode ? (
        <ProjectDialog
          editingProjectId={editingProjectId}
          formErrors={projectFormErrors}
          formState={projectForm}
          isOpen
          isSaving={projectMutations.isSaving}
          mode={projectDialogMode}
          onArchive={
            editingProjectId
              ? () => void handleProjectArchive(editingProjectId)
              : undefined
          }
          onClose={resetProjectForm}
          onFieldChange={handleProjectInputChange}
          onSubmit={handleProjectSubmit}
        />
      ) : null}

      {taskDialogMode ? (
        <TaskDialog
          activeProjects={activeProjects}
          mode={taskDialogMode}
          selectedTask={effectiveSelectedTask}
          taskForm={taskForm}
          taskFormErrors={taskFormErrors}
          taskMutationsSaving={taskMutations.isSaving}
          timeLogMutationsSaving={timeLogMutations.isSaving}
          timeLogs={timeLogsQuery.data}
          timeLogsError={timeLogsQuery.error}
          timeLogsLoading={timeLogsQuery.isLoading}
          onArchive={taskDialogMode === 'edit' ? handleTaskArchive : undefined}
          onCancel={handleTaskCancel}
          onClose={handleTaskClose}
          onCreateSubmit={handleTaskCreateSubmit}
          onFieldBlur={saveTaskIfDirty}
          onFieldChange={handleTaskInputChange}
          onTimeLogCreate={handleTimeLogCreate}
          onTimeLogDelete={handleTimeLogDelete}
        />
      ) : null}
    </>
  )

  return {
    handleProjectEdit,
    openCreateProjectDialog,
    openCreateTaskDialog,
    openEditTaskDialog,
    workspaceDialogs,
  }
}
