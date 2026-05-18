import type { Project, Task } from '../../api/types'
import { formatDueDateDisplay } from '../../lib/formatDate'
import type { BoardDisplayOptions } from '../../stores/boardDisplayOptions'
import { KanbanCardShell } from './KanbanCardShell'

function formatMetricValue(value: number | string | null): string {
  if (value === null || value === '') {
    return '—'
  }

  return String(value)
}

type KanbanTaskCardProps = {
  boardDisplayOptions: BoardDisplayOptions
  draggingDisabled: boolean
  onOpenTask: (task: Task) => void
  project: Project | null
  showProjectNameOnCard: boolean
  task: Task
}

export function KanbanTaskCard({
  boardDisplayOptions,
  draggingDisabled,
  onOpenTask,
  project,
  showProjectNameOnCard,
  task,
}: KanbanTaskCardProps): JSX.Element {
  const showProjectPill =
    boardDisplayOptions.showProjectName && showProjectNameOnCard && project !== null

  return (
    <KanbanCardShell
      className="task-card kanban-task-card"
      dragData={{
        type: 'task',
        taskId: task.id,
        status: task.status,
      }}
      draggingDisabled={draggingDisabled}
      id={`kanban-task:${task.id}`}
      style={{ padding: '16px' }}
    >
      <div className="kanban-task-linear">
        <div className="kanban-task-title-row">
          <button
            className="kanban-task-title"
            data-testid="kanban-task-title"
            type="button"
            onClick={() => onOpenTask(task)}
          >
            {task.title}
          </button>
          <span
            aria-hidden
            className="kanban-task-colour-dot"
            data-testid="kanban-task-colour-dot"
            style={{ backgroundColor: project?.colour ?? '#c4b5a8' }}
          />
        </div>

        {showProjectPill ? (
          <span
            className="kanban-project-pill"
            style={{
              backgroundColor: `color-mix(in srgb, ${project.colour ?? '#c4b5a8'} 22%, transparent)`,
              color: project.colour ?? '#5b4a3f',
            }}
          >
            {project.name}
          </span>
        ) : null}

        <div className="kanban-task-metrics">
          {boardDisplayOptions.showPriority ? (
            <span className="status-pill">{task.priority}</span>
          ) : null}

          {boardDisplayOptions.showActualHours && task.actual_hours > 0 ? (
            <span className="task-meta">{formatMetricValue(task.actual_hours)}</span>
          ) : null}

          {boardDisplayOptions.showDueDate && task.target_date ? (
            <span className="task-meta">{formatDueDateDisplay(task.target_date)}</span>
          ) : null}
        </div>
      </div>
    </KanbanCardShell>
  )
}
