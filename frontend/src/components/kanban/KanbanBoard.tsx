import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { ReactNode, RefObject } from 'react'

type KanbanBoardProps = {
  boardRef: RefObject<HTMLDivElement>
  children: ReactNode
  onDragEnd: (event: DragEndEvent) => void
}

export function KanbanBoard({
  boardRef,
  children,
  onDragEnd,
}: KanbanBoardProps): JSX.Element {
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

  return (
    <DndContext collisionDetection={closestCorners} onDragEnd={onDragEnd} sensors={sensors}>
      <div ref={boardRef} className="kanban-grid-row">
        {children}
      </div>
    </DndContext>
  )
}
