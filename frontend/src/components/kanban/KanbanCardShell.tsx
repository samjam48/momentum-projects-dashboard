import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

type KanbanCardShellProps = {
  children: ReactNode
  className: string
  draggingDisabled: boolean
  dragData: Record<string, string>
  id: string
  style?: React.CSSProperties
  testAttributes?: Record<string, string | undefined>
}

export function KanbanCardShell({
  children,
  className,
  draggingDisabled,
  dragData,
  id,
  style,
  testAttributes,
}: KanbanCardShellProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      data: dragData,
      disabled: draggingDisabled,
    })

  return (
    <li
      ref={setNodeRef}
      className={`${className}${isDragging ? ' task-card-dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...style,
      }}
      {...testAttributes}
      {...attributes}
      {...listeners}
    >
      {children}
    </li>
  )
}
