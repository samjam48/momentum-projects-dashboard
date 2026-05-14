import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'

import { cn } from '../../lib/utils'

const Checkbox = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    checked={checked}
    className={cn(
      'checkbox-root peer h-4 w-4 shrink-0 rounded border bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-highlight)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-transparent data-[state=checked]:text-[var(--accent-action)]',
      className,
    )}
    style={{
      backgroundColor: 'transparent',
      borderColor: checked ? 'var(--accent-action)' : 'rgba(90, 58, 37, 0.22)',
      borderStyle: 'solid',
      borderWidth: checked ? 2 : 1,
    }}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      forceMount
      className="flex items-center justify-center text-current data-[state=unchecked]:opacity-0"
    >
      <Check aria-hidden size={12} strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
