import type { FormEvent } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../api/client'
import type { useTaskMutations } from '../../api/tasks'
import { useTaskTimeLogs, useTimeLogMutations } from '../../api/timeLogs'
import type {
  KanbanTaskStatus,
  Project,
  Task,
  TaskPayload,
  TaskUpdatePayload,
  TimeLogPayload,
} from '../../api/types'
import {
  TaskDialog,
  type TaskFormErrors,
  type TaskFormState,
} from '../../components/TaskDialog'
import type { TaskDialogMode } from '../workspace/workspaceDialogTypes'

export type UseTaskDialogParams = {
  activeProjects: Project[]
  activeTaskId: string | null
  onTableTitleDisambiguation: (taskId: string) => void
  onTasksReload: () => Promise<void>
  selectedTask: Task | null
  setActiveTaskId: Dispatch<SetStateAction<string | null>>
  setTaskDialogMode: Dispatch<SetStateAction<TaskDialogMode>>
  sidebarSelectedProjectIds: string[]
  taskDialogMode: TaskDialogMode
  taskMutations: ReturnType<typeof useTaskMutations>
}

const KANBAN_STATUSES: KanbanTaskStatus[] = ['backlog', 'in_progress', 'review', 'done']

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

export function useTaskDialog({
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
}: UseTaskDialogParams): {
  openCreateTaskDialog: () => void
  openEditTaskDialog: (task: Task) => void
  taskDialog: JSX.Element | null
} {
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
  const timeLogMutations = useTimeLogMutations(taskDialogMode === 'edit' ? activeTaskId : null)

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

  const discardTaskDraft = (): void => {
    if (taskDialogMode === 'edit') {
      setTaskForm(savedTaskFormRef.current)
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
    discardTaskDraft()
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
    activity_type_id: string | null
    hours: number
    location: string | null
    logged_date: string
    notes: string | null
    title: string | null
  }): Promise<void> => {
    const timeLogPayload: TimeLogPayload = {
      activity_type_id: payload.activity_type_id ?? null,
      hours: payload.hours,
      location: payload.location,
      logged_date: payload.logged_date,
      notes: payload.notes,
      title: payload.title,
    }

    await timeLogMutations.create(timeLogPayload)
    await onTasksReload()
  }

  const handleTimeLogUpdate = async (
    timeLogId: string,
    payload: {
      activity_type_id: string | null
      hours: number
      location: string | null
      logged_date: string
      notes: string | null
      title: string | null
    },
  ): Promise<void> => {
    const timeLogPayload: TimeLogPayload = {
      activity_type_id: payload.activity_type_id ?? null,
      hours: payload.hours,
      location: payload.location,
      logged_date: payload.logged_date,
      notes: payload.notes,
      title: payload.title,
    }

    await timeLogMutations.update(timeLogId, timeLogPayload)
    await onTasksReload()
  }

  const handleTimeLogDelete = async (timeLogId: string): Promise<void> => {
    await timeLogMutations.remove(timeLogId)
    await onTasksReload()
  }

  const taskDialog =
    taskDialogMode !== null ? (
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
        onTimeLogUpdate={handleTimeLogUpdate}
      />
    ) : null

  return {
    openCreateTaskDialog,
    openEditTaskDialog,
    taskDialog,
  }
}
