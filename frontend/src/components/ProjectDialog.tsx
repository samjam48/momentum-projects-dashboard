import type { FormEvent } from 'react'
import { X } from 'lucide-react'

import type { Venture } from '../api/types'
import type { ProjectBoardStatus, ProjectType } from '../api/types'
import { ColourPicker } from './ColourPicker'
import { DialogFormFooter } from './ui/DialogFormFooter'
import { FormField } from './ui/FormField'
import { Select } from './ui/Select'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

const PROJECT_TYPE_OPTIONS: ProjectType[] = ['project', 'asset', 'gig', 'contract']

const BOARD_STATUS_OPTIONS: ProjectBoardStatus[] = ['idea', 'active', 'paused', 'shipped']

function projectTypeLabel(value: ProjectType): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function boardStatusLabel(value: ProjectBoardStatus): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export type ProjectFormErrors = {
  colour?: string
  description?: string
  form?: string
  name?: string
  venture_id?: string
}

export type ProjectFormState = {
  board_status: ProjectBoardStatus
  colour: string
  description: string
  icon: string
  name: string
  project_type: ProjectType
  shippedWhenArchiving: boolean
  venture_id: string
}

type ProjectDialogProps = {
  activeVentures: Venture[]
  editingProjectId: string | null
  formErrors: ProjectFormErrors
  formState: ProjectFormState
  isOpen: boolean
  isSaving: boolean
  mode: 'create' | 'edit'
  onArchive?: () => void | Promise<void>
  onClose: () => void
  onFieldChange: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

export function ProjectDialog({
  activeVentures,
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
      <DialogContent data-slot="dialog-content" onBackdropClick={onClose}>
        <DialogHeader>
          <div className="task-dialog-header">
            <DialogTitle>{title}</DialogTitle>
            <Button aria-label="Close project" size="icon" type="button" variant="ghost" onClick={onClose}>
              <span aria-hidden>X</span>
              <X aria-hidden size={18} />
            </Button>
          </div>
          <DialogDescription>
            {mode === 'create'
              ? 'Choose a venture and fill in the project details.'
              : 'Update details or archive this project.'}
          </DialogDescription>
        </DialogHeader>

        <form className="project-form" noValidate onSubmit={(event) => void onSubmit(event)}>
          <Select
            error={formErrors.venture_id}
            label="Venture"
            name="venture_id"
            value={formState.venture_id}
            onChange={(event) => onFieldChange('venture_id', event.target.value)}
          >
            {activeVentures.map((venture) => (
              <option key={venture.id} value={venture.id}>
                {venture.name}
              </option>
            ))}
          </Select>

          <FormField error={formErrors.name} label="Project name">
            {(controlProps) => (
              <input
                {...controlProps}
                name="name"
                value={formState.name}
                onChange={(event) => onFieldChange('name', event.target.value)}
              />
            )}
          </FormField>

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

          <label className="field">
            <span>Icon</span>
            <input
              aria-label="Icon"
              name="icon"
              value={formState.icon}
              onChange={(event) => onFieldChange('icon', event.target.value)}
            />
          </label>

          <Select
            aria-label="Project type"
            label="Project type"
            name="project_type"
            value={formState.project_type}
            onChange={(event) =>
              onFieldChange('project_type', event.target.value as ProjectType)
            }
          >
            {[...PROJECT_TYPE_OPTIONS].sort().map((value) => (
              <option key={value} value={value}>
                {projectTypeLabel(value)}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Board status"
            label="Board status"
            name="board_status"
            value={formState.board_status}
            onChange={(event) =>
              onFieldChange('board_status', event.target.value as ProjectBoardStatus)
            }
          >
            {BOARD_STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {boardStatusLabel(value)}
              </option>
            ))}
          </Select>

          {formErrors.form ? (
            <p className="form-error" role="alert">
              {formErrors.form}
            </p>
          ) : null}

          {mode === 'edit' ? (
            <label className="field field-checkbox">
              <input
                aria-label="Shipped when archiving"
                checked={formState.shippedWhenArchiving}
                type="checkbox"
                onChange={(event) =>
                  onFieldChange('shippedWhenArchiving', event.target.checked)
                }
              />
              <span>Shipped when archiving</span>
            </label>
          ) : null}

          <DialogFormFooter
            actionsTestId="project-dialog-actions"
            className="mt-2"
            destructiveAction={
              mode === 'edit' && editingProjectId && onArchive ? (
                <Button disabled={isSaving} type="button" variant="destructive" onClick={() => void onArchive()}>
                  Archive project
                </Button>
              ) : null
            }
            cancelAction={
              <Button disabled={isSaving} type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            }
            primaryAction={
              <Button disabled={isSaving} type="submit">
                {mode === 'create' ? 'Create project' : 'Save project'}
              </Button>
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
