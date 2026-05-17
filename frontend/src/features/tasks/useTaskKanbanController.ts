import type { DragEndEvent } from '@dnd-kit/core'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '../../api/client'
import type {
  KanbanTaskStatus,
  Task,
  TaskStatus,
  TaskStatusPayload,
} from '../../api/types'
import {
  getDropDetailFromDragEvent,
  hasKanbanComparableChanged,
  reorderKanbanItems,
  type DropDetail,
  type KanbanDndConfig,
} from '../../lib/kanbanDnd'
import { sortTasksForKanban } from '../../lib/kanbanSort'

type KanbanDropDetail = {
  kanban_order: number | null
  status: KanbanTaskStatus
  taskId: string
}

const KANBAN_TASK_STATUSES: readonly KanbanTaskStatus[] = [
  'backlog',
  'in_progress',
  'review',
  'done',
]

function isKanbanTaskStatus(value: string): value is KanbanTaskStatus {
  return (KANBAN_TASK_STATUSES as readonly string[]).includes(value)
}

function taskKanbanColumnKey(task: Task): KanbanTaskStatus {
  return isKanbanTaskStatus(task.status) ? task.status : 'backlog'
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
    isKanbanTaskStatus(value.status) &&
    'kanban_order' in value &&
    (typeof value.kanban_order === 'number' || value.kanban_order === null)
  )
}

const taskKanbanDndConfig: KanbanDndConfig<Task, KanbanTaskStatus> = {
  columnIdPrefix: 'kanban-column:',
  cardIdPrefix: 'kanban-task:',
  getColumnKey: taskKanbanColumnKey,
  getOrder: (task) => task.kanban_order,
  setColumnAndOrder: (task, column, order) => ({
    ...task,
    status: column,
    kanban_order: order,
    completed_date: column === 'done' ? task.completed_date : null,
  }),
  orderItemsInColumn: (items, column) =>
    sortTasksForKanban(items.filter((task) => task.status === column)),
}

function toTaskKanbanDropDetail(detail: DropDetail<KanbanTaskStatus>): KanbanDropDetail {
  return {
    taskId: detail.itemId,
    status: detail.columnKey,
    kanban_order: detail.kanban_order,
  }
}

function taskKanbanComparable(task: Task): {
  completed_date: string | null
  kanban_order: number | null
  status: TaskStatus
} {
  return {
    status: task.status,
    kanban_order: task.kanban_order,
    completed_date: task.completed_date,
  }
}

type TaskMutationBundle = {
  resetError: () => void
  updateStatus: (taskId: string, payload: TaskStatusPayload) => Promise<Task>
}

export type UseTaskKanbanControllerArgs = {
  boardInteractionDisabled: boolean
  boardRef: RefObject<HTMLDivElement | null>
  storedProjectIdsKey: string
  taskMutations: TaskMutationBundle
  tasksData: Task[]
  visibleTasks: Task[]
}

export function useTaskKanbanController({
  boardInteractionDisabled,
  boardRef,
  storedProjectIdsKey,
  taskMutations,
  tasksData,
  visibleTasks,
}: UseTaskKanbanControllerArgs): {
  displayTasks: Task[]
  handleKanbanDragEnd: (event: DragEndEvent) => void
  kanbanMutationError: string | null
} {
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null)
  const [kanbanMutationError, setKanbanMutationError] = useState<string | null>(null)

  const displayTasks = optimisticTasks ?? visibleTasks

  const previousFilterKeyRef = useRef(storedProjectIdsKey)
  useEffect(() => {
    if (previousFilterKeyRef.current === storedProjectIdsKey) {
      return
    }
    previousFilterKeyRef.current = storedProjectIdsKey
    setOptimisticTasks((current) => (current !== null ? null : current))
    setKanbanMutationError((current) => (current !== null ? null : current))
  }, [storedProjectIdsKey])

  const previousTasksDataRef = useRef(tasksData)
  useEffect(() => {
    if (previousTasksDataRef.current === tasksData) {
      return
    }
    previousTasksDataRef.current = tasksData
    setOptimisticTasks((current) => (current !== null ? null : current))
  }, [tasksData])

  const handleKanbanDrop = useCallback(
    async (detail: KanbanDropDetail): Promise<void> => {
      if (boardInteractionDisabled) {
        return
      }

      const nextTasks = reorderKanbanItems(
        displayTasks,
        detail.taskId,
        detail.status,
        detail.kanban_order,
        taskKanbanDndConfig,
      )
      if (!hasKanbanComparableChanged(displayTasks, nextTasks, taskKanbanComparable)) {
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

  const handleKanbanDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const detail = getDropDetailFromDragEvent(displayTasks, event, taskKanbanDndConfig)
      if (!detail) {
        return
      }

      void handleKanbanDrop(toTaskKanbanDropDetail(detail))
    },
    [displayTasks, handleKanbanDrop],
  )

  useEffect(() => {
    const kanbanBoard = boardRef.current
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
  }, [boardRef, handleKanbanDrop])

  return {
    displayTasks,
    handleKanbanDragEnd,
    kanbanMutationError,
  }
}
