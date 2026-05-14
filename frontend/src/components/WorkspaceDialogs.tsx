import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useEffect, useId, useState } from 'react'

import { ApiError } from '../api/client'
import { useProjectMutations } from '../api/projects'
import type { useTaskMutations } from '../api/tasks'
import { useTaskTimeLogs, useTimeLogMutations } from '../api/timeLogs'
import type {
  Project,
  ProjectPayload,
  Task,
  TaskPayload,
  TaskPriority,
  TaskStatus,
  TimeLog,
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

type ProjectDialogMode = 'create' | 'edit' | null

export type TaskDialogMode = 'create' | 'edit' | null

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

export type UseWorkspaceDialogsParams = {
  activeProjectIds: string[]
  activeProjects: Project[]
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
  activeTaskId: string | null
}

export function useWorkspaceDialogs({
  activeProjectIds,
  activeProjects,
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
  activeTaskId,
}: UseWorkspaceDialogsParams) {
  const [projectDialogMode, setProjectDialogMode] = useState<ProjectDialogMode>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)
  const [projectFormErrors, setProjectFormErrors] = useState<ProjectFormErrors>({})
  const [taskForm, setTaskForm] = useState<TaskFormState>(defaultTaskForm(''))
  const [taskFormErrors, setTaskFormErrors] = useState<TaskFormErrors>({})
  const [timeLogForm, setTimeLogForm] = useState<TimeLogFormState>(EMPTY_TIME_LOG_FORM)
  const [timeLogFormErrors, setTimeLogFormErrors] = useState<TimeLogFormErrors>({})

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
    if (taskDialogMode === 'edit' && activeTaskId && !selectedTask) {
      setTaskDialogMode(null)
      setActiveTaskId(null)
      setTaskFormErrors({})
      setTimeLogFormErrors({})
    }
  }, [activeTaskId, selectedTask, setActiveTaskId, setTaskDialogMode, taskDialogMode])

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
      sidebarSelectedProjectIds.length === 1 &&
      sidebarSelectedProjectIds[0] in projectsById
        ? sidebarSelectedProjectIds[0]
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
        onTableTitleDisambiguation(createdTask.id)
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
    </>
  )

  return {
    openCreateProjectDialog,
    openCreateTaskDialog,
    openEditTaskDialog,
    handleProjectEdit,
    workspaceDialogs,
  }
}
