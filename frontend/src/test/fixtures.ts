import type { Project, Task, TimeLog, Venture, VentureCategoryLabel } from '../api/types'
import { PROJECT_PALETTE } from '../lib/projectPalette'
import { SIDEBAR_PROJECT_FILTER_STORAGE_KEY } from '../stores/projectFilter'

export const BOARD_DISPLAY_OPTIONS_STORAGE_KEY = 'momentum.boardDisplayOptions'

export const MOCK_DEFAULT_VENTURE_ID = 'venture-unsorted'

export { PROJECT_PALETTE, SIDEBAR_PROJECT_FILTER_STORAGE_KEY }

export function buildVentureCategoryLabel(
  overrides: Partial<VentureCategoryLabel>,
): VentureCategoryLabel {
  return {
    id: overrides.id ?? 'label-hustle',
    name: overrides.name ?? 'Hustle',
    slug: overrides.slug ?? 'hustle',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
    usage_count: overrides.usage_count,
  }
}

export function buildVenture(overrides: Partial<Venture>): Venture {
  const categoryLabel = overrides.category_label ?? buildVentureCategoryLabel({})
  const categoryLabelId = overrides.category_label_id ?? categoryLabel.id

  return {
    id: overrides.id ?? MOCK_DEFAULT_VENTURE_ID,
    name: overrides.name ?? 'Unsorted',
    description: overrides.description ?? null,
    colour: overrides.colour ?? '#D97048',
    icon: overrides.icon ?? null,
    status: overrides.status ?? 'active',
    category_label_id: categoryLabelId,
    category_label: overrides.category_label ?? categoryLabel,
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

export function buildProject(overrides: Partial<Project>): Project {
  const ventureId = overrides.venture_id ?? MOCK_DEFAULT_VENTURE_ID

  return {
    id: overrides.id ?? 'project-default',
    venture_id: ventureId,
    name: overrides.name ?? 'Default Project',
    description: overrides.description ?? null,
    colour: overrides.colour ?? '#D97048',
    icon: overrides.icon ?? null,
    project_type: overrides.project_type ?? 'project',
    status: overrides.status ?? 'active',
    board_status: overrides.board_status ?? 'active',
    kanban_order: overrides.kanban_order ?? null,
    finished: overrides.finished ?? false,
    archived_by_venture: overrides.archived_by_venture ?? false,
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
    actual_hours:
      overrides.actual_hours !== undefined ? overrides.actual_hours : 0,
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
    activity_type_id: overrides.activity_type_id ?? null,
    activity_type_name: overrides.activity_type_name ?? null,
    activity_type_display_name: overrides.activity_type_display_name ?? 'uncategorised',
    hours: overrides.hours ?? 1,
    logged_date: overrides.logged_date ?? '2026-05-13',
    notes: overrides.notes ?? null,
    title: overrides.title ?? null,
    location: overrides.location ?? null,
    source: 'manual',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}
