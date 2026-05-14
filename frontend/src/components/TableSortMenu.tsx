import { useEffect, useId, useRef, useState } from 'react'
import { Settings } from 'lucide-react'

type TaskSortKey = 'target_date' | 'priority' | 'project_name'

type TableSortMenuProps = {
  onSort: (key: TaskSortKey) => void
}

const SORT_OPTIONS: Array<{ key: TaskSortKey; label: string }> = [
  { key: 'project_name', label: 'Project' },
  { key: 'priority', label: 'Priority' },
  { key: 'target_date', label: 'Target date' },
]

export function TableSortMenu({ onSort }: TableSortMenuProps): JSX.Element {
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

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
    <div ref={containerRef} className="table-sort-menu">
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Sort by"
        className="icon-gear-button"
        data-testid="table-sort-gear"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Settings aria-hidden size={16} strokeWidth={2} />
      </button>

      {isOpen ? (
        <div aria-label="Sort by" className="table-sort-dropdown" id={menuId} role="menu">
          <p className="table-sort-label">Sort by</p>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              className="table-sort-item"
              role="menuitem"
              type="button"
              onClick={() => {
                onSort(option.key)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export type { TaskSortKey }
