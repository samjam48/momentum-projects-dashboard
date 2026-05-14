import type { Task } from '../api/types'

export function compareTasksForKanban(leftTask: Task, rightTask: Task): number {
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

export function sortTasksForKanban(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasksForKanban)
}

export function taskOrderByStatus(tasks: Task[], status: Task['status']): Task[] {
  return sortTasksForKanban(tasks.filter((task) => task.status === status))
}
