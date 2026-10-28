import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api as hiyoApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { JavaInfo } from '@shared/types'

// safe api access
const _api: any = hiyoApi ?? (window as any).hiyo

export interface JavaPickerProps {
  value?: string
  onChange?: (path: string) => void
  requiredMajor?: number
  className?: string
}

export function JavaPicker({ value, onChange, requiredMajor, className }: JavaPickerProps) {
  const [list, setList] = useState<JavaInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await _api.java.detect()
      setList(Array.isArray(res) ? res : [])
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to detect Java')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleInstall = async (major: number) => {
    setInstalling(true)
    try {
      const path = await _api.java.install(major)
      toast.success('Java installed')
      await load()
      if (path && onChange) onChange(path)
    } catch (e: any) {
      toast.error(e?.message ?? 'Install failed')
    } finally {
      setInstalling(false)
    }
  }

  if (loading) return <Skeleton className="h-10 w-full" />

  return (
    <div className={cn('space-y-2', className)}>
      <Select value={value ?? ''} onValueChange={(v) => onChange?.(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Select Java runtime" />
        </SelectTrigger>
        <SelectContent>
          {list.map((j) => (
            <SelectItem key={j.path} value={j.path}>
              Java {j.major} — {j.version} ({j.path})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={load}>
          Detect
        </Button>
        {requiredMajor ? (
          <Button type="button" size="sm" disabled={installing} onClick={() => handleInstall(requiredMajor)}>
            {installing ? 'Installing...' : `Install Java ${requiredMajor}`}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default JavaPicker
