import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Download, FileText, RefreshCw, Search, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import type { CrashCause } from '@shared/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatBytes, formatRelativeTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

const SEVERITY_STYLES: Record<CrashCause['severity'], string> = {
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  error: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  fatal: 'border-rose-500/40 bg-rose-500/15 text-rose-100',
}

export default function InstanceLogsTab({ instanceId }: { instanceId: string }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [analysis, setAnalysis] = useState<{ summary: string; causes: CrashCause[] } | null>(null)

  const logsQuery = useQuery({
    queryKey: ['logs', instanceId, 'instance'],
    queryFn: () => api.logs.list(instanceId),
  })
  const logs = logsQuery.data ?? []

  useEffect(() => {
    if (logs.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !logs.some((log) => log.path === selected)) {
      setSelected(logs[0].path)
      setAnalysis(null)
    }
  }, [logs, selected])

  const fileQuery = useQuery({
    queryKey: ['log-content', selected],
    queryFn: () => (selected ? api.logs.read(selected, 3000) : Promise.resolve('')),
    enabled: !!selected,
    refetchInterval: autoRefresh ? 3000 : false,
  })

  const text = fileQuery.data ?? ''
  const lines = useMemo(() => {
    const all = text.split(/\r?\n/)
    if (!filter.trim()) return all
    const needle = filter.toLowerCase()
    return all.filter((line) => line.toLowerCase().includes(needle))
  }, [text, filter])

  const analyze = async () => {
    if (!selected) return
    try {
      setAnalysis(await api.logs.analyze(selected))
    } catch (error) {
      toast.error((error as Error)?.message ?? 'Could not analyze log')
    }
  }

  const exportFile = async () => {
    if (!selected) return
    try {
      const content = await api.logs.export(selected)
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = selected.split(/[\\/]/).pop() || 'log.txt'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error((error as Error)?.message ?? 'Could not export log')
    }
  }

  if (logsQuery.isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {t('logs.files', { defaultValue: 'Log files' })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['logs', instanceId, 'instance'] })
              fileQuery.refetch()
            }}
            aria-label={t('common.refresh', { defaultValue: 'Refresh' })}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', fileQuery.isFetching && 'animate-spin')} />
          </Button>
        </div>
        {logs.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--muted)]">
              {t('logs.empty', { defaultValue: 'Launch the game to generate logs.' })}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const name = log.path.split(/[\\/]/).pop() ?? log.path
              const isCrash = name.endsWith('.txt')
              return (
                <button
                  key={log.path}
                  type="button"
                  onClick={() => {
                    setSelected(log.path)
                    setAnalysis(null)
                  }}
                  className={cn(
                    'w-full rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors',
                    selected === log.path
                      ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                      : 'border-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:bg-[var(--surface-2)]',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className={cn('h-3.5 w-3.5 shrink-0', isCrash ? 'text-[var(--danger)]' : 'text-[var(--muted)]')} />
                    <span className="truncate text-xs font-medium">{name}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">
                    {formatBytes(log.size)} · {formatRelativeTime(log.modifiedAt, i18n.language)}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('logs.filter', { defaultValue: 'Filter lines' })}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            {t('logs.auto', { defaultValue: 'Auto' })}
          </label>
          <Button variant="outline" size="sm" onClick={analyze} disabled={!selected}>
            <Stethoscope className="h-4 w-4" />
            {t('logs.analyze', { defaultValue: 'Analyze' })}
          </Button>
          <Button variant="outline" size="sm" onClick={exportFile} disabled={!selected}>
            <Download className="h-4 w-4" />
            {t('logs.export', { defaultValue: 'Export' })}
          </Button>
        </div>

        {analysis && (
          <Card>
            <CardContent className="space-y-2 p-3 text-sm">
              <p className="font-medium">{analysis.summary}</p>
              {analysis.causes.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">
                  {t('logs.noCause', { defaultValue: 'No known crash signature detected.' })}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {analysis.causes.map((cause) => (
                    <div
                      key={cause.id}
                      className={cn('rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs', SEVERITY_STYLES[cause.severity])}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {cause.title}
                      </div>
                      <p className="mt-0.5 opacity-80">{cause.tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selected ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--text)_8%,transparent)]">
            <ScrollArea className="h-[52vh]">
              <pre className="min-w-full whitespace-pre-wrap break-words p-3 font-mono text-[11.5px] leading-relaxed text-[var(--text)]">
                {lines.join('\n')}
              </pre>
            </ScrollArea>
          </div>
        ) : (
          <EmptyState
            title={t('logs.emptyTitle', { defaultValue: 'No log selected' })}
            description={t('logs.emptyDesc', { defaultValue: 'Pick a log file on the left to inspect it.' })}
          />
        )}
      </div>
    </div>
  )
}
