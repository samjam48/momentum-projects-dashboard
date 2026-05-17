import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ApiError } from '../api/client'
import {
  listProjects,
  projectQueryKeys,
  unarchiveProject,
  useProjects,
  type ProjectFilters,
} from '../api/projects'
import type { Project, Task, TaskFilters, Venture } from '../api/types'
import { listVentures, unarchiveVenture, useVentures, ventureQueryKeys } from '../api/ventures'
import {
  updateTaskStatus,
  useTasks,
} from '../api/tasks'
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
import { Select } from './ui/Select'

type ArchiveTab = 'ventures' | 'projects' | 'tasks'

function stableProjectFilters(filters: ProjectFilters): ProjectFilters {
  const { status, venture_id, board_status, project_type, finished } = filters
  return { status, venture_id, board_status, project_type, finished }
}

const ARCHIVED_PROJECT_FILTERS: ProjectFilters = stableProjectFilters({ status: 'archived' })
const ACTIVE_PROJECT_FILTERS: ProjectFilters = stableProjectFilters({ status: 'active' })

export type ArchiveDialogProps = {
  onWorkspaceTasksReload?: () => void | Promise<void>
}

type RestoreIntent = {
  displayName: string
  id: string
  kind: 'project' | 'task' | 'venture'
}

function titleCaseLabel(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function archivedTaskParentsAllowRestore(
  task: Task,
  projectById: Map<string, Project>,
  ventureById: Map<string, Venture>,
): boolean {
  const project = projectById.get(task.project_id)
  if (!project || project.status !== 'active') {
    return false
  }
  const ventureId = project.venture_id
  if (!ventureId) {
    return true
  }
  const venture = ventureById.get(ventureId)
  return venture !== undefined && venture.status !== 'archived'
}

function restoreConfirmationContent(intent: RestoreIntent): {
  description: ReactNode
  title: ReactNode
} {
  if (intent.kind === 'task') {
    return { description: intent.displayName, title: 'Restore task?' }
  }
  if (intent.kind === 'project') {
    return {
      description: 'This project will appear in your active projects again.',
      title: `Restore ${intent.displayName}?`,
    }
  }
  return {
    description: 'This venture and its projects will appear with your active items again.',
    title: `Restore ${intent.displayName}?`,
  }
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

export function ArchiveDialog({
  onWorkspaceTasksReload,
}: ArchiveDialogProps): JSX.Element {
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
  const [archivedTasksProjectFilter, setArchivedTasksProjectFilter] = useState('')

  const archivedVenturesQuery = useVentures('archived', { enabled: open })
  const activeVenturesQuery = useVentures('active', { enabled: open })
  const archivedProjectsQuery = useProjects(ARCHIVED_PROJECT_FILTERS, { enabled: open })
  const activeProjectsQuery = useProjects(ACTIVE_PROJECT_FILTERS, { enabled: open })

  const archivedTasksFilters: TaskFilters =
    archivedTasksProjectFilter.trim() === ''
      ? { status: 'archived' }
      : { status: 'archived', projectId: archivedTasksProjectFilter.trim() }

  const archivedTasksListing = useTasks(archivedTasksFilters, open && activeTab === 'tasks', {
    resetDataOnReload: true,
  })

  const mergedProjectById = useMemo(() => {
    const nextMap = new Map<string, Project>()
    for (const project of activeProjectsQuery.data ?? []) {
      nextMap.set(project.id, project)
    }
    for (const project of archivedProjectsQuery.data ?? []) {
      nextMap.set(project.id, project)
    }
    return nextMap
  }, [activeProjectsQuery.data, archivedProjectsQuery.data])

  const ventureById = useMemo(() => {
    const nextMap = new Map<string, Venture>()
    for (const venture of activeVenturesQuery.data ?? []) {
      nextMap.set(venture.id, venture)
    }
    for (const venture of archivedVenturesQuery.data ?? []) {
      nextMap.set(venture.id, venture)
    }
    return nextMap
  }, [activeVenturesQuery.data, archivedVenturesQuery.data])

  const visibleArchivedTasks = useMemo(
    () =>
      archivedTasksListing.data.filter((task) =>
        archivedTaskParentsAllowRestore(task, mergedProjectById, ventureById),
      ),
    [archivedTasksListing.data, mergedProjectById, ventureById],
  )

  const sortedActiveProjectsForArchivedTaskFilter = useMemo(
    () =>
      [...(activeProjectsQuery.data ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [activeProjectsQuery.data],
  )

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

  const performRestoreArchivedTask = async (taskId: string): Promise<boolean> => {
    setActionError(null)
    setRestorePending(true)
    try {
      await updateTaskStatus(taskId, { status: 'backlog', kanban_order: null })
      await archivedTasksListing.reload()
      await onWorkspaceTasksReload?.()
      return true
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setActionError(caughtError.formError ?? caughtError.message)
        return false
      }
      setActionError('Unable to restore archived task.')
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
    if (kind === 'task') {
      await performRestoreArchivedTask(id)
      setRestoreIntent(null)
      return
    }
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

  const restoreDialogCopy = restoreIntent ? restoreConfirmationContent(restoreIntent) : null

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) {
            setActionError(null)
            setArchivedTasksProjectFilter('')
          }

          if (!nextOpen) {
            setActiveTab('projects')
            setArchivedVentures([])
            setArchivedProjects([])
            setActionError(null)
            setArchivedTasksProjectFilter('')
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
              View archived ventures, archived projects, and archived tasks.
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
            <button
              aria-controls="archive-panel-tasks"
              aria-selected={activeTab === 'tasks'}
              className={`archive-dialog-tab${activeTab === 'tasks' ? ' archive-dialog-tab-active' : ''}`}
              id="archive-tab-tasks"
              role="tab"
              type="button"
              onClick={() => {
                setActiveTab('tasks')
                setActionError(null)
              }}
            >
              Archived tasks
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

          <ArchiveTabPanel
            ariaLabelledBy="archive-tab-tasks"
            hidden={activeTab !== 'tasks'}
            id="archive-panel-tasks"
          >
            <Select
              aria-label="Archived tasks project filter"
              fieldClassName="archive-tasks-project-filter-field"
              id="archive-tasks-project-filter"
              value={archivedTasksProjectFilter}
              onChange={(event) => {
                setArchivedTasksProjectFilter(event.target.value)
              }}
            >
              <option value="">All projects</option>
              {sortedActiveProjectsForArchivedTaskFilter.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>

            {archivedTasksListing.isLoading ? (
              <LoadingState message="Loading archived tasks…" />
            ) : null}
            {!archivedTasksListing.isLoading && archivedTasksListing.error ? (
              <ErrorBanner message={archivedTasksListing.error} />
            ) : null}
            {!archivedTasksListing.isLoading &&
            !archivedTasksListing.error &&
            visibleArchivedTasks.length === 0 ? (
              <EmptyState
                description="Adjust the filter or archive a task to populate this list."
                title="No archived tasks"
              />
            ) : null}
            {!archivedTasksListing.isLoading && visibleArchivedTasks.length > 0 ? (
              <ArchiveList
                getKey={(task) => task.id}
                getLabel={(task) => task.title}
                items={visibleArchivedTasks}
                restoreDisabled={restorePending}
                onRestore={(task) => {
                  setRestoreIntent({
                    displayName: task.title,
                    id: task.id,
                    kind: 'task',
                  })
                }}
                onSelect={(task) => {
                  void task.id
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
        description={restoreDialogCopy?.description ?? ''}
        open={Boolean(restoreIntent)}
        pending={restorePending}
        title={restoreDialogCopy?.title ?? 'Restore item?'}
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
