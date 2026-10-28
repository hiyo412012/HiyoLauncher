import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      {icon ? <div className="text-[var(--muted)]">{icon}</div> : null}
      <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-[var(--muted)]">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}