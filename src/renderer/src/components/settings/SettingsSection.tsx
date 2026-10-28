import React from 'react'
import { cn } from '@/lib/utils'

export interface SettingsSectionProps {
  id?: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({ id, title, description, children, className }: SettingsSectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-6 space-y-4', className)}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export default SettingsSection