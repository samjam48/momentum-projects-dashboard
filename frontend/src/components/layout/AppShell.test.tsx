import { render, screen, within } from '@testing-library/react'

import App from '../../App'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function installEmptyProjectsMock(): void {
  const fetchMock = vi.fn<typeof fetch>()
  fetchMock.mockResolvedValue(jsonResponse([]))
  vi.stubGlobal('fetch', fetchMock)
}

describe('Ticket 1b-1 app shell and Projects page layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders top navigation with Projects active and future routes stubbed', async () => {
    installEmptyProjectsMock()
    render(<App />)

    const nav = await screen.findByRole('navigation', { name: /primary/i })
    expect(within(nav).getByRole('link', { name: /^projects$/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('button', { name: /^income$/i })).toBeDisabled()
    expect(within(nav).getByRole('button', { name: /^goals$/i })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })

  it('renders sidebar scaffold and omits the workspace filter panel', async () => {
    installEmptyProjectsMock()
    render(<App />)

    expect(await screen.findByRole('complementary', { name: /projects sidebar/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /workspace filter/i })).not.toBeInTheDocument()
  })

  it('stacks the kanban board above the task summary table in the main column', async () => {
    installEmptyProjectsMock()
    render(<App />)

    await screen.findByRole('complementary', { name: /projects sidebar/i })

    const main = screen.getByRole('main')
    const kanban = within(main).getByRole('region', { name: /kanban board/i })
    const tableSection = within(main).getByRole('region', { name: /task summary/i })

    expect(kanban.compareDocumentPosition(tableSection)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(within(main).queryByTestId('workspace-panels-two-up')).not.toBeInTheDocument()
  })

  it('exposes the Projects page toolbar controls', async () => {
    installEmptyProjectsMock()
    render(<App />)

    const toolbar = await screen.findByRole('toolbar', { name: /projects page/i })
    expect(within(toolbar).getByRole('tab', { name: /^tasks$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(toolbar).getByRole('tab', { name: /projects/i })).toBeDisabled()
    expect(within(toolbar).getByRole('combobox', { name: /project filter/i })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: /new task/i })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: /board options/i })).toBeInTheDocument()
  })
})
