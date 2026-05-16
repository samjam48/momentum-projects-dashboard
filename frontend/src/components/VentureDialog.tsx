import { type FormEvent, useEffect, useRef, useState } from 'react'

import type { ApiError } from '../api/client'
import type { Venture, VentureCategoryLabel, VenturePayload } from '../api/types'
import { ColourPicker } from './ColourPicker'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
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

function displayCategoryTitle(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
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
  const [newLabelName, setNewLabelName] = useState('')

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
      setNewLabelName('')
      return
    }

    setName('')
    setDescription('')
    setColour('#D97048')
    setIcon('')
    setCategoryLabelId(hustleLabelId ?? categoryLabels[0]?.id ?? '')
    setNewLabelName('')
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

  const handleCreateLabel = async (): Promise<void> => {
    const trimmed = newLabelName.trim()
    if (!trimmed) {
      return
    }

    onResetLabelError()
    try {
      const created = await onCreateCategoryLabel(trimmed)
      setCategoryLabelId(created.id)
      setNewLabelName('')
    } catch {
      /* surfaced via labelError */
    }
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

          <label className="field">
            <span>Category label</span>
            <select
              aria-label="Category label"
              value={categoryLabelId}
              onChange={(event) => setCategoryLabelId(event.target.value)}
            >
              {categoryLabels.map((label) => (
                <option key={label.id} value={label.id}>
                  {displayCategoryTitle(label.name)}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <label className="block">
              <span>New category label</span>
              <input
                aria-label="New category label"
                type="text"
                value={newLabelName}
                onChange={(event) => {
                  setNewLabelName(event.target.value)
                  onResetLabelError()
                }}
              />
            </label>
            <Button
              className="mt-2"
              disabled={isSaving || !newLabelName.trim()}
              type="button"
              variant="secondary"
              onClick={() => void handleCreateLabel()}
            >
              Create label
            </Button>
          </div>

          {ventureError?.formError ? (
            <p className="form-error" role="alert">
              {ventureError.formError}
            </p>
          ) : null}

          {labelError?.formError ? (
            <p className="form-error" role="alert">
              {labelError.formError}
            </p>
          ) : null}

          {mode === 'edit' && venture && onArchive ? (
            <Button
              className="danger-button"
              disabled={isSaving}
              type="button"
              onClick={() => void onArchive(venture.id)}
            >
              Archive venture
            </Button>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button disabled={isSaving} type="submit">
              {mode === 'create' ? 'Create venture' : 'Save venture'}
            </Button>
            <Button disabled={isSaving} type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
