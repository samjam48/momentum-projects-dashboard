import type { DragEndEvent } from '@dnd-kit/core'
import type { RefObject } from 'react'

import type { Project, ProjectBoardStatus } from '../api/types'
import { projectOrderByBoardStatus } from '../lib/kanbanSort'
import { KanbanBoard } from './kanban/KanbanBoard'
import { KanbanColumn } from './kanban/KanbanColumn'
import { KanbanProjectCard } from './kanban/KanbanProjectCard'

const BOARD_OPTIONS: Array<{ label: string; value: ProjectBoardStatus }> = [
  { label: 'Idea', value: 'idea' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Shipped', value: 'shipped' },
]

const KANBAN_PROJECT_COLUMN_ID_PREFIX = 'kanban-project-column:'

function kanbanProjectColumnId(boardStatus: ProjectBoardStatus): string {
  return `${KANBAN_PROJECT_COLUMN_ID_PREFIX}${boardStatus}`
}

function kanbanProjectSortableId(projectId: string): string {
  return `kanban-project:${projectId}`
}

type ProjectKanbanDragColumnData = {
  board_status: ProjectBoardStatus
  type: 'column'
}

function ProjectBoardColumn({
  boardInteractionDisabled,
  boardStatus,
  boardTitle,
  displayProjects,
  onOpenProject,
  openTaskCounts,
}: {
  boardInteractionDisabled: boolean
  boardStatus: ProjectBoardStatus
  boardTitle: string
  displayProjects: Project[]
  onOpenProject: (project: Project) => void
  openTaskCounts: Record<string, number>
}): JSX.Element {
  const columnProjects = projectOrderByBoardStatus(displayProjects, boardStatus)

  return (
    <KanbanColumn
      columnData={{
        type: 'column',
        board_status: boardStatus,
      } satisfies ProjectKanbanDragColumnData}
      draggingDisabled={boardInteractionDisabled}
      droppableId={kanbanProjectColumnId(boardStatus)}
      emptyStateCopy="No projects in this column. Drop a project here when moving cards between columns."
      itemIds={columnProjects.map((project) => kanbanProjectSortableId(project.id))}
      pillClassName={`status-pill status-${boardStatus}`}
      title={boardTitle}
    >
      {columnProjects.map((project) => (
        <KanbanProjectCard
          key={project.id}
          draggingDisabled={boardInteractionDisabled}
          onOpenProject={onOpenProject}
          openTaskCounts={openTaskCounts}
          project={project}
        />
      ))}
    </KanbanColumn>
  )
}

export type ProjectKanbanBoardProps = {
  boardInteractionDisabled: boolean
  boardRef: RefObject<HTMLDivElement>
  displayProjects: Project[]
  filterMatchedProjects: boolean
  hasSidebarProjectSelection: boolean
  kanbanMutationError: string | null
  onDragEnd: (event: DragEndEvent) => void
  onOpenProject: (project: Project) => void
  openTaskCounts: Record<string, number>
  projectsError: string | null
  projectsLoading: boolean
}

export function ProjectKanbanBoard({
  boardInteractionDisabled,
  boardRef,
  displayProjects,
  filterMatchedProjects,
  hasSidebarProjectSelection,
  kanbanMutationError,
  onDragEnd,
  onOpenProject,
  openTaskCounts,
  projectsError,
  projectsLoading,
}: ProjectKanbanBoardProps): JSX.Element {
  if (!hasSidebarProjectSelection) {
    return (
      <p className="muted-copy">No projects selected. Choose one or more projects in the sidebar.</p>
    )
  }

  return (
    <>
      <header className="section-title-bar">
        <h2 className="section-title">Projects</h2>
      </header>

      {projectsError ? <p className="form-error">{projectsError}</p> : null}
      {kanbanMutationError ? <p className="form-error">{kanbanMutationError}</p> : null}
      {projectsLoading ? <p className="muted-copy">Loading projects…</p> : null}

      {!filterMatchedProjects ? (
        <p className="muted-copy">
          Nothing matches this filter. Adjust filter or choose another project type.
        </p>
      ) : null}

      <KanbanBoard boardRef={boardRef} onDragEnd={onDragEnd}>
        {BOARD_OPTIONS.map((option) => (
          <ProjectBoardColumn
            key={option.value}
            boardInteractionDisabled={boardInteractionDisabled}
            boardStatus={option.value}
            boardTitle={option.label}
            displayProjects={filterMatchedProjects ? displayProjects : []}
            onOpenProject={onOpenProject}
            openTaskCounts={openTaskCounts}
          />
        ))}
      </KanbanBoard>
    </>
  )
}
