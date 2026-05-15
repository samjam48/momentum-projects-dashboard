import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { buildVenture, buildVentureCategoryLabel } from '../test/fixtures'
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

function buildProps(overrides: Partial<VentureDialogProps> = {}): VentureDialogProps {
  return {
    categoryLabels: [labelHustle, labelBusiness],
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

describe('VentureDialog (1.6-8)', () => {
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

  it('keeps edits after creating a category label when labels list updates', async () => {
    const existing = labelHustle
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
    await userEvent.type(nameInput, 'Keep Venture Name')

    await userEvent.type(screen.getByRole('textbox', { name: /new category label/i }), 'Agency')
    await userEvent.click(screen.getByRole('button', { name: /create label/i }))

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
    expect(screen.getByRole('combobox', { name: /category label/i })).toHaveValue('lbl-created')
  })

  it('sets default category when labels arrive after open (create)', async () => {
    const { rerender } = render(
      <VentureDialog {...buildProps({ categoryLabels: [], hustleLabelId: null })} />,
    )

    rerender(<VentureDialog {...buildProps({ categoryLabels: [labelHustle], hustleLabelId: null })} />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /category label/i })).toHaveValue(labelHustle.id)
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
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Edited name')

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
