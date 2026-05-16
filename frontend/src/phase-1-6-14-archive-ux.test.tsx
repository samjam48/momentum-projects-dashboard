/**
 * Ticket 1.6-14 — Archive UX parity (behavioural tests).
 * Tests only; production work is tracked separately.
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { resetBoardDisplayOptionsStore } from './stores/boardDisplayOptions'
import { resetProjectFilterStore } from './stores/projectFilter'
import { buildProject, buildVenture, buildVentureCategoryLabel } from './test/fixtures'
import { renderApp } from './test/renderApp'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import { getSidebar, waitForWorkspaceReady } from './test/workspaceQueries'

const seedLabel = buildVentureCategoryLabel({
  id: 'label-1614',
  name: 'Hustle',
  slug: 'hustle',
})

const activeVenture = buildVenture({
  id: 'venture-active-1614',
  name: 'Active Parent',
  category_label: seedLabel,
  category_label_id: seedLabel.id,
})

const archivedVenture = buildVenture({
  id: 'venture-archived-1614',
  name: 'icebox holding',
  description: 'Quarterly review pack only.',
  status: 'archived',
  category_label: seedLabel,
  category_label_id: seedLabel.id,
})

const archivedProject = buildProject({
  id: 'project-archived-1614',
  name: 'Restorable Row',
  venture_id: activeVenture.id,
  status: 'archived',
})

function jsonError(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function countUnarchivePatchCalls(fetchMock: { mock: { calls: unknown[][] } }): number {
  return fetchMock.mock.calls.filter((call) => {
    const [input, init] = call as [RequestInfo | URL, RequestInit | undefined]
    const path = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const url = new URL(path, 'http://localhost')
    const method = init?.method ?? 'GET'
    return method === 'PATCH' && url.pathname.includes('/unarchive')
  }).length
}

function tabClassSignature(element: HTMLElement): string {
  return [...element.classList].sort().join(' ')
}

async function openArchiveShell(): Promise<HTMLElement> {
  await userEvent.click(within(getSidebar()).getByRole('button', { name: /view archive/i }))
  return screen.findByRole('dialog', { name: /^archive$/i })
}

function findRestoreControl(scope: HTMLElement): HTMLElement {
  const root = within(scope)
  const link = root.queryByRole('link', { name: /^restore$/i })
  const button = root.queryByRole('button', { name: /^restore$/i })
  const found = link ?? button
  if (!found) {
    throw new Error('Expected a restore control (link or button) labeled “restore”.')
  }
  return found
}

describe('Ticket 1.6-14 — archive ventures vs projects UX', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetTestStorage()
    resetProjectFilterStore()
    resetBoardDisplayOptionsStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetTestStorage()
    resetProjectFilterStore()
    resetBoardDisplayOptionsStore()
  })

  it('uses matching selected / unselected tab chrome for Archived ventures and Archived projects (no extra tab-only pill styling)', async () => {
    installWorkspaceBackendMock({
      ventures: [activeVenture, archivedVenture],
      projects: [archivedProject],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    const venturesTab = within(archiveDialog).getByRole('tab', { name: /archived ventures/i })
    const projectsTab = within(archiveDialog).getByRole('tab', { name: /archived projects/i })

    await userEvent.click(venturesTab)
    const venturesSelectedSig = tabClassSignature(venturesTab)
    const projectsIdleWhenVenturesSelected = tabClassSignature(projectsTab)
    const ventureActiveBg = window.getComputedStyle(venturesTab).backgroundColor
    const ventureIdleSiblingBg = window.getComputedStyle(projectsTab).backgroundColor

    await userEvent.click(projectsTab)
    const projectsSelectedSig = tabClassSignature(projectsTab)
    const venturesIdleWhenProjectsSelected = tabClassSignature(venturesTab)
    const projectActiveBg = window.getComputedStyle(projectsTab).backgroundColor
    const projectIdleSiblingBg = window.getComputedStyle(venturesTab).backgroundColor

    expect(projectsSelectedSig).toBe(venturesSelectedSig)
    expect(venturesIdleWhenProjectsSelected).toBe(projectsIdleWhenVenturesSelected)
    expect(projectActiveBg).toBe(ventureActiveBg)
    expect(projectIdleSiblingBg).toBe(ventureIdleSiblingBg)

    for (const tab of [venturesTab, projectsTab]) {
      expect(tab.className, 'Archive tabs should use archive-dialog-tab tokens, not shadcn Button chrome.').not.toMatch(
        /\bh-10\b|\bpx-4\b/,
      )
    }
  })

  it('uses the same list row flex alignment for archived ventures and archived projects', async () => {
    installWorkspaceBackendMock({
      ventures: [activeVenture, archivedVenture],
      projects: [archivedProject],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived ventures/i }))
    const venturePanel = within(archiveDialog).getByRole('tabpanel')
    const ventureFlex = venturePanel.querySelector('.archive-project-row')
    expect(ventureFlex, 'Expected venture archive row container.').toBeInstanceOf(HTMLElement)
    const ventureMainAxis = window.getComputedStyle(ventureFlex).justifyContent

    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))
    const projectPanel = within(archiveDialog).getByRole('tabpanel')
    const projectFlex = projectPanel.querySelector('.archive-project-row')
    expect(projectFlex, 'Expected project archive row container.').toBeInstanceOf(HTMLElement)
    const projectMainAxis = window.getComputedStyle(projectFlex).justifyContent

    expect(projectMainAxis).toBe(ventureMainAxis)
  })

  it('uses a right-aligned “restore” text affordance (not an Unarchive pill) on archived project rows', async () => {
    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProject],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))

    const projectsPanel = within(archiveDialog).getByRole('tabpanel')
    const restore = findRestoreControl(projectsPanel)
    expect(restore.textContent?.trim().toLowerCase()).toBe('restore')

    const row = restore.closest('.archive-project-row')
    expect(row, 'restore should live inside the archive row layout container.').toBeTruthy()
    const rowRect = row!.getBoundingClientRect()
    const restoreRect = restore.getBoundingClientRect()
    expect(restoreRect.right).toBeGreaterThanOrEqual(rowRect.left + rowRect.width / 2)
    expect(rowRect.right - restoreRect.right).toBeLessThanOrEqual(28)

    const rowScope = row as HTMLElement
    expect(within(rowScope).queryByRole('button', { name: /^unarchive$/i })).toBeNull()

    const pillCue = window.getComputedStyle(restore)
    const isTransparent =
      pillCue.backgroundColor === 'rgba(0, 0, 0, 0)' || pillCue.backgroundColor === 'transparent'
    expect(
      isTransparent || pillCue.backgroundColor.includes('0)'),
      'restore should read as link / text control, not filled secondary pill.',
    ).toBe(true)
  })

  it('shows the same restore affordance on archived venture rows where restoration is allowed', async () => {
    installWorkspaceBackendMock({
      ventures: [archivedVenture],
      projects: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived ventures/i }))

    const venturesPanel = within(archiveDialog).getByRole('tabpanel')
    const restore = findRestoreControl(venturesPanel)
    expect(restore.textContent?.trim().toLowerCase()).toBe('restore')

    const row = restore.closest('.archive-project-row') ?? restore.closest('li')
    expect(row).toBeTruthy()
    const rowRect = row!.getBoundingClientRect()
    const restoreRect = restore.getBoundingClientRect()
    expect(restoreRect.right).toBeGreaterThanOrEqual(rowRect.left + rowRect.width / 2)

    expect(within(row as HTMLElement).queryByRole('button', { name: /^unarchive$/i })).toBeNull()
  })

  it('opens a confirm step before unarchive API; cancel leaves the archived row in place (projects)', async () => {
    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProject],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))
    expect(within(archiveDialog).getByText(/restorable row/i)).toBeInTheDocument()

    const before = countUnarchivePatchCalls(fetchMock)
    const projectsPanel = within(archiveDialog).getByRole('tabpanel')
    await userEvent.click(findRestoreControl(projectsPanel))

    const confirm = await screen.findByRole('alertdialog')
    expect(
      within(confirm).queryByText(/unarchive|patch|422|409/i),
      'Confirmation copy should stay product-facing.',
    ).toBeNull()
    expect(countUnarchivePatchCalls(fetchMock)).toBe(before)

    await userEvent.click(within(confirm).getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    expect(countUnarchivePatchCalls(fetchMock)).toBe(before)
    expect(within(archiveDialog).getByText(/restorable row/i)).toBeInTheDocument()
  })

  it('opens archived venture detail with read-only venture fields when a row is activated', async () => {
    installWorkspaceBackendMock({
      ventures: [archivedVenture],
      projects: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived ventures/i }))

    const venturePanel = within(archiveDialog).getByRole('tabpanel')
    await userEvent.click(within(venturePanel).getByRole('button', { name: /Icebox Holding/i }))

    const detail = await screen.findByRole('dialog', { name: /icebox holding|venture details|archived venture/i })
    expect(within(detail).getByText(/quarterly review pack only/i)).toBeInTheDocument()

    const editableText = within(detail)
      .queryAllByRole('textbox')
      .filter((element) => !(element as HTMLInputElement).disabled && !(element as HTMLInputElement).readOnly)

    expect(
      editableText,
      'Venture detail should be read-only (no enabled textboxes).',
    ).toHaveLength(0)
  })

  it('returns to the archive ventures list on the same tab after dismissing venture detail (cancel or backdrop)', async () => {
    installWorkspaceBackendMock({
      ventures: [archivedVenture],
      projects: [],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived ventures/i }))

    const venturePanelDismiss = within(archiveDialog).getByRole('tabpanel')
    await userEvent.click(within(venturePanelDismiss).getByRole('button', { name: /Icebox Holding/i }))

    const detail = await screen.findByRole('dialog', { name: /icebox holding|venture details|archived venture/i })
    await userEvent.click(within(detail).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /icebox holding|venture details|archived venture/i })).not.toBeInTheDocument()
    })

    expect(screen.getByRole('dialog', { name: /^archive$/i })).toBeInTheDocument()
    const shell = screen.getByRole('dialog', { name: /^archive$/i })
    expect(within(shell).getByRole('tab', { name: /archived ventures/i })).toHaveAttribute('aria-selected', 'true')
    expect(within(shell).getByText(/Icebox Holding/i)).toBeInTheDocument()

    const shellAfterCancel = screen.getByRole('dialog', { name: /^archive$/i })
    const venturePanelAgain = within(shellAfterCancel).getByRole('tabpanel')
    await userEvent.click(within(venturePanelAgain).getByRole('button', { name: /Icebox Holding/i }))
    await screen.findByRole('dialog', { name: /icebox holding|venture details|archived venture/i })

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /icebox holding|venture details|archived venture/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('dialog', { name: /^archive$/i })).toBeInTheDocument()
    expect(
      within(screen.getByRole('dialog', { name: /^archive$/i })).getByRole('tab', { name: /archived ventures/i }),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('after opening archived project detail, dismissing returns to Archived projects (not the main board only)', async () => {
    installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProject],
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))
    await userEvent.click(within(archiveDialog).getByText(/restorable row/i))

    const inspector = await screen.findByRole('dialog', {
      name: /archived project|project details|restorable row|edit project/i,
    })

    await userEvent.click(within(inspector).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: /archived project|project details|restorable row|edit project/i,
        }),
      ).not.toBeInTheDocument()
    })

    const shell = screen.getByRole('dialog', { name: /^archive$/i })
    expect(within(shell).getByRole('tab', { name: /archived projects/i })).toHaveAttribute('aria-selected', 'true')
    expect(within(shell).getByText(/restorable row/i)).toBeInTheDocument()
  })

  it('after confirm, a failing unarchive surfaces an inline alert (422 or 409) without trapping the UI', async () => {
    const policyMessage = 'This project cannot be restored right now.'
    const { fetchMock } = installWorkspaceBackendMock({
      ventures: [activeVenture],
      projects: [archivedProject],
      onProjectUnarchive: () => jsonError({ detail: policyMessage }, 409),
    })

    await renderApp()
    await waitForWorkspaceReady()

    const archiveDialog = await openArchiveShell()
    await userEvent.click(within(archiveDialog).getByRole('tab', { name: /archived projects/i }))

    const before = countUnarchivePatchCalls(fetchMock)
    const panel = within(archiveDialog).getByRole('tabpanel')
    await userEvent.click(findRestoreControl(panel))
    const confirm = await screen.findByRole('alertdialog')

    await userEvent.click(within(confirm).getByRole('button', { name: /^(restore|confirm)$/i }))

    await waitFor(() => {
      expect(countUnarchivePatchCalls(fetchMock)).toBeGreaterThan(before)
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(new RegExp(policyMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    expect(within(archiveDialog).getByText(/restorable row/i)).toBeInTheDocument()
  })
})
