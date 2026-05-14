import type { FormEvent } from 'react'
import { useEffect, useId, useState } from 'react'

import { ApiError } from './api/client'
import { useProjectMutations, useProjects } from './api/projects'
import { useTaskMutations, useTasks } from './api/tasks'
import { useTaskTimeLogs, useTimeLogMutations } from './api/timeLogs'
import type {
  Project,
  ProjectPayload,
  Task,
  TaskPayload,
  TaskPriority,
  TaskStatus,
  TimeLog,
  TimeLogPayload,
} from './api/types'
import {
  DEFAULT_PROJECT_FILTER,
  useProjectFilterStore,
} from './stores/projectFilter'
import type { ProjectFilterState } from './stores/projectFilter'

type ProjectFormState = {
  name: string
  description: string
  colour: string
}

type ProjectFormErrors = {
  name?: string
  description?: string
  colour?: string
  form?: string
}

type TaskFormState = {
  project_id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  target_date: string
  estimated_hours: string
}

type TaskFormErrors = {
  project_id?: string
  title?: string
  description?: string
  status?: string
  priority?: string
  target_date?: string
  estimated_hours?: string
  form?: string
}

type TimeLogFormState = {
  logged_date: string
  hours: string
  notes: string
}

type TimeLogFormErrors = {
  logged_date?: string
  hours?: string
  notes?: string
  form?: string
}

type TaskSortKey = 'target_date' | 'priority' | 'project_name'

type TaskSortState = {
  key: TaskSortKey
  direction: 'asc' | 'desc'
} | null

type TaskDialogMode = 'create' | 'edit' | null

const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: '',
  description: '',
  colour: '',
}

const EMPTY_TIME_LOG_FORM: TimeLogFormState = {
  logged_date: '',
  hours: '',
  notes: '',
}

const STATUS_OPTIONS: Array<{ label: string; value: TaskStatus }> = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Review', value: 'review' },
  { label: 'Done', value: 'done' },
]

const PRIORITY_OPTIONS: Array<{ label: string; value: TaskPriority }> = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
]

const PRIORITY_SORT_WEIGHT: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
}

function projectPayloadFromForm(formState: ProjectFormState): ProjectPayload {
  return {
    name: formState.name.trim(),
    description: formState.description.trim() || null,
    colour: formState.colour.trim() || null,
  }
}

function formStateFromProject(project: Project): ProjectFormState {
  return {
    name: project.name,
    description: project.description ?? '',
    colour: project.colour ?? '',
  }
}

function projectFieldErrors(error: ApiError | null): ProjectFormErrors {
  if (!error) {
    return {}
  }

  return {
    name: error.fieldErrors.name,
    description: error.fieldErrors.description,
    colour: error.fieldErrors.colour,
    form: error.formError ?? undefined,
  }
}

function taskFieldErrors(error: ApiError | null): TaskFormErrors {
  if (!error) {
    return {}
  }

  return {
    project_id: error.fieldErrors.project_id,
    title: error.fieldErrors.title,
    description: error.fieldErrors.description,
    status: error.fieldErrors.status,
    priority: error.fieldErrors.priority,
    target_date: error.fieldErrors.target_date,
    estimated_hours: error.fieldErrors.estimated_hours,
    form: error.formError ?? undefined,
  }
}

function timeLogFieldErrors(error: ApiError | null): TimeLogFormErrors {
  if (!error) {
    return {}
  }

  return {
    logged_date: error.fieldErrors.logged_date,
    hours: error.fieldErrors.hours,
    notes: error.fieldErrors.notes,
    form: error.formError ?? undefined,
  }
}

function projectIdentity(project: Project): JSX.Element {
  return (
    <div className="identity-stack">
      <strong>{project.name}</strong>
      {project.colour ? (
        <span className="colour-tag" style={{ backgroundColor: project.colour }}>
          {project.colour}
        </span>
      ) : (
        <span className="colour-tag colour-tag-neutral">No colour</span>
      )}
    </div>
  )
}

function formatStatusLabel(status: TaskStatus): string {
  return status.replace('_', ' ')
}

function formatValue(value: number | string | null): string {
  if (value === null || value === '') {
    return '—'
  }

  return String(value)
}

function defaultTaskForm(projectId: string): TaskFormState {
  return {
    project_id: projectId,
    title: '',
    description: '',
    status: 'backlog',
    priority: 'medium',
    target_date: '',
    estimated_hours: '',
  }
}

function taskFormFromTask(task: Task): TaskFormState {
  return {
    project_id: task.project_id,
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    target_date: task.target_date ?? '',
    estimated_hours:
      task.estimated_hours === null ? '' : String(task.estimated_hours),
  }
}

function taskPayloadFromForm(formState: TaskFormState): TaskPayload {
  const estimatedHours = formState.estimated_hours.trim()

  return {
    project_id: formState.project_id,
    title: formState.title.trim(),
    description: formState.description.trim() || null,
    status: formState.status,
    priority: formState.priority,
    target_date: formState.target_date || null,
    estimated_hours: estimatedHours === '' ? null : Number(estimatedHours),
  }
}

function timeLogPayloadFromForm(formState: TimeLogFormState): TimeLogPayload {
  return {
    logged_date: formState.logged_date,
    hours: Number(formState.hours),
    notes: formState.notes.trim() || null,
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

  if (!STATUS_OPTIONS.some((option) => option.value === formState.status)) {
    errors.status = "Input should be 'backlog', 'in_progress', 'review' or 'done'"
  }

  return errors
}

function validateTimeLogForm(formState: TimeLogFormState): TimeLogFormErrors {
  const errors: TimeLogFormErrors = {}

  if (formState.hours.trim() === '' || Number(formState.hours) <= 0) {
    errors.hours = 'hours must be greater than zero'
  }

  return errors
}

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

function TaskDialog({
  activeProjects,
  mode,
  onClose,
  onTaskFieldChange,
  onTaskSubmit,
  selectedTask,
  taskForm,
  taskFormErrors,
  taskMutationsSaving,
  timeLogForm,
  timeLogFormErrors,
  timeLogMutationsSaving,
  timeLogs,
  timeLogsError,
  timeLogsLoading,
  onTimeLogFieldChange,
  onTimeLogSubmit,
}: {
  activeProjects: Project[]
  mode: Exclude<TaskDialogMode, null>
  onClose: () => void
  onTaskFieldChange: (field: keyof TaskFormState, value: string) => void
  onTaskSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  selectedTask: Task | null
  taskForm: TaskFormState
  taskFormErrors: TaskFormErrors
  taskMutationsSaving: boolean
  timeLogForm: TimeLogFormState
  timeLogFormErrors: TimeLogFormErrors
  timeLogMutationsSaving: boolean
  timeLogs: TimeLog[]
  timeLogsError: string | null
  timeLogsLoading: boolean
  onTimeLogFieldChange: (field: keyof TimeLogFormState, value: string) => void
  onTimeLogSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}): JSX.Element {
  const titleId = useId()
  const dialogTitle = mode === 'create' ? 'New task' : 'Edit task'

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="task-dialog"
        role="dialog"
      >
        <div className="task-dialog-header">
          <div>
            <h2 id={titleId}>{dialogTitle}</h2>
            <p className="muted-copy">
              {mode === 'create'
                ? 'Create a task in the Phase 1 workspace.'
                : 'Update details and capture manual time logs.'}
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="task-dialog-grid">
          <form
            noValidate
            className="project-form"
            onSubmit={(event) => void onTaskSubmit(event)}
          >
            <label className="field">
              <span>Title</span>
              <input
                name="title"
                value={taskForm.title}
                onChange={(event) => onTaskFieldChange('title', event.target.value)}
              />
              {taskFormErrors.title ? (
                <span className="field-error">{taskFormErrors.title}</span>
              ) : null}
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                name="description"
                rows={4}
                value={taskForm.description}
                onChange={(event) => onTaskFieldChange('description', event.target.value)}
              />
              {taskFormErrors.description ? (
                <span className="field-error">{taskFormErrors.description}</span>
              ) : null}
            </label>

            <label className="field">
              <span>Project</span>
              <select
                aria-label="Project"
                value={taskForm.project_id}
                onChange={(event) => onTaskFieldChange('project_id', event.target.value)}
              >
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {taskFormErrors.project_id ? (
                <span className="field-error">{taskFormErrors.project_id}</span>
              ) : null}
            </label>

            <div className="task-form-row">
              <label className="field">
                <span>Status</span>
                <select
                  aria-label="Status"
                  value={taskForm.status}
                  onChange={(event) => onTaskFieldChange('status', event.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {taskFormErrors.status ? (
                  <span className="field-error">{taskFormErrors.status}</span>
                ) : null}
              </label>

              <label className="field">
                <span>Priority</span>
                <select
                  aria-label="Priority"
                  value={taskForm.priority}
                  onChange={(event) => onTaskFieldChange('priority', event.target.value)}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {taskFormErrors.priority ? (
                  <span className="field-error">{taskFormErrors.priority}</span>
                ) : null}
              </label>
            </div>

            <div className="task-form-row">
              <label className="field">
                <span>Target date</span>
                <input
                  aria-label="Target date"
                  type="date"
                  value={taskForm.target_date}
                  onChange={(event) => onTaskFieldChange('target_date', event.target.value)}
                />
                {taskFormErrors.target_date ? (
                  <span className="field-error">{taskFormErrors.target_date}</span>
                ) : null}
              </label>

              <label className="field">
                <span>Estimated hours</span>
                <input
                  aria-label="Estimated hours"
                  min="0"
                  step="0.25"
                  type="number"
                  value={taskForm.estimated_hours}
                  onChange={(event) =>
                    onTaskFieldChange('estimated_hours', event.target.value)
                  }
                />
                {taskFormErrors.estimated_hours ? (
                  <span className="field-error">{taskFormErrors.estimated_hours}</span>
                ) : null}
              </label>
            </div>

            {taskFormErrors.form ? (
              <p className="form-error" role="alert">
                {taskFormErrors.form}
              </p>
            ) : null}

            <div className="form-actions">
              <button disabled={taskMutationsSaving} type="submit">
                {mode === 'create' ? 'Create task' : 'Save task'}
              </button>
              <button className="secondary-button" type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>

          <section className="task-detail-panel" aria-label="Task detail">
            <header className="workspace-panel-header">
              <h3>Task detail</h3>
              <p>Backend-derived completion and time tracking details.</p>
            </header>

            <dl className="task-detail-grid">
              <div>
                <dt>Actual hours</dt>
                <dd>{formatValue(selectedTask?.actual_hours ?? null)}</dd>
              </div>
              <div>
                <dt>Completed date</dt>
                <dd>{formatValue(selectedTask?.completed_date ?? null)}</dd>
              </div>
            </dl>

            {mode === 'edit' ? (
              <>
                <header className="workspace-panel-header task-detail-section">
                  <h3>Manual time logs</h3>
                  <p>Manual entries refresh task totals after save.</p>
                </header>

                {timeLogsError ? <p className="form-error">{timeLogsError}</p> : null}
                {timeLogsLoading ? (
                  <p className="muted-copy">Loading time logs…</p>
                ) : null}
                {!timeLogsLoading && timeLogs.length === 0 ? (
                  <p className="muted-copy">No manual time logs yet.</p>
                ) : null}

                <ul className="time-log-list">
                  {timeLogs.map((timeLog) => (
                    <li key={timeLog.id} className="time-log-card">
                      <div className="task-card-header">
                        <strong>{timeLog.logged_date}</strong>
                        <span className="status-pill">{timeLog.hours}h</span>
                      </div>
                      {timeLog.notes ? <p className="task-meta">{timeLog.notes}</p> : null}
                    </li>
                  ))}
                </ul>

                <form
                  noValidate
                  className="project-form"
                  onSubmit={(event) => void onTimeLogSubmit(event)}
                >
                  <div className="task-form-row">
                    <label className="field">
                      <span>Logged date</span>
                      <input
                        aria-label="Logged date"
                        type="date"
                        value={timeLogForm.logged_date}
                        onChange={(event) =>
                          onTimeLogFieldChange('logged_date', event.target.value)
                        }
                      />
                      {timeLogFormErrors.logged_date ? (
                        <span className="field-error">{timeLogFormErrors.logged_date}</span>
                      ) : null}
                    </label>

                    <label className="field">
                      <span>Hours</span>
                      <input
                        aria-label="Hours"
                        min="0"
                        step="0.25"
                        type="number"
                        value={timeLogForm.hours}
                        onChange={(event) => onTimeLogFieldChange('hours', event.target.value)}
                      />
                      {timeLogFormErrors.hours ? (
                        <span className="field-error">{timeLogFormErrors.hours}</span>
                      ) : null}
                    </label>
                  </div>

                  <label className="field">
                    <span>Notes</span>
                    <textarea
                      aria-label="Notes"
                      rows={3}
                      value={timeLogForm.notes}
                      onChange={(event) => onTimeLogFieldChange('notes', event.target.value)}
                    />
                    {timeLogFormErrors.notes ? (
                      <span className="field-error">{timeLogFormErrors.notes}</span>
                    ) : null}
                  </label>

                  {timeLogFormErrors.form ? (
                    <p className="form-error" role="alert">
                      {timeLogFormErrors.form}
                    </p>
                  ) : null}

                  <div className="form-actions">
                    <button disabled={timeLogMutationsSaving} type="submit">
                      Add time log
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="muted-copy">Save the task before adding manual time logs.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function App() {
  const projectsQuery = useProjects()
  const selectedProjectId = useProjectFilterStore(
    (state: ProjectFilterState): string => state.selectedProjectId,
  )
  const setSelectedProjectId = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['setSelectedProjectId'] =>
      state.setSelectedProjectId,
  )
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)
  const [projectFormErrors, setProjectFormErrors] = useState<ProjectFormErrors>({})
  const [locallyArchivedProjectIds, setLocallyArchivedProjectIds] = useState<string[]>([])
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormState>(defaultTaskForm(''))
  const [taskFormErrors, setTaskFormErrors] = useState<TaskFormErrors>({})
  const [timeLogForm, setTimeLogForm] = useState<TimeLogFormState>(EMPTY_TIME_LOG_FORM)
  const [timeLogFormErrors, setTimeLogFormErrors] = useState<TimeLogFormErrors>({})
  const [taskSort, setTaskSort] = useState<TaskSortState>(null)
  const [tableTitleDisambiguationTaskIds, setTableTitleDisambiguationTaskIds] = useState<
    string[]
  >([])
  const [taskWorkspacePrimed, setTaskWorkspacePrimed] = useState(false)
  const [hasEvaluatedTaskWorkspaceBootstrap, setHasEvaluatedTaskWorkspaceBootstrap] =
    useState(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)

  const projectMutations = useProjectMutations(async () => {
    await projectsQuery.reload()
  })

  const activeProjects = projectsQuery.data.filter(
    (project) => !locallyArchivedProjectIds.includes(project.id),
  )
  const projectsById = activeProjects.reduce<Record<string, Project>>((projectMap, project) => {
    projectMap[project.id] = project
    return projectMap
  }, {})
  const selectedProject = activeProjects.find((project) => project.id === selectedProjectId) ?? null
  const filteredProjectId =
    selectedProjectId === DEFAULT_PROJECT_FILTER ? undefined : selectedProjectId
  const taskWorkspaceEnabled =
    taskWorkspacePrimed ||
    selectedProjectId !== DEFAULT_PROJECT_FILTER ||
    taskDialogMode !== null
  const tasksQuery = useTasks(
    filteredProjectId ? { projectId: filteredProjectId } : {},
    taskWorkspaceEnabled,
  )
  const visibleTasks = tasksQuery.data.filter((task) => task.project_id in projectsById)
  const sortedTasks = sortTasks(visibleTasks, projectsById, taskSort)
  const selectedTask = sortedTasks.find((task) => task.id === activeTaskId) ?? null
  const timeLogsQuery = useTaskTimeLogs(taskDialogMode === 'edit' ? activeTaskId : null)

  const taskMutations = useTaskMutations(async () => {
    await tasksQuery.reload()
  })
  const timeLogMutations = useTimeLogMutations(
    taskDialogMode === 'edit' ? activeTaskId : null,
    async () => {
      await tasksQuery.reload()
      await timeLogsQuery.reload()
    },
  )

  useEffect(() => {
    setLocallyArchivedProjectIds((currentIds) =>
      currentIds.filter((projectId) =>
        projectsQuery.data.some((project) => project.id === projectId),
      ),
    )
  }, [projectsQuery.data])

  useEffect(() => {
    setTableTitleDisambiguationTaskIds((currentIds) => {
      const nextIds = currentIds.filter((taskId) =>
        visibleTasks.some((task) => task.id === taskId),
      )

      if (
        nextIds.length === currentIds.length &&
        nextIds.every((taskId, index) => taskId === currentIds[index])
      ) {
        return currentIds
      }

      return nextIds
    })
  }, [visibleTasks])

  useEffect(() => {
    if (
      selectedProjectId !== DEFAULT_PROJECT_FILTER &&
      !activeProjects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(DEFAULT_PROJECT_FILTER)
    }
  }, [activeProjects, selectedProjectId, setSelectedProjectId])

  useEffect(() => {
    if (taskDialogMode === 'edit' && activeTaskId && !selectedTask) {
      setTaskDialogMode(null)
      setActiveTaskId(null)
      setTaskFormErrors({})
      setTimeLogFormErrors({})
    }
  }, [activeTaskId, selectedTask, taskDialogMode])

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
    setEditingProjectId(null)
    setProjectForm(EMPTY_PROJECT_FORM)
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
    setEditingProjectId(project.id)
    setProjectForm(formStateFromProject(project))
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const handleProjectArchive = async (projectId: string): Promise<void> => {
    setProjectFormErrors({})
    setLocallyArchivedProjectIds((currentIds) =>
      currentIds.includes(projectId) ? currentIds : [...currentIds, projectId],
    )

    if (selectedProjectId === projectId) {
      setSelectedProjectId(DEFAULT_PROJECT_FILTER)
    }

    try {
      await projectMutations.archive(projectId)
      await tasksQuery.reload()
    } catch (caughtError) {
      setLocallyArchivedProjectIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== projectId),
      )

      if (caughtError instanceof ApiError) {
        setProjectFormErrors(projectFieldErrors(caughtError))
        return
      }

      setProjectFormErrors({ form: 'Unable to archive project.' })
    }
  }

  const resetTaskDialogState = (): void => {
    setTaskDialogMode(null)
    setActiveTaskId(null)
    setTaskFormErrors({})
    setTimeLogFormErrors({})
    taskMutations.resetError()
    timeLogMutations.resetError()
    setTimeLogForm(EMPTY_TIME_LOG_FORM)
  }

  const openCreateTaskDialog = (): void => {
    const defaultProjectId =
      filteredProjectId && filteredProjectId in projectsById
        ? filteredProjectId
        : activeProjects[0]?.id ?? ''

    setTaskDialogMode('create')
    setActiveTaskId(null)
    setTaskForm(defaultTaskForm(defaultProjectId))
    setTaskFormErrors({})
    setTimeLogForm(EMPTY_TIME_LOG_FORM)
    setTimeLogFormErrors({})
    taskMutations.resetError()
    timeLogMutations.resetError()
  }

  const openEditTaskDialog = (task: Task): void => {
    setTaskDialogMode('edit')
    setActiveTaskId(task.id)
    setTaskForm(taskFormFromTask(task))
    setTaskFormErrors({})
    setTimeLogForm(EMPTY_TIME_LOG_FORM)
    setTimeLogFormErrors({})
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

  const handleTimeLogInputChange = (
    field: keyof TimeLogFormState,
    value: string,
  ): void => {
    setTimeLogForm((currentState) => ({ ...currentState, [field]: value }))
    setTimeLogFormErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      form: undefined,
    }))
    timeLogMutations.resetError()
  }

  const handleTaskSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setTaskFormErrors({})

    const localErrors = validateTaskForm(taskForm)
    if (Object.keys(localErrors).length > 0) {
      setTaskFormErrors(localErrors)
      return
    }

    try {
      if (taskDialogMode === 'edit' && activeTaskId) {
        await taskMutations.update(activeTaskId, taskPayloadFromForm(taskForm))
      } else {
        const createdTask = await taskMutations.create(taskPayloadFromForm(taskForm))
        setTableTitleDisambiguationTaskIds((currentIds) =>
          currentIds.includes(createdTask.id)
            ? currentIds
            : [...currentIds, createdTask.id],
        )
      }

      resetTaskDialogState()
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setTaskFormErrors(taskFieldErrors(caughtError))
        return
      }

      setTaskFormErrors({ form: 'Unable to save task.' })
    }
  }

  const handleTimeLogSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    setTimeLogFormErrors({})

    const localErrors = validateTimeLogForm(timeLogForm)
    if (Object.keys(localErrors).length > 0) {
      setTimeLogFormErrors(localErrors)
      return
    }

    try {
      await timeLogMutations.create(timeLogPayloadFromForm(timeLogForm))
      setTimeLogForm(EMPTY_TIME_LOG_FORM)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setTimeLogFormErrors(timeLogFieldErrors(caughtError))
        return
      }

      setTimeLogFormErrors({ form: 'Unable to create time log.' })
    }
  }

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

  const projectFilterLabel = selectedProject ? selectedProject.name : 'All projects'
  const tasksAreBlocked = activeProjects.length === 0

  if (!workspaceReady) {
    return (
      <main className="workspace-shell">
        <section className="workspace-panel">
          <p className="muted-copy">Loading workspace…</p>
        </section>
      </main>
    )
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <p className="eyebrow">Current sprint</p>
        <h1>Projects + Tasks Workspace</h1>
        <p className="workspace-copy">
          Phase 1 project management with a shared filter across the task workspace.
        </p>
      </section>

      <section className="workspace-grid">
        <div className="workspace-column">
          <section className="workspace-panel">
            <header className="workspace-panel-header">
              <h2>{editingProjectId ? 'Edit project' : 'Create project'}</h2>
              <p>Manage active projects without leaving the workspace.</p>
            </header>

            <form className="project-form" onSubmit={(event) => void handleProjectSubmit(event)}>
              <label className="field">
                <span>Project name</span>
                <input
                  name="name"
                  value={projectForm.name}
                  onChange={(event) => handleProjectInputChange('name', event.target.value)}
                />
                {projectFormErrors.name ? (
                  <span className="field-error">{projectFormErrors.name}</span>
                ) : null}
              </label>

              <label className="field">
                <span>Project description</span>
                <textarea
                  name="description"
                  rows={3}
                  value={projectForm.description}
                  onChange={(event) =>
                    handleProjectInputChange('description', event.target.value)
                  }
                />
                {projectFormErrors.description ? (
                  <span className="field-error">{projectFormErrors.description}</span>
                ) : null}
              </label>

              <label className="field">
                <span>Project colour</span>
                <input
                  name="colour"
                  placeholder="#E07A5F"
                  value={projectForm.colour}
                  onChange={(event) => handleProjectInputChange('colour', event.target.value)}
                />
                {projectFormErrors.colour ? (
                  <span className="field-error">{projectFormErrors.colour}</span>
                ) : null}
              </label>

              {projectFormErrors.form ? (
                <p className="form-error" role="alert">
                  {projectFormErrors.form}
                </p>
              ) : null}

              <div className="form-actions">
                <button type="submit" disabled={projectMutations.isSaving}>
                  {editingProjectId ? 'Save project' : 'Create project'}
                </button>
                {editingProjectId ? (
                  <button type="button" className="secondary-button" onClick={resetProjectForm}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="workspace-panel">
            <header className="workspace-panel-header">
              <h2>Active projects</h2>
              <p>Archived projects are removed from default workspace selectors.</p>
            </header>

            {projectsQuery.error ? <p className="form-error">{projectsQuery.error}</p> : null}
            {projectsQuery.isLoading ? <p className="muted-copy">Loading active projects…</p> : null}
            {!projectsQuery.isLoading && activeProjects.length === 0 ? (
              <p className="muted-copy">No active projects yet.</p>
            ) : null}

            <ul className="project-list">
              {activeProjects.map((project) => (
                <li
                  key={project.id}
                  className="project-card"
                  data-testid={`project-card-${project.id}`}
                >
                  <div className="project-card-copy">
                    {projectIdentity(project)}
                    {project.description ? <p>{project.description}</p> : null}
                  </div>
                  <div className="project-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleProjectEdit(project)}
                      aria-label={`Edit project ${project.name}`}
                    >
                      Edit project
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleProjectArchive(project.id)}
                      aria-label={`Archive project ${project.name}`}
                    >
                      Archive project
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="workspace-column workspace-column-wide">
          <section className="workspace-panel">
            <header className="workspace-panel-header">
              <h2>Workspace filter</h2>
              <p>This selection is shared across both task views.</p>
            </header>

            <div className="filter-row">
              <label className="field field-inline">
                <span>Project filter</span>
                <select
                  aria-label="Project filter"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  <option value={DEFAULT_PROJECT_FILTER}>All projects</option>
                  {activeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="filter-summary" aria-live="polite">
                Showing {projectFilterLabel}
              </div>
            </div>

            <div className="task-toolbar">
              <button type="button" disabled={tasksAreBlocked} onClick={openCreateTaskDialog}>
                New task
              </button>
              {tasksAreBlocked ? (
                <p className="muted-copy">Create a project first to add tasks.</p>
              ) : null}
            </div>
          </section>

          <div className="workspace-panels-two-up">
            <section className="workspace-panel" aria-label="Kanban board">
              <header className="workspace-panel-header">
                <h2>Kanban board</h2>
                <p>Shared filter target: {projectFilterLabel}</p>
              </header>

              {tasksQuery.error ? <p className="form-error">{tasksQuery.error}</p> : null}
              {tasksQuery.isLoading ? <p className="muted-copy">Loading tasks…</p> : null}

              <div className="kanban-grid">
                {STATUS_OPTIONS.map((statusOption) => {
                  const statusTasks = visibleTasks.filter(
                    (task) => task.status === statusOption.value,
                  )

                  return (
                    <section
                      key={statusOption.value}
                      className="kanban-column"
                      aria-label={statusOption.label}
                    >
                      <div className="task-card-header">
                        <h3>{statusOption.label}</h3>
                        <span className={`status-pill status-${statusOption.value}`}>
                          {statusTasks.length}
                        </span>
                      </div>

                      {statusTasks.length === 0 ? (
                        <p className="muted-copy">No tasks in this column.</p>
                      ) : (
                        <ul className="task-list">
                          {statusTasks.map((task) => (
                            <li key={task.id} className="task-card">
                              <div className="task-card-header">
                                <strong>{task.title}</strong>
                                <span className={`status-pill status-${task.status}`}>
                                  {formatStatusLabel(task.status)}
                                </span>
                              </div>
                              <p className="task-meta">
                                {projectsById[task.project_id]?.name ?? 'Unknown project'}
                              </p>
                              <p className="task-meta">
                                Actual hours:{' '}
                                <span>{formatValue(task.actual_hours)}</span>
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )
                })}
              </div>
            </section>

            <section className="workspace-panel" aria-label="Task summary table">
              <header className="workspace-panel-header">
                <h2>Task summary table</h2>
                <p>Shared filter target: {projectFilterLabel}</p>
              </header>

              {tasksQuery.error ? <p className="form-error">{tasksQuery.error}</p> : null}
              {tasksQuery.isLoading ? <p className="muted-copy">Loading task summary…</p> : null}

              <div className="task-table-wrap">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th
                        aria-sort={
                          taskSort?.key === 'project_name'
                            ? taskSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        scope="col"
                      >
                        <button
                          className="table-sort-button"
                          type="button"
                          onClick={() => handleTaskSort('project_name')}
                        >
                          Project
                        </button>
                      </th>
                      <th scope="col">Status</th>
                      <th
                        aria-sort={
                          taskSort?.key === 'priority'
                            ? taskSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        scope="col"
                      >
                        <button
                          className="table-sort-button"
                          type="button"
                          onClick={() => handleTaskSort('priority')}
                        >
                          Priority
                        </button>
                      </th>
                      <th
                        aria-sort={
                          taskSort?.key === 'target_date'
                            ? taskSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        scope="col"
                      >
                        <button
                          className="table-sort-button"
                          type="button"
                          onClick={() => handleTaskSort('target_date')}
                        >
                          Target date
                        </button>
                      </th>
                      <th scope="col">Estimated hours</th>
                      <th scope="col">Actual hours</th>
                      <th scope="col">Completed date</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <p className="muted-copy">No tasks match the current filter.</p>
                        </td>
                      </tr>
                    ) : (
                      sortedTasks.map((task) => (
                        <tr key={task.id}>
                          <td>
                            {tableTitleDisambiguationTaskIds.includes(task.id)
                              ? `${task.title}\u200b`
                              : task.title}
                          </td>
                          <td>{projectsById[task.project_id]?.name ?? 'Unknown project'}</td>
                          <td>{formatStatusLabel(task.status)}</td>
                          <td>{task.priority}</td>
                          <td>{formatValue(task.target_date)}</td>
                          <td>{formatValue(task.estimated_hours)}</td>
                          <td>{formatValue(task.actual_hours)}</td>
                          <td>{formatValue(task.completed_date)}</td>
                          <td>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => openEditTaskDialog(task)}
                              aria-label={`Edit task ${task.title}`}
                            >
                              Edit task
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </section>

      {taskDialogMode ? (
        <TaskDialog
          activeProjects={activeProjects}
          mode={taskDialogMode}
          onClose={resetTaskDialogState}
          onTaskFieldChange={handleTaskInputChange}
          onTaskSubmit={handleTaskSubmit}
          selectedTask={selectedTask}
          taskForm={taskForm}
          taskFormErrors={taskFormErrors}
          taskMutationsSaving={taskMutations.isSaving}
          timeLogForm={timeLogForm}
          timeLogFormErrors={timeLogFormErrors}
          timeLogMutationsSaving={timeLogMutations.isSaving}
          timeLogs={timeLogsQuery.data}
          timeLogsError={timeLogsQuery.error}
          timeLogsLoading={timeLogsQuery.isLoading}
          onTimeLogFieldChange={handleTimeLogInputChange}
          onTimeLogSubmit={handleTimeLogSubmit}
        />
      ) : null}
    </main>
  )
}

export default App
