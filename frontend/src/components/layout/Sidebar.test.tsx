import { render, within } from '@testing-library/react'

import App from '../../App'
import { resetProjectFilterStore } from '../../stores/projectFilter'
import { buildProject } from '../../test/fixtures'
import { resetTestStorage } from '../../test/storage'
import { installWorkspaceBackendMock } from '../../test/workspaceBackendMock'
import { getSidebar, waitForWorkspaceReady } from '../../test/workspaceQueries'

const sampleProject = buildProject({
  id: 'project-sample',
  name: 'Sample Project',
  colour: '#7B5EA7',
})

describe('Ticket 1b-2 Sidebar integration', () => {
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

  it('omits inline archive buttons from sidebar project rows', async () => {
    installWorkspaceBackendMock({ projects: [sampleProject] })

    render(<App />)
    await waitForWorkspaceReady()

    const sidebar = getSidebar()
    expect(
      within(sidebar).queryByRole('button', { name: /archive project sample project/i }),
    ).not.toBeInTheDocument()
  })

  it('does not expose legacy Edit project row actions in the sidebar list', async () => {
    installWorkspaceBackendMock({ projects: [sampleProject] })

    render(<App />)
    await waitForWorkspaceReady()

    const sidebar = getSidebar()
    expect(
      within(sidebar).queryByRole('button', { name: /edit project sample project/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps project list items spaced with a colour dot adjacent to the title', async () => {
    installWorkspaceBackendMock({ projects: [sampleProject] })

    render(<App />)
    await waitForWorkspaceReady()

    const row = within(getSidebar()).getByTestId('sidebar-project-project-sample')
    const dot = within(row).getByTestId('project-colour-dot')
    const title = within(row).getByRole('button', { name: /^sample project$/i })

    expect(row).toHaveClass('sidebar-project-row')
    expect(dot.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
