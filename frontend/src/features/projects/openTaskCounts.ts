import type { Project, Task } from '../../api/types'

export function deriveOpenTaskCountsByProjectId(
  projects: Project[],
  tasks: Task[],
): Record<string, number> {
  const activeProjectIds = new Set(
    projects
      .filter((project) => project.status === 'active')
      .map((project) => project.id),
  )

  return tasks.reduce<Record<string, number>>((counts, task) => {
    if (task.status === 'done' || task.status === 'archived') {
      return counts
    }

    if (!activeProjectIds.has(task.project_id)) {
      return counts
    }

    counts[task.project_id] = (counts[task.project_id] ?? 0) + 1
    return counts
  }, {})
}
