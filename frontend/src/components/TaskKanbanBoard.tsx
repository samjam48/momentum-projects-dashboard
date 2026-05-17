import type { DragEndEvent } from '@dnd-kit/core'
import type { RefObject } from 'react'

import type { Project, Task } from '../api/types'
import { taskOrderByStatus } from '../lib/kanbanSort'
import type { BoardDisplayOptions } from '../stores/boardDisplayOptions'
import { KanbanBoard } from './kanban/KanbanBoard'
import { KanbanColumn } from './kanban/KanbanColumn'
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

function TaskBoardColumn({
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
  return (
    <KanbanColumn
      columnData={{
        type: 'column',
        status,
      } satisfies KanbanDragColumnData}
      draggingDisabled={draggingDisabled}
      droppableId={kanbanColumnId(status)}
      emptyStateCopy="No tasks in this column."
      itemIds={tasks.map((task) => kanbanTaskId(task.id))}
      pillClassName={`status-pill status-${status}`}
      title={title}
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
    </KanbanColumn>
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

      <KanbanBoard boardRef={boardRef} onDragEnd={onDragEnd}>
        {STATUS_OPTIONS.map((statusOption) => (
          <TaskBoardColumn
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
      </KanbanBoard>
    </>
  )
}
