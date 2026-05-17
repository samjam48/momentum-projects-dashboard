import { type ReactNode } from 'react'

import { cn } from '../../lib/utils'

type DialogFormFooterProps = {
  actionsTestId?: string
  cancelAction: ReactNode
  className?: string
  destructiveAction?: ReactNode
  primaryAction: ReactNode
}

export function DialogFormFooter({
  actionsTestId,
  cancelAction,
  className,
  destructiveAction,
  primaryAction,
}: DialogFormFooterProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {destructiveAction ? <div>{destructiveAction}</div> : null}
      <div className="form-actions" data-testid={actionsTestId}>
        {cancelAction}
        {primaryAction}
      </div>
    </div>
  )
}
