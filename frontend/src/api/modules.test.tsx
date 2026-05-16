import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { QueryProvider } from '../test/QueryProvider'
import {
  activityTypeQueryKeys,
  useActivityTypeMutations,
  useActivityTypes,
} from './activityTypes'
import { ApiError, apiRequest } from './client'
import {
  projectQueryKeys,
  useProjectMutations,
  useProjects,
} from './projects'
import { createAppQueryClient } from './queryClient'
import {
  createTask,
  listTasks,
  updateTaskStatus,
  useTaskMutations,
  useTasks,
} from './tasks'
import {
  createTimeLog,
  listTimeLogs,
  timeLogQueryKeys,
  useTaskTimeLogs,
  useTimeLogMutations,
} from './timeLogs'
import type { ActivityType, Project, Task, TimeLog, Venture, VentureCategoryLabel } from './types'
import {
  ventureCategoryLabelQueryKeys,
  useVentureCategoryLabelMutations,
  useVentureCategoryLabels,
} from './ventureCategoryLabels'
import {
  ventureQueryKeys,
  useVentureMutations,
  useVentures,
} from './ventures'

type MockResponseOptions = {
  body?: unknown
  status?: number
}

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>

function jsonResponse({ body, status = 200 }: MockResponseOptions): Response {
  return new Response(JSON.stringify(body ?? null), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function installFetchMock(responses: Response[]): FetchMock {
  const fetchMock = vi.fn<typeof fetch>()
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function queryWrapper({ children }: { children: ReactNode }): JSX.Element {
  return <QueryProvider>{children}</QueryProvider>
}

function queryWrapperWithClient(client: ReturnType<typeof createAppQueryClient>): ({
  children,
}: {
  children: ReactNode
}) => JSX.Element {
  function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return <QueryProvider client={client}>{children}</QueryProvider>
  }
  return Wrapper
}

function createTrackedQueryClient() {
  const client = createAppQueryClient()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  return { client, invalidateSpy }
}

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    project_id: overrides.project_id ?? 'project-1',
    title: overrides.title ?? 'Write API tests',
    description: overrides.description ?? null,
    status: overrides.status ?? 'backlog',
    priority: overrides.priority ?? 'medium',
    target_date: overrides.target_date ?? null,
    estimated_hours: overrides.estimated_hours ?? null,
    actual_hours: overrides.actual_hours ?? null,
    kanban_order: overrides.kanban_order ?? null,
    completed_date: overrides.completed_date ?? null,
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

function buildTimeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: overrides.id ?? 'log-1',
    task_id: overrides.task_id ?? 'task-1',
    project_id: overrides.project_id ?? 'project-1',
    activity_type_id: overrides.activity_type_id ?? null,
    activity_type_name: overrides.activity_type_name ?? null,
    activity_type_display_name: overrides.activity_type_display_name ?? 'None',
    hours: overrides.hours ?? 1.5,
    logged_date: overrides.logged_date ?? '2026-05-13',
    notes: overrides.notes ?? 'Focused session',
    title: overrides.title ?? null,
    location: overrides.location ?? null,
    source: 'manual',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

function buildVentureCategoryLabel(overrides: Partial<VentureCategoryLabel> = {}): VentureCategoryLabel {
  return {
    id: overrides.id ?? 'label-1',
    name: overrides.name ?? 'Hustle',
    slug: overrides.slug ?? 'hustle',
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
    usage_count: overrides.usage_count,
  }
}

function buildVenture(overrides: Partial<Venture> = {}): Venture {
  const label =
    overrides.category_label ??
    buildVentureCategoryLabel({ id: overrides.category_label_id ?? 'label-1' })
  return {
    id: overrides.id ?? 'venture-1',
    name: overrides.name ?? 'Acme',
    description: overrides.description ?? null,
    colour: overrides.colour ?? '#112233',
    icon: overrides.icon ?? null,
    status: overrides.status ?? 'active',
    category_label_id: overrides.category_label_id ?? label.id,
    category_label: label,
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

function buildActivityType(overrides: Partial<ActivityType> = {}): ActivityType {
  return {
    id: overrides.id ?? 'at-1',
    name: overrides.name ?? 'planning',
    slug: overrides.slug ?? 'planning',
    status: overrides.status ?? 'active',
    sort_order: overrides.sort_order ?? 0,
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'project-1',
    venture_id: overrides.venture_id ?? 'venture-1',
    name: overrides.name ?? 'Website',
    description: overrides.description ?? null,
    colour: overrides.colour ?? '#445566',
    icon: overrides.icon ?? null,
    project_type: overrides.project_type ?? 'project',
    status: overrides.status ?? 'active',
    board_status: overrides.board_status ?? 'active',
    kanban_order: overrides.kanban_order ?? null,
    finished: overrides.finished ?? false,
    archived_by_venture: overrides.archived_by_venture ?? false,
    created_at: overrides.created_at ?? '2026-05-13T08:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-13T08:00:00Z',
  }
}

describe('api client helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns JSON and null payloads for successful requests', async () => {
    installFetchMock([
      jsonResponse({ body: { ok: true } }),
      new Response(null, { status: 204 }),
    ])

    await expect(apiRequest<{ ok: boolean }>('/api/v1/projects')).resolves.toEqual({
      ok: true,
    })
    await expect(apiRequest<null>('/api/v1/projects/project-1', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('builds validation field errors from failed responses', async () => {
    installFetchMock([
      jsonResponse({
        body: {
          detail: [{ loc: ['body', 'colour'], msg: 'colour must match #RRGGBB' }],
        },
        status: 422,
      }),
    ])

    try {
      await apiRequest('/api/v1/projects', { method: 'POST' })
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(ApiError)
      expect(caughtError).toMatchObject({
        formError: 'colour must match #RRGGBB',
        message: 'colour must match #RRGGBB',
        fieldErrors: { colour: 'colour must match #RRGGBB' },
        status: 422,
      })
      return
    }

    throw new Error('Expected apiRequest to throw an ApiError.')
  })
})

describe('task API helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists tasks with filters and supports create and status updates', async () => {
    const listedTask = buildTask()
    installFetchMock([
      jsonResponse({ body: { items: [listedTask] } }),
      jsonResponse({ body: buildTask({ id: 'task-2', title: 'Created task' }), status: 201 }),
      jsonResponse({
        body: buildTask({ id: 'task-2', title: 'Created task', status: 'done', kanban_order: 3 }),
      }),
    ])

    await expect(
      listTasks({ projectId: 'project-1', status: 'done', priority: 'high' }),
    ).resolves.toEqual([listedTask])
    await expect(
      createTask({
        project_id: 'project-1',
        title: 'Created task',
        description: null,
        status: 'backlog',
        priority: 'medium',
        target_date: null,
        estimated_hours: null,
      }),
    ).resolves.toMatchObject({ id: 'task-2', title: 'Created task' })
    await expect(updateTaskStatus('task-2', { status: 'done', kanban_order: 3 })).resolves.toMatchObject({
      id: 'task-2',
      status: 'done',
      kanban_order: 3,
    })
  })

  it('loads tasks through the hook and reports fetch failures', async () => {
    installFetchMock([
      jsonResponse({ body: [buildTask({ id: 'task-success', title: 'Loaded task' })] }),
      jsonResponse({ body: { detail: 'Task API failed' }, status: 500 }),
    ])

    const { result: successResult } = renderHook(() => useTasks({ projectId: 'project-1' }))
    await waitFor(() => {
      expect(successResult.current.isLoading).toBe(false)
    })
    expect(successResult.current.data).toHaveLength(1)
    expect(successResult.current.data[0]?.title).toBe('Loaded task')

    const { result: errorResult } = renderHook(() => useTasks({ status: 'done' }))
    await waitFor(() => {
      expect(errorResult.current.isLoading).toBe(false)
    })
    expect(errorResult.current.error).toBe('Task API failed')
  })

  it('runs task mutations and surfaces mutation errors', async () => {
    const onSettled = vi.fn((): Promise<void> => Promise.resolve())
    installFetchMock([
      jsonResponse({ body: buildTask({ id: 'task-create', title: 'Create mutation' }), status: 201 }),
      jsonResponse({ body: buildTask({ id: 'task-update', title: 'Update mutation' }) }),
      new Response(null, { status: 204 }),
      jsonResponse({ body: buildTask({ id: 'task-status', status: 'review' }) }),
      jsonResponse({ body: { detail: 'Unable to create task.' }, status: 500 }),
    ])

    const { result } = renderHook(() => useTaskMutations(onSettled))

    await act(async () => {
      await expect(
        result.current.create({
          project_id: 'project-1',
          title: 'Create mutation',
          description: null,
          status: 'backlog',
          priority: 'medium',
          target_date: null,
          estimated_hours: null,
        }),
      ).resolves.toMatchObject({ id: 'task-create' })
    })
    await act(async () => {
      await expect(
        result.current.update('task-update', {
          project_id: 'project-1',
          title: 'Update mutation',
          description: null,
          status: 'backlog',
          priority: 'medium',
          target_date: null,
          estimated_hours: null,
        }),
      ).resolves.toMatchObject({ id: 'task-update' })
    })
    await act(async () => {
      await expect(result.current.remove('task-update')).resolves.toBeUndefined()
    })
    await act(async () => {
      await expect(
        result.current.updateStatus('task-status', { status: 'review', kanban_order: 2 }),
      ).resolves.toMatchObject({ id: 'task-status', status: 'review' })
    })
    expect(onSettled).toHaveBeenCalledTimes(4)

    await act(async () => {
      await expect(
        result.current.create({
          project_id: 'project-1',
          title: 'Broken mutation',
          description: null,
          status: 'backlog',
          priority: 'medium',
          target_date: null,
          estimated_hours: null,
        }),
      ).rejects.toBeInstanceOf(ApiError)
    })
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error?.message).toBe('Unable to create task.')
  })
})

describe('time log API helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists and creates time logs', async () => {
    const listedTimeLog = buildTimeLog()
    installFetchMock([
      jsonResponse({ body: { items: [listedTimeLog] } }),
      jsonResponse({ body: buildTimeLog({ id: 'log-2', hours: 2.5 }), status: 201 }),
    ])

    await expect(listTimeLogs('task-1')).resolves.toEqual([listedTimeLog])
    await expect(
      createTimeLog('task-1', {
        hours: 2.5,
        logged_date: '2026-05-13',
        notes: 'Second session',
      }),
    ).resolves.toMatchObject({ id: 'log-2', hours: 2.5 })
  })

  it('loads time logs, handles missing task ids, and surfaces mutation failures', async () => {
    installFetchMock([
      jsonResponse({ body: [buildTimeLog({ id: 'log-success' })] }),
      jsonResponse({ body: buildTimeLog({ id: 'log-created', hours: 3 }) }),
      jsonResponse({ body: { detail: 'Unable to create time log.' }, status: 500 }),
    ])

    const { result: emptyResult } = renderHook(() => useTaskTimeLogs(null), {
      wrapper: queryWrapper,
    })
    await waitFor(() => {
      expect(emptyResult.current.isLoading).toBe(false)
    })
    expect(emptyResult.current.data).toEqual([])

    const { result: listResult } = renderHook(() => useTaskTimeLogs('task-1'), {
      wrapper: queryWrapper,
    })
    await waitFor(() => {
      expect(listResult.current.isLoading).toBe(false)
    })
    expect(listResult.current.data[0]?.id).toBe('log-success')

    const { result: missingTaskMutation } = renderHook(() => useTimeLogMutations(null), {
      wrapper: queryWrapper,
    })
    await act(async () => {
      await expect(
        missingTaskMutation.current.create({
          hours: 1,
          logged_date: '2026-05-13',
          notes: null,
        }),
      ).rejects.toBeInstanceOf(ApiError)
    })
    expect(missingTaskMutation.current.error?.message).toBe('A task is required.')

    const { client, invalidateSpy } = createTrackedQueryClient()
    const { result: mutationResult } = renderHook(() => useTimeLogMutations('task-1'), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await expect(
        mutationResult.current.create({
          hours: 3,
          logged_date: '2026-05-13',
          notes: 'Deep work',
        }),
      ).resolves.toMatchObject({ id: 'log-created', hours: 3 })
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: timeLogQueryKeys.list('task-1') }),
    )
    await act(async () => {
      await expect(
        mutationResult.current.create({
          hours: 4,
          logged_date: '2026-05-14',
          notes: 'Retry path',
        }),
      ).rejects.toBeInstanceOf(ApiError)
    })
    expect(mutationResult.current.error?.message).toBe('Unable to create time log.')
  })
})

describe('phase 1.6.7 API hooks (TanStack Query)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads venture category labels via useQuery and invalidates list after create', async () => {
    installFetchMock([jsonResponse({ body: [buildVentureCategoryLabel()] })])

    const { result: listResult } = renderHook(() => useVentureCategoryLabels(), {
      wrapper: queryWrapper,
    })
    await waitFor(() => {
      expect(listResult.current.isLoading).toBe(false)
    })
    expect(listResult.current.data).toHaveLength(1)

    const { client, invalidateSpy } = createTrackedQueryClient()
    installFetchMock([
      jsonResponse({ body: buildVentureCategoryLabel({ id: 'x', name: 'New' }), status: 201 }),
    ])
    const { result: mutResult } = renderHook(() => useVentureCategoryLabelMutations(), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await mutResult.current.create({ name: 'New' })
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ventureCategoryLabelQueryKeys.list() }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ventureQueryKeys.list('active') }),
    )
  })

  it('loads ventures via useQuery and invalidates ventures plus projects after create', async () => {
    installFetchMock([jsonResponse({ body: [buildVenture()] })])

    const { result: listResult } = renderHook(() => useVentures('active'), { wrapper: queryWrapper })
    await waitFor(() => {
      expect(listResult.current.isLoading).toBe(false)
    })
    expect(listResult.current.data[0]?.name).toBe('Acme')

    const { client, invalidateSpy } = createTrackedQueryClient()
    installFetchMock([jsonResponse({ body: buildVenture({ id: 'v-new' }), status: 201 })])
    const { result: mutResult } = renderHook(() => useVentureMutations(), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await mutResult.current.create({
        name: 'New Co',
        description: null,
        colour: '#ffffff',
      })
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ventureQueryKeys.list('active') }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ventureQueryKeys.list('archived') }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.lists() }),
    )
  })

  it('loads activity types via useQuery and invalidates active and archived lists after create', async () => {
    installFetchMock([jsonResponse({ body: [buildActivityType()] })])

    const { result: listResult } = renderHook(() => useActivityTypes('active'), {
      wrapper: queryWrapper,
    })
    await waitFor(() => {
      expect(listResult.current.isLoading).toBe(false)
    })
    expect(listResult.current.data[0]?.slug).toBe('planning')

    const { client, invalidateSpy } = createTrackedQueryClient()
    installFetchMock([jsonResponse({ body: buildActivityType({ id: 'new-at' }), status: 201 })])
    const { result: mutResult } = renderHook(() => useActivityTypeMutations(), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await mutResult.current.create({ name: 'Meeting' })
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: activityTypeQueryKeys.list('active') }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: activityTypeQueryKeys.list('archived') }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: timeLogQueryKeys.all }),
    )
  })

  it('loads projects via useQuery and invalidates project lists after create', async () => {
    installFetchMock([jsonResponse({ body: [buildProject()] })])

    const { result: listResult } = renderHook(
      () => useProjects({ status: 'active', venture_id: 'venture-1' }),
      { wrapper: queryWrapper },
    )
    await waitFor(() => {
      expect(listResult.current.isLoading).toBe(false)
    })
    expect(listResult.current.data[0]?.venture_id).toBe('venture-1')

    const { client, invalidateSpy } = createTrackedQueryClient()
    installFetchMock([jsonResponse({ body: buildProject({ id: 'p-new' }), status: 201 })])
    const { result: mutResult } = renderHook(() => useProjectMutations(), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await mutResult.current.create({
        venture_id: 'venture-1',
        name: 'New project',
        description: null,
        colour: '#000000',
      })
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.lists() }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.board() }),
    )
  })

  it('invalidates project lists and board after project unarchive', async () => {
    const { client, invalidateSpy } = createTrackedQueryClient()
    installFetchMock([jsonResponse({ body: buildProject({ status: 'active' }) })])
    const { result: mutResult } = renderHook(() => useProjectMutations(), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await mutResult.current.unarchive('project-1')
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.lists() }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.board() }),
    )
  })

  it('invalidates project lists and board after project board status update', async () => {
    const { client, invalidateSpy } = createTrackedQueryClient()
    installFetchMock([jsonResponse({ body: buildProject({ board_status: 'shipped' }) })])
    const { result: mutResult } = renderHook(() => useProjectMutations(), {
      wrapper: queryWrapperWithClient(client),
    })
    await act(async () => {
      await mutResult.current.updateBoardStatus('project-1', { board_status: 'shipped' })
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.lists() }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectQueryKeys.board() }),
    )
  })
})
