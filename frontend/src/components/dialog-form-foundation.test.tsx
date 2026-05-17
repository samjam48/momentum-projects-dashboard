import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen } from '@testing-library/react'

import { buildVenture, buildVentureCategoryLabel } from '../test/fixtures'
import { ProjectDialog, type ProjectDialogProps } from './ProjectDialog'
import { VentureDialog, type VentureDialogProps } from './VentureDialog'

function readSource(relativePath: string): string {
  const absolutePath = resolve(process.cwd(), relativePath)
  if (!existsSync(absolutePath)) {
    return ''
  }
  return readFileSync(absolutePath, 'utf8')
}

function buildProjectDialogProps(
  overrides: Partial<ProjectDialogProps> = {},
): ProjectDialogProps {
  const venture = buildVenture({ id: 'venture-select', name: 'Hustle Lab' })

  return {
    activeVentures: [venture],
    editingProjectId: 'project-1',
    formErrors: {},
    formState: {
      board_status: 'active',
      colour: '#D97048',
      description: '',
      icon: '',
      name: 'Website refresh',
      project_type: 'project',
      shippedWhenArchiving: false,
      venture_id: venture.id,
    },
    isOpen: true,
    isSaving: false,
    mode: 'edit',
    onArchive: vi.fn(),
    onClose: vi.fn(),
    onFieldChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function buildVentureDialogProps(
  overrides: Partial<VentureDialogProps> = {},
): VentureDialogProps {
  const label = buildVentureCategoryLabel({
    id: 'label-hustle',
    name: 'Hustle',
    slug: 'hustle',
  })
  const venture = buildVenture({
    id: 'venture-1',
    name: 'Acme Studio',
    category_label: label,
    category_label_id: label.id,
  })

  return {
    categoryLabels: [label],
    hustleLabelId: label.id,
    isSaving: false,
    labelError: null,
    mode: 'edit',
    onArchive: vi.fn(),
    onClose: vi.fn(),
    onCreateCategoryLabel: vi.fn(),
    onResetLabelError: vi.fn(),
    onResetVentureError: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    open: true,
    venture,
    ventureError: null,
    ...overrides,
  }
}

describe('Shared dialog and form primitive foundation', () => {
  it('adds the shared Select, FormField, and DialogFormFooter primitive files under components/ui', () => {
    expect(existsSync(resolve(process.cwd(), 'src/components/ui/Select.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/components/ui/FormField.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/components/ui/DialogFormFooter.tsx'))).toBe(
      true,
    )
  })

  it('defines a Select API that supports both visible labels and aria-label-only usage', () => {
    const source = readSource('src/components/ui/Select.tsx')

    expect(source).toMatch(/\blabel\?:\s*string/)
    expect(source).toMatch(/['"]aria-label['"]\?:\s*string/)
    expect(source).toMatch(/\berror\?:\s*string/)
  })

  it('adopts the shared form primitives in at least one touched dialog consumer', () => {
    const candidates = [
      readSource('src/components/ProjectDialog.tsx'),
      readSource('src/components/VentureDialog.tsx'),
      readSource('src/components/TaskDialog.tsx'),
      readSource('src/pages/ProjectsPage.tsx'),
    ]

    expect(candidates.some((source) => /ui\/FormField/.test(source))).toBe(true)
    expect(candidates.some((source) => /ui\/Select/.test(source))).toBe(true)
    expect(candidates.some((source) => /ui\/DialogFormFooter/.test(source))).toBe(true)
  })

  it('wires select errors through aria-describedby while keeping the visible label as the accessible name', () => {
    render(
      <ProjectDialog
        {...buildProjectDialogProps({
          formErrors: { venture_id: 'Select a venture.' },
        })}
      />,
    )

    const select = screen.getByRole('combobox', { name: /^venture$/i })
    const error = screen.getByText('Select a venture.')

    expect(error).toHaveAttribute('id')
    expect(select).toHaveAttribute('aria-describedby', error.getAttribute('id'))
  })

  it('wires text-field errors through aria-describedby for the shared FormField accessibility contract', () => {
    const base = buildProjectDialogProps()
    render(
      <ProjectDialog
        {...base}
        formErrors={{ name: 'Project name is required.' }}
        formState={{ ...base.formState, name: '' }}
      />,
    )

    const input = screen.getByRole('textbox', { name: /project name/i })
    const error = screen.getByText('Project name is required.')

    expect(error).toHaveAttribute('id')
    expect(input).toHaveAttribute('aria-describedby', error.getAttribute('id'))
  })

  it('uses Pattern A footer order with destructive actions outside the save/cancel pair', () => {
    render(<VentureDialog {...buildVentureDialogProps()} />)

    const cancelButton = screen.getByRole('button', { name: /^cancel$/i })
    const primaryButton = screen.getByRole('button', { name: /save venture/i })
    const archiveButton = screen.getByRole('button', { name: /archive venture/i })
    const footer = cancelButton.parentElement

    expect(footer).not.toBeNull()
    expect(footer).toContainElement(cancelButton)
    expect(footer).toContainElement(primaryButton)
    expect(footer).not.toContainElement(archiveButton)
    expect(cancelButton.compareDocumentPosition(primaryButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
