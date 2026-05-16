import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  buildProject,
  buildVenture,
  buildVentureCategoryLabel,
} from './test/fixtures'
import { renderApp } from './test/renderApp'
import { resetBoardDisplayOptionsStore } from './stores/boardDisplayOptions'
import { resetProjectFilterStore } from './stores/projectFilter'
import { resetTestStorage } from './test/storage'
import { installWorkspaceBackendMock } from './test/workspaceBackendMock'
import {
  getSidebar,
  switchBoardViewTab,
  waitForProjectKanbanCard,
  waitForWorkspaceReady,
} from './test/workspaceQueries'

const labelSeed = buildVentureCategoryLabel({ id: 'label-seed-1', name: 'Hustle', slug: 'hustle' })
const ventureBase = buildVenture({
  id: 'venture-stale',
  name: 'Stale probe venture',
  category_label: labelSeed,
  category_label_id: labelSeed.id,
})

/** Ticket 1.6-12 — cross-surface consistency after mutations (no stale Kanban card metadata). */
describe('Phase 1.6-12 — cross-feature stale state after project mutations', () => {
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

  it('refreshes Project Kanban type label after project type is saved from the sidebar edit dialog', async () => {
    const project = buildProject({
      id: 'p-stale-type',
      name: 'Type morph',
      venture_id: ventureBase.id,
      project_type: 'project',
      board_status: 'active',
      kanban_order: 0,
    })

    installWorkspaceBackendMock({
      ventures: [ventureBase],
      projects: [project],
      tasks: [],
    })

    await renderApp()
    await waitForWorkspaceReady()
    await switchBoardViewTab('projects')

    let card = await waitForProjectKanbanCard('Type morph', /active/i, { timeout: 2000 })
    expect(within(card).queryByText(/^gig$/i)).not.toBeInTheDocument()

    fireEvent.click(within(getSidebar()).getByRole('button', { name: /^type morph$/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit project/i })
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /project type/i }), 'gig')
    await userEvent.click(within(dialog).getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /edit project/i })).not.toBeInTheDocument()
    })

    card = await waitForProjectKanbanCard('Type morph', /active/i, { timeout: 2000 })
    await waitFor(() => {
      expect(within(card).getByText(/^gig$/i)).toBeInTheDocument()
    })
  })
})
