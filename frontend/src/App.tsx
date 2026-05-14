import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

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
import { AppShell } from './components/layout/AppShell'
import { KanbanTaskCard } from './components/kanban/KanbanTaskCard'
import { ProjectDialog } from './components/ProjectDialog'
import { DEFAULT_PROJECT_COLOUR } from './lib/projectPalette'
import { ProjectsPage } from './pages/ProjectsPage'
import {
  DEFAULT_PROJECT_FILTER,
  deriveToolbarProjectId,
  getSidebarSelectedProjectIds,
  SIDEBAR_PROJECT_FILTER_STORAGE_KEY,
  useProjectFilterStore,
} from './stores/projectFilter'
import type { ProjectFilterState } from './stores/projectFilter'
import type { BoardDisplayOptions } from './stores/boardDisplayOptions'
import { useBoardDisplayOptionsStore, hydrateBoardDisplayOptionsFromStorage } from './stores/boardDisplayOptions'

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

type TaskSortKey = 'target_date' | 'priority' | 'project_name'

type TaskSortState = {
  key: TaskSortKey
  direction: 'asc' | 'desc'
} | null

type TaskDialogMode = 'create' | 'edit' | null

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

const KANBAN_COLUMN_ID_PREFIX = 'kanban-column:'
const KANBAN_TASK_ID_PREFIX = 'kanban-task:'

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

function compareTasksForKanban(leftTask: Task, rightTask: Task): number {
  if (leftTask.kanban_order !== null && rightTask.kanban_order !== null) {
    if (leftTask.kanban_order !== rightTask.kanban_order) {
      return leftTask.kanban_order - rightTask.kanban_order
    }
  } else if (leftTask.kanban_order !== null) {
    return -1
  } else if (rightTask.kanban_order !== null) {
    return 1
  }

  if (leftTask.created_at !== rightTask.created_at) {
    return leftTask.created_at.localeCompare(rightTask.created_at)
  }

  return leftTask.id.localeCompare(rightTask.id)
}

function sortTasksForKanban(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasksForKanban)
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

function kanbanColumnId(status: TaskStatus): string {
  return `${KANBAN_COLUMN_ID_PREFIX}${status}`
}

function kanbanTaskId(taskId: string): string {
  return `${KANBAN_TASK_ID_PREFIX}${taskId}`
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

function taskOrderByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return sortTasksForKanban(tasks.filter((task) => task.status === status))
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


function KanbanColumn({
  boardDisplayOptions,
  draggingDisabled,
  onOpenTask,
  projectsById,
  showProjectNameOnCard,
  status,
  tasks,
  title,
}: {
  boardDisplayOptions: BoardDisplayOptions
  draggingDisabled: boolean
  onOpenTask: (task: Task) => void
  projectsById: Record<string, Project>
  showProjectNameOnCard: boolean
  status: TaskStatus
  tasks: Task[]
  title: string
}): JSX.Element {
  const { isOver, setNodeRef } = useDroppable({
    id: kanbanColumnId(status),
    data: {
      type: 'column',
      status,
    } satisfies KanbanDragColumnData,
    disabled: draggingDisabled,
  })

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column${isOver ? ' kanban-column-over' : ''}`}
      aria-label={title}
    >
      <div className="task-card-header">
        <h3>{title}</h3>
        <span className={`status-pill status-${status}`}>{tasks.length}</span>
      </div>

      <SortableContext
        items={tasks.map((task) => kanbanTaskId(task.id))}
        strategy={verticalListSortingStrategy}
      >
        {tasks.length === 0 ? (
          <div className="kanban-empty-state">
            <p className="muted-copy">No tasks in this column.</p>
          </div>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <KanbanTaskCard
                key={task.id}
                boardDisplayOptions={boardDisplayOptions}
                draggingDisabled={draggingDisabled}
                onOpenTask={onOpenTask}
                project={projectsById[task.project_id] ?? null}
                showProjectNameOnCard={showProjectNameOnCard}
                task={task}
              />
            ))}
          </ul>
        )}
      </SortableContext>
    </section>
  )
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
  const [projectDialogMode, setProjectDialogMode] = useState<ProjectDialogMode>(null)
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
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null)
  const [kanbanMutationError, setKanbanMutationError] = useState<string | null>(null)
  const boardDisplayOptions = useBoardDisplayOptionsStore(
    useShallow((state) => ({
      showActualHours: state.showActualHours,
      showDueDate: state.showDueDate,
      showPriority: state.showPriority,
      showProjectName: state.showProjectName,
      showStatusBadge: state.showStatusBadge,
    })),
  )

  const projectMutations = useProjectMutations(async () => {
    await projectsQuery.reload()
  })

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
    .filter((task) => task.project_id in projectsById)
    .filter((task) => sidebarSelectedProjectIds.includes(task.project_id))
  const displayTasks = optimisticTasks ?? visibleTasks
  const sortedTasks = sortTasks(displayTasks, projectsById, taskSort)
  const selectedTask = sortedTasks.find((task) => task.id === activeTaskId) ?? null
  const timeLogsQuery = useTaskTimeLogs(taskDialogMode === 'edit' ? activeTaskId : null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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
  const boardInteractionDisabled = tasksQuery.isLoading || taskMutations.isSaving

  useEffect(() => {
    hydrateBoardDisplayOptionsFromStorage()
  }, [])

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
        displayTasks.some((task) => task.id === taskId),
      )

      if (
        nextIds.length === currentIds.length &&
        nextIds.every((taskId, index) => taskId === currentIds[index])
      ) {
        return currentIds
      }

      return nextIds
    })
  }, [displayTasks])

  useEffect(() => {
    setOptimisticTasks(null)
  }, [storedProjectIdsKey, tasksQuery.data])

  useEffect(() => {
    setKanbanMutationError(null)
  }, [storedProjectIdsKey])

  useEffect(() => {
    if (activeProjectIds.length === 0) {
      return
    }

    const sidebarIds = getSidebarSelectedProjectIds(selectedProjectIds, activeProjectIds)
    const toolbarProjectId = deriveToolbarProjectId(sidebarIds, activeProjectIds)

    if (selectedProjectId !== toolbarProjectId) {
      useProjectFilterStore.setState({ selectedProjectId: toolbarProjectId })
    }
  }, [activeProjectIdsKey, selectedProjectId, storedProjectIdsKey])

  useEffect(() => {
    if (activeProjectIds.length === 0) {
      return
    }

    if (
      selectedProjectId !== DEFAULT_PROJECT_FILTER &&
      !activeProjects.some((project) => project.id === selectedProjectId)
    ) {
      setToolbarProjectFilter(DEFAULT_PROJECT_FILTER, activeProjectIds)
    }
  }, [activeProjectIdsKey, activeProjects, selectedProjectId, setToolbarProjectFilter])

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
      await projectsQuery.reload()
      const remainingActiveProjectIds = activeProjectIds.filter(
        (activeProjectId) => activeProjectId !== projectId,
      )
      if (toolbarFilteredToArchivedProject) {
        setToolbarProjectFilter(DEFAULT_PROJECT_FILTER, remainingActiveProjectIds)
      }
      if (wasOnlySidebarSelection) {
        resetSidebarToAllProjects(remainingActiveProjectIds)
      }
      await tasksQuery.reload()
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
        projectsError={null}
        projectsLoading
      >
        <section className="workspace-panel">
          <p className="muted-copy">Loading workspace…</p>
        </section>
      </AppShell>
    )
  }

  const kanbanSection = hasSidebarProjectSelection ? (
    <>
      {tasksQuery.error ? <p className="form-error">{tasksQuery.error}</p> : null}
      {kanbanMutationError ? <p className="form-error">{kanbanMutationError}</p> : null}
      {tasksQuery.isLoading ? <p className="muted-copy">Loading tasks…</p> : null}

      <DndContext
        collisionDetection={closestCorners}
        onDragEnd={handleKanbanDragEnd}
        sensors={sensors}
      >
        <div ref={kanbanBoardRef} className="kanban-grid kanban-grid-row">
          {STATUS_OPTIONS.map((statusOption) => (
            <KanbanColumn
              key={statusOption.value}
              boardDisplayOptions={boardDisplayOptions}
              draggingDisabled={boardInteractionDisabled}
              onOpenTask={openEditTaskDialog}
              projectsById={projectsById}
              showProjectNameOnCard={showProjectNameOnCard}
              status={statusOption.value}
              tasks={taskOrderByStatus(displayTasks, statusOption.value)}
              title={statusOption.label}
            />
          ))}
        </div>
      </DndContext>
    </>
  ) : (
    <p className="muted-copy">No projects selected. Choose one or more projects in the sidebar.</p>
  )

  const tableSection = hasSidebarProjectSelection ? (
    <>
      <header className="workspace-panel-header">
        <h2>Task summary</h2>
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
    </>
  ) : (
    <>
      <header className="workspace-panel-header">
        <h2>Task summary</h2>
        <p>Shared filter target: {projectFilterLabel}</p>
      </header>
      <div className="task-table-wrap">
        <table className="task-table">
          <tbody>
            <tr>
              <td>
                <p className="muted-copy">
                  No projects selected. Choose one or more projects in the sidebar.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )

  return (
    <AppShell
      activeProjects={activeProjects}
      onCreateProject={openCreateProjectDialog}
      onEditProject={handleProjectEdit}
      projectsError={projectsQuery.error}
      projectsLoading={projectsQuery.isLoading}
    >
      <ProjectsPage
        activeProjects={activeProjects}
        kanbanSection={kanbanSection}
        onOpenCreateTask={openCreateTaskDialog}
        projectFilterLabel={projectFilterLabel}
        selectedProjectId={selectedProjectId}
        setToolbarProjectFilter={(projectId) => {
          setToolbarProjectFilter(projectId, activeProjectIds)
        }}
        tableSection={tableSection}
        tasksAreBlocked={tasksAreBlocked}
      />

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
    </AppShell>
  )
}

export default App
