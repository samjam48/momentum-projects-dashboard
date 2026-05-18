import { type SelectHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'
import { FormField } from './FormField'

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'aria-label'> & {
  'aria-label'?: string
  error?: string
  fieldClassName?: string
  label?: string
}

export function Select({
  className,
  error,
  fieldClassName,
  id,
  label,
  'aria-label': ariaLabel,
  children,
  ...props
}: SelectProps): JSX.Element {
  return (
    <FormField className={fieldClassName} error={error} id={id} label={label}>
      {(controlProps) => (
        <select {...props} {...controlProps} aria-label={ariaLabel} className={cn(className)}>
          {children}
        </select>
      )}
    </FormField>
  )
}
