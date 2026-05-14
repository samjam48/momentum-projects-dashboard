import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { Project, Task } from '../../api/types'
import type { BoardDisplayOptions } from '../../stores/boardDisplayOptions'

function formatStatusLabel(status: Task['status']): string {
  return status.replace('_', ' ')
}

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `kanban-task:${task.id}`,
      data: {
        type: 'task',
        taskId: task.id,
        status: task.status,
      },
      disabled: draggingDisabled,
    })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`task-card kanban-task-card${isDragging ? ' task-card-dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="kanban-task-linear">
        <span
          aria-hidden
          className="kanban-task-colour-dot"
          data-testid="kanban-task-colour-dot"
          style={{ backgroundColor: project?.colour ?? '#c4b5a8' }}
        />

        <div className="kanban-task-body">
          <button
            className="kanban-task-title"
            data-testid="kanban-task-title"
            type="button"
            onClick={() => onOpenTask(task)}
          >
            {task.title}
          </button>

          {showProjectNameOnCard && project ? (
            <p className="kanban-project-name">{project.name}</p>
          ) : null}

          <div className="kanban-task-metrics">
            {boardDisplayOptions.showPriority ? (
              <span className="status-pill">{task.priority}</span>
            ) : null}

            {boardDisplayOptions.showActualHours && task.actual_hours > 0 ? (
              <span className="task-meta">{formatMetricValue(task.actual_hours)}</span>
            ) : null}

            {boardDisplayOptions.showStatusBadge ? (
              <span
                className={`status-pill status-${task.status}`}
                data-testid="kanban-task-status-badge"
              >
                {formatStatusLabel(task.status)}
              </span>
            ) : null}

            {boardDisplayOptions.showDueDate && task.target_date ? (
              <span className="task-meta">{task.target_date}</span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}
