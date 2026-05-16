import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArchiveDialog } from './components/ArchiveDialog'
import { QueryProvider } from './test/QueryProvider'
import { flushAct } from './test/actUtils'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'

const currentDir = dirname(fileURLToPath(import.meta.url))

describe('Ticket 1.6-12 — archive UI scope and patterns', () => {
  const user = userEvent.setup()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not introduce hard-delete or purge chrome in ArchiveDialog source', () => {
    const source = readFileSync(resolve(currentDir, 'components/ArchiveDialog.tsx'), 'utf-8')
    expect(source).not.toMatch(/\bpurge\b/i)
    expect(source).not.toMatch(/hard[-\s]?delete/i)
    expect(source).not.toMatch(/delete\s+permanently/i)
  })

  it('surfaces separate venture vs project archive views as distinct tabs', async () => {
    installWorkspaceBackendMock({ projects: [] })
    render(
      <QueryProvider>
        <ArchiveDialog />
      </QueryProvider>,
    )

    await flushAct()

    await user.click(screen.getByRole('button', { name: /view archive/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('tab', { name: /archived ventures/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: /archived projects/i })).toBeInTheDocument()
  })

  it('keeps bulk venture/project archive chrome out of TaskDialog source', () => {
    const source = readFileSync(resolve(currentDir, 'components/TaskDialog.tsx'), 'utf-8')
    expect(source).not.toMatch(/Archived ventures/i)
    expect(source).not.toMatch(/Archived projects/i)
    expect(source).not.toMatch(/view archive/i)
  })
})
