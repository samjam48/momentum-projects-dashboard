import { useEffect, useState, type ReactNode } from 'react'

import { useProjects, type ProjectFilters } from '../api/projects'
import type { Project, Venture } from '../api/types'
import { useVentures } from '../api/ventures'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'

type ArchiveTab = 'ventures' | 'projects'

const ARCHIVED_PROJECT_FILTERS: ProjectFilters = { status: 'archived' }

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
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ArchiveTab>('projects')
  const [archivedVentures, setArchivedVentures] = useState<Venture[]>([])
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])

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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setActiveTab('projects')
          setArchivedVentures([])
          setArchivedProjects([])
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
            onClick={() => setActiveTab('ventures')}
          >
            Archived ventures
          </button>
          <button
            aria-selected={activeTab === 'projects'}
            className={`archive-dialog-tab${activeTab === 'projects' ? ' archive-dialog-tab-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => setActiveTab('projects')}
          >
            Archived projects
          </button>
        </div>

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
                    <button
                      className="archive-project-row"
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
