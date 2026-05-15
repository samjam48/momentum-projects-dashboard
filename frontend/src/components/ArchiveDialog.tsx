import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'

import { ApiError } from '../api/client'
import {
  listProjects,
  projectQueryKeys,
  unarchiveProject,
  useProjects,
  type ProjectFilters,
} from '../api/projects'
import type { Project, Venture } from '../api/types'
import { useVentures, ventureQueryKeys } from '../api/ventures'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'

type ArchiveTab = 'ventures' | 'projects'

function stableProjectFilters(filters: ProjectFilters): ProjectFilters {
  const { status, venture_id, board_status, project_type, finished } = filters
  return { status, venture_id, board_status, project_type, finished }
}

const ARCHIVED_PROJECT_FILTERS: ProjectFilters = stableProjectFilters({ status: 'archived' })
const ACTIVE_PROJECT_FILTERS: ProjectFilters = stableProjectFilters({ status: 'active' })

type ArchiveDialogProps = {
  onEditProject: (project: Project) => void
}

function titleCaseLabel(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function ArchiveDialog({ onEditProject }: ArchiveDialogProps): JSX.Element {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ArchiveTab>('projects')
  const [archivedVentures, setArchivedVentures] = useState<Venture[]>([])
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [projectActionPending, setProjectActionPending] = useState(false)

  const archivedVenturesQuery = useVentures('archived', { enabled: open })
  const archivedProjectsQuery = useProjects(ARCHIVED_PROJECT_FILTERS, { enabled: open })

  useEffect(() => {
    if (!open) {
      return
    }
    if (!archivedVenturesQuery.isLoading && !archivedVenturesQuery.error) {
      setArchivedVentures(archivedVenturesQuery.data)
    }
  }, [
    open,
    archivedVenturesQuery.data,
    archivedVenturesQuery.error,
    archivedVenturesQuery.isLoading,
  ])

  useEffect(() => {
    if (!open) {
      return
    }
    if (!archivedProjectsQuery.isLoading && !archivedProjectsQuery.error) {
      setArchivedProjects(archivedProjectsQuery.data)
    }
  }, [
    open,
    archivedProjectsQuery.data,
    archivedProjectsQuery.error,
    archivedProjectsQuery.isLoading,
  ])

  const handleUnarchiveProject = async (projectId: string): Promise<void> => {
    setActionError(null)
    setProjectActionPending(true)
    try {
      await unarchiveProject(projectId)
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: projectQueryKeys.list(ACTIVE_PROJECT_FILTERS),
          queryFn: () => listProjects(ACTIVE_PROJECT_FILTERS),
        }),
        queryClient.fetchQuery({
          queryKey: projectQueryKeys.list(ARCHIVED_PROJECT_FILTERS),
          queryFn: () => listProjects(ARCHIVED_PROJECT_FILTERS),
        }),
      ])
      setOpen(false)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setActionError(caughtError.formError ?? caughtError.message)
        return
      }
      setActionError('Unable to unarchive project.')
    } finally {
      setProjectActionPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setActionError(null)
        }

        if (!nextOpen) {
          setActiveTab('projects')
          setArchivedVentures([])
          setArchivedProjects([])
          setActionError(null)
          queryClient.removeQueries({ queryKey: projectQueryKeys.list(ARCHIVED_PROJECT_FILTERS) })
          queryClient.removeQueries({ queryKey: ventureQueryKeys.list('archived') })
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="sidebar-archive-link" type="button" variant="ghost">
          View archive
        </Button>
      </DialogTrigger>

      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Archive</DialogTitle>
        </DialogHeader>

        <div aria-label="Archive views" className="archive-dialog-tabs" role="tablist">
          <button
            aria-selected={activeTab === 'ventures'}
            className={`archive-dialog-tab${activeTab === 'ventures' ? ' archive-dialog-tab-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => {
              setActiveTab('ventures')
              setActionError(null)
            }}
          >
            Archived ventures
          </button>
          <button
            aria-selected={activeTab === 'projects'}
            className={`archive-dialog-tab${activeTab === 'projects' ? ' archive-dialog-tab-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => {
              setActiveTab('projects')
              setActionError(null)
            }}
          >
            Archived projects
          </button>
        </div>

        {actionError ? (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        ) : null}

        {activeTab === 'ventures' ? (
          <ArchiveTabPanel>
            {archivedVenturesQuery.isLoading ? (
              <p className="muted-copy">Loading archived ventures…</p>
            ) : null}
            {!archivedVenturesQuery.isLoading && archivedVenturesQuery.error ? (
              <p className="form-error">{archivedVenturesQuery.error}</p>
            ) : null}
            {!archivedVenturesQuery.isLoading &&
            !archivedVenturesQuery.error &&
            archivedVentures.length === 0 ? (
              <p className="muted-copy">No archived ventures.</p>
            ) : null}
            {!archivedVenturesQuery.isLoading && archivedVentures.length > 0 ? (
              <ul className="archive-project-list">
                {archivedVentures.map((venture) => (
                  <li key={venture.id} className="archive-project-row">
                    <span>{titleCaseLabel(venture.name)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </ArchiveTabPanel>
        ) : (
          <ArchiveTabPanel>
            {archivedProjectsQuery.isLoading ? (
              <p className="muted-copy">Loading archived projects…</p>
            ) : null}
            {!archivedProjectsQuery.isLoading && archivedProjectsQuery.error ? (
              <p className="form-error">{archivedProjectsQuery.error}</p>
            ) : null}
            {!archivedProjectsQuery.isLoading &&
            !archivedProjectsQuery.error &&
            archivedProjects.length === 0 ? (
              <p className="muted-copy">No archived projects.</p>
            ) : null}
            {!archivedProjectsQuery.isLoading && archivedProjects.length > 0 ? (
              <ul className="archive-project-list">
                {archivedProjects.map((project) => (
                  <li key={project.id}>
                    <div className="archive-project-row archive-project-actions">
                      <button
                        className="archive-project-title"
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          onEditProject(project)
                        }}
                      >
                        <span
                          aria-hidden
                          className="project-colour-dot"
                          data-testid={`archive-project-dot-${project.id}`}
                          style={{ backgroundColor: project.colour ?? undefined }}
                        />
                        <span>{project.name}</span>
                      </button>
                      <Button
                        disabled={projectActionPending}
                        type="button"
                        variant="secondary"
                        onClick={() => void handleUnarchiveProject(project.id)}
                      >
                        Unarchive
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </ArchiveTabPanel>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ArchiveTabPanel({ children }: { children: ReactNode }): JSX.Element {
  return <div role="tabpanel">{children}</div>
}
