import type { ReactNode } from 'react'

import type { Project, ProjectType } from '../api/types'
import { DEFAULT_PROJECT_FILTER } from '../stores/projectFilter'
import { Button } from '../components/ui/button'

type ProjectsPageProps = {
  activeProjects: Project[]
  boardViewTab: 'projects' | 'tasks'
  kanbanSection: ReactNode
  onBoardViewTabChange: (tab: 'projects' | 'tasks') => void
  onOpenCreateTask: () => void
  onProjectKanbanTypeFilterChange: (value: 'all' | ProjectType) => void
  projectFilterLabel: string
  projectKanbanTypeFilter: 'all' | ProjectType
  selectedProjectId: string
  setToolbarProjectFilter: (projectId: string) => void
  tableSection: ReactNode
  tasksAreBlocked: boolean
}

export function ProjectsPage({
  activeProjects,
  boardViewTab,
  kanbanSection,
  onBoardViewTabChange,
  onOpenCreateTask,
  onProjectKanbanTypeFilterChange,
  projectFilterLabel,
  projectKanbanTypeFilter,
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
            aria-selected={boardViewTab === 'tasks'}
            className={`board-toggle-tab${boardViewTab === 'tasks' ? ' board-toggle-tab-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => onBoardViewTabChange('tasks')}
          >
            Tasks
          </button>
          <button
            aria-selected={boardViewTab === 'projects'}
            className={`board-toggle-tab${boardViewTab === 'projects' ? ' board-toggle-tab-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => onBoardViewTabChange('projects')}
          >
            Projects
          </button>
        </div>

        {boardViewTab === 'projects' ? (
          <label className="field field-inline toolbar-filter">
            <span className="sr-only">Project type filter</span>
            <select
              aria-label="Project type filter"
              value={projectKanbanTypeFilter}
              onChange={(event) => {
                const nextValue = event.target.value
                if (
                  nextValue === 'all' ||
                  nextValue === 'project' ||
                  nextValue === 'asset' ||
                  nextValue === 'gig' ||
                  nextValue === 'contract'
                ) {
                  onProjectKanbanTypeFilterChange(nextValue)
                }
              }}
            >
              <option value="all">All types</option>
              <option value="project">Project</option>
              <option value="asset">Asset</option>
              <option value="gig">Gig</option>
              <option value="contract">Contract</option>
            </select>
          </label>
        ) : null}

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
