import { useEffect, useId, useState } from 'react'

import type { ApiError } from '../api/client'
import type { VentureCategoryLabel } from '../api/types'
import { displayVentureCategoryTitle } from '../lib/ventureCategoryDisplay'

export type VentureCategoryCreatableComboboxProps = {
  categoryLabels: VentureCategoryLabel[]
  disabled?: boolean
  labelError: ApiError | null
  onClearError: () => void
  onCreate: (trimmedName: string) => Promise<VentureCategoryLabel>
  onSelectedLabelIdChange: (id: string) => void
  selectedLabelId: string
}

export function VentureCategoryCreatableCombobox({
  categoryLabels,
  disabled,
  labelError,
  onClearError,
  onCreate,
  onSelectedLabelIdChange,
  selectedLabelId,
}: VentureCategoryCreatableComboboxProps): JSX.Element {
  const listboxId = useId()
  const [listOpen, setListOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    if (selectedLabelId === '') {
      return
    }

    const label = categoryLabels.find((item) => item.id === selectedLabelId)
    setFilterText(label ? displayVentureCategoryTitle(label.name) : '')
  }, [categoryLabels, selectedLabelId])

  const trimmedFilter = filterText.trim()
  const normalizedQuery = trimmedFilter.toLowerCase()
  const selectedLabel = categoryLabels.find((item) => item.id === selectedLabelId)
  const selectedDisplay =
    selectedLabel !== undefined ? displayVentureCategoryTitle(selectedLabel.name) : ''
  const normalizedSelectedDisplay = selectedDisplay.trim().toLowerCase()
  const normalizedFilterForList =
    normalizedQuery === normalizedSelectedDisplay ? '' : normalizedQuery

  const filtered =
    normalizedFilterForList === ''
      ? categoryLabels
      : categoryLabels.filter((label) =>
          label.name.toLowerCase().includes(normalizedFilterForList),
        )

  const hasExactMatch = categoryLabels.some(
    (label) => label.name.trim().toLowerCase() === trimmedFilter.toLowerCase(),
  )

  const showCreate = trimmedFilter.length > 0 && !hasExactMatch

  const createOptionLabel =
    trimmedFilter === '' ? '' : `Create "${displayVentureCategoryTitle(trimmedFilter)}"`

  return (
    <div className="relative">
      <label className="field">
        <span>Venture category</span>
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={listOpen}
          aria-label="Venture category"
          className="w-full"
          disabled={disabled}
          role="combobox"
          value={filterText}
          onFocus={(event) => {
            event.target.select()
            setListOpen(true)
          }}
          onChange={(event) => {
            const value = event.target.value
            onClearError()
            setFilterText(value)
            if (value.trim().toLowerCase() !== selectedDisplay.trim().toLowerCase()) {
              onSelectedLabelIdChange('')
            }
            setListOpen(true)
          }}
        />
        {labelError?.formError ? (
          <span className="field-error" role="alert">
            {labelError.formError}
          </span>
        ) : null}
      </label>

      {listOpen ? (
        <ul
          className="absolute z-[60] mt-1 max-h-48 w-full list-none overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {filtered.map((label) => (
            <li key={label.id} className="px-0 py-0" role="presentation">
              <button
                className="w-full cursor-pointer bg-transparent px-3 py-2 text-left hover:bg-slate-100"
                role="option"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onClearError()
                  onSelectedLabelIdChange(label.id)
                  setFilterText(displayVentureCategoryTitle(label.name))
                  setListOpen(false)
                }}
              >
                {displayVentureCategoryTitle(label.name)}
              </button>
            </li>
          ))}
          {showCreate ? (
            <li className="px-0 py-0" role="presentation">
              <button
                className="w-full cursor-pointer bg-transparent px-3 py-2 text-left font-medium hover:bg-slate-100"
                role="option"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  void (async () => {
                    try {
                      const created = await onCreate(trimmedFilter)
                      onSelectedLabelIdChange(created.id)
                      setFilterText(displayVentureCategoryTitle(created.name))
                      setListOpen(false)
                    } catch {
                      /* surfaced via labelError */
                    }
                  })()
                }}
              >
                {createOptionLabel}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
