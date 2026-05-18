import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ReactNode } from 'react'

type KanbanColumnProps = {
  columnData: Record<string, string>
  draggingDisabled: boolean
  emptyStateCopy: string
  itemIds: string[]
  children: ReactNode
  droppableId: string
  pillClassName: string
  title: string
}

export function KanbanColumn({
  children,
  columnData,
  draggingDisabled,
  droppableId,
  emptyStateCopy,
  itemIds,
  pillClassName,
  title,
}: KanbanColumnProps): JSX.Element {
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: columnData,
    disabled: draggingDisabled,
  })

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column${isOver ? ' kanban-column-over' : ''}`}
      aria-label={title}
    >
      <div className="task-card-header">
        <span className={pillClassName}>{title}</span>
        <span className="kanban-column-count muted-copy">{itemIds.length}</span>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {itemIds.length === 0 ? (
          <div className="kanban-empty-state">
            <p className="muted-copy">{emptyStateCopy}</p>
          </div>
        ) : (
          <ul
            className="task-list kanban-task-list"
            style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
          >
            {children}
          </ul>
        )}
      </SortableContext>
    </section>
  )
}
