import type { ReactNode } from 'react'

type ArchiveListProps<TItem> = {
  getKey: (item: TItem) => string
  getLabel: (item: TItem) => string
  items: TItem[]
  onRestore: (item: TItem) => void
  onSelect: (item: TItem) => void
  renderLeadingContent?: (item: TItem) => ReactNode
  restoreDisabled?: boolean
  restoreLabel?: string
}

export function ArchiveList<TItem>({
  getKey,
  getLabel,
  items,
  onRestore,
  onSelect,
  renderLeadingContent,
  restoreDisabled = false,
  restoreLabel = 'restore',
}: ArchiveListProps<TItem>): JSX.Element {
  return (
    <ul className="archive-project-list">
      {items.map((item) => {
        const label = getLabel(item)

        return (
          <li key={getKey(item)}>
            <div className="archive-project-row archive-project-actions">
              <button className="archive-project-title" type="button" onClick={() => onSelect(item)}>
                {renderLeadingContent?.(item)}
                <span>{label}</span>
              </button>
              <button
                className="archive-restore-link"
                data-archive-restore
                disabled={restoreDisabled}
                style={{ backgroundColor: 'transparent' }}
                type="button"
                onClick={() => onRestore(item)}
              >
                {restoreLabel}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
