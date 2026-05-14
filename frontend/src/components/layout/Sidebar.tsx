import type { FormEvent, ReactNode } from 'react'

import type { Project } from '../../api/types'
import { Button } from '../ui/button'

type ProjectFormErrors = {
  colour?: string
  description?: string
  form?: string
  name?: string
}

type ProjectFormState = {
  colour: string
  description: string
  name: string
}

export type SidebarProps = {
  activeProjects: Project[]
  editingProjectId: string | null
  onArchiveProject: (projectId: string) => void
  onCancelEdit: () => void
  onEditProject: (project: Project) => void
  onProjectFieldChange: (field: keyof ProjectFormState, value: string) => void
  onProjectSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  projectForm: ProjectFormState
  projectFormErrors: ProjectFormErrors
  projectsError: string | null
  projectsLoading: boolean
  projectMutationsSaving: boolean
  renderProjectIdentity: (project: Project) => ReactNode
}

export function Sidebar({
  activeProjects,
  editingProjectId,
  onArchiveProject,
  onCancelEdit,
  onEditProject,
  onProjectFieldChange,
  onProjectSubmit,
  projectForm,
  projectFormErrors,
  projectsError,
  projectsLoading,
  projectMutationsSaving,
  renderProjectIdentity,
}: SidebarProps): JSX.Element {
  return (
    <aside aria-label="Projects sidebar" className="app-sidebar">
      <div className="app-sidebar-body">
        <p className="sidebar-eyebrow">Projects</p>
        <p className="muted-copy sidebar-note">Flat list until Phase 1.6 adds ventures.</p>

        <form className="project-form" onSubmit={(event) => void onProjectSubmit(event)}>
          <label className="field">
            <span>Project name</span>
            <input
              name="name"
              value={projectForm.name}
              onChange={(event) => onProjectFieldChange('name', event.target.value)}
            />
            {projectFormErrors.name ? (
              <span className="field-error">{projectFormErrors.name}</span>
            ) : null}
          </label>

          <label className="field">
            <span>Project description</span>
            <textarea
              name="description"
              rows={3}
              value={projectForm.description}
              onChange={(event) => onProjectFieldChange('description', event.target.value)}
            />
            {projectFormErrors.description ? (
              <span className="field-error">{projectFormErrors.description}</span>
            ) : null}
          </label>

          <label className="field">
            <span>Project colour</span>
            <input
              name="colour"
              placeholder="#E07A5F"
              value={projectForm.colour}
              onChange={(event) => onProjectFieldChange('colour', event.target.value)}
            />
            {projectFormErrors.colour ? (
              <span className="field-error">{projectFormErrors.colour}</span>
            ) : null}
          </label>

          {projectFormErrors.form ? (
            <p className="form-error" role="alert">
              {projectFormErrors.form}
            </p>
          ) : null}

          <div className="form-actions">
            <Button disabled={projectMutationsSaving} type="submit">
              {editingProjectId ? 'Save project' : 'Create project'}
            </Button>
            {editingProjectId ? (
              <Button type="button" variant="secondary" onClick={onCancelEdit}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        {projectsError ? <p className="form-error">{projectsError}</p> : null}
        {projectsLoading ? <p className="muted-copy">Loading active projects…</p> : null}
        {!projectsLoading && activeProjects.length === 0 ? (
          <p className="muted-copy">No active projects yet.</p>
        ) : null}

        <ul className="project-list">
          {activeProjects.map((project) => (
            <li
              key={project.id}
              className="project-card"
              data-testid={`project-card-${project.id}`}
            >
              <div className="project-card-copy">
                {renderProjectIdentity(project)}
                {project.description ? <p>{project.description}</p> : null}
              </div>
              <div className="project-card-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onEditProject(project)}
                  aria-label={`Edit project ${project.name}`}
                >
                  Edit project
                </Button>
                <Button
                  type="button"
                  className="danger-button"
                  onClick={() => void onArchiveProject(project.id)}
                  aria-label={`Archive project ${project.name}`}
                >
                  Archive project
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <Button aria-disabled className="sidebar-hustle-stub" disabled type="button" variant="secondary">
          + Hustle (1.6)
        </Button>
      </div>

      <Button className="sidebar-archive-link" type="button" variant="ghost">
        View archive
      </Button>
    </aside>
  )
}
