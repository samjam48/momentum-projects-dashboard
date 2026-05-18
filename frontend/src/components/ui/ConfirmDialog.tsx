import type { ReactNode } from 'react'

import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'

type ConfirmDialogProps = {
  cancelLabel?: string
  children?: ReactNode
  confirmLabel: string
  description: ReactNode
  onConfirm: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  title: ReactNode
}

export function ConfirmDialog({
  cancelLabel = 'Cancel',
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) {
          return
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="z-[60]"
        role="alertdialog"
        onBackdropClick={() => {
          if (!pending) {
            onOpenChange(false)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            disabled={pending}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button disabled={pending} type="button" onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
