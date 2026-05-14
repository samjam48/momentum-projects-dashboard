import { useEffect, useState, type ReactNode } from 'react'

import { listProjects } from '../api/projects'
import type { Project } from '../api/types'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'

type ArchiveTab = 'projects' | 'tasks'

type ArchiveDialogProps = {
  onEditProject: (project: Project) => void
}

export function ArchiveDialog({ onEditProject }: ArchiveDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ArchiveTab>('projects')
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    void listProjects('archived')
      .then((projects) => {
        if (!cancelled) {
          setArchivedProjects(projects)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Unable to load archived projects.')
          setArchivedProjects([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setActiveTab('projects')
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
            aria-selected={activeTab === 'projects'}
            className={`archive-dialog-tab${activeTab === 'projects' ? ' archive-dialog-tab-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => setActiveTab('projects')}
          >
            Archived projects
          </button>
          <button
            aria-selected={activeTab === 'tasks'}
            className={`archive-dialog-tab${activeTab === 'tasks' ? ' archive-dialog-tab-active' : ''}`}
            role="tab"
            type="button"
            onClick={() => setActiveTab('tasks')}
          >
            Archived tasks
          </button>
        </div>

        {activeTab === 'projects' ? (
          <ArchiveTabPanel>
            {loadError ? <p className="form-error">{loadError}</p> : null}
            {isLoading ? <p className="muted-copy">Loading archived projects…</p> : null}
            {!isLoading && archivedProjects.length === 0 ? (
              <p className="muted-copy">No archived projects.</p>
            ) : null}
            {!isLoading && archivedProjects.length > 0 ? (
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
        ) : (
          <ArchiveTabPanel>
            <p className="muted-copy">No archived tasks.</p>
          </ArchiveTabPanel>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ArchiveTabPanel({ children }: { children: ReactNode }): JSX.Element {
  return <div role="tabpanel">{children}</div>
}
