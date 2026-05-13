import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import { ApiError } from './api/client'
import { useProjectMutations, useProjects } from './api/projects'
import {
  DEFAULT_PROJECT_FILTER,
  useProjectFilterStore,
} from './stores/projectFilter'
import type { Project, ProjectPayload } from './api/types'
import type { ProjectFilterState } from './stores/projectFilter'

type ProjectFormState = {
  name: string
  description: string
  colour: string
}

type ProjectFormErrors = {
  name?: string
  description?: string
  colour?: string
  form?: string
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: '',
  description: '',
  colour: '',
}

function projectPayloadFromForm(formState: ProjectFormState): ProjectPayload {
  return {
    name: formState.name.trim(),
    description: formState.description.trim() || null,
    colour: formState.colour.trim() || null,
  }
}

function formStateFromProject(project: Project): ProjectFormState {
  return {
    name: project.name,
    description: project.description ?? '',
    colour: project.colour ?? '',
  }
}

function projectFieldErrors(error: ApiError | null): ProjectFormErrors {
  if (!error) {
    return {}
  }

  return {
    name: error.fieldErrors.name,
    description: error.fieldErrors.description,
    colour: error.fieldErrors.colour,
    form: error.formError ?? undefined,
  }
}

function projectIdentity(project: Project): JSX.Element {
  return (
    <div className="identity-stack">
      <strong>{project.name}</strong>
      {project.colour ? (
        <span className="colour-tag" style={{ backgroundColor: project.colour }}>
          {project.colour}
        </span>
      ) : (
        <span className="colour-tag colour-tag-neutral">No colour</span>
      )}
    </div>
  )
}

function WorkspaceTarget({
  title,
  description,
  summary,
}: {
  title: string
  description: string
  summary: string
}): JSX.Element {
  return (
    <section className="workspace-panel" aria-label={`${title} target`}>
      <header className="workspace-panel-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <p className="muted-copy">{summary}</p>
    </section>
  )
}

function App() {
  const projectsQuery = useProjects()
  const selectedProjectId = useProjectFilterStore(
    (state: ProjectFilterState): string => state.selectedProjectId,
  )
  const setSelectedProjectId = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['setSelectedProjectId'] =>
      state.setSelectedProjectId,
  )
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)
  const [projectFormErrors, setProjectFormErrors] = useState<ProjectFormErrors>({})
  const [locallyArchivedProjectIds, setLocallyArchivedProjectIds] = useState<string[]>([])

  const projectMutations = useProjectMutations(async () => {
    await projectsQuery.reload()
  })

  const activeProjects = projectsQuery.data.filter(
    (project) => !locallyArchivedProjectIds.includes(project.id),
  )
  const selectedProject = activeProjects.find((project) => project.id === selectedProjectId) ?? null

  useEffect(() => {
    setLocallyArchivedProjectIds((currentIds) =>
      currentIds.filter((projectId) =>
        projectsQuery.data.some((project) => project.id === projectId),
      ),
    )
  }, [projectsQuery.data])

  useEffect(() => {
    if (
      selectedProjectId !== DEFAULT_PROJECT_FILTER &&
      !activeProjects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(DEFAULT_PROJECT_FILTER)
    }
  }, [activeProjects, selectedProjectId, setSelectedProjectId])

  const handleProjectInputChange = (
    field: keyof ProjectFormState,
    value: string,
  ): void => {
    setProjectForm((currentState) => ({ ...currentState, [field]: value }))
    setProjectFormErrors((currentErrors) => ({ ...currentErrors, [field]: undefined, form: undefined }))
    projectMutations.resetError()
  }

  const resetProjectForm = (): void => {
    setEditingProjectId(null)
    setProjectForm(EMPTY_PROJECT_FORM)
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const handleProjectSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault()
    setProjectFormErrors({})

    try {
      if (editingProjectId) {
        await projectMutations.update(editingProjectId, projectPayloadFromForm(projectForm))
      } else {
        await projectMutations.create(projectPayloadFromForm(projectForm))
      }

      resetProjectForm()
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setProjectFormErrors(projectFieldErrors(caughtError))
        return
      }

      setProjectFormErrors({ form: 'Unable to save project.' })
    }
  }

  const handleProjectEdit = (project: Project): void => {
    setEditingProjectId(project.id)
    setProjectForm(formStateFromProject(project))
    setProjectFormErrors({})
    projectMutations.resetError()
  }

  const handleProjectArchive = async (projectId: string): Promise<void> => {
    setProjectFormErrors({})
    setLocallyArchivedProjectIds((currentIds) =>
      currentIds.includes(projectId) ? currentIds : [...currentIds, projectId],
    )

    if (selectedProjectId === projectId) {
      setSelectedProjectId(DEFAULT_PROJECT_FILTER)
    }

    try {
      await projectMutations.archive(projectId)
    } catch (caughtError) {
      setLocallyArchivedProjectIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== projectId),
      )

      if (caughtError instanceof ApiError) {
        setProjectFormErrors(projectFieldErrors(caughtError))
        return
      }

      setProjectFormErrors({ form: 'Unable to archive project.' })
    }
  }

  const projectFilterLabel = selectedProject ? selectedProject.name : 'All projects'
  const tasksAreBlocked = activeProjects.length === 0

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <p className="eyebrow">Current sprint</p>
        <h1>Projects + Tasks Workspace</h1>
        <p className="workspace-copy">
          Phase 1 project management with a shared filter across the task workspace.
        </p>
      </section>

      <section className="workspace-grid">
        <div className="workspace-column">
          <section className="workspace-panel">
            <header className="workspace-panel-header">
              <h2>{editingProjectId ? 'Edit project' : 'Create project'}</h2>
              <p>Manage active projects without leaving the workspace.</p>
            </header>

            <form className="project-form" onSubmit={(event) => void handleProjectSubmit(event)}>
              <label className="field">
                <span>Project name</span>
                <input
                  name="name"
                  value={projectForm.name}
                  onChange={(event) => handleProjectInputChange('name', event.target.value)}
                />
                {projectFormErrors.name ? (
                  <span className="field-error">{projectFormErrors.name}</span>
                ) : null}
              </label>

              <label className="field">
                <span>Project description</span>
                <textarea
                  name="description"
                  value={projectForm.description}
                  onChange={(event) =>
                    handleProjectInputChange('description', event.target.value)
                  }
                  rows={3}
                />
                {projectFormErrors.description ? (
                  <span className="field-error">{projectFormErrors.description}</span>
                ) : null}
              </label>

              <label className="field">
                <span>Project colour</span>
                <input
                  name="colour"
                  value={projectForm.colour}
                  onChange={(event) => handleProjectInputChange('colour', event.target.value)}
                  placeholder="#E07A5F"
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
                <button type="submit" disabled={projectMutations.isSaving}>
                  {editingProjectId ? 'Save project' : 'Create project'}
                </button>
                {editingProjectId ? (
                  <button type="button" className="secondary-button" onClick={resetProjectForm}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="workspace-panel">
            <header className="workspace-panel-header">
              <h2>Active projects</h2>
              <p>Archived projects are removed from default workspace selectors.</p>
            </header>

            {projectsQuery.error ? <p className="form-error">{projectsQuery.error}</p> : null}
            {projectsQuery.isLoading ? <p className="muted-copy">Loading active projects…</p> : null}
            {!projectsQuery.isLoading && activeProjects.length === 0 ? (
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
                    {projectIdentity(project)}
                    {project.description ? <p>{project.description}</p> : null}
                  </div>
                  <div className="project-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleProjectEdit(project)}
                      aria-label={`Edit project ${project.name}`}
                    >
                      Edit project
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleProjectArchive(project.id)}
                      aria-label={`Archive project ${project.name}`}
                    >
                      Archive project
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="workspace-column workspace-column-wide">
          <section className="workspace-panel">
            <header className="workspace-panel-header">
              <h2>Workspace filter</h2>
              <p>This selection is shared across both task views.</p>
            </header>

            <div className="filter-row">
              <label className="field field-inline">
                <span>Project filter</span>
                <select
                  aria-label="Project filter"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  <option value={DEFAULT_PROJECT_FILTER}>All projects</option>
                  {activeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="filter-summary" aria-live="polite">
                Showing {projectFilterLabel}
              </div>
            </div>

            <div className="task-toolbar">
              <button type="button" disabled={tasksAreBlocked}>
                New task
              </button>
              {tasksAreBlocked ? (
                <p className="muted-copy">Create a project first to add tasks.</p>
              ) : null}
            </div>
          </section>

          <div className="workspace-panels-two-up">
            <WorkspaceTarget
              title="Kanban board"
              description={`Shared filter target: ${projectFilterLabel}`}
              summary={`Selected project scope: ${projectFilterLabel}.`}
            />
            <WorkspaceTarget
              title="Task summary table"
              description={`Shared filter target: ${projectFilterLabel}`}
              summary={`Selected project scope: ${projectFilterLabel}.`}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
