import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { ApiError, apiRequest } from './client'
import { useQueryState, type QueryState } from './queryUtils'
import type {
  Project,
  ProjectBoardStatus,
  ProjectPayload,
  ProjectStatus,
  ProjectType,
} from './types'

export const projectQueryKeys = {
  all: ['projects'] as const,
  lists: () => [...projectQueryKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectQueryKeys.lists(), filters] as const,
  board: () => [...projectQueryKeys.all, 'board'] as const,
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

export async function archiveProject(
  projectId: string,
  options?: { finished?: boolean },
): Promise<void> {
  const init: RequestInit = { method: 'POST' }
  if (options !== undefined && options.finished !== undefined) {
    init.body = JSON.stringify({ finished: options.finished })
  }
  await apiRequest<null>(`/api/v1/projects/${projectId}/archive`, init)
}

export async function unarchiveProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/api/v1/projects/${projectId}/unarchive`, {
    method: 'PATCH',
  })
}

export type UpdateProjectBoardStatusPayload = {
  board_status: ProjectBoardStatus
  kanban_order?: number
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

export function useProjects(
  filters: ProjectFilters = DEFAULT_PROJECT_FILTERS,
  options?: { enabled?: boolean },
): QueryState<Project[]> {
  const { status, venture_id, board_status, project_type, finished } = filters
  const stableFilters = useMemo<ProjectFilters>(
    () => ({ status, venture_id, board_status, project_type, finished }),
    [status, venture_id, board_status, project_type, finished],
  )

  const enabled = options?.enabled ?? true

  const query = useQuery({
    queryKey: projectQueryKeys.list(stableFilters),
    queryFn: () => listProjects(stableFilters),
    enabled,
  })

  return useQueryState(query, [])
}

function useProjectMutationErrorState(): {
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
  runMutation: <T>(callback: () => Promise<T>) => Promise<T>
} {
  const [error, setError] = useState<ApiError | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const runMutation = async <T>(callback: () => Promise<T>): Promise<T> => {
    setIsSaving(true)
    setError(null)
    try {
      return await callback()
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
  }

  return {
    error,
    isSaving,
    resetError: () => setError(null),
    runMutation,
  }
}

export function useProjectMutations(): {
  create: (payload: ProjectPayload) => Promise<Project>
  update: (projectId: string, payload: ProjectPayload) => Promise<Project>
  archive: (projectId: string, archivePayload?: { finished?: boolean }) => Promise<void>
  unarchive: (projectId: string) => Promise<Project>
  updateBoardStatus: (
    projectId: string,
    payload: UpdateProjectBoardStatusPayload,
  ) => Promise<Project>
  error: ApiError | null
  isSaving: boolean
  resetError: () => void
} {
  const queryClient = useQueryClient()
  const { error, isSaving, resetError, runMutation } = useProjectMutationErrorState()

  const onSettled = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.board() }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: createProject,
    onSettled,
  })
  const updateMutation = useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: ProjectPayload }) =>
      updateProject(projectId, payload),
    onSettled,
  })
  const archiveMutation = useMutation({
    mutationFn: ({
      projectId,
      archivePayload,
    }: {
      projectId: string
      archivePayload?: { finished?: boolean }
    }) => archiveProject(projectId, archivePayload),
    onSettled,
  })
  const unarchiveMutation = useMutation({
    mutationFn: unarchiveProject,
    onSettled,
  })
  const updateBoardStatusMutation = useMutation({
    mutationFn: ({
      projectId,
      payload,
    }: {
      projectId: string
      payload: UpdateProjectBoardStatusPayload
    }) => updateProjectBoardStatus(projectId, payload),
    onSettled,
  })

  return {
    create: (payload) => runMutation(() => createMutation.mutateAsync(payload)),
    update: (projectId, payload) =>
      runMutation(() => updateMutation.mutateAsync({ projectId, payload })),
    archive: (projectId, archivePayload) =>
      runMutation(() => archiveMutation.mutateAsync({ projectId, archivePayload })),
    unarchive: (projectId) => runMutation(() => unarchiveMutation.mutateAsync(projectId)),
    updateBoardStatus: (projectId, payload) =>
      runMutation(() =>
        updateBoardStatusMutation.mutateAsync({ projectId, payload }),
      ),
    error,
    isSaving,
    resetError,
  }
}
