import { useEffect, useId, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import {
  useBoardDisplayOptionsStore,
} from '../../stores/boardDisplayOptions'
import { Checkbox } from '../ui/checkbox'

type VisibleBoardOptionKey =
  | 'showActualHours'
  | 'showDueDate'
  | 'showPriority'
  | 'showProjectName'

const BOARD_OPTION_ITEMS: Array<{ key: VisibleBoardOptionKey; label: string }> = [
  { key: 'showDueDate', label: 'Show due date' },
  { key: 'showPriority', label: 'Show priority' },
  { key: 'showActualHours', label: 'Show actual hours' },
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
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Board options"
        className="icon-gear-button"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Settings aria-hidden size={16} strokeWidth={2} />
      </button>

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
              <Checkbox
                aria-hidden
                checked={options[item.key]}
                className="board-options-checkbox"
                tabIndex={-1}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
