import type { DragEndEvent } from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ApiError } from '../../api/client'
import type { QueryState } from '../../api/queryUtils'
import {
  projectQueryKeys,
  updateProjectBoardStatus,
  type UpdateProjectBoardStatusPayload,
} from '../../api/projects'
import type { Project, ProjectBoardStatus, ProjectType } from '../../api/types'
import {
  getDropDetailFromDragEvent,
  hasKanbanComparableChanged,
  reorderKanbanItems,
  type DropDetail,
  type KanbanDndConfig,
} from '../../lib/kanbanDnd'
import { sortProjectsForKanbanBoard } from '../../lib/kanbanSort'

type ProjectKanbanDropDetail = {
  board_status: ProjectBoardStatus
  kanban_order: number | null
  projectId: string
}

function isProjectKanbanDropDetail(value: unknown): value is ProjectKanbanDropDetail {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'projectId' in value &&
    typeof value.projectId === 'string' &&
    'board_status' in value &&
    typeof value.board_status === 'string' &&
    'kanban_order' in value &&
    (typeof value.kanban_order === 'number' || value.kanban_order === null)
  )
}

const projectKanbanDndConfig: KanbanDndConfig<Project, ProjectBoardStatus> = {
  columnIdPrefix: 'kanban-project-column:',
  cardIdPrefix: 'kanban-project:',
  getColumnKey: (project) => project.board_status,
  getOrder: (project) => project.kanban_order,
  setColumnAndOrder: (project, column, order) => ({
    ...project,
    board_status: column,
    kanban_order: order,
    finished: column === 'shipped' ? true : project.finished,
  }),
  orderItemsInColumn: (items, column) =>
    sortProjectsForKanbanBoard(
      items.filter((project) => project.board_status === column),
    ),
}

function toProjectKanbanDropDetail(
  detail: DropDetail<ProjectBoardStatus>,
): ProjectKanbanDropDetail {
  return {
    projectId: detail.itemId,
    board_status: detail.columnKey,
    kanban_order: detail.kanban_order,
  }
}

function projectKanbanComparable(project: Project): {
  board_status: ProjectBoardStatus
  finished: boolean
  kanban_order: number | null
} {
  return {
    board_status: project.board_status,
    kanban_order: project.kanban_order,
    finished: project.finished,
  }
}

export type UseProjectKanbanControllerArgs = {
  boardRef: RefObject<HTMLDivElement | null>
  projectKanbanTypeFilter: 'all' | ProjectType
  projectsQuery: QueryState<Project[]>
  sidebarScopedBoardProjects: Project[]
  storedProjectIdsKey: string
}

export function useProjectKanbanController({
  boardRef,
  projectKanbanTypeFilter,
  projectsQuery,
  sidebarScopedBoardProjects,
  storedProjectIdsKey,
}: UseProjectKanbanControllerArgs): {
  displayProjectsForBoard: Project[]
  filterMatchedProjectKanban: boolean
  handleProjectKanbanDragEnd: (event: DragEndEvent) => void
  projectBoardInteractionDisabled: boolean
  projectKanbanMutationError: string | null
} {
  const [optimisticProjects, setOptimisticProjects] = useState<Project[] | null>(null)
  const [projectKanbanMutationError, setProjectKanbanMutationError] = useState<
    string | null
  >(null)

  const queryClient = useQueryClient()
  const updateProjectBoardStatusMutation = useMutation({
    mutationFn: (vars: { payload: UpdateProjectBoardStatusPayload; projectId: string }) =>
      updateProjectBoardStatus(vars.projectId, vars.payload),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: projectQueryKeys.board() }),
      ])
    },
  })

  const projectBoardQueueTailRef = useRef(Promise.resolve())
  const [projectBoardLaneBusyCount, setProjectBoardLaneBusyCount] = useState(0)

  const typeFilteredBoardProjects = useMemo(() => {
    if (projectKanbanTypeFilter === 'all') {
      return sidebarScopedBoardProjects
    }

    return sidebarScopedBoardProjects.filter(
      (project) => project.project_type === projectKanbanTypeFilter,
    )
  }, [projectKanbanTypeFilter, sidebarScopedBoardProjects])

  const filterMatchedProjectKanban =
    projectKanbanTypeFilter === 'all'
      ? sidebarScopedBoardProjects.length > 0
      : typeFilteredBoardProjects.length > 0

  const displayProjectsForBoard = optimisticProjects ?? typeFilteredBoardProjects

  const previousFilterKeyRef = useRef(storedProjectIdsKey)
  const previousProjectsDataRef = useRef(projectsQuery.data)

  useEffect(() => {
    if (previousFilterKeyRef.current === storedProjectIdsKey) {
      return
    }
    previousFilterKeyRef.current = storedProjectIdsKey
    setOptimisticProjects((current) => (current !== null ? null : current))
    setProjectKanbanMutationError((current) => (current !== null ? null : current))
  }, [storedProjectIdsKey])

  useEffect(() => {
    if (previousProjectsDataRef.current === projectsQuery.data) {
      return
    }
    previousProjectsDataRef.current = projectsQuery.data
    setOptimisticProjects((current) => (current !== null ? null : current))
  }, [projectsQuery.data])

  useEffect(() => {
    setOptimisticProjects((current) => (current !== null ? null : current))
    setProjectKanbanMutationError((current) => (current !== null ? null : current))
  }, [projectKanbanTypeFilter])

  const projectBoardInteractionDisabled =
    projectsQuery.isLoading || projectBoardLaneBusyCount > 0

  const enqueueProjectBoardLane = useCallback((task: () => Promise<void>) => {
    setProjectBoardLaneBusyCount((count) => count + 1)

    const wrapped = async (): Promise<void> => {
      try {
        await task()
      } finally {
        setProjectBoardLaneBusyCount((count) => count - 1)
      }
    }

    const executed = projectBoardQueueTailRef.current.then(wrapped)
    projectBoardQueueTailRef.current = executed.catch(() => undefined)
    return executed
  }, [])

  const handleProjectKanbanDrop = useCallback(
    async (detail: ProjectKanbanDropDetail): Promise<void> => {
      const nextProjects = reorderKanbanItems(
        displayProjectsForBoard,
        detail.projectId,
        detail.board_status,
        detail.kanban_order,
        projectKanbanDndConfig,
      )

      if (
        !hasKanbanComparableChanged(
          displayProjectsForBoard,
          nextProjects,
          projectKanbanComparable,
        )
      ) {
        return
      }

      setProjectKanbanMutationError(null)
      setOptimisticProjects(nextProjects)

      const payload: UpdateProjectBoardStatusPayload = {
        board_status: detail.board_status,
        kanban_order:
          detail.kanban_order === null ? undefined : detail.kanban_order,
      }

      if (detail.board_status === 'shipped') {
        payload.finished = true
      }

      await enqueueProjectBoardLane(async () => {
        try {
          await updateProjectBoardStatusMutation.mutateAsync({
            payload,
            projectId: detail.projectId,
          })
          setOptimisticProjects(null)
        } catch (caughtError) {
          setOptimisticProjects(null)

          if (caughtError instanceof ApiError) {
            setProjectKanbanMutationError(
              caughtError.formError ?? caughtError.message,
            )
            return
          }

          setProjectKanbanMutationError('Unable to persist project board changes.')
        }
      })
    },
    [
      displayProjectsForBoard,
      enqueueProjectBoardLane,
      updateProjectBoardStatusMutation,
    ],
  )

  const handleProjectKanbanDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const detail = getDropDetailFromDragEvent(
        displayProjectsForBoard,
        event,
        projectKanbanDndConfig,
      )
      if (!detail) {
        return
      }

      void handleProjectKanbanDrop(toProjectKanbanDropDetail(detail))
    },
    [displayProjectsForBoard, handleProjectKanbanDrop],
  )

  useEffect(() => {
    const kanbanBoard = boardRef.current
    if (!kanbanBoard) {
      return
    }

    const handleProjectKanbanTestDrop = (event: Event): void => {
      if (!(event instanceof CustomEvent) || !isProjectKanbanDropDetail(event.detail)) {
        return
      }

      void handleProjectKanbanDrop(event.detail)
    }

    kanbanBoard.addEventListener('project-kanban:drop', handleProjectKanbanTestDrop)
    return () => {
      kanbanBoard.removeEventListener('project-kanban:drop', handleProjectKanbanTestDrop)
    }
  }, [boardRef, handleProjectKanbanDrop])

  return {
    displayProjectsForBoard,
    filterMatchedProjectKanban,
    handleProjectKanbanDragEnd,
    projectBoardInteractionDisabled,
    projectKanbanMutationError,
  }
}
