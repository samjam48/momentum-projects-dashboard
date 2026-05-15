import type { ReactNode } from 'react'

import type { Project } from '../api/types'
import { DEFAULT_PROJECT_FILTER } from '../stores/projectFilter'
import { Button } from '../components/ui/button'

type ProjectsPageProps = {
  activeProjects: Project[]
  kanbanSection: ReactNode
  onOpenCreateTask: () => void
  projectFilterLabel: string
  selectedProjectId: string
  setToolbarProjectFilter: (projectId: string) => void
  tableSection: ReactNode
  tasksAreBlocked: boolean
}

export function ProjectsPage({
  activeProjects,
  kanbanSection,
  onOpenCreateTask,
  projectFilterLabel,
  selectedProjectId,
  setToolbarProjectFilter,
  tableSection,
  tasksAreBlocked,
}: ProjectsPageProps): JSX.Element {
  return (
    <div className="projects-page">
      <div aria-label="Projects page" className="projects-toolbar" role="toolbar">
        <div aria-label="Board view" className="board-toggle" role="tablist">
          <button
            aria-selected
            className="board-toggle-tab board-toggle-tab-active"
            role="tab"
            type="button"
          >
            Tasks
          </button>
          <button
            aria-selected={false}
            className="board-toggle-tab"
            disabled
            role="tab"
            title="Coming soon"
            type="button"
          >
            Projects
          </button>
        </div>

        <label className="field field-inline toolbar-filter">
          <span className="sr-only">Project filter</span>
          <select
            aria-label="Project filter"
            value={selectedProjectId}
            onChange={(event) => setToolbarProjectFilter(event.target.value)}
          >
            <option value={DEFAULT_PROJECT_FILTER}>All projects</option>
            {activeProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <Button disabled={tasksAreBlocked} type="button" onClick={onOpenCreateTask}>
          + New task
        </Button>

        {tasksAreBlocked ? (
          <p className="muted-copy toolbar-empty-hint">Create a project first to add tasks.</p>
        ) : null}

        <span aria-live="polite" className="toolbar-filter-summary sr-only">
          Showing {projectFilterLabel}
        </span>
      </div>

      <section aria-label="Kanban board" className="projects-kanban-region">
        {kanbanSection}
      </section>

      <section aria-label="Task summary" className="projects-table-region">
        {tableSection}
      </section>
    </div>
  )
}
