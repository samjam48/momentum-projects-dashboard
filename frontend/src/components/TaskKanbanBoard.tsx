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
import type { RefObject } from 'react'

import type { Project, Task, TaskStatus } from '../api/types'
import type { BoardDisplayOptions } from '../stores/boardDisplayOptions'
import { BoardOptionsMenu } from './kanban/BoardOptionsMenu'
import { KanbanTaskCard } from './kanban/KanbanTaskCard'

const STATUS_OPTIONS: Array<{ label: string; value: TaskStatus }> = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Review', value: 'review' },
  { label: 'Done', value: 'done' },
]

const KANBAN_COLUMN_ID_PREFIX = 'kanban-column:'
const KANBAN_TASK_ID_PREFIX = 'kanban-task:'

function kanbanColumnId(status: TaskStatus): string {
  return `${KANBAN_COLUMN_ID_PREFIX}${status}`
}

function kanbanTaskId(taskId: string): string {
  return `${KANBAN_TASK_ID_PREFIX}${taskId}`
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

function taskOrderByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return sortTasksForKanban(tasks.filter((task) => task.status === status))
}

type KanbanDragColumnData = {
  status: TaskStatus
  type: 'column'
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
        <span className={`status-pill status-${status}`}>{title}</span>
        <span className="kanban-column-count muted-copy">{tasks.length}</span>
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

export type TaskKanbanBoardProps = {
  boardDisplayOptions: BoardDisplayOptions
  boardInteractionDisabled: boolean
  boardRef: RefObject<HTMLDivElement>
  displayTasks: Task[]
  hasSidebarProjectSelection: boolean
  kanbanMutationError: string | null
  onDragEnd: (event: DragEndEvent) => void
  onOpenTask: (task: Task) => void
  projectsById: Record<string, Project>
  showProjectNameOnCard: boolean
  tasksError: string | null
  tasksLoading: boolean
}

export function TaskKanbanBoard({
  boardDisplayOptions,
  boardInteractionDisabled,
  boardRef,
  displayTasks,
  hasSidebarProjectSelection,
  kanbanMutationError,
  onDragEnd,
  onOpenTask,
  projectsById,
  showProjectNameOnCard,
  tasksError,
  tasksLoading,
}: TaskKanbanBoardProps): JSX.Element {
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

  if (!hasSidebarProjectSelection) {
    return (
      <p className="muted-copy">No projects selected. Choose one or more projects in the sidebar.</p>
    )
  }

  return (
    <>
      <header className="section-title-bar">
        <h2 className="section-title">Tasks</h2>
        <BoardOptionsMenu />
      </header>

      {tasksError ? <p className="form-error">{tasksError}</p> : null}
      {kanbanMutationError ? <p className="form-error">{kanbanMutationError}</p> : null}
      {tasksLoading ? <p className="muted-copy">Loading tasks…</p> : null}

      <DndContext collisionDetection={closestCorners} onDragEnd={onDragEnd} sensors={sensors}>
        <div ref={boardRef} className="kanban-grid-row">
          {STATUS_OPTIONS.map((statusOption) => (
            <KanbanColumn
              key={statusOption.value}
              boardDisplayOptions={boardDisplayOptions}
              draggingDisabled={boardInteractionDisabled}
              onOpenTask={onOpenTask}
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
  )
}
