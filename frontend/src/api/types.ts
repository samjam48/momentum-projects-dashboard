export type ProjectStatus = 'active' | 'archived'

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Project = {
  id: string
  name: string
  description: string | null
  colour: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export type ProjectPayload = {
  name: string
  description: string | null
  colour: string | null
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
  status: TaskStatus
  priority: TaskPriority
  target_date: string | null
  estimated_hours: number | null
}

export type TaskStatusPayload = {
  status: TaskStatus
  kanban_order: number | null
}

export type TimeLog = {
  id: string
  task_id: string
  project_id: string
  hours: number
  logged_date: string
  notes: string | null
  source: 'manual'
  created_at: string
  updated_at: string
}

export type TimeLogPayload = {
  hours: number
  logged_date: string
  notes: string | null
}

export type TaskFilters = {
  projectId?: string
  status?: TaskStatus
  priority?: TaskPriority
}
