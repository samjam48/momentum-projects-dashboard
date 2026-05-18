import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-highlight)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-10 px-4 py-2',
        icon: 'h-10 w-10',
        sm: 'h-8 rounded-full px-3 text-xs',
      },
      variant: {
        default:
          'bg-[var(--accent-action)] text-[#fff8f0] hover:bg-[var(--accent-action-hover)]',
        destructive: 'bg-[#c8553d] text-[#fff8f0] hover:bg-[#a7422e]',
        ghost: 'bg-transparent text-[var(--primary-text)] hover:bg-[var(--accent-muted)]',
        outline:
          'border border-[rgba(90,58,37,0.18)] bg-transparent text-[#4d3729] hover:bg-[var(--accent-muted)]',
        secondary:
          'bg-[#ead7c0] text-[#4d3729] hover:bg-[#dec3a5]',
      },
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ className, size, variant }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button }
