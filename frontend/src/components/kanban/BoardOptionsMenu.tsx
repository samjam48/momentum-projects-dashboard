import { useEffect, useId, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Button } from '../ui/button'
import {
  type BoardDisplayOptions,
  useBoardDisplayOptionsStore,
} from '../../stores/boardDisplayOptions'

type BoardOptionKey = keyof BoardDisplayOptions

const BOARD_OPTION_ITEMS: Array<{ key: BoardOptionKey; label: string }> = [
  { key: 'showDueDate', label: 'Show due date' },
  { key: 'showPriority', label: 'Show priority' },
  { key: 'showActualHours', label: 'Show actual hours' },
  { key: 'showStatusBadge', label: 'Show status badge' },
  { key: 'showProjectName', label: 'Show project name' },
]

export function BoardOptionsMenu(): JSX.Element {
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const options = useBoardDisplayOptionsStore(
    useShallow((state) => ({
      showActualHours: state.showActualHours,
      showDueDate: state.showDueDate,
      showPriority: state.showPriority,
      showProjectName: state.showProjectName,
      showStatusBadge: state.showStatusBadge,
    })),
  )
  const toggleOption = useBoardDisplayOptionsStore((state) => state.toggleOption)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="board-options-menu">
      <Button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        type="button"
        variant="secondary"
        onClick={() => setIsOpen((current) => !current)}
      >
        Board options
      </Button>

      {isOpen ? (
        <div
          aria-label="Board options"
          className="board-options-dropdown"
          id={menuId}
          role="menu"
        >
          {BOARD_OPTION_ITEMS.map((item) => (
            <button
              key={item.key}
              aria-checked={options[item.key]}
              className="board-options-item"
              role="menuitemcheckbox"
              type="button"
              onClick={() => toggleOption(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
