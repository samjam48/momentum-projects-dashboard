import { useCallback, useEffect, useRef, useState } from 'react'

import {
  DEFAULT_PROJECT_COLOUR,
  PROJECT_PALETTE,
  PROJECT_PALETTE_NAMES,
} from '../lib/projectPalette'
import { cn } from '../lib/utils'

type ColourPickerProps = {
  onChange: (colour: string) => void
  value: string
}

export function ColourPicker({ onChange, value }: ColourPickerProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedColour = value || DEFAULT_PROJECT_COLOUR
  const selectedIndex = Math.max(
    0,
    PROJECT_PALETTE.findIndex(
      (swatch) => swatch.toLowerCase() === selectedColour.toLowerCase(),
    ),
  )

  const focusOption = useCallback((index: number): void => {
    const normalizedIndex = (index + PROJECT_PALETTE.length) % PROJECT_PALETTE.length
    setFocusedIndex(normalizedIndex)
    optionRefs.current[normalizedIndex]?.focus()
  }, [])

  useEffect(() => {
    if (!expanded) {
      return
    }

    setFocusedIndex(selectedIndex)
    optionRefs.current[selectedIndex]?.focus()
  }, [expanded, selectedIndex])

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setExpanded(true)
    }
  }

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption(index + 1)
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(index - 1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      focusOption(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      focusOption(PROJECT_PALETTE.length - 1)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setExpanded(false)
    }
  }

  return (
    <div className="colour-picker-field">
      <span className="colour-picker-label">Colour</span>
      <button
        aria-expanded={expanded}
        aria-haspopup="listbox"
        aria-label="Colour"
        className={cn(
          'colour-picker-trigger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-highlight)] focus-visible:ring-offset-2',
        )}
        type="button"
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          aria-hidden
          className="colour-picker-swatch"
          style={{ backgroundColor: selectedColour }}
        />
      </button>

      {expanded ? (
        <div
          aria-activedescendant={`colour-option-${focusedIndex}`}
          aria-label="Colour options"
          className="colour-picker-options"
          role="radiogroup"
        >
          {PROJECT_PALETTE.map((swatch, index) => {
            const name = PROJECT_PALETTE_NAMES[index] ?? 'Colour'
            const isSelected = swatch.toLowerCase() === selectedColour.toLowerCase()

            return (
              <button
                key={swatch}
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                aria-checked={isSelected}
                aria-label={`Colour swatch ${name}`}
                className={cn(
                  'colour-picker-option',
                  isSelected ? 'colour-picker-option-selected' : undefined,
                )}
                id={`colour-option-${index}`}
                role="radio"
                tabIndex={index === focusedIndex ? 0 : -1}
                type="button"
                onClick={() => {
                  onChange(swatch)
                  setExpanded(false)
                }}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span
                  aria-hidden
                  className={cn(
                    'colour-picker-swatch',
                    isSelected ? 'colour-picker-swatch-selected' : undefined,
                  )}
                  style={{ backgroundColor: swatch }}
                />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
