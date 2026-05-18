import type { Project } from '../../api/types'
import { KanbanCardShell } from './KanbanCardShell'

function countOpenTasksForProject(openTaskCounts: Record<string, number>, projectId: string): number {
  return openTaskCounts[projectId] ?? 0
}

type KanbanProjectCardProps = {
  draggingDisabled: boolean
  onOpenProject: (project: Project) => void
  openTaskCounts: Record<string, number>
  project: Project
}

export function KanbanProjectCard({
  draggingDisabled,
  onOpenProject,
  openTaskCounts,
  project,
}: KanbanProjectCardProps): JSX.Element {
  const openCount = countOpenTasksForProject(openTaskCounts, project.id)
  const showType = project.project_type !== 'project'

  return (
    <KanbanCardShell
      className="task-card kanban-project-card"
      dragData={{
        type: 'project',
        projectId: project.id,
        board_status: project.board_status,
      }}
      draggingDisabled={draggingDisabled}
      id={`kanban-project:${project.id}`}
      style={{ padding: '16px' }}
      testAttributes={{
        'data-dragging-suppressed-for-mutation': draggingDisabled ? '' : undefined,
      }}
    >
      <div className="kanban-task-linear">
        <div className="kanban-task-title-row">
          <button
            className="kanban-project-title"
            data-testid="kanban-project-title"
            type="button"
            onClick={() => onOpenProject(project)}
          >
            {project.name}
          </button>
          <span
            aria-hidden
            className="kanban-task-colour-dot"
            data-testid="kanban-project-colour-dot"
            style={{ backgroundColor: project.colour ?? '#c4b5a8' }}
          />
        </div>

        <div className="kanban-project-meta-row">
          {showType ? (
            <span className="task-meta kanban-project-type">{project.project_type}</span>
          ) : null}

          <span className="task-meta">{`Tasks ${openCount}`}</span>

          {project.board_status === 'shipped' && project.finished ? (
            <span className="task-meta">Finished</span>
          ) : null}
        </div>
      </div>
    </KanbanCardShell>
  )
}
