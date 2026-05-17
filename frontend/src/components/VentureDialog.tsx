import { type FormEvent, useEffect, useRef, useState } from 'react'

import type { ApiError } from '../api/client'
import type { Venture, VentureCategoryLabel, VenturePayload } from '../api/types'
import { ColourPicker } from './ColourPicker'
import { VentureCategoryCreatableCombobox } from './VentureCategoryCreatableCombobox'
import { DialogFormFooter } from './ui/DialogFormFooter'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

export type VentureDialogProps = {
  categoryLabels: VentureCategoryLabel[]
  hustleLabelId: string | null
  isSaving: boolean
  labelError: ApiError | null
  mode: 'create' | 'edit'
  onArchive: ((ventureId: string) => Promise<void>) | null
  onClose: () => void
  onCreateCategoryLabel: (name: string) => Promise<VentureCategoryLabel>
  onResetLabelError: () => void
  onResetVentureError: () => void
  onSubmit: (payload: VenturePayload) => Promise<void>
  open: boolean
  venture: Venture | null
  ventureError: ApiError | null
}

export function VentureDialog({
  categoryLabels,
  hustleLabelId,
  isSaving,
  labelError,
  mode,
  onArchive,
  onClose,
  onCreateCategoryLabel,
  onResetLabelError,
  onResetVentureError,
  onSubmit,
  open,
  venture,
  ventureError,
}: VentureDialogProps): JSX.Element {
  const [categoryLabelId, setCategoryLabelId] = useState('')
  const [colour, setColour] = useState('#D97048')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [name, setName] = useState('')

  const prevOpenRef = useRef(false)
  const initSessionKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false
      initSessionKeyRef.current = null
      return
    }

    const ventureKey = venture?.id ?? ''
    const sessionKey = `${mode}:${ventureKey}`
    const becameOpen = !prevOpenRef.current
    prevOpenRef.current = true

    const sameSession =
      !becameOpen && initSessionKeyRef.current !== null && initSessionKeyRef.current === sessionKey

    if (sameSession) {
      return
    }

    initSessionKeyRef.current = sessionKey

    if (mode === 'edit' && venture) {
      setName(venture.name)
      setDescription(venture.description ?? '')
      setColour(venture.colour ?? '#D97048')
      setIcon(venture.icon ?? '')
      setCategoryLabelId(venture.category_label_id)
      return
    }

    setName('')
    setDescription('')
    setColour('#D97048')
    setIcon('')
    setCategoryLabelId(hustleLabelId ?? categoryLabels[0]?.id ?? '')
  }, [open, mode, venture, hustleLabelId, categoryLabels])

  /** Create mode only: when labels load after open, adopt default category without touching other fields. */
  useEffect(() => {
    if (!open || mode !== 'create') {
      return
    }
    setCategoryLabelId((current) => {
      if (current !== '') {
        return current
      }
      return hustleLabelId ?? categoryLabels[0]?.id ?? ''
    })
  }, [open, mode, hustleLabelId, categoryLabels])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    onResetVentureError()
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    await onSubmit({
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      colour,
      icon: icon.trim() ? icon.trim() : null,
      category_label_id: categoryLabelId || undefined,
    })
  }

  const dialogTitle = mode === 'create' ? 'New venture' : venture?.name ?? 'Venture'

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Name</span>
            <input
              required
              aria-label="Name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                onResetVentureError()
              }}
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              aria-label="Description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
                onResetVentureError()
              }}
            />
          </label>

          <ColourPicker value={colour} onChange={setColour} />

          <label className="field">
            <span>Icon</span>
            <input
              aria-label="Icon"
              placeholder="Optional"
              type="text"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
            />
          </label>

          <VentureCategoryCreatableCombobox
            categoryLabels={categoryLabels}
            disabled={isSaving}
            labelError={labelError}
            selectedLabelId={categoryLabelId}
            onClearError={onResetLabelError}
            onCreate={onCreateCategoryLabel}
            onSelectedLabelIdChange={(id) => {
              setCategoryLabelId(id)
              onResetVentureError()
            }}
          />

          {ventureError?.formError ? (
            <p className="form-error" role="alert">
              {ventureError.formError}
            </p>
          ) : null}

          <DialogFormFooter
            destructiveAction={
              mode === 'edit' && venture && onArchive ? (
                <Button
                  disabled={isSaving}
                  type="button"
                  variant="destructive"
                  onClick={() => void onArchive(venture.id)}
                >
                  Archive venture
                </Button>
              ) : null
            }
            cancelAction={
              <Button disabled={isSaving} type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            }
            primaryAction={
              <Button disabled={isSaving} type="submit">
                {mode === 'create' ? 'Create venture' : 'Save venture'}
              </Button>
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
