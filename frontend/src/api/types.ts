export type ProjectStatus = 'active' | 'archived'
export type VentureStatus = 'active' | 'archived'
export type ProjectType = 'project' | 'asset' | 'gig' | 'contract'
export type ProjectBoardStatus = 'idea' | 'active' | 'paused' | 'shipped'
export type ActivityTypeStatus = 'active' | 'archived'

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done' | 'archived'

export type KanbanTaskStatus = 'backlog' | 'in_progress' | 'review' | 'done'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Project = {
  id: string
  venture_id: string
  name: string
  description: string | null
  colour: string | null
  icon: string | null
  project_type: ProjectType
  status: ProjectStatus
  board_status: ProjectBoardStatus
  kanban_order: number | null
  finished: boolean
  archived_by_venture: boolean
  created_at: string
  updated_at: string
}

export type ProjectPayload = {
  venture_id: string
  name: string
  description: string | null
  colour: string | null
  icon?: string | null
  project_type?: ProjectType
  board_status?: ProjectBoardStatus
  finished?: boolean
}

export type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  target_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  kanban_order: number | null
  completed_date: string | null
  created_at: string
  updated_at: string
}

export type TaskPayload = {
  project_id: string
  title: string
  description: string | null
  status: KanbanTaskStatus
  priority: TaskPriority
  target_date: string | null
  estimated_hours: number | null
}

export type TaskUpdatePayload = Partial<TaskPayload> & {
  status?: TaskStatus
}

export type TaskStatusPayload = {
  status: KanbanTaskStatus
  kanban_order: number | null
}

export type TimeLog = {
  id: string
  task_id: string
  project_id: string
  activity_type_id: string | null
  activity_type_name: string | null
  activity_type_display_name: string
  hours: number
  logged_date: string
  notes: string | null
  title: string | null
  location: string | null
  source: 'manual'
  created_at: string
  updated_at: string
}

export type TimeLogPayload = {
  hours: number
  logged_date: string
  notes: string | null
  activity_type_id?: string | null
  title?: string | null
  location?: string | null
}

export type TaskFilters = {
  projectId?: string
  status?: TaskStatus
  priority?: TaskPriority
}

export type VentureCategoryLabel = {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
  usage_count?: number
}

export type VentureCategoryLabelPayload = {
  name: string
}

export type Venture = {
  id: string
  name: string
  description: string | null
  colour: string | null
  icon: string | null
  status: VentureStatus
  category_label_id: string
  category_label: VentureCategoryLabel | null
  created_at: string
  updated_at: string
}

export type VenturePayload = {
  name: string
  description: string | null
  colour: string | null
  icon?: string | null
  category_label_id?: string
}

export type ActivityType = {
  id: string
  name: string
  slug: string
  status: ActivityTypeStatus
  sort_order: number | null
  created_at: string
  updated_at: string
}

export type ActivityTypePayload = {
  name: string
}
