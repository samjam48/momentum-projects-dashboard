import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import App from './App'
import { resetProjectFilterStore } from './stores/projectFilter'

type MockResponseOptions = {
  body?: unknown
  status?: number
}

type FetchMock = ReturnType<typeof vi.fn<Promise<Response>, Parameters<typeof fetch>>>

function jsonResponse({ body, status = 200 }: MockResponseOptions): Response {
  return new Response(JSON.stringify(body ?? null), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function installFetchMock(responses: Response[]): FetchMock {
  const fetchMock = vi.fn<Promise<Response>, Parameters<typeof fetch>>()
  fetchMock.mockResolvedValue(jsonResponse({ body: [] }))
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Ticket 3 project management and shared data layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetProjectFilterStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetProjectFilterStore()
  })

  it('renders active projects, colour tags, and shared filter targets', async () => {
    installFetchMock([
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter',
            description: 'Weekly letters',
            colour: '#123ABC',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T09:00:00Z',
          },
        ],
      }),
    ])

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /projects \+ tasks workspace/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('project-card-project-podcast')).toBeInTheDocument()
    expect(screen.getByTestId('project-card-project-newsletter')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('project-card-project-podcast')).getByText('#D97048'),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /project filter/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /kanban board/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /task summary table/i }),
    ).toBeInTheDocument()
  })

  it('supports create, edit, and archive flows without a page reload', async () => {
    installFetchMock([
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
        ],
      }),
      jsonResponse({
        body: {
          id: 'project-newsletter',
          name: 'Newsletter',
          description: 'Weekly letters',
          colour: '#123ABC',
          status: 'active',
          created_at: '2026-05-13T09:00:00Z',
          updated_at: '2026-05-13T09:00:00Z',
        },
        status: 201,
      }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter',
            description: 'Weekly letters',
            colour: '#123ABC',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T09:00:00Z',
          },
        ],
      }),
      jsonResponse({
        body: {
          id: 'project-newsletter',
          name: 'Newsletter Updated',
          description: 'Weekly letters revised',
          colour: '#456DEF',
          status: 'active',
          created_at: '2026-05-13T09:00:00Z',
          updated_at: '2026-05-13T10:00:00Z',
        },
      }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter Updated',
            description: 'Weekly letters revised',
            colour: '#456DEF',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T10:00:00Z',
          },
        ],
      }),
      new Response(null, { status: 204 }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
        ],
      }),
    ])

    render(<App />)

    await screen.findByTestId('project-card-project-podcast')

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Newsletter' },
    })
    fireEvent.change(screen.getByLabelText(/project description/i), {
      target: { value: 'Weekly letters' },
    })
    fireEvent.change(screen.getByLabelText(/project colour/i), {
      target: { value: '#123ABC' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    expect(await screen.findByTestId('project-card-project-newsletter')).toBeInTheDocument()

    const newsletterCard = screen.getByTestId('project-card-project-newsletter')
    fireEvent.click(within(newsletterCard).getByRole('button', { name: /edit/i }))
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Newsletter Updated' },
    })
    fireEvent.change(screen.getByLabelText(/project description/i), {
      target: { value: 'Weekly letters revised' },
    })
    fireEvent.change(screen.getByLabelText(/project colour/i), {
      target: { value: '#456DEF' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save project/i }))

    await waitFor(() => {
      expect(screen.getByTestId('project-card-project-newsletter')).toHaveTextContent(
        'Newsletter Updated',
      )
    })

    const updatedCard = screen.getByTestId('project-card-project-newsletter')
    fireEvent.click(within(updatedCard).getByRole('button', { name: /archive/i }))

    await waitFor(() => {
      expect(screen.queryByTestId('project-card-project-newsletter')).not.toBeInTheDocument()
    })
  })

  it('shows inline validation errors and preserves form values after server rejection', async () => {
    installFetchMock([
      jsonResponse({ body: [] }),
      jsonResponse({
        body: { detail: 'colour must match #RRGGBB' },
        status: 422,
      }),
    ])

    render(<App />)

    await screen.findByRole('heading', { name: /projects \+ tasks workspace/i })

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Podcast' },
    })
    fireEvent.change(screen.getByLabelText(/project colour/i), {
      target: { value: 'orange' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    expect(await screen.findByText(/colour must match/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/project name/i)).toHaveValue('Podcast')
    expect(screen.getByLabelText(/project colour/i)).toHaveValue('orange')
  })

  it('falls back to all projects when the selected project is archived', async () => {
    installFetchMock([
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
          {
            id: 'project-newsletter',
            name: 'Newsletter',
            description: 'Weekly letters',
            colour: '#123ABC',
            status: 'active',
            created_at: '2026-05-13T09:00:00Z',
            updated_at: '2026-05-13T09:00:00Z',
          },
        ],
      }),
      new Response(null, { status: 204 }),
      jsonResponse({
        body: [
          {
            id: 'project-podcast',
            name: 'Podcast',
            description: 'Main show',
            colour: '#D97048',
            status: 'active',
            created_at: '2026-05-13T08:00:00Z',
            updated_at: '2026-05-13T08:00:00Z',
          },
        ],
      }),
    ])

    render(<App />)

    const filter = await screen.findByRole('combobox', { name: /project filter/i })
    fireEvent.change(filter, { target: { value: 'project-newsletter' } })
    expect(filter).toHaveValue('project-newsletter')

    const newsletterCard = screen.getByTestId('project-card-project-newsletter')
    fireEvent.click(within(newsletterCard).getByRole('button', { name: /archive/i }))

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /project filter/i })).toHaveValue('all')
    })
  })

  it('blocks task creation when there are no active projects', async () => {
    installFetchMock([jsonResponse({ body: [] })])

    render(<App />)

    expect(await screen.findByText(/create a project first/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new task/i })).toBeDisabled()
  })
})
