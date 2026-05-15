/**
 * Ticket 1.6-11 — Time Log Activity Type Combobox and List UX (TDD).
 *
 * Preconditions: Phase 1.6 API hooks/contracts exist (`activity-types`, time-log payloads).
 * These tests encode acceptance criteria and edge cases ahead of UI implementation.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from './test/renderApp'
import {
  buildActivityType,
  buildProject,
  buildTask,
  buildTimeLog,
} from './test/fixtures'
import { resetProjectFilterStore } from './stores/projectFilter'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import { flushAct } from './test/actUtils'

const alphaProject = buildProject({
  id: 'project-alpha',
  name: 'Alpha Client',
  colour: '#5B7C99',
})

const releaseNotesTask = buildTask({
  id: 'task-write-release-notes',
  project_id: 'project-alpha',
  title: 'Write release notes',
  status: 'done',
  completed_date: '2026-05-18',
  actual_hours: 2,
})

const user = userEvent.setup()

async function openEditTaskDialog(taskTitle: string): Promise<HTMLElement> {
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`edit task ${taskTitle}`, 'i') }),
  )
  return screen.findByRole('dialog', { name: /edit task/i })
}

async function openAddTimeLogDialog(taskDialog: HTMLElement): Promise<HTMLElement> {
  fireEvent.click(within(taskDialog).getByRole('button', { name: /\+ add time log/i }))
  return screen.findByRole('dialog', { name: /add time log/i })
}

/** Pre-implementation: fail sooner than Vitest default while specs wait on combobox UX. */
const TL_WAIT = { timeout: 3000 } satisfies { timeout: number }

describe('Ticket 1.6-11 — Time log activity type combobox & list UX', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetTestStorage()
    resetProjectFilterStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetTestStorage()
    resetProjectFilterStore()
  })

  it('uses an Activity type combobox as the primary labelled input on the add time-log form (before notes)', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const activityCombobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    const notesField = within(addDialog).getByRole('textbox', { name: /^notes$/i })

    expect(
      activityCombobox.compareDocumentPosition(notesField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('lists active activity types in the combobox and filters them case-insensitively while typing', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)

    expect(await screen.findByRole('option', { name: /planning/i }, TL_WAIT)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /meeting/i })).toBeInTheDocument()

    await user.clear(combobox)
    await user.type(combobox, 'MEET')

    expect(await screen.findByRole('option', { name: /meeting/i }, TL_WAIT)).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /planning/i })).not.toBeInTheDocument()
  })

  it('shows a single Create activity option when the filter matches no existing type', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, 'novel-type-xyz')

    const createOptions = screen.queryAllByRole('option', { name: /^create activity$/i })
    expect(createOptions).toHaveLength(1)
  })

  it('does not offer Create activity for whitespace-only combobox input', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, '   ')

    expect(screen.queryByRole('option', { name: /^create activity$/i })).not.toBeInTheDocument()
  })

  it('inline-creates an activity type via API, selects it, and preserves other time-log fields', async () => {
    const { fetchMock } = installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    await user.type(within(addDialog).getByLabelText(/^time$/i), '2.5')
    await user.type(within(addDialog).getByRole('textbox', { name: /^location$/i }), 'Studio')
    await user.type(within(addDialog).getByRole('textbox', { name: /^notes$/i }), 'Deep focus')

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, 'Deep work')

    await user.click(await screen.findByRole('option', { name: /^create activity$/i }, TL_WAIT))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          if ((init?.method ?? 'GET') !== 'POST') {
            return false
          }

          try {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
            return new URL(url, 'http://localhost').pathname === '/api/v1/activity-types'
          } catch {
            return false
          }
        }),
      ).toBe(true)
    })

    await waitFor(() => {
      expect(combobox).toHaveDisplayValue(/deep work/i)
    })

    expect(within(addDialog).getByLabelText(/^time$/i)).toHaveValue(2.5)
    expect(within(addDialog).getByRole('textbox', { name: /^location$/i })).toHaveValue('Studio')
    expect(within(addDialog).getByRole('textbox', { name: /^notes$/i })).toHaveValue('Deep focus')
  })

  it('shows client-side validation for activity names over 25 characters before a successful save', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, 'abcdefghijklmnopqrstuvwxyz')

    await user.click(await screen.findByRole('option', { name: /^create activity$/i }, TL_WAIT))

    expect(
      await within(addDialog).findByText(/\b25\b|at most 25|maximum\b.*25|too long/i, TL_WAIT),
    ).toBeInTheDocument()
  })

  it('surfaces server validation errors inline when POST /activity-types fails', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
      activityTypes: [
        buildActivityType({
          id: 'archived-planning',
          name: 'planning',
          slug: 'planning',
          status: 'archived',
          sort_order: null,
        }),
        buildActivityType({
          id: 'at-meeting-visible',
          name: 'meeting',
          slug: 'meeting',
          sort_order: 0,
        }),
      ],
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, 'planning')

    await user.click(await screen.findByRole('option', { name: /^create activity$/i }, TL_WAIT))

    expect(
      await within(addDialog).findByText(/already exists|duplicate/i, TL_WAIT),
    ).toBeInTheDocument()
  })

  it('blocks creating reserved name uncategorised with clear validation copy', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, 'uncategorised')

    await user.click(await screen.findByRole('option', { name: /^create activity$/i }, TL_WAIT))

    expect(
      await within(addDialog).findByText(/reserved|uncategorised/i, TL_WAIT),
    ).toBeInTheDocument()
  })

  it('does not expose a distracting Create-only state when casing differs but the type already exists', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      activityTypes: [
        buildActivityType({
          id: 'at-planning-seed',
          name: 'planning',
          slug: 'planning',
          sort_order: 0,
        }),
      ],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.clear(combobox)
    await user.type(combobox, 'Planning')

    expect(screen.queryByRole('option', { name: /^create activity$/i })).not.toBeInTheDocument()

    const listbox = await screen.findByRole('listbox', {}, TL_WAIT)

    expect(within(listbox).getByRole('option', { name: /planning/i })).toBeInTheDocument()
  })

  it('surfaces inline errors when POST time-log rejects the payload while other fields remain visible', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
      onTimeLogCreate: () =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: 'Bad activity assignment' }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    await user.type(within(addDialog).getByLabelText(/^time$/i), '1')

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.click(await screen.findByRole('option', { name: /meeting/i }, TL_WAIT))

    await user.click(within(addDialog).getByRole('button', { name: /^save$/i }))

    expect(await within(addDialog).findByText(/bad activity assignment/i, TL_WAIT)).toBeInTheDocument()
    expect(within(addDialog).getByLabelText(/^time$/i)).toHaveValue(1)
  })

  it('allows saving without notes while still sending location when set', async () => {
    const { fetchMock } = installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    await user.type(within(addDialog).getByLabelText(/^time$/i), '3')
    await user.type(within(addDialog).getByRole('textbox', { name: /^location$/i }), 'Remote')

    const combobox = await within(addDialog).findByRole(
      'combobox',
      { name: /activity type/i },
      TL_WAIT,
    )
    await user.click(combobox)
    await user.click(await screen.findByRole('option', { name: /planning/i }, TL_WAIT))

    await user.click(within(addDialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      const postCall = [...fetchMock.mock.calls].reverse().find(([input, init]) => {
        if ((init?.method ?? 'GET') !== 'POST') return false

        try {
          const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
          const url = new URL(raw, 'http://localhost')

          return url.pathname.endsWith('/time-logs')
        } catch {
          return false
        }
      })

      expect(postCall).toBeTruthy()
      const [, init] = postCall!

      expect(init?.body).toBeTruthy()
      const parsed = JSON.parse(init!.body as string) as {
        notes: string | null
        location?: string | null
      }

      expect(parsed.notes).toBeNull()
      expect(parsed.location).toBe('Remote')
    })
  })

  it('renders migrated null activity logs as bold uncategorised on the primary list line', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-migrated-null',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_id: null,
            activity_type_name: null,
            activity_type_display_name: 'uncategorised',
            notes: null,
            title: null,
            logged_date: '2026-05-10',
            hours: 1,
          }),
        ],
      },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const row = await within(taskDialog).findByTestId(
      'time-log-row-log-migrated-null',
      {},
      TL_WAIT,
    )

    const primary = within(row).getByTestId('time-log-row-primary')
    const strong = within(primary).getByText(/uncategorised/i)

    expect(strong.tagName).toBe('STRONG')
  })

  it('uses activity type display as the bold primary label and keeps location on the secondary line', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-with-type',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_id: 'at-seed-planning',
            activity_type_name: 'planning',
            activity_type_display_name: 'Planning',
            logged_date: '2026-05-11',
            hours: 1.25,
            location: 'Coffee shop',
            notes: null,
            title: null,
          }),
        ],
      },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const row = await within(taskDialog).findByTestId('time-log-row-log-with-type', {}, TL_WAIT)

    const primary = within(row).getByTestId('time-log-row-primary')
    expect(within(primary).getByText(/planning/i).tagName).toBe('STRONG')

    const secondary = within(row).getByTestId('time-log-row-secondary')
    expect(secondary.textContent ?? '').toMatch(/coffee shop/i)
  })

  it('date-orders logs without inserting activity-type section headers when types differ', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-old',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_display_name: 'Meeting',
            activity_type_id: 'x',
            activity_type_name: 'meeting',
            logged_date: '2026-05-08',
            created_at: '2026-05-09T09:00:00Z',
            hours: 1,
          }),
          buildTimeLog({
            id: 'log-new',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_display_name: 'Planning',
            activity_type_id: 'y',
            activity_type_name: 'planning',
            logged_date: '2026-05-12',
            created_at: '2026-05-12T09:00:00Z',
            hours: 2,
          }),
        ],
      },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const list = await within(taskDialog).findByRole(
      'list',
      { name: /time logs/i },
      TL_WAIT,
    )

    expect(within(list).queryByRole('heading', { name: /planning/i })).not.toBeInTheDocument()
    expect(within(list).queryByRole('heading', { name: /meeting/i })).not.toBeInTheDocument()

    const primaries = within(list).getAllByTestId('time-log-row-primary')
    expect(primaries[0]?.textContent ?? '').toMatch(/planning/i)
    expect(primaries[1]?.textContent ?? '').toMatch(/meeting/i)
  })

  it('ties break ordering for identical logged dates by created timestamp (stable list)', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-older-created',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_display_name: 'Admin',
            logged_date: '2026-05-01',
            created_at: '2026-05-02T09:00:00Z',
            hours: 1,
          }),
          buildTimeLog({
            id: 'log-newer-created',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_display_name: 'Planning',
            logged_date: '2026-05-01',
            created_at: '2026-05-03T09:00:00Z',
            hours: 1,
          }),
        ],
      },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const list = await within(taskDialog).findByRole(
      'list',
      { name: /time logs/i },
      TL_WAIT,
    )

    const primaries = within(list).getAllByTestId('time-log-row-primary')
    expect(primaries[0]?.textContent ?? '').toMatch(/planning/i)
    expect(primaries[1]?.textContent ?? '').toMatch(/admin/i)
  })

  it('after archiving an activity type, refetched time logs show uncategorised for cleared rows', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-archived-type',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_id: 'at-seed-planning',
            activity_type_name: 'planning',
            activity_type_display_name: 'Planning',
            logged_date: '2026-05-14',
            hours: 1,
          }),
        ],
      },
    })

    await renderApp()
    let taskDialog = await openEditTaskDialog('Write release notes')

    expect(
      await within(taskDialog).findByTestId('time-log-row-log-archived-type', {}, TL_WAIT),
    ).toHaveTextContent(/planning/i)

    const archiveResponse = await fetch('http://localhost/api/v1/activity-types/at-seed-planning/archive', {
      method: 'PATCH',
    })

    await flushAct()
    expect(archiveResponse.status).toBe(204)

    fireEvent.keyDown(taskDialog, {
      key: 'Escape',
      code: 'Escape',
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /edit task/i })).not.toBeInTheDocument()
    })

    await flushAct()

    taskDialog = await openEditTaskDialog('Write release notes')

    expect(
      await within(taskDialog).findByTestId(
        'time-log-row-log-archived-type',
        {},
        TL_WAIT,
      ),
    ).toHaveTextContent(/uncategorised/i)
  })

  it('exposes manage-activity-types affordance consistent with linking from the time-log form', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: { 'task-write-release-notes': [] },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')
    const addDialog = await openAddTimeLogDialog(taskDialog)

    const surface =
      within(addDialog).queryByRole('link', {
        name: /manage activity types|activity types$/i,
      }) ?? within(addDialog).queryByRole('button', { name: /manage activity types|activity types$/i })

    expect(surface).toBeTruthy()
  })

  it('opens an edit time-log dialog that shares the Activity type combobox behaviour', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-edit-target',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_id: 'at-seed-meeting',
            activity_type_name: 'meeting',
            activity_type_display_name: 'Meeting',
            logged_date: '2026-05-13',
            hours: 1,
          }),
        ],
      },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')

    await user.click(
      await within(taskDialog).findByRole('button', { name: /edit time log/i }, TL_WAIT),
    )

    const editDialog = await screen.findByRole('dialog', { name: /edit time log/i }, TL_WAIT)
    expect(
      await within(editDialog).findByRole('combobox', { name: /activity type/i }, TL_WAIT),
    ).toBeInTheDocument()
  })

  it('surfaces delete validation when removing an in-use activity type from management UI', async () => {
    installWorkspaceBackendMock({
      projects: [alphaProject],
      tasks: [releaseNotesTask],
      timeLogs: {
        'task-write-release-notes': [
          buildTimeLog({
            id: 'log-using-type',
            task_id: 'task-write-release-notes',
            project_id: 'project-alpha',
            activity_type_id: 'at-seed-admin',
            activity_type_name: 'admin',
            activity_type_display_name: 'Admin',
            logged_date: '2026-05-13',
            hours: 0.5,
          }),
        ],
      },
    })

    await renderApp()
    const taskDialog = await openEditTaskDialog('Write release notes')

    await user.click(
      await within(taskDialog).findByRole('button', { name: /manage activity types/i }, TL_WAIT),
    )

    const manageDialog = await screen.findByRole('dialog', { name: /activity types/i }, TL_WAIT)

    await user.click(
      within(within(manageDialog).getByRole('row', { name: /\badmin\b/i })).getByRole('button', {
        name: /delete/i,
      }),
    )

    expect(
      await within(manageDialog).findByText(/referenced|cannot delete|in use/i, TL_WAIT),
    ).toBeInTheDocument()
  })
})
