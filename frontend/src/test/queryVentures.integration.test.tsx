import { render, screen, waitFor } from '@testing-library/react'

import { useVentures } from '../api/ventures'
import { QueryProvider } from './QueryProvider'
import { installWorkspaceBackendMock } from './workspaceBackendMock'

function VenturesProbe(): JSX.Element {
  const ventures = useVentures('active')
  return (
    <div data-testid="ventures-probe">
      {ventures.isLoading ? 'loading' : `count:${ventures.data.length}`}
    </div>
  )
}

describe('TanStack ventures query with workspace mock', () => {
  it('loads active ventures', async () => {
    installWorkspaceBackendMock({ projects: [] })

    render(
      <QueryProvider>
        <VenturesProbe />
      </QueryProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(/count:/)).toBeInTheDocument()
    })
  })
})
