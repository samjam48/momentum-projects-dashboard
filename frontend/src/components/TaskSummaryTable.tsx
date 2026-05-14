import type { Project, Task, TaskStatus } from '../api/types'
import { DEFAULT_PROJECT_FILTER } from '../stores/projectFilter'
import { TableSortMenu, type TaskSortKey } from './TableSortMenu'

type TaskSortState = {
  key: TaskSortKey
  direction: 'asc' | 'desc'
} | null

function formatStatusLabel(status: TaskStatus): string {
  return status.replace('_', ' ')
}

function formatValue(value: number | string | null): string {
  if (value === null || value === '') {
    return '—'
  }

  return String(value)
}

function buildFilterSubtitle(
  selectedProjectId: string,
  sidebarSelectedProjectIds: string[],
  activeProjects: Project[],
  projectsById: Record<string, Project>,
): string {
  if (selectedProjectId !== DEFAULT_PROJECT_FILTER) {
    const projectName = projectsById[selectedProjectId]?.name
    if (projectName) {
      return `Showing ${projectName}`
    }
  }

  if (
    sidebarSelectedProjectIds.length === activeProjects.length &&
    activeProjects.length > 0
  ) {
    return 'Showing all projects'
  }

  return `Showing ${sidebarSelectedProjectIds.length} projects`
}

export type TaskSummaryTableProps = {
  activeProjects: Project[]
  hasSidebarProjectSelection: boolean
  onOpenEditTask: (task: Task) => void
  onSort: (key: TaskSortKey) => void
  projectsById: Record<string, Project>
  selectedProjectId: string
  sidebarSelectedProjectIds: string[]
  sortedTasks: Task[]
  tableTitleDisambiguationTaskIds: string[]
  taskSort: TaskSortState
  tasksError: string | null
  tasksLoading: boolean
}

export function TaskSummaryTable({
  activeProjects,
  hasSidebarProjectSelection,
  onOpenEditTask,
  onSort,
  projectsById,
  selectedProjectId,
  sidebarSelectedProjectIds,
  sortedTasks,
  tableTitleDisambiguationTaskIds,
  taskSort,
  tasksError,
  tasksLoading,
}: TaskSummaryTableProps): JSX.Element {
  const filterSubtitle = buildFilterSubtitle(
    selectedProjectId,
    sidebarSelectedProjectIds,
    activeProjects,
    projectsById,
  )

  if (!hasSidebarProjectSelection) {
    return (
      <>
        <header className="section-title-bar">
          <div className="section-title-stack">
            <h2 className="section-title">Task summary</h2>
            <p className="task-summary-subtitle">{filterSubtitle}</p>
          </div>
          <TableSortMenu onSort={onSort} />
        </header>
        <div className="task-table-wrap">
          <table className="task-table">
            <tbody>
              <tr>
                <td>
                  <p className="muted-copy">
                    No projects selected. Choose one or more projects in the sidebar.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="section-title-bar">
        <div className="section-title-stack">
          <h2 className="section-title">Task summary</h2>
          <p className="task-summary-subtitle">{filterSubtitle}</p>
        </div>
        <TableSortMenu onSort={onSort} />
      </header>

      {tasksError ? <p className="form-error">{tasksError}</p> : null}
      {tasksLoading ? <p className="muted-copy">Loading task summary…</p> : null}

      <div className="task-table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th
                aria-sort={
                  taskSort?.key === 'project_name'
                    ? taskSort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                scope="col"
              >
                <button
                  className="table-sort-button"
                  type="button"
                  onClick={() => onSort('project_name')}
                >
                  Project
                </button>
              </th>
              <th scope="col">Status</th>
              <th
                aria-sort={
                  taskSort?.key === 'priority'
                    ? taskSort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                scope="col"
              >
                <button
                  className="table-sort-button"
                  type="button"
                  onClick={() => onSort('priority')}
                >
                  Priority
                </button>
              </th>
              <th
                aria-sort={
                  taskSort?.key === 'target_date'
                    ? taskSort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                scope="col"
              >
                <button
                  className="table-sort-button"
                  type="button"
                  onClick={() => onSort('target_date')}
                >
                  Target date
                </button>
              </th>
              <th scope="col">Estimated hours</th>
              <th scope="col">Actual hours</th>
              <th scope="col">Completed date</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <p className="muted-copy">No tasks match the current filter.</p>
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    {tableTitleDisambiguationTaskIds.includes(task.id)
                      ? `${task.title}\u200b`
                      : task.title}
                  </td>
                  <td>{projectsById[task.project_id]?.name ?? 'Unknown project'}</td>
                  <td>{formatStatusLabel(task.status)}</td>
                  <td>{task.priority}</td>
                  <td>{formatValue(task.target_date)}</td>
                  <td>{formatValue(task.estimated_hours)}</td>
                  <td>{formatValue(task.actual_hours)}</td>
                  <td>{formatValue(task.completed_date)}</td>
                  <td>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onOpenEditTask(task)}
                      aria-label={`Edit task ${task.title}`}
                    >
                      Edit task
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

export type { TaskSortKey, TaskSortState }
