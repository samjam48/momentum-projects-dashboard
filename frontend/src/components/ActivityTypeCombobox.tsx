import { useId, useState } from 'react'

import type { ActivityType } from '../api/types'
import { formatActivityTypeLabel } from '../lib/activityTypeDisplay'

export type ActivityTypeComboboxProps = {
  activityTypes: ActivityType[]
  activityTypeError: string | null
  disabled?: boolean
  filterText: string
  onClearError: () => void
  onCreateInline: (trimmedName: string) => Promise<boolean>
  onFilterTextChange: (value: string) => void
  onPickActivityType: (type: ActivityType) => void
}

export function ActivityTypeCombobox({
  activityTypes,
  activityTypeError,
  disabled,
  filterText,
  onClearError,
  onCreateInline,
  onFilterTextChange,
  onPickActivityType,
}: ActivityTypeComboboxProps): JSX.Element {
  const listboxId = useId()
  const [listOpen, setListOpen] = useState(false)

  const trimmedFilter = filterText.trim()
  const normalizedQuery = trimmedFilter.toLowerCase()

  const filtered =
    normalizedQuery === ''
      ? activityTypes
      : activityTypes.filter((type) => type.name.toLowerCase().includes(normalizedQuery))

  const hasActiveExact = activityTypes.some(
    (type) => type.name.toLowerCase() === trimmedFilter.toLowerCase(),
  )

  const showCreate =
    trimmedFilter.length > 0 && !hasActiveExact && filtered.length === 0

  return (
    <div className="relative">
      <label className="field">
        <span>Activity type</span>
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={listOpen}
          aria-label="Activity type"
          className="w-full"
          disabled={disabled}
          role="combobox"
          value={filterText}
          onFocus={() => {
            setListOpen(true)
          }}
          onChange={(event) => {
            onClearError()
            onFilterTextChange(event.target.value)
            setListOpen(true)
          }}
        />
        {activityTypeError ? (
          <span className="field-error" role="alert">
            {activityTypeError}
          </span>
        ) : null}
      </label>

      {listOpen ? (
        <ul
          className="absolute z-[60] mt-1 max-h-48 w-full list-none overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {filtered.map((type) => (
            <li key={type.id} className="px-0 py-0" role="presentation">
              <button
                className="w-full cursor-pointer bg-transparent px-3 py-2 text-left hover:bg-slate-100"
                role="option"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onClearError()
                  onPickActivityType(type)
                  setListOpen(false)
                }}
              >
                {formatActivityTypeLabel(type.name)}
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
                    const created = await onCreateInline(trimmedFilter)
                    if (created) {
                      setListOpen(false)
                    }
                  })()
                }}
              >
                Create activity
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
