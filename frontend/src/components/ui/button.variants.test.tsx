import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen } from '@testing-library/react'
import { type ComponentProps, createElement } from 'react'

import { Button } from './button'

function renderButtonWithUncheckedVariant(
  variant: string,
  props: ComponentProps<typeof Button> = {},
): void {
  const { children = props['aria-label'] ?? 'Action', ...buttonProps } = props

  render(
    createElement(
      Button,
      {
        ...buttonProps,
        type: 'button',
        variant: variant as unknown as ComponentProps<typeof Button>['variant'],
      },
      children,
    ),
  )
}

function readButtonSource(): string {
  return readFileSync(resolve(process.cwd(), 'src/components/ui/button.tsx'), 'utf8')
}

describe('Button shared primitive variants', () => {
  it('declares destructive and outline as first-class variants in the button source', () => {
    const source = readButtonSource()

    expect(source).toMatch(/\bdestructive:\s*['"`]/)
    expect(source).toMatch(/\boutline:\s*['"`]/)
  })

  it('renders outline buttons with non-primary bordered styling instead of base-only chrome', () => {
    renderButtonWithUncheckedVariant('outline', { children: 'Cancel' })

    const button = screen.getByRole('button', { name: /^cancel$/i })

    expect(button.className).toMatch(/\bborder/)
    expect(button.className).toMatch(/\bbg-transparent\b|\bbg-\[var\(--primary-surface\)\]/)
    expect(button.className).not.toMatch(/bg-\[var\(--accent-action\)\]/)
  })

  it('renders destructive buttons with dedicated destructive fill styling', () => {
    renderButtonWithUncheckedVariant('destructive', { children: 'Archive project' })

    const button = screen.getByRole('button', { name: /archive project/i })

    expect(button.className).toMatch(/\bbg-\[/)
    expect(button.className).toMatch(/\bhover:bg-\[/)
    expect(button.className).not.toMatch(/bg-\[var\(--accent-action\)\]/)
  })

  it('preserves explicit aria-label coverage for icon-only buttons', () => {
    renderButtonWithUncheckedVariant('ghost', {
      'aria-label': 'Close project',
      children: <span aria-hidden>X</span>,
      size: 'icon',
    })

    expect(screen.getByRole('button', { name: /close project/i })).toBeInTheDocument()
  })
})
