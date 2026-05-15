import { useEffect, useState, type ReactNode } from 'react'

import { listProjects } from '../api/projects'
import { listTasks } from '../api/tasks'
import type { Project, Task } from '../api/types'
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
  activeProjects: Project[]
  onEditProject: (project: Project) => void
  onEditTask: (task: Task) => void
}

export function ArchiveDialog({
  activeProjects,
  onEditProject,
  onEditTask,
}: ArchiveDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ArchiveTab>('projects')
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null)
  const [tasksLoadError, setTasksLoadError] = useState<string | null>(null)

  const projectsById = activeProjects.reduce<Record<string, Project>>((projectMap, project) => {
    projectMap[project.id] = project
    return projectMap
  }, {})

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setIsLoadingProjects(true)
    setProjectsLoadError(null)

    void listProjects('archived')
      .then((projects) => {
        if (!cancelled) {
          setArchivedProjects(projects)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectsLoadError('Unable to load archived projects.')
          setArchivedProjects([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProjects(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || activeTab !== 'tasks') {
      return
    }

    let cancelled = false
    setIsLoadingTasks(true)
    setTasksLoadError(null)

    void listTasks({ status: 'archived' })
      .then((tasks) => {
        if (!cancelled) {
          setArchivedTasks(tasks)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTasksLoadError('Unable to load archived tasks.')
          setArchivedTasks([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTasks(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, open])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setActiveTab('projects')
          setArchivedProjects([])
          setArchivedTasks([])
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
            {projectsLoadError ? <p className="form-error">{projectsLoadError}</p> : null}
            {isLoadingProjects ? <p className="muted-copy">Loading archived projects…</p> : null}
            {!isLoadingProjects && archivedProjects.length === 0 ? (
              <p className="muted-copy">No archived projects.</p>
            ) : null}
            {!isLoadingProjects && archivedProjects.length > 0 ? (
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
            {tasksLoadError ? <p className="form-error">{tasksLoadError}</p> : null}
            {isLoadingTasks ? <p className="muted-copy">Loading archived tasks…</p> : null}
            {!isLoadingTasks && archivedTasks.length === 0 ? (
              <p className="muted-copy">No archived tasks.</p>
            ) : null}
            {!isLoadingTasks && archivedTasks.length > 0 ? (
              <ul className="archive-task-list">
                {archivedTasks.map((task) => {
                  const project = projectsById[task.project_id]

                  return (
                    <li key={task.id}>
                      <button
                        className="archive-task-row"
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          onEditTask(task)
                        }}
                      >
                        <span
                          aria-hidden
                          className="project-colour-dot"
                          data-testid={`archive-task-dot-${task.project_id}`}
                          style={{ backgroundColor: project?.colour ?? undefined }}
                        />
                        <span>{task.title}</span>
                        {project ? <span className="archive-task-project">{project.name}</span> : null}
                      </button>
                    </li>
                  )
                })}
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
