import * as React from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--accent)] text-[var(--bg)]',
  secondary: 'bg-[var(--surface-2)] text-[var(--text)]',
  outline: 'border border-[color-mix(in_srgb,var(--text)_15%,transparent)] text-[var(--text)]',
  success: 'bg-[color-mix(in_srgb,var(--success)_20%,transparent)] text-[var(--success)]',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] text-[var(--warning)]',
  danger: 'bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] text-[var(--danger)]',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
)
Badge.displayName = 'Badge'