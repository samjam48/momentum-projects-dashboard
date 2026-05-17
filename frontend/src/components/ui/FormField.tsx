import { type ReactNode, useId } from 'react'

import { cn } from '../../lib/utils'

type FormFieldRenderProps = {
  'aria-describedby'?: string
  'aria-invalid'?: true
  id: string
}

type FormFieldProps = {
  children: (props: FormFieldRenderProps) => ReactNode
  className?: string
  error?: string
  id?: string
  label?: string
}

export function FormField({
  children,
  className,
  error,
  id,
  label,
}: FormFieldProps): JSX.Element {
  const generatedId = useId()
  const controlId = id ?? `field-${generatedId}`
  const errorId = error ? `${controlId}-error` : undefined
  const controlProps: FormFieldRenderProps = {
    id: controlId,
  }

  if (errorId) {
    controlProps['aria-describedby'] = errorId
    controlProps['aria-invalid'] = true
  }

  if (label) {
    return (
      <div className={cn('field', className)}>
        <label htmlFor={controlId}>
          <span>{label}</span>
        </label>
        {children(controlProps)}
        {error ? (
          <span className="field-error" id={errorId}>
            {error}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('field', className)}>
      {children(controlProps)}
      {error ? (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
