import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArchiveDialog } from './ArchiveDialog'
import { QueryProvider } from '../test/QueryProvider'
import { flushAct } from '../test/actUtils'
import { installWorkspaceBackendMock } from '../test/workspaceBackendMock'

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>

function readRequestUrl(call: Parameters<FetchMock>[0]): string {
  if (typeof call === 'string') {
    return call
  }
  if (call instanceof URL) {
    return call.toString()
  }
  return call.url
}

function isArchivedVenturesFetch(input: Parameters<FetchMock>[0]): boolean {
  const url = readRequestUrl(input)
  const parsed = new URL(url, 'http://localhost')
  return parsed.pathname === '/api/v1/ventures' && parsed.searchParams.get('status') === 'archived'
}

function isArchivedProjectsFetch(input: Parameters<FetchMock>[0]): boolean {
  const url = readRequestUrl(input)
  const parsed = new URL(url, 'http://localhost')
  return parsed.pathname === '/api/v1/projects' && parsed.searchParams.get('status') === 'archived'
}

describe('ArchiveDialog — Chore 1.6-C1 archived query laziness', () => {
  const user = userEvent.setup()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderArchiveOnly(): FetchMock {
    const { fetchMock } = installWorkspaceBackendMock({ projects: [] })
    render(
      <QueryProvider>
        <ArchiveDialog onEditProject={vi.fn()} />
      </QueryProvider>,
    )
    return fetchMock
  }

  it('does not subscribe to archived venture or project list fetches while the archive dialog remains closed after mount', async () => {
    const fetchMock = renderArchiveOnly()

    await flushAct()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view archive/i })).toBeVisible()
    })

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 150)
      })
    })
    const ventureCalls = fetchMock.mock.calls.filter(([input]) => isArchivedVenturesFetch(input))
    const projectCalls = fetchMock.mock.calls.filter(([input]) => isArchivedProjectsFetch(input))
    expect(
      ventureCalls.length + projectCalls.length,
      `Expected no archived venture/project list fetches until the dialog opens; ventures=${String(ventureCalls.length)} projects=${String(projectCalls.length)}`,
    ).toBe(0)
  })

  it('runs archived venture and project fetches once the archive dialog is opened', async () => {
    const fetchMock = renderArchiveOnly()

    await flushAct()

    const baselineVentures = fetchMock.mock.calls.filter(([input]) => isArchivedVenturesFetch(input)).length
    const baselineProjects = fetchMock.mock.calls.filter(([input]) => isArchivedProjectsFetch(input)).length

    await user.click(screen.getByRole('button', { name: /view archive/i }))

    await waitFor(() => {
      const ventureCalls = fetchMock.mock.calls.filter(([input]) => isArchivedVenturesFetch(input)).length
      const projectCalls = fetchMock.mock.calls.filter(([input]) => isArchivedProjectsFetch(input)).length
      expect(ventureCalls).toBeGreaterThan(baselineVentures)
      expect(projectCalls).toBeGreaterThan(baselineProjects)
    })

    await waitFor(() => {
      const dialogContainer = screen.getByRole('dialog')
      expect(
        within(dialogContainer).getByRole('heading', { name: /archive/i }),
      ).toBeInTheDocument()
    })
  })
})
