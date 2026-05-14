import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'

import { cn } from '../../lib/utils'

const Checkbox = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded border border-[rgba(90,58,37,0.22)] bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-highlight)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--accent-action)] data-[state=checked]:bg-[rgba(156,93,53,0.12)] data-[state=checked]:text-[var(--accent-action)]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <span aria-hidden className="text-[10px] font-bold leading-none">
        ✓
      </span>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
