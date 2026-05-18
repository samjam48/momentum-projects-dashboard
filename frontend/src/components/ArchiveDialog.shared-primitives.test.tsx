import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ArchiveDialog } from './ArchiveDialog'
import { QueryProvider } from '../test/QueryProvider'
import { buildProject, buildVenture } from '../test/fixtures'
import { installWorkspaceBackendMock } from '../test/workspaceBackendMock'

const activeVenture = buildVenture({
  id: 'venture-active-fr4',
  name: 'Active Parent',
})

const archivedProject = buildProject({
  id: 'project-archived-fr4',
  name: 'Restorable Row',
  venture_id: activeVenture.id,
  status: 'archived',
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function readUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  return input.url
}

function renderArchiveDialog(): void {
  render(
    <QueryProvider>
      <ArchiveDialog />
    </QueryProvider>,
  )
}

describe('ArchiveDialog FR-4 shared confirm and feedback behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dismisses both the confirm dialog and the archive dialog after a successful restore', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProject],
    })

    renderArchiveDialog()

    await user.click(screen.getByRole('button', { name: /view archive/i }))
    const archiveDialog = await screen.findByRole('dialog', { name: /^archive$/i })

    await user.click(await within(archiveDialog).findByRole('button', { name: /^restore$/i }))

    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: /^archive$/i })).not.toBeInTheDocument()
    })
  })

  it('keeps the confirm step visible and disabled while restore is pending so duplicate submissions are blocked', async () => {
    const user = userEvent.setup()
    let resolveUnarchive: ((response: Response) => void) | null = null
    let unarchiveCalls = 0

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProject],
      onProjectUnarchive: async () => {
        unarchiveCalls += 1
        return new Promise<Response>((resolve) => {
          resolveUnarchive = resolve
        })
      },
    })

    renderArchiveDialog()

    try {
      await user.click(screen.getByRole('button', { name: /view archive/i }))
      const archiveDialog = await screen.findByRole('dialog', { name: /^archive$/i })

      await user.click(await within(archiveDialog).findByRole('button', { name: /^restore$/i }))

      const confirm = await screen.findByRole('alertdialog')
      await user.click(within(confirm).getByRole('button', { name: /^restore$/i }))

      await waitFor(() => {
        expect(unarchiveCalls).toBe(1)
      })

      const pendingDialog = screen.getByRole('alertdialog')
      const restoreButton = within(pendingDialog).getByRole('button', { name: /^restore/i })
      const cancelButton = within(pendingDialog).getByRole('button', { name: /^cancel$/i })

      expect(restoreButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()

      await user.click(restoreButton)
      expect(unarchiveCalls).toBe(1)
    } finally {
      resolveUnarchive?.(jsonResponse({ ...archivedProject, status: 'active' }))
    }
  })

  it('renders product-style empty guidance for both archived projects and archived ventures', async () => {
    const user = userEvent.setup()

    installWorkspaceBackendMock({
      ventures: [],
      projects: [],
    })

    renderArchiveDialog()

    await user.click(screen.getByRole('button', { name: /view archive/i }))
    const archiveDialog = await screen.findByRole('dialog', { name: /^archive$/i })

    const projectsPanel = within(archiveDialog).getByRole('tabpanel')
    expect(within(projectsPanel).getByText(/^No archived projects yet\.$/i)).toBeInTheDocument()
    expect(
      within(projectsPanel).getByText(/Archive a project to restore it later\./i),
    ).toBeInTheDocument()

    await user.click(within(archiveDialog).getByRole('tab', { name: /archived ventures/i }))

    const venturesPanel = within(archiveDialog).getByRole('tabpanel')
    expect(within(venturesPanel).getByText(/^No archived ventures yet\.$/i)).toBeInTheDocument()
    expect(
      within(venturesPanel).getByText(/Archive a venture to restore it later\./i),
    ).toBeInTheDocument()
  })

  it('renders loading feedback while the archived project list is still resolving', async () => {
    const user = userEvent.setup()
    let resolveArchivedProjects: ((response: Response) => void) | null = null

    const fetchMock = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
      const url = new URL(readUrl(input), 'http://localhost')

      if (url.pathname === '/api/v1/ventures') {
        return jsonResponse({ items: [] })
      }

      if (
        url.pathname === '/api/v1/projects' &&
        url.searchParams.get('status') === 'archived'
      ) {
        return new Promise<Response>((resolve) => {
          resolveArchivedProjects = resolve
        })
      }

      return jsonResponse({ items: [] })
    })

    vi.stubGlobal('fetch', fetchMock)

    renderArchiveDialog()

    try {
      await user.click(screen.getByRole('button', { name: /view archive/i }))
      const archiveDialog = await screen.findByRole('dialog', { name: /^archive$/i })

      expect(
        await within(archiveDialog).findByText(/loading archived projects/i),
      ).toBeInTheDocument()
    } finally {
      resolveArchivedProjects?.(jsonResponse({ items: [] }))
    }
  })

  it('keeps actionable restore policy errors visible in the archive flow after confirm', async () => {
    const user = userEvent.setup()
    const policyMessage = 'Unarchive the venture first to restore this project.'

    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProject],
      onProjectUnarchive: () => jsonResponse({ detail: policyMessage }, 409),
    })

    renderArchiveDialog()

    await user.click(screen.getByRole('button', { name: /view archive/i }))
    const archiveDialog = await screen.findByRole('dialog', { name: /^archive$/i })

    await user.click(await within(archiveDialog).findByRole('button', { name: /^restore$/i }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /^restore$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(policyMessage)
    expect(within(archiveDialog).getByText(/restorable row/i)).toBeInTheDocument()
  })
})
