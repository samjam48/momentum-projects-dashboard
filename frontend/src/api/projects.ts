import { useCallback, useEffect, useState } from 'react'

import { ApiError, apiRequest } from './client'
import type {
  Project,
  ProjectBoardStatus,
  ProjectPayload,
  ProjectStatus,
  ProjectType,
} from './types'

// TanStack Query migration target: @tanstack/react-query useQuery/useMutation queryKey invalidateQueries
export const projectQueryKeys = {
  all: ['projects'] as const,
  lists: () => [...projectQueryKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectQueryKeys.lists(), filters] as const,
  board: () => [...projectQueryKeys.all, 'board'] as const,
}

type QueryState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  reload: () => Promise<void>
}

function extractProjects(payload: unknown): Project[] {
  if (Array.isArray(payload)) {
    return payload as Project[]
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    Array.isArray(payload.items)
  ) {
    return payload.items as Project[]
  }

  return []
}

export type ProjectFilters = {
  status?: ProjectStatus
  venture_id?: string
  board_status?: ProjectBoardStatus
  project_type?: ProjectType
  finished?: boolean
}

function buildProjectQuery(filters: ProjectFilters = {}): string {
  const query = new URLSearchParams()
  if (filters.status) {
    query.set('status', filters.status)
  }
  if (filters.venture_id) {
    query.set('venture_id', filters.venture_id)
  }
  if (filters.board_status) {
    query.set('board_status', filters.board_status)
  }
  if (filters.project_type) {
    query.set('project_type', filters.project_type)
  }
  if (typeof filters.finished === 'boolean') {
    query.set('finished', String(filters.finished))
  }
  return query.toString()
}

export async function listProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  const query = buildProjectQuery(filters)
  const payload = await apiRequest<unknown>(`/api/v1/projects?${query.toString()}`)
  return extractProjects(payload)
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  return apiRequest<Project>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateProject(
  projectId: string,
  payload: ProjectPayload,
): Promise<Project> {
  return apiRequest<Project>(`/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function archiveProject(projectId: string): Promise<void> {
  await apiRequest<null>(`/api/v1/projects/${projectId}`, {
    method: 'DELETE',
  })
}

export async function unarchiveProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/api/v1/projects/${projectId}/unarchive`, {
    method: 'PATCH',
  })
}

export type UpdateProjectBoardStatusPayload = {
  board_status: ProjectBoardStatus
  order?: { project_id: string; kanban_order: number }[]
  finished?: boolean
}

export async function updateProjectBoardStatus(
  projectId: string,
  payload: UpdateProjectBoardStatusPayload,
): Promise<Project> {
  return apiRequest<Project>(`/api/v1/projects/${projectId}/board-status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

const DEFAULT_PROJECT_FILTERS: ProjectFilters = { status: 'active' }

export function useProjects(filters: ProjectFilters = DEFAULT_PROJECT_FILTERS): QueryState<Project[]> {
  const [data, setData] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setData(await listProjects(filters))
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError('Unable to load projects.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, isLoading, reload }
}

type ProjectMutations = {
  create: (payload: ProjectPayload) => Promise<Project>
  update: (projectId: string, payload: ProjectPayload) => Promise<Project>
  archive: (projectId: string) => Promise<void>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
}

export function useProjectMutations(
  onSettled: () => Promise<void>,
): ProjectMutations {
  const [error, setError] = useState<ApiError | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const runMutation = useCallback(
    async <T>(callback: () => Promise<T>): Promise<T> => {
      setIsSaving(true)
      setError(null)

      try {
        const result = await callback()
        await onSettled()
        return result
      } catch (caughtError) {
        if (caughtError instanceof ApiError) {
          setError(caughtError)
          throw caughtError
        }

        const fallbackError = new ApiError('Unable to save project.', 500)
        setError(fallbackError)
        throw fallbackError
      } finally {
        setIsSaving(false)
      }
    },
    [onSettled],
  )

  return {
    create: (payload) => runMutation(() => createProject(payload)),
    update: (projectId, payload) => runMutation(() => updateProject(projectId, payload)),
    archive: (projectId) => runMutation(() => archiveProject(projectId)),
    error,
    isSaving,
    resetError: () => setError(null),
  }
}
