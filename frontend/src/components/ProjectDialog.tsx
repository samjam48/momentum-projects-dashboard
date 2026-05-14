import type { FormEvent } from 'react'

import { ColourPicker } from './ColourPicker'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

type ProjectFormErrors = {
  colour?: string
  description?: string
  form?: string
  name?: string
}

type ProjectFormState = {
  colour: string
  description: string
  name: string
}

type ProjectDialogProps = {
  editingProjectId: string | null
  formErrors: ProjectFormErrors
  formState: ProjectFormState
  isOpen: boolean
  isSaving: boolean
  mode: 'create' | 'edit'
  onArchive?: () => void
  onClose: () => void
  onFieldChange: (field: keyof ProjectFormState, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

export function ProjectDialog({
  editingProjectId,
  formErrors,
  formState,
  isOpen,
  isSaving,
  mode,
  onArchive,
  onClose,
  onFieldChange,
  onSubmit,
}: ProjectDialogProps): JSX.Element {
  const title = mode === 'create' ? 'New project' : 'Edit project'

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent data-slot="dialog-content">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a project to the workspace.'
              : 'Update project details or archive this project.'}
          </DialogDescription>
        </DialogHeader>

        <form className="project-form" noValidate onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span>Project name</span>
            <input
              aria-label="Project name"
              name="name"
              value={formState.name}
              onChange={(event) => onFieldChange('name', event.target.value)}
            />
            {formErrors.name ? <span className="field-error">{formErrors.name}</span> : null}
          </label>

          <label className="field">
            <span>Project description</span>
            <textarea
              aria-label="Project description"
              name="description"
              rows={3}
              value={formState.description}
              onChange={(event) => onFieldChange('description', event.target.value)}
            />
            {formErrors.description ? (
              <span className="field-error">{formErrors.description}</span>
            ) : null}
          </label>

          <ColourPicker
            value={formState.colour}
            onChange={(colour) => onFieldChange('colour', colour)}
          />
          {formErrors.colour ? <span className="field-error">{formErrors.colour}</span> : null}

          {formErrors.form ? (
            <p className="form-error" role="alert">
              {formErrors.form}
            </p>
          ) : null}

          {mode === 'edit' && editingProjectId && onArchive ? (
            <Button
              className="danger-button"
              type="button"
              onClick={() => void onArchive()}
            >
              Archive project
            </Button>
          ) : null}

          <div className="form-actions" data-testid="project-dialog-actions">
            <Button disabled={isSaving} type="submit">
              {mode === 'create' ? 'Create project' : 'Save project'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
