import type { FormEvent, MouseEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'

import type {
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  TimeLog,
} from '../api/types'
import {
  formatTimeLogDate,
  getTimeLogBody,
  getTimeLogLocation,
  getTimeLogTitle,
} from '../lib/timeLogDisplay'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

export type TaskFormState = {
  description: string
  estimated_hours: string
  priority: TaskPriority
  project_id: string
  status: TaskStatus
  target_date: string
  title: string
}

export type TaskFormErrors = {
  description?: string
  estimated_hours?: string
  form?: string
  priority?: string
  project_id?: string
  status?: string
  target_date?: string
  title?: string
}

type TimeLogSubFormState = {
  date: string
  hours: string
  location: string
  notes: string
  title: string
}

type TimeLogSubFormErrors = {
  form?: string
  hours?: string
}

const KANBAN_STATUS_OPTIONS: Array<{ label: string; value: TaskStatus }> = [
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

function formatValue(value: number | string | null): string {
  if (value === null || value === '') {
    return '—'
  }

  return String(value)
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

type TaskDialogProps = {
  activeProjects: Project[]
  mode: 'create' | 'edit'
  onArchive?: () => Promise<void>
  onCancel: () => void
  onClose: () => Promise<void>
  onCreateSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onFieldBlur: () => Promise<void>
  onFieldChange: (field: keyof TaskFormState, value: string) => void
  onTimeLogCreate: (payload: {
    hours: number
    location: string | null
    logged_date: string
    notes: string | null
    title: string | null
  }) => Promise<void>
  onTimeLogDelete: (timeLogId: string) => Promise<void>
  selectedTask: Task | null
  taskForm: TaskFormState
  taskFormErrors: TaskFormErrors
  taskMutationsSaving: boolean
  timeLogMutationsSaving: boolean
  timeLogs: TimeLog[]
  timeLogsError: string | null
  timeLogsLoading: boolean
}

export function TaskDialog({
  activeProjects,
  mode,
  onArchive,
  onCancel,
  onClose,
  onCreateSubmit,
  onFieldBlur,
  onFieldChange,
  onTimeLogCreate,
  onTimeLogDelete,
  selectedTask,
  taskForm,
  taskFormErrors,
  taskMutationsSaving,
  timeLogMutationsSaving,
  timeLogs,
  timeLogsError,
  timeLogsLoading,
}: TaskDialogProps): JSX.Element {
  const dialogLabelId = useId()
  const [timeLogDialogOpen, setTimeLogDialogOpen] = useState(false)
  const [timeLogForm, setTimeLogForm] = useState<TimeLogSubFormState>({
    date: todayIsoDate(),
    hours: '',
    location: '',
    notes: '',
    title: '',
  })
  const [timeLogFormErrors, setTimeLogFormErrors] = useState<TimeLogSubFormErrors>({})
  const [expandedTimeLogId, setExpandedTimeLogId] = useState<string | null>(null)
  const [pendingTimeLogDeleteId, setPendingTimeLogDeleteId] = useState<string | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (mode === 'edit' && titleRef.current) {
      titleRef.current.textContent = taskForm.title
    }
  }, [mode, taskForm.title])

  const resetTimeLogForm = (): void => {
    setTimeLogForm({
      date: todayIsoDate(),
      hours: '',
      location: '',
      notes: '',
      title: '',
    })
    setTimeLogFormErrors({})
  }

  const handleTimeLogSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setTimeLogFormErrors({})

    const hoursValue = timeLogForm.hours.trim()
    if (hoursValue === '' || Number(hoursValue) <= 0) {
      setTimeLogFormErrors({ hours: 'hours must be greater than zero' })
      return
    }

    await onTimeLogCreate({
      hours: Number(hoursValue),
      location: timeLogForm.location.trim() || null,
      logged_date: timeLogForm.date || todayIsoDate(),
      notes: timeLogForm.notes.trim() || null,
      title: timeLogForm.title.trim() || null,
    })

    setTimeLogDialogOpen(false)
    resetTimeLogForm()
  }

  const dialogAriaLabel = mode === 'create' ? 'New task' : 'Edit task'

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && mode === 'edit') {
      void onClose()
    }
  }

  const timeLogsPanel =
    mode === 'edit' ? (
      <section
        aria-labelledby={`${dialogLabelId}-time-logs`}
        className="task-detail-panel"
        data-testid="time-logs-section"
      >
        <h3 id={`${dialogLabelId}-time-logs`}>Time logs</h3>

        <div className="time-logs-summary" data-testid="time-logs-summary">
          <div className="time-log-card">
            <span>Actual hours</span>
            <strong>{formatValue(selectedTask?.actual_hours ?? null)}</strong>
          </div>
          <div className="time-log-card">
            <span>Completed date</span>
            <strong>{formatValue(selectedTask?.completed_date ?? null)}</strong>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            resetTimeLogForm()
            setTimeLogDialogOpen(true)
          }}
        >
          + Add time log
        </Button>

        {timeLogsError ? <p className="form-error">{timeLogsError}</p> : null}
        {timeLogsLoading ? <p className="muted-copy">Loading time logs…</p> : null}

        <ul aria-label="Time logs" className="time-log-list">
          {timeLogs.map((timeLog) => {
            const body = getTimeLogBody(timeLog)
            const location = getTimeLogLocation(timeLog)
            const title = getTimeLogTitle(timeLog)
            const formattedDate = formatTimeLogDate(timeLog.logged_date)
            const detailText = body?.trim() ? body : 'No notes'
            const hasNotesBody = Boolean(body?.trim())

            return (
              <li key={timeLog.id}>
                <div className="time-log-row-wrap">
                  <button
                    className="time-log-row"
                    data-testid={`time-log-row-${timeLog.id}`}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(156, 93, 53, 0.35)',
                      borderRadius: '14px',
                    }}
                    type="button"
                    onClick={() =>
                      setExpandedTimeLogId((currentId) =>
                        currentId === timeLog.id ? null : timeLog.id,
                      )
                    }
                  >
                    <span
                      className="time-log-row-primary-line"
                      data-testid="time-log-row-primary"
                    >
                      <strong>{title}</strong>
                    </span>
                    <span
                      className="time-log-row-primary-line"
                      data-testid="time-log-row-secondary"
                    >
                      {formattedDate ? ` · ${formattedDate}` : ''}
                      {location ? ` · ${location}` : ''}
                    </span>
                  </button>
                  <button
                    aria-label={`Delete time log ${title}`}
                    className="time-log-delete"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setPendingTimeLogDeleteId(timeLog.id)
                    }}
                  >
                    X
                  </button>
                </div>
                {expandedTimeLogId === timeLog.id ? (
                  <p
                    className={hasNotesBody ? 'time-log-detail' : 'time-log-detail muted-copy'}
                    data-testid={`time-log-detail-${timeLog.id}`}
                  >
                    {detailText}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    ) : null

  return (
    <>
      <div className="dialog-backdrop" role="presentation" onClick={handleBackdropClick}>
        <div
          aria-label={dialogAriaLabel}
          aria-modal="true"
          className="task-dialog"
          role="dialog"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && mode === 'edit') {
              void onClose()
            }
          }}
        >
          {mode === 'create' ? (
            <div className="task-dialog-header" />
          ) : (
            <div className="task-dialog-header">
              <h3
                ref={titleRef}
                contentEditable
                suppressContentEditableWarning
                style={{ fontSize: '20px', padding: '12.8px 15.2px' }}
                onBlur={(event) => {
                  onFieldChange('title', event.currentTarget.textContent ?? '')
                  void onFieldBlur()
                }}
                onInput={(event) => {
                  onFieldChange('title', event.currentTarget.textContent ?? '')
                }}
              >
                {taskForm.title}
              </h3>
              <Button
                aria-label="Close task"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => void onClose()}
              >
                <span aria-hidden>X</span>
                <X aria-hidden size={18} />
              </Button>
            </div>
          )}

          <div className="task-dialog-grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)' }}>
            {mode === 'create' ? (
            <form
              noValidate
              aria-label="New task"
              className="project-form"
              onSubmit={(event) => void onCreateSubmit(event)}
            >
                <label className="field">
                  <span>Title</span>
                  <input
                    aria-label="Title"
                    name="title"
                    value={taskForm.title}
                    onChange={(event) => onFieldChange('title', event.target.value)}
                  />
                  {taskFormErrors.title ? (
                    <span className="field-error">{taskFormErrors.title}</span>
                  ) : null}
                </label>

                <label className="field">
                  <span>Description</span>
                  <textarea
                    aria-label="Description"
                    name="description"
                    rows={4}
                    value={taskForm.description}
                    onChange={(event) => onFieldChange('description', event.target.value)}
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
                    onChange={(event) => onFieldChange('project_id', event.target.value)}
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
                      onChange={(event) => onFieldChange('status', event.target.value)}
                    >
                      {KANBAN_STATUS_OPTIONS.map((option) => (
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
                      onChange={(event) => onFieldChange('priority', event.target.value)}
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
                      onChange={(event) => onFieldChange('target_date', event.target.value)}
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
                        onFieldChange('estimated_hours', event.target.value)
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
                    Create task
                  </button>
                  <button className="secondary-button" type="button" onClick={onCancel}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
              <form
                noValidate
                aria-label="Edit task"
                className="project-form"
                onSubmit={(event) => event.preventDefault()}
              >
                <label className="field">
                  <span className="sr-only">Description</span>
                  <textarea
                    aria-label="Description"
                    name="description"
                    rows={4}
                    value={taskForm.description}
                    onBlur={() => void onFieldBlur()}
                    onChange={(event) => onFieldChange('description', event.target.value)}
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
                    onBlur={() => void onFieldBlur()}
                    onChange={(event) => onFieldChange('project_id', event.target.value)}
                  >
                    {activeProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="task-form-row">
                  <label className="field">
                    <span>Status</span>
                    <select
                      aria-label="Status"
                      value={taskForm.status}
                      onBlur={() => void onFieldBlur()}
                      onChange={(event) => onFieldChange('status', event.target.value)}
                    >
                      {KANBAN_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Priority</span>
                    <select
                      aria-label="Priority"
                      value={taskForm.priority}
                      onBlur={() => void onFieldBlur()}
                      onChange={(event) => onFieldChange('priority', event.target.value)}
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="task-form-row">
                  <label className="field">
                    <span>Target date</span>
                    <input
                      aria-label="Target date"
                      type="date"
                      value={taskForm.target_date}
                      onBlur={() => void onFieldBlur()}
                      onChange={(event) => onFieldChange('target_date', event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>Estimated hours</span>
                    <input
                      aria-label="Estimated hours"
                      min="0"
                      step="0.25"
                      type="number"
                      value={taskForm.estimated_hours}
                      onBlur={() => void onFieldBlur()}
                      onChange={(event) =>
                        onFieldChange('estimated_hours', event.target.value)
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

                <footer
                  aria-label="Task actions"
                  className="task-dialog-footer"
                  data-testid="task-dialog-footer"
                  role="contentinfo"
                >
                <Button className="default" type="button" variant="default" onClick={onCancel}>
                  Cancel
                </Button>
                  {onArchive ? (
                    <Button type="button" variant="ghost" onClick={() => void onArchive()}>
                      Archive
                    </Button>
                  ) : null}
                </footer>
              </form>
              {timeLogsPanel}
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={timeLogDialogOpen}
        onOpenChange={(open) => {
          setTimeLogDialogOpen(open)
          if (!open) {
            resetTimeLogForm()
          }
        }}
      >
        <DialogContent aria-describedby={undefined} aria-label="Add time log">
          <DialogHeader>
            <DialogTitle>Add time log</DialogTitle>
          </DialogHeader>

          <form className="project-form" noValidate onSubmit={(event) => void handleTimeLogSave(event)}>
            <label className="field">
              <span>Title</span>
              <input
                aria-label="Title"
                value={timeLogForm.title}
                onChange={(event) =>
                  setTimeLogForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>Notes</span>
              <textarea
                aria-label="Notes"
                rows={3}
                value={timeLogForm.notes}
                onChange={(event) =>
                  setTimeLogForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>Location</span>
              <input
                aria-label="Location"
                value={timeLogForm.location}
                onChange={(event) =>
                  setTimeLogForm((current) => ({ ...current, location: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>Date</span>
              <input
                aria-label="Date"
                type="date"
                value={timeLogForm.date}
                onChange={(event) =>
                  setTimeLogForm((current) => ({ ...current, date: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>Time</span>
              <input
                aria-label="Time"
                min="0"
                step="0.25"
                type="number"
                value={timeLogForm.hours}
                onChange={(event) => {
                  setTimeLogForm((current) => ({ ...current, hours: event.target.value }))
                  setTimeLogFormErrors({})
                }}
              />
              {timeLogFormErrors.hours ? (
                <span className="field-error">{timeLogFormErrors.hours}</span>
              ) : null}
            </label>

            <DialogFooter>
              <Button disabled={timeLogMutationsSaving} type="submit">
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setTimeLogDialogOpen(false)
                  resetTimeLogForm()
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {pendingTimeLogDeleteId ? (
        <div
          className="time-log-confirm-backdrop"
          role="presentation"
          onClick={() => setPendingTimeLogDeleteId(null)}
        >
          <div
            aria-describedby={`${dialogLabelId}-time-log-delete-desc`}
            aria-labelledby={`${dialogLabelId}-time-log-delete-title`}
            aria-modal="true"
            className="time-log-confirm-dialog"
            role="alertdialog"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setPendingTimeLogDeleteId(null)
              }
            }}
          >
            <h4 id={`${dialogLabelId}-time-log-delete-title`}>Delete time log?</h4>
            <p id={`${dialogLabelId}-time-log-delete-desc`}>
              This permanently removes the entry and updates task hours.
            </p>
            <div className="time-log-confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setPendingTimeLogDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  void (async () => {
                    await onTimeLogDelete(pendingTimeLogDeleteId)
                    setPendingTimeLogDeleteId(null)
                  })()
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
