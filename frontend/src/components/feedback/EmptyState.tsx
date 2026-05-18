type EmptyStateProps = {
  description: string
  title: string
}

export function EmptyState({ description, title }: EmptyStateProps): JSX.Element {
  return (
    <div className="grid gap-1">
      <p>{title}</p>
      <p className="muted-copy">{description}</p>
    </div>
  )
}
