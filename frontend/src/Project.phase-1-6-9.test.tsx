import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  buildProject,
  buildTask,
  buildVenture,
  buildVentureCategoryLabel,
} from './test/fixtures'
import { renderApp } from './test/renderApp'
import { resetProjectFilterStore } from './stores/projectFilter'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import { clickProjectFilterCheckbox, getSidebar } from './test/workspaceQueries'

function getProjectsToolbar(): HTMLElement {
  return screen.getByRole('toolbar', { name: /projects page/i })
}

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  return input.url
}

function parseFetchBody(init?: RequestInit): Record<string, unknown> | null {
  if (!init?.body || typeof init.body !== 'string') {
    return null
  }
  try {
    return JSON.parse(init.body) as Record<string, unknown>
  } catch {
    return null
  }
}

function patchBodiesForPath(
  fetchMock: ReturnType<typeof vi.fn>,
  pathContains: string,
): Record<string, unknown>[] {
  return fetchMock.mock.calls
    .map(([input, init]) => {
      const url = readRequestUrl(input as RequestInfo | URL)
      const method = (init as RequestInit | undefined)?.method ?? 'GET'
      if (method !== 'PATCH' || !url.includes(pathContains)) {
        return null
      }
      return parseFetchBody(init as RequestInit)
    })
    .filter((body): body is Record<string, unknown> => body !== null)
}

describe('Ticket 1.6-9 — Project create, edit, archive, and type UX', () => {
  const labelSeed = buildVentureCategoryLabel({ id: 'label-seed-1', name: 'Hustle', slug: 'hustle' })
  const ventureAlpha = buildVenture({
    id: 'venture-alpha',
    name: 'Alpha Venture',
    category_label: labelSeed,
    category_label_id: labelSeed.id,
  })
  const ventureBeta = buildVenture({
    id: 'venture-beta',
    name: 'Beta Venture',
    category_label: labelSeed,
    category_label_id: labelSeed.id,
  })
  const ventureArchived = buildVenture({
    id: 'venture-archived',
    name: 'Archived Parent',
    status: 'archived',
    category_label: labelSeed,
    category_label_id: labelSeed.id,
  })

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

  it('does not offer root-level “New project” in the projects toolbar (venture-context create only)', async () => {
    const project = buildProject({ id: 'p1', name: 'Solo', venture_id: ventureAlpha.id })
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [project],
    })

    await renderApp()

    const toolbar = getProjectsToolbar()
    expect(within(toolbar).queryByRole('button', { name: /^new project$/i })).not.toBeInTheDocument()
  })

  it('offers an add-project action on the venture row with the venture preselected in the create dialog', async () => {
    const project = buildProject({ id: 'p1', name: 'Existing', venture_id: ventureAlpha.id })
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [project],
    })

    await renderApp()

    const sidebar = getSidebar()
    const ventureRow = within(sidebar).getByTestId(`sidebar-venture-${ventureAlpha.id}`)
    const shell = ventureRow.parentElement
    expect(shell).toBeTruthy()
    const addProject = within(shell!).getByRole('link', { name: /^\+ project$/i })
    await userEvent.click(addProject)

    const dialog = await screen.findByRole('dialog', { name: /new project/i })
    const ventureField = within(dialog).getByRole('combobox', { name: /^venture$/i })
    expect(ventureField).toHaveValue(ventureAlpha.id)
  })

  it('offers add-project from an empty venture state and preselects that venture', async () => {
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [],
    })

    await renderApp()

    const sidebar = getSidebar()
    expect(within(sidebar).getByText(/no projects yet/i)).toBeInTheDocument()

    await userEvent.click(within(sidebar).getByRole('link', { name: /^\+ project$/i }))

    const dialog = await screen.findByRole('dialog', { name: /new project/i })
    expect(within(dialog).getByRole('combobox', { name: /^venture$/i })).toHaveValue(ventureAlpha.id)
  })

  it('includes venture, name, description, colour, optional icon, project type, and board status in the project dialog', async () => {
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [],
    })

    await renderApp()

    const sidebar = getSidebar()
    await userEvent.click(within(sidebar).getByRole('link', { name: /^\+ project$/i }))

    const dialog = await screen.findByRole('dialog', { name: /new project/i })
    expect(within(dialog).getByRole('combobox', { name: /^venture$/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /project name/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /project description/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /^colour$/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /^icon$/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /project type/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /board status/i })).toBeInTheDocument()
  })

  it('limits project type options to project, asset, gig, and contract with project as the default', async () => {
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [],
    })

    await renderApp()

    await userEvent.click(
      within(getSidebar()).getByRole('link', { name: /^\+ project$/i }),
    )
    const dialog = await screen.findByRole('dialog', { name: /new project/i })
    const typeField = within(dialog).getByRole('combobox', { name: /project type/i })

    const optionValues = Array.from(typeField.querySelectorAll('option'), (option) => option.value).sort()

    expect(optionValues).toEqual(['asset', 'contract', 'gig', 'project'])
    expect(typeField).toHaveValue('project')
  })

  it('does not send task updates when only the project type classification changes', async () => {
    const project = buildProject({ id: 'p-type', name: 'Typed', venture_id: ventureAlpha.id })
    const task = buildTask({ id: 't1', project_id: project.id, title: 'Only task' })
    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [project],
      tasks: [task],
    })

    await renderApp()

    fireEvent.click(within(getSidebar()).getByRole('button', { name: /^typed$/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit project/i })

    const taskPatchesBefore = patchBodiesForPath(fetchMock, '/api/v1/tasks/')

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /project type/i }), 'gig')
    await userEvent.click(within(dialog).getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /edit project/i })).not.toBeInTheDocument()
    })

    const taskPatchesAfter = patchBodiesForPath(fetchMock, '/api/v1/tasks/')
    expect(taskPatchesAfter.length).toBe(taskPatchesBefore.length)
  })

  it('blocks creating a project when there is no active venture and surfaces clear guidance', async () => {
    installWorkspaceBackendMock({
      ventures: [],
      projects: [],
    })

    await renderApp()

    const sidebar = getSidebar()
    expect(within(sidebar).getByText(/create a venture to get started/i)).toBeInTheDocument()
    expect(within(sidebar).queryByRole('link', { name: /^\+ project$/i })).not.toBeInTheDocument()

    expect(within(getProjectsToolbar()).queryByRole('button', { name: /^new project$/i })).not.toBeInTheDocument()
  })

  it('when every venture is archived, shows recovery copy pointing to archive or creating a venture', async () => {
    installWorkspaceBackendMock({
      ventures: [ventureArchived],
      projects: [],
    })

    await renderApp()

    const sidebar = getSidebar()
    expect(within(sidebar).getByRole('button', { name: /view archive/i })).toBeInTheDocument()
    expect(
      within(sidebar).getByText(/archived every venture|all ventures are archived|no active ventures/i),
    ).toBeInTheDocument()
  })

  it('allows moving a project to another active venture from edit and persists the new venture', async () => {
    const project = buildProject({
      id: 'p-move',
      name: 'Move me',
      venture_id: ventureAlpha.id,
    })
    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [ventureAlpha, ventureBeta],
      projects: [project],
    })

    await renderApp()

    fireEvent.click(within(getSidebar()).getByRole('button', { name: /^move me$/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit project/i })

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /^venture$/i }), ventureBeta.id)
    await userEvent.click(within(dialog).getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      const bodies = patchBodiesForPath(fetchMock, '/api/v1/projects/p-move')
      expect(bodies.some((body) => body.venture_id === ventureBeta.id)).toBe(true)
    })
  })

  it('lets migrated “Unsorted” projects change venture like any other project', async () => {
    const unsortedVenture = buildVenture({
      id: 'venture-unsorted',
      name: 'Unsorted',
      category_label: labelSeed,
      category_label_id: labelSeed.id,
    })
    const project = buildProject({
      id: 'p-unsorted',
      name: 'Legacy client',
      venture_id: unsortedVenture.id,
    })
    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [unsortedVenture, ventureBeta],
      projects: [project],
    })

    await renderApp()

    fireEvent.click(within(getSidebar()).getByRole('button', { name: /^legacy client$/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit project/i })

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /^venture$/i }), ventureBeta.id)
    await userEvent.click(within(dialog).getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      const bodies = patchBodiesForPath(fetchMock, '/api/v1/projects/p-unsorted')
      expect(bodies.some((body) => body.venture_id === ventureBeta.id)).toBe(true)
    })
  })

  it('archive flow includes a finished / shipped control (not only silent archive)', async () => {
    const project = buildProject({ id: 'p-arch', name: 'Archie', venture_id: ventureAlpha.id })
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [project],
    })

    await renderApp()

    fireEvent.click(within(getSidebar()).getByRole('button', { name: /^archie$/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit project/i })

    const shippedControl = within(dialog).queryByRole('checkbox', { name: /shipped|finished/i })
    const shippedRadio = within(dialog).queryByRole('radio', { name: /shipped|finished/i })

    expect(shippedControl ?? shippedRadio).not.toBeNull()
  })

  it('does not call project board-status when only project type changes (classification only)', async () => {
    const project = buildProject({
      id: 'p-board',
      name: 'Board safe',
      venture_id: ventureAlpha.id,
      board_status: 'active',
      project_type: 'project',
    })
    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [project],
    })

    await renderApp()

    fireEvent.click(within(getSidebar()).getByRole('button', { name: /^board safe$/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit project/i })

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /project type/i }), 'asset')
    await userEvent.click(within(dialog).getByRole('button', { name: /save project/i }))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const [input, init] = call
          const url = readRequestUrl(input)
          const method = init?.method ?? 'GET'
          return method === 'PATCH' && url.includes('/board-status')
        }),
      ).toBe(false),
    )
  })

  it('after archiving the only sidebar-selected project, resets the sidebar filter to all active projects', async () => {
    const p1 = buildProject({ id: 'p-a', name: 'Only selected', venture_id: ventureAlpha.id })
    const p2 = buildProject({ id: 'p-b', name: 'Other', venture_id: ventureAlpha.id })
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [p1, p2],
    })

    await renderApp()

    await clickProjectFilterCheckbox('Other')

    fireEvent.click(within(getSidebar()).getByRole('button', { name: /^only selected$/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit project/i })
    await userEvent.click(within(dialog).getByRole('button', { name: /archive project/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /edit project/i })).not.toBeInTheDocument()
    })

    expect(
      within(getSidebar()).getByRole('checkbox', { name: /show other in workspace/i }),
    ).toBeChecked()
  })

  it('exposes unarchive for an archived project when its parent venture stays active', async () => {
    const archived = buildProject({
      id: 'p-restorable',
      name: 'Restorable',
      venture_id: ventureAlpha.id,
      status: 'archived',
    })
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [archived],
    })

    await renderApp()

    await userEvent.click(within(getSidebar()).getByRole('button', { name: /view archive/i }))
    const archiveDialog = await screen.findByRole('dialog', { name: /archive/i })
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))

    const restoreTrigger = await within(archiveDialog).findByRole('button', { name: /^restore$/i })
    await userEvent.click(restoreTrigger)
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(within(getSidebar()).getByRole('button', { name: /^restorable$/i })).toBeInTheDocument()
    })
  })

  it('blocks unarchive under an archived parent venture and shows clear product copy', async () => {
    const archivedChild = buildProject({
      id: 'p-blocked',
      name: 'Blocked child',
      venture_id: ventureArchived.id,
      status: 'archived',
      archived_by_venture: true,
    })
    installWorkspaceBackendMock({
      ventures: [ventureArchived],
      projects: [archivedChild],
    })

    await renderApp()

    await userEvent.click(within(getSidebar()).getByRole('button', { name: /view archive/i }))
    const archiveDialog = await screen.findByRole('dialog', { name: /archive/i })
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))

    const restoreTrigger = await within(archiveDialog).findByRole('button', { name: /^restore$/i })
    await userEvent.click(restoreTrigger)
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: /^restore$/i }))

    expect(
      await screen.findByText(/unarchive the venture first/i),
    ).toBeInTheDocument()
  })

  it('uses product-facing copy in the project dialog (no API identifiers or jargon)', async () => {
    installWorkspaceBackendMock({
      ventures: [ventureAlpha],
      projects: [],
    })

    await renderApp()

    await userEvent.click(within(getSidebar()).getByRole('link', { name: /^\+ project$/i }))
    const dialog = await screen.findByRole('dialog', { name: /new project/i })

    const copy = dialog.textContent ?? ''
    expect(copy).not.toMatch(/venture_id|\/api\/v1|\bPATCH\b|\b422\b|1\.6-\d/i)
  })
})
