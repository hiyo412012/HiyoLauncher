import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-[var(--accent)] text-[var(--bg)] hover:opacity-90',
  secondary: 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface)]',
  outline:
    'border border-[color-mix(in_srgb,var(--text)_15%,transparent)] bg-transparent text-[var(--text)] hover:bg-[var(--surface)]',
  ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--surface)]',
  destructive: 'bg-[var(--danger)] text-[var(--bg)] hover:opacity-90',
  link: 'bg-transparent text-[var(--accent)] underline-offset-4 hover:underline',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-[var(--radius-sm)]',
  md: 'h-10 px-4 text-sm rounded-[var(--radius-md)]',
  lg: 'h-12 px-6 text-base rounded-[var(--radius-lg)]',
  icon: 'h-10 w-10 rounded-[var(--radius-md)]',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors',
          'disabled:pointer-events-none disabled:opacity-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export function buttonVariants(variant: ButtonVariant = 'default', size: ButtonSize = 'md'): string {
  return cn(variantClasses[variant], sizeClasses[size])
}