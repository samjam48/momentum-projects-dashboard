import type { Project, Task, TaskPriority } from '../../api/types'

export type TaskSortKey = 'target_date' | 'priority' | 'project_name'

export type TaskSortState = {
  direction: 'asc' | 'desc'
  key: TaskSortKey
} | null

const PRIORITY_SORT_WEIGHT: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
}

export function compareTasks(
  leftTask: Task,
  rightTask: Task,
  projectsById: Record<string, Project>,
  sortState: TaskSortState,
  leftIndex: number,
  rightIndex: number,
): number {
  if (!sortState) {
    return leftIndex - rightIndex
  }

  const directionWeight = sortState.direction === 'asc' ? 1 : -1

  if (sortState.key === 'project_name') {
    const leftName = projectsById[leftTask.project_id]?.name ?? ''
    const rightName = projectsById[rightTask.project_id]?.name ?? ''
    const nameComparison = leftName.localeCompare(rightName, undefined, {
      sensitivity: 'base',
    })

    if (nameComparison !== 0) {
      return nameComparison * directionWeight
    }
  }

  if (sortState.key === 'priority') {
    const priorityComparison =
      PRIORITY_SORT_WEIGHT[leftTask.priority] -
      PRIORITY_SORT_WEIGHT[rightTask.priority]

    if (priorityComparison !== 0) {
      return priorityComparison * directionWeight
    }
  }

  if (sortState.key === 'target_date') {
    const leftDate = leftTask.target_date
    const rightDate = rightTask.target_date

    if (leftDate === null && rightDate !== null) {
      return 1
    }

    if (leftDate !== null && rightDate === null) {
      return -1
    }

    if (leftDate !== null && rightDate !== null) {
      const dateComparison = leftDate.localeCompare(rightDate)
      if (dateComparison !== 0) {
        return dateComparison * directionWeight
      }
    }
  }

  return leftIndex - rightIndex
}

export function sortTasks(
  tasks: Task[],
  projectsById: Record<string, Project>,
  sortState: TaskSortState,
): Task[] {
  if (!sortState) {
    return tasks
  }

  const indexedTasks = tasks.map((task, index) => ({ index, task }))

  return indexedTasks
    .sort((leftEntry, rightEntry) =>
      compareTasks(
        leftEntry.task,
        rightEntry.task,
        projectsById,
        sortState,
        leftEntry.index,
        rightEntry.index,
      ),
    )
    .map((entry) => entry.task)
}
