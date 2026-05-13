import { render, screen } from '@testing-library/react'

import App from './App'

describe('App', () => {
  it('renders the installation scaffold summary', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Momentum installation scaffold' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Backend runtime')).toBeInTheDocument()
    expect(screen.getByText('Frontend toolchain')).toBeInTheDocument()
    expect(screen.getByText('SQLite configuration')).toBeInTheDocument()
  })
})
