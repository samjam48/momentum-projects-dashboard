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

import type { Project, Task } from '../api/types'
import { taskOrderByStatus } from '../lib/kanbanSort'
import type { BoardDisplayOptions } from '../stores/boardDisplayOptions'
import { BoardOptionsMenu } from './kanban/BoardOptionsMenu'
import { KanbanTaskCard } from './kanban/KanbanTaskCard'

const STATUS_OPTIONS: Array<{ label: string; value: Task['status'] }> = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Review', value: 'review' },
  { label: 'Done', value: 'done' },
]

const KANBAN_COLUMN_ID_PREFIX = 'kanban-column:'
const KANBAN_TASK_ID_PREFIX = 'kanban-task:'

function kanbanColumnId(status: Task['status']): string {
  return `${KANBAN_COLUMN_ID_PREFIX}${status}`
}

function kanbanTaskId(taskId: string): string {
  return `${KANBAN_TASK_ID_PREFIX}${taskId}`
}

type KanbanDragColumnData = {
  status: Task['status']
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
  status: Task['status']
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
          <ul
            className="task-list kanban-task-list"
            style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
          >
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
