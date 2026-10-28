import React from 'react'
import { cn } from '@/lib/utils'
import type { Theme } from '@shared/types'

const PRESETS: { id: Theme; name: string; colors: string[] }[] = [
  { id: 'ocean', name: 'Ocean', colors: ['#071a22', '#0d2a33', '#5ec8d8', '#e6f7f9'] },
  { id: 'aurora', name: 'Aurora', colors: ['#0f172a', '#1e293b', '#a78bfa', '#f1f5f9'] },
  { id: 'voxel', name: 'Voxel', colors: ['#0b1f17', '#123524', '#4ade80', '#e8f5ee'] },
  { id: 'mono', name: 'Mono', colors: ['#111111', '#1f1f1f', '#a3a3a3', '#f5f5f5'] },
]

export interface ThemePickerProps {
  value: Theme
  onChange: (theme: Theme) => void
  className?: string
}

export function ThemePicker({ value, onChange, className }: ThemePickerProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {PRESETS.map((p) => {
        const active = value === p.id
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={active}
            className={cn(
              'group rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
            )}
          >
            <div className="flex gap-1.5 mb-2">
              {p.colors.map((c, i) => (
                <span
                  key={i}
                  className="h-6 w-6 rounded-full border border-white/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="text-sm font-medium">{p.name}</div>
            {p.id === 'ocean' ? (
              <div className="text-[10px] text-muted-foreground">Default</div>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export default ThemePicker