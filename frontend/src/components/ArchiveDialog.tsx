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
import { listVentures, unarchiveVenture, useVentures, ventureQueryKeys } from '../api/ventures'
import { ArchiveList } from '../features/archives/ArchiveList'
import { EmptyState } from './feedback/EmptyState'
import { ErrorBanner } from './feedback/ErrorBanner'
import { LoadingState } from './feedback/LoadingState'
import { Button } from './ui/button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

type RestoreIntent = {
  displayName: string
  id: string
  kind: 'project' | 'venture'
}

function titleCaseLabel(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function resolveVentureLabel(
  project: Project,
  archivedVenturesList: Venture[],
  activeVentures: Venture[] | undefined,
): string {
  const id = project.venture_id
  const activeName = (activeVentures ?? []).find((venture) => venture.id === id)?.name
  if (activeName) {
    return activeName
  }
  const archivedName = archivedVenturesList.find((venture) => venture.id === id)?.name
  return archivedName ?? '—'
}

export function ArchiveDialog(): JSX.Element {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ArchiveTab>('projects')
  const [archivedVentures, setArchivedVentures] = useState<Venture[]>([])
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [restorePending, setRestorePending] = useState(false)
  const [restoreIntent, setRestoreIntent] = useState<RestoreIntent | null>(null)
  const [ventureDetail, setVentureDetail] = useState<Venture | null>(null)
  const [projectDetail, setProjectDetail] = useState<Project | null>(null)

  const archivedVenturesQuery = useVentures('archived', { enabled: open })
  const activeVenturesQuery = useVentures('active', { enabled: open })
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

  const performUnarchiveProject = async (projectId: string): Promise<boolean> => {
    setActionError(null)
    setRestorePending(true)
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
      return true
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setActionError(caughtError.formError ?? caughtError.message)
        return false
      }
      setActionError('Unable to restore project.')
      return false
    } finally {
      setRestorePending(false)
    }
  }

  const performUnarchiveVenture = async (ventureId: string): Promise<boolean> => {
    setActionError(null)
    setRestorePending(true)
    try {
      await unarchiveVenture(ventureId)
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: ventureQueryKeys.list('active'),
          queryFn: () => listVentures('active'),
        }),
        queryClient.fetchQuery({
          queryKey: ventureQueryKeys.list('archived'),
          queryFn: () => listVentures('archived'),
        }),
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
      return true
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setActionError(caughtError.formError ?? caughtError.message)
        return false
      }
      setActionError('Unable to restore venture.')
      return false
    } finally {
      setRestorePending(false)
    }
  }

  const handleConfirmRestore = async (): Promise<void> => {
    if (!restoreIntent || restorePending) {
      return
    }
    const { id, kind } = restoreIntent
    await (kind === 'project' ? performUnarchiveProject(id) : performUnarchiveVenture(id))
    setRestoreIntent(null)
  }

  const handleRestoreDialogOpenChange = (nextOpen: boolean): void => {
    if (restorePending) {
      return
    }
    if (!nextOpen) {
      setRestoreIntent(null)
    }
  }

  return (
    <>
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
            setRestoreIntent(null)
            setVentureDetail(null)
            setProjectDetail(null)
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

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive</DialogTitle>
            <DialogDescription className="sr-only">
              View archived ventures and archived projects.
            </DialogDescription>
          </DialogHeader>

          <div aria-label="Archive views" className="archive-dialog-tabs" role="tablist">
            <button
              aria-controls="archive-panel-ventures"
              aria-selected={activeTab === 'ventures'}
              className={`archive-dialog-tab${activeTab === 'ventures' ? ' archive-dialog-tab-active' : ''}`}
              id="archive-tab-ventures"
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
              aria-controls="archive-panel-projects"
              aria-selected={activeTab === 'projects'}
              className={`archive-dialog-tab${activeTab === 'projects' ? ' archive-dialog-tab-active' : ''}`}
              id="archive-tab-projects"
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

          {actionError ? <ErrorBanner message={actionError} /> : null}

          <ArchiveTabPanel
            ariaLabelledBy="archive-tab-ventures"
            hidden={activeTab !== 'ventures'}
            id="archive-panel-ventures"
          >
            {archivedVenturesQuery.isLoading ? (
              <LoadingState message="Loading archived ventures…" />
            ) : null}
            {!archivedVenturesQuery.isLoading && archivedVenturesQuery.error ? (
              <ErrorBanner message={archivedVenturesQuery.error} />
            ) : null}
            {!archivedVenturesQuery.isLoading &&
            !archivedVenturesQuery.error &&
            archivedVentures.length === 0 ? (
              <EmptyState
                description="Archive a venture to restore it later."
                title="No archived ventures yet."
              />
            ) : null}
            {!archivedVenturesQuery.isLoading && archivedVentures.length > 0 ? (
              <ArchiveList
                getKey={(venture) => venture.id}
                getLabel={(venture) => titleCaseLabel(venture.name)}
                items={archivedVentures}
                restoreDisabled={restorePending}
                onRestore={(venture) => {
                  setRestoreIntent({
                    kind: 'venture',
                    id: venture.id,
                    displayName: titleCaseLabel(venture.name),
                  })
                }}
                onSelect={(venture) => {
                  setVentureDetail(venture)
                }}
              />
            ) : null}
          </ArchiveTabPanel>

          <ArchiveTabPanel
            ariaLabelledBy="archive-tab-projects"
            hidden={activeTab !== 'projects'}
            id="archive-panel-projects"
          >
            {archivedProjectsQuery.isLoading ? (
              <LoadingState message="Loading archived projects…" />
            ) : null}
            {!archivedProjectsQuery.isLoading && archivedProjectsQuery.error ? (
              <ErrorBanner message={archivedProjectsQuery.error} />
            ) : null}
            {!archivedProjectsQuery.isLoading &&
            !archivedProjectsQuery.error &&
            archivedProjects.length === 0 ? (
              <EmptyState
                description="Archive a project to restore it later."
                title="No archived projects yet."
              />
            ) : null}
            {!archivedProjectsQuery.isLoading && archivedProjects.length > 0 ? (
              <ArchiveList
                getKey={(project) => project.id}
                getLabel={(project) => project.name}
                items={archivedProjects}
                renderLeadingContent={(project) => (
                  <span
                    aria-hidden
                    className="project-colour-dot"
                    data-testid={`archive-project-dot-${project.id}`}
                    style={{ backgroundColor: project.colour ?? undefined }}
                  />
                )}
                restoreDisabled={restorePending}
                onRestore={(project) => {
                  setRestoreIntent({
                    kind: 'project',
                    id: project.id,
                    displayName: project.name,
                  })
                }}
                onSelect={(project) => {
                  setProjectDetail(project)
                }}
              />
            ) : null}
          </ArchiveTabPanel>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(projectDetail)} onOpenChange={(next) => !next && setProjectDetail(null)}>
        {projectDetail ? (
          <DialogContent className="z-[60]" onBackdropClick={() => setProjectDetail(null)}>
            <DialogHeader>
              <DialogTitle>{projectDetail.name}</DialogTitle>
              <DialogDescription>Review archived project details.</DialogDescription>
            </DialogHeader>
            <div className="venture-archive-detail-fields">
              <div className="field">
                <span>Venture</span>
                <p className="muted-copy">{resolveVentureLabel(projectDetail, archivedVentures, activeVenturesQuery.data)}</p>
              </div>
              <div className="field">
                <span>Type</span>
                <p className="muted-copy">{projectDetail.project_type}</p>
              </div>
              <div className="field">
                <span>Board status</span>
                <p className="muted-copy">{projectDetail.board_status}</p>
              </div>
              <div className="field">
                <span>Colour</span>
                <p className="muted-copy">{(projectDetail.colour ?? '').trim() || '—'}</p>
              </div>
              <div className="field">
                <span>Description</span>
                <p className="muted-copy">{projectDetail.description?.trim() ? projectDetail.description : '—'}</p>
              </div>
            </div>
            <DialogFooter className="sm:justify-start">
              <Button type="button" variant="outline" onClick={() => setProjectDetail(null)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(ventureDetail)} onOpenChange={(next) => !next && setVentureDetail(null)}>
        {ventureDetail ? (
          <DialogContent className="z-[60]" onBackdropClick={() => setVentureDetail(null)}>
            <DialogHeader>
              <DialogTitle>{titleCaseLabel(ventureDetail.name)}</DialogTitle>
              <DialogDescription>Review archived venture details.</DialogDescription>
            </DialogHeader>
            <div className="venture-archive-detail-fields">
              <div className="field">
                <span>Category</span>
                <p className="muted-copy">{ventureDetail.category_label?.name ?? '—'}</p>
              </div>
              <div className="field">
                <span>Description</span>
                <p className="muted-copy">{ventureDetail.description?.trim() ? ventureDetail.description : '—'}</p>
              </div>
            </div>
            <DialogFooter className="sm:justify-start">
              <Button type="button" variant="outline" onClick={() => setVentureDetail(null)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        confirmLabel="Restore"
        description={
          restoreIntent?.kind === 'project'
            ? 'This project will appear in your active projects again.'
            : 'This venture and its projects will appear with your active items again.'
        }
        open={Boolean(restoreIntent)}
        pending={restorePending}
        title={restoreIntent ? `Restore ${restoreIntent.displayName}?` : 'Restore item?'}
        onConfirm={handleConfirmRestore}
        onOpenChange={handleRestoreDialogOpenChange}
      />
    </>
  )
}

type ArchiveTabPanelProps = {
  ariaLabelledBy: string
  children: ReactNode
  hidden: boolean
  id: string
}

function ArchiveTabPanel({ ariaLabelledBy, children, hidden, id }: ArchiveTabPanelProps): JSX.Element {
  return (
    <div aria-labelledby={ariaLabelledBy} hidden={hidden} id={id} role="tabpanel">
      {children}
    </div>
  )
}
