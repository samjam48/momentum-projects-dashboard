import { useMemo, useState } from 'react'

import type { Project, Task, Venture, VenturePayload } from '../../api/types'
import {
  useVentureCategoryLabelMutations,
  useVentureCategoryLabels,
} from '../../api/ventureCategoryLabels'
import { useVentureMutations, useVentures } from '../../api/ventures'
import {
  useProjectFilterStore,
  type ProjectFilterState,
} from '../../stores/projectFilter'
import { ArchiveDialog } from '../ArchiveDialog'
import { VentureDialog } from '../VentureDialog'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'

export type SidebarProps = {
  activeProjects: Project[]
  onArchivedTaskRestored?: () => void | Promise<void>
  onCreateProject: (ventureId: string) => void
  onEditProject: (project: Project) => void
  onEditTask: (task: Task) => void
  projectsError: string | null
  projectsLoading: boolean
  reloadProjects: () => Promise<Project[]>
}

function titleCaseCategory(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function Sidebar({
  activeProjects,
  onArchivedTaskRestored,
  onCreateProject,
  onEditProject,
  onEditTask,
  projectsError,
  projectsLoading,
  reloadProjects,
}: SidebarProps): JSX.Element {
  void onEditTask
  const toggleSidebarProject = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['toggleSidebarProject'] =>
      state.toggleSidebarProject,
  )
  const isSidebarProjectSelected = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['isSidebarProjectSelected'] =>
      state.isSidebarProjectSelected,
  )
  const resetSidebarToAllProjects = useProjectFilterStore(
    (state: ProjectFilterState): ProjectFilterState['resetSidebarToAllProjects'] =>
      state.resetSidebarToAllProjects,
  )

  const venturesQuery = useVentures('active')
  const archivedVenturesQuery = useVentures('archived')
  const labelsQuery = useVentureCategoryLabels()

  const ventureMutations = useVentureMutations()
  const labelMutations = useVentureCategoryLabelMutations()

  const hustleLabelId =
    labelsQuery.data.find(
      (label) => typeof label.slug === 'string' && label.slug.toLowerCase() === 'hustle',
    )?.id ??
    labelsQuery.data[0]?.id ??
    null

  const [ventureDialog, setVentureDialog] = useState<
    { mode: 'create'; venture: null } | { mode: 'edit'; venture: Venture } | null
  >(null)

  const [expandedVentureIds, setExpandedVentureIds] = useState<Record<string, boolean>>({})

  const isVentureExpanded = (ventureId: string): boolean =>
    expandedVentureIds[ventureId] !== false

  const toggleVentureExpanded = (ventureId: string): void => {
    setExpandedVentureIds((previous) => ({
      ...previous,
      [ventureId]: !isVentureExpanded(ventureId),
    }))
  }

  const projectsByVentureId = useMemo(() => {
    return activeProjects.reduce<Record<string, Project[]>>((accumulator, project) => {
      const bucket = accumulator[project.venture_id] ?? []
      bucket.push(project)
      accumulator[project.venture_id] = bucket
      return accumulator
    }, {})
  }, [activeProjects])

  const dedupedVentures = useMemo(
    () => [...new Map(venturesQuery.data.map((venture) => [venture.id, venture])).values()],
    [venturesQuery.data],
  )

  const activeProjectIds = activeProjects.map((project) => project.id)

  const sidebarLoading = venturesQuery.isLoading || projectsLoading

  const combinedError =
    projectsError ??
    venturesQuery.error ??
    labelsQuery.error ??
    null

  const handleVentureSubmit = async (payload: VenturePayload): Promise<void> => {
    ventureMutations.resetError()
    try {
      if (ventureDialog?.mode === 'create') {
        await ventureMutations.create(payload)
      } else if (ventureDialog?.mode === 'edit') {
        await ventureMutations.update(ventureDialog.venture.id, payload)
      }

      setVentureDialog(null)
    } catch {
      /* Errors surface via ventureMutations.error */
    }
  }

  const handleVentureArchive = async (ventureId: string): Promise<void> => {
    ventureMutations.resetError()
    const ventureProjectIds = activeProjects
      .filter((project) => project.venture_id === ventureId)
      .map((project) => project.id)

    const storedSidebarIds = useProjectFilterStore.getState().selectedProjectIds
    const sidebarSelection = storedSidebarIds ?? activeProjectIds

    const archivedVentureIntersectsSidebarSelection = ventureProjectIds.some((projectId) =>
      sidebarSelection.includes(projectId),
    )

    try {
      await ventureMutations.archive(ventureId)
      const nextActive = await reloadProjects()
      if (archivedVentureIntersectsSidebarSelection) {
        resetSidebarToAllProjects(nextActive.map((project) => project.id))
      }
      setVentureDialog(null)
    } catch {
      /* Errors surface via ventureMutations.error */
    }
  }

  return (
    <aside aria-label="Projects sidebar" className="app-sidebar">
      <div className="app-sidebar-body">
        <p className="sidebar-eyebrow">Ventures</p>

        {sidebarLoading ? (
          <div className="sidebar-loading-state" data-testid="sidebar-loading-state">
            <p className="muted-copy">Loading projects…</p>
          </div>
        ) : (
          <>
            {combinedError ? <p className="form-error">{combinedError}</p> : null}

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setVentureDialog({ mode: 'create', venture: null })
              }}
            >
              + Hustle
            </Button>

            {!sidebarLoading && dedupedVentures.length === 0 ? (
              archivedVenturesQuery.isLoading ? (
                <p className="muted-copy">Loading ventures…</p>
              ) : archivedVenturesQuery.data.length > 0 ? (
                <p className="muted-copy">All ventures are archived.</p>
              ) : (
                <p className="muted-copy">Create a venture to get started.</p>
              )
            ) : null}

            {dedupedVentures.map((venture) => {
              const childProjects = projectsByVentureId[venture.id] ?? []
              const expanded = isVentureExpanded(venture.id)
              const stripeColour = venture.colour ?? '#9c5d35'

              return (
                <div
                  key={venture.id}
                  className="sidebar-venture-shell"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftStyle: 'solid',
                    borderLeftColor: stripeColour,
                  }}
                >
                  <div
                    className="sidebar-venture-row"
                    data-testid={`sidebar-venture-${venture.id}`}
                  >
                    <button
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse venture' : 'Expand venture'}
                      className="sidebar-venture-toggle"
                      type="button"
                      onClick={() => toggleVentureExpanded(venture.id)}
                    >
                      {expanded ? '<' : '>'}
                    </button>

                    <button
                      className="sidebar-project-title"
                      type="button"
                      onClick={() => {
                        setVentureDialog({ mode: 'edit', venture })
                      }}
                    >
                      {venture.name}
                    </button>

                    <span className="muted-copy text-xs">
                      {venture.category_label
                        ? titleCaseCategory(venture.category_label.name)
                        : null}
                    </span>

                    <span className="sidebar-venture-project-count muted-copy text-xs">
                      {childProjects.length}{' '}
                      {childProjects.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>

                  {expanded ? (
                    <div className="sidebar-venture-expanded">
                      {childProjects.length === 0 ? (
                        <p className="muted-copy text-sm">No projects yet.</p>
                      ) : (
                        <ul className="project-list sidebar-project-list">
                          {childProjects.map((project) => {
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
                      )}

                      <a
                        className="sidebar-add-project-link"
                        href="#"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          event.preventDefault()
                          onCreateProject(venture.id)
                        }}
                      >
                        + project
                      </a>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </>
        )}
      </div>

      {ventureDialog !== null ? (
        <VentureDialog
          categoryLabels={labelsQuery.data}
          hustleLabelId={hustleLabelId}
          isSaving={ventureMutations.isSaving || labelMutations.isSaving}
          labelError={labelMutations.error}
          mode={ventureDialog.mode}
          open
          venture={ventureDialog.mode === 'edit' ? ventureDialog.venture : null}
          ventureError={ventureMutations.error}
          onArchive={
            ventureDialog.mode === 'edit'
              ? (ventureId) => handleVentureArchive(ventureId)
              : null
          }
          onClose={() => {
            ventureMutations.resetError()
            labelMutations.resetError()
            setVentureDialog(null)
          }}
          onCreateCategoryLabel={(labelName) => labelMutations.create({ name: labelName })}
          onResetLabelError={() => labelMutations.resetError()}
          onResetVentureError={() => ventureMutations.resetError()}
          onSubmit={(payload) => handleVentureSubmit(payload)}
        />
      ) : null}

      <ArchiveDialog onWorkspaceTasksReload={onArchivedTaskRestored} />
    </aside>
  )
}
