import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { buildVenture, buildVentureCategoryLabel } from '../test/fixtures'
import { displayVentureCategoryTitle } from '../lib/ventureCategoryDisplay'
import { VentureDialog, type VentureDialogProps } from './VentureDialog'

const labelHustle = buildVentureCategoryLabel({
  id: 'lbl-hustle',
  name: 'Hustle',
  slug: 'hustle',
})

const labelBusiness = buildVentureCategoryLabel({
  id: 'lbl-business',
  name: 'Business',
  slug: 'business',
})

const labelEducation = buildVentureCategoryLabel({
  id: 'lbl-education',
  name: 'Education',
  slug: 'education',
})

const labelHobby = buildVentureCategoryLabel({
  id: 'lbl-hobby',
  name: 'Hobby',
  slug: 'hobby',
})

function buildProps(overrides: Partial<VentureDialogProps> = {}): VentureDialogProps {
  return {
    categoryLabels: [labelHustle, labelBusiness, labelEducation, labelHobby],
    hustleLabelId: labelHustle.id,
    isSaving: false,
    labelError: null,
    mode: 'create',
    onArchive: null,
    onClose: vi.fn(),
    onCreateCategoryLabel: vi.fn(),
    onResetLabelError: vi.fn(),
    onResetVentureError: vi.fn(),
    onSubmit: vi.fn(),
    open: true,
    venture: null,
    ventureError: null,
    ...overrides,
  }
}

function getCategoryCombo(): HTMLElement {
  return screen.getByRole('combobox', { name: /^venture category$/i })
}

describe('VentureDialog (1.6-8)', () => {
  it('shows the full category options when opening create-mode combobox with default Hustle selected', async () => {
    const user = userEvent.setup()
    render(<VentureDialog {...buildProps({ mode: 'create', venture: null })} />)

    const combo = getCategoryCombo()
    expect(combo).toHaveValue('Hustle')

    await user.click(combo)
    await screen.findByRole('listbox')

    expect(screen.getByRole('option', { name: 'Business' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Education' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Hobby' })).toBeInTheDocument()
  })

  it('preserves selected edit-mode category and still shows full options list', async () => {
    const venture = buildVenture({
      id: 'v-edit-options',
      name: 'Studio',
      category_label: labelBusiness,
      category_label_id: labelBusiness.id,
    })
    const user = userEvent.setup()
    render(
      <VentureDialog
        {...buildProps({
          mode: 'edit',
          venture,
          onArchive: vi.fn(),
        })}
      />,
    )

    const combo = getCategoryCombo()
    expect(combo).toHaveValue('Business')

    await user.click(combo)
    await screen.findByRole('listbox')

    expect(screen.getByRole('option', { name: 'Business' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Hustle' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Education' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Hobby' })).toBeInTheDocument()
  })

  it('does not wipe venture fields when categoryLabels refetches (new array)', async () => {
    const props = buildProps()
    const { rerender } = render(<VentureDialog {...props} />)

    const nameInput = screen.getByRole('textbox', { name: /^name$/i })
    await userEvent.type(nameInput, 'Acme Labs')

    const descriptionInput = screen.getByRole('textbox', { name: /description/i })
    await userEvent.type(descriptionInput, 'Side project')

    const refetchedLabels = [
      buildVentureCategoryLabel({ ...labelHustle }),
      buildVentureCategoryLabel({ ...labelBusiness }),
    ]
    rerender(<VentureDialog {...props} categoryLabels={refetchedLabels} />)

    expect(nameInput).toHaveValue('Acme Labs')
    expect(descriptionInput).toHaveValue('Side project')
  })

  it('keeps edits after creating a category label via combobox when labels list updates', async () => {
    const existing = labelHustle
    const user = userEvent.setup()
    const onCreateCategoryLabel = vi.fn().mockResolvedValue(
      buildVentureCategoryLabel({
        id: 'lbl-created',
        name: 'Agency',
        slug: 'agency',
      }),
    )

    const { rerender } = render(
      <VentureDialog
        {...buildProps({
          categoryLabels: [existing],
          hustleLabelId: existing.id,
          onCreateCategoryLabel,
        })}
      />,
    )

    const nameInput = screen.getByRole('textbox', { name: /^name$/i })
    await user.type(nameInput, 'Keep Venture Name')

    await user.click(getCategoryCombo())
    await user.keyboard('Agency')
    await user.click(
      await screen.findByRole('option', {
        name: /create .*agency/i,
      }),
    )

    await waitFor(() => expect(onCreateCategoryLabel).toHaveBeenCalled())

    expect(nameInput).toHaveValue('Keep Venture Name')

    const updatedLabels = [
      existing,
      buildVentureCategoryLabel({
        id: 'lbl-created',
        name: 'Agency',
        slug: 'agency',
      }),
    ]
    rerender(
      <VentureDialog
        {...buildProps({
          categoryLabels: updatedLabels,
          hustleLabelId: existing.id,
          onCreateCategoryLabel,
        })}
      />,
    )

    expect(screen.getByRole('textbox', { name: /^name$/i })).toHaveValue('Keep Venture Name')
    expect(getCategoryCombo()).toHaveValue('Agency')
  })

  it('sets default category when labels arrive after open (create)', async () => {
    const { rerender } = render(
      <VentureDialog {...buildProps({ categoryLabels: [], hustleLabelId: null })} />,
    )

    rerender(
      <VentureDialog {...buildProps({ categoryLabels: [labelHustle], hustleLabelId: null })} />,
    )

    await waitFor(() => {
      expect(getCategoryCombo()).toHaveValue(displayVentureCategoryTitle(labelHustle.name))
    })
  })

  it('does not reset edit form when categoryLabels refetches', async () => {
    const venture = buildVenture({
      id: 'v-edit',
      name: 'Original',
      description: null,
      category_label: labelBusiness,
      category_label_id: labelBusiness.id,
    })

    const user = userEvent.setup()
    const { rerender } = render(
      <VentureDialog
        {...buildProps({
          mode: 'edit',
          venture,
          onArchive: vi.fn(),
        })}
      />,
    )

    const nameInput = screen.getByRole('textbox', { name: /^name$/i })
    await user.clear(nameInput)
    await user.type(nameInput, 'Edited name')

    const refetchedLabels = [
      buildVentureCategoryLabel({ ...labelHustle }),
      buildVentureCategoryLabel({ ...labelBusiness }),
    ]
    rerender(
      <VentureDialog
        {...buildProps({
          mode: 'edit',
          venture,
          categoryLabels: refetchedLabels,
          onArchive: vi.fn(),
        })}
      />,
    )

    expect(nameInput).toHaveValue('Edited name')
  })
})
