import type { Project, Task, TimeLog } from '../api/types'
import { PROJECT_PALETTE } from '../lib/projectPalette'
import { SIDEBAR_PROJECT_FILTER_STORAGE_KEY } from '../stores/projectFilter'

export { PROJECT_PALETTE, SIDEBAR_PROJECT_FILTER_STORAGE_KEY }

export function buildProject(overrides: Partial<Project>): Project {
  return {
    id: overrides.id ?? 'project-default',
    name: overrides.name ?? 'Default Project',
    description: overrides.description ?? null,
    colour: overrides.colour ?? '#D97048',
    status: overrides.status ?? 'active',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

export function buildTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? 'task-default',
    project_id: overrides.project_id ?? 'project-default',
    title: overrides.title ?? 'Default task',
    description: overrides.description ?? null,
    status: overrides.status ?? 'backlog',
    priority: overrides.priority ?? 'medium',
    target_date: overrides.target_date ?? null,
    estimated_hours: overrides.estimated_hours ?? null,
    actual_hours: overrides.actual_hours ?? 0,
    kanban_order: overrides.kanban_order ?? null,
    completed_date: overrides.completed_date ?? null,
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

export function buildTimeLog(overrides: Partial<TimeLog>): TimeLog {
  return {
    id: overrides.id ?? 'log-default',
    task_id: overrides.task_id ?? 'task-default',
    project_id: overrides.project_id ?? 'project-default',
    hours: overrides.hours ?? 1,
    logged_date: overrides.logged_date ?? '2026-05-13',
    notes: overrides.notes ?? null,
    source: 'manual',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}
