import type { Project, Task } from '../../api/types'
import {
  useProjectFilterStore,
  type ProjectFilterState,
} from '../../stores/projectFilter'
import { ArchiveDialog } from '../ArchiveDialog'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'

export type SidebarProps = {
  activeProjects: Project[]
  onCreateProject: () => void
  onEditProject: (project: Project) => void
  onEditTask: (task: Task) => void
  projectsError: string | null
  projectsLoading: boolean
}

export function Sidebar({
  activeProjects,
  onCreateProject,
  onEditProject,
  onEditTask,
  projectsError,
  projectsLoading,
}: SidebarProps): JSX.Element {
  const toggleSidebarProject = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['toggleSidebarProject'] =>
      state.toggleSidebarProject,
  )
  const isSidebarProjectSelected = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['isSidebarProjectSelected'] =>
      state.isSidebarProjectSelected,
  )

  const activeProjectIds = activeProjects.map((project) => project.id)

  return (
    <aside aria-label="Projects sidebar" className="app-sidebar">
      <div className="app-sidebar-body">
        <p className="sidebar-eyebrow">Projects</p>
        <p className="muted-copy sidebar-note">Flat list until Phase 1.6 adds ventures.</p>

        {projectsLoading ? (
          <div className="sidebar-loading-state" data-testid="sidebar-loading-state">
            <p className="muted-copy">Loading projects…</p>
          </div>
        ) : (
          <>
            <Button type="button" onClick={onCreateProject}>
              New project
            </Button>

            {projectsError ? <p className="form-error">{projectsError}</p> : null}
            {activeProjects.length === 0 ? (
              <p className="muted-copy">No active projects yet.</p>
            ) : null}

            <ul className="project-list sidebar-project-list">
              {activeProjects.map((project) => {
                const checked = isSidebarProjectSelected(project.id, activeProjectIds)

                return (
                  <li
                    key={project.id}
                    className="sidebar-project-row"
                    data-testid={`sidebar-project-${project.id}`}
                  >
                    <span
                      aria-hidden
                      className="project-colour-dot"
                      data-testid="project-colour-dot"
                      style={{ backgroundColor: project.colour ?? undefined }}
                    />

                    <button
                      className="sidebar-project-title"
                      type="button"
                      onClick={() => onEditProject(project)}
                    >
                      {project.name}
                    </button>

                    <Checkbox
                      aria-label={`Show ${project.name} in workspace`}
                      checked={checked}
                      onCheckedChange={() => {
                        toggleSidebarProject(project.id, activeProjectIds)
                      }}
                    />
                  </li>
                )
              })}
            </ul>

            <Button
              aria-disabled
              aria-label="+ Hustle (Phase 1.6)"
              className="sidebar-hustle-stub"
              disabled
              type="button"
              variant="secondary"
            >
              + Hustle (1.6)
            </Button>
          </>
        )}
      </div>

      <ArchiveDialog
        activeProjects={activeProjects}
        onEditProject={onEditProject}
        onEditTask={onEditTask}
      />
    </aside>
  )
}
