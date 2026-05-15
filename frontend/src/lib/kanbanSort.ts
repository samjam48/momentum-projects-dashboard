import type { Project, ProjectBoardStatus, Task } from '../api/types'

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

export function compareProjectsForKanban(left: Project, right: Project): number {
  if (left.kanban_order !== null && right.kanban_order !== null) {
    if (left.kanban_order !== right.kanban_order) {
      return left.kanban_order - right.kanban_order
    }
  } else if (left.kanban_order !== null) {
    return -1
  } else if (right.kanban_order !== null) {
    return 1
  }

  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at)
  }

  return left.id.localeCompare(right.id)
}

export function sortProjectsForKanbanBoard(projects: Project[]): Project[] {
  return [...projects].sort(compareProjectsForKanban)
}

export function projectOrderByBoardStatus(
  projects: Project[],
  boardStatus: ProjectBoardStatus,
): Project[] {
  return sortProjectsForKanbanBoard(
    projects.filter((project) => project.board_status === boardStatus),
  )
}
