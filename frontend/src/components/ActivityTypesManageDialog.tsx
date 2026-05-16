import { useState } from 'react'

import { ApiError } from '../api/client'
import { useActivityTypeMutations, useActivityTypes } from '../api/activityTypes'
import type { ActivityType } from '../api/types'
import { formatActivityTypeLabel } from '../lib/activityTypeDisplay'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

type ActivityTypesManageDialogProps = {
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function ActivityTypesManageDialog({
  onOpenChange,
  open,
}: ActivityTypesManageDialogProps): JSX.Element {
  const activityTypes = useActivityTypes('active')
  const mutations = useActivityTypeMutations()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async (type: ActivityType): Promise<void> => {
    setDeleteError(null)
    mutations.resetError()
    try {
      await mutations.remove(type.id)
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : 'Unable to delete activity type.'
      setDeleteError(message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setDeleteError(null)
          mutations.resetError()
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent aria-describedby={undefined} aria-label="Activity types">
        <DialogHeader>
          <DialogTitle>Activity types</DialogTitle>
        </DialogHeader>

        {deleteError ? (
          <p className="form-error" role="alert">
            {deleteError}
          </p>
        ) : null}

        <table className="w-full border-collapse text-left text-sm">
          <tbody>
            {activityTypes.data.map((type) => (
              <tr key={type.id} aria-label={type.name}>
                <td className="py-2 pr-4">
                  {formatActivityTypeLabel(type.name)}
                </td>
                <td className="py-2">
                  <Button
                    disabled={mutations.isSaving}
                    type="button"
                    variant="secondary"
                    onClick={() => void handleDelete(type)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
