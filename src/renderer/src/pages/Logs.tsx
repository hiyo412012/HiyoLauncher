import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Copy, Download, FileText, RefreshCw, Search, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import type { CrashCause, LogFileInfo } from '@shared/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatBytes, formatRelativeTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ScrollArea } from '@/components/ui/scroll-area'

const SEVERITY_STYLES: Record<CrashCause['severity'], string> = {
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  error: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  fatal: 'border-rose-500/40 bg-rose-500/15 text-rose-100',
}

export default function Logs() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [instanceId, setInstanceId] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [wrap, setWrap] = useState(false)
  const [analysis, setAnalysis] = useState<{ summary: string; causes: CrashCause[] } | null>(null)

  const instancesQuery = useQuery({ queryKey: ['instances'], queryFn: () => api.instances.list() })
  const instances = instancesQuery.data ?? []

  const logsQuery = useQuery({
    queryKey: ['logs', instanceId],
    queryFn: () => api.logs.list(instanceId === 'all' ? undefined : instanceId),
  })
  const logs = logsQuery.data ?? []

  useEffect(() => {
    if (!logs.length) {
      setSelected(null)
      return
    }
    if (!selected || !logs.some((l) => l.path === selected)) {
      setSelected(logs[0].path)
    }
  }, [logs, selected])

  const fileQuery = useQuery({
    queryKey: ['log-content', selected],
    queryFn: () => (selected ? api.logs.read(selected, 2000) : Promise.resolve('')),
    enabled: !!selected,
    refetchInterval: autoRefresh ? 3000 : false,
  })

  const text = fileQuery.data ?? ''
  const lines = useMemo(() => {
    const all = text.split(/\r?\n/)
    if (!filter.trim()) return all
    const needle = filter.toLowerCase()
    return all.filter((l) => l.toLowerCase().includes(needle))
  }, [text, filter])

  const selectedInfo = logs.find((l) => l.path === selected)

  const analyze = async () => {
    if (!selected) return
    try {
      const result = await api.logs.analyze(selected)
      setAnalysis(result)
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not analyze log')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('logs.copied', { defaultValue: 'Log copied to clipboard' }))
    } catch {
      toast.error('Clipboard unavailable')
    }
  }

  const exportFile = async () => {
    if (!selected) return
    try {
      const content = await api.logs.export(selected)
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selected.split(/[\\/]/).pop() || 'log.txt'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not export log')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('nav.logs', { defaultValue: 'Logs' })}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t('logs.subtitle', {
              defaultValue: 'Live logs, crash reports and one-click diagnosis.',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('logs.allInstances', { defaultValue: 'All instance logs' })}
              </SelectItem>
              {instances.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void logsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {logsQuery.isLoading ? (
        <Skeleton className="h-[520px] rounded-xl" />
      ) : !logs.length ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={t('logs.emptyTitle', { defaultValue: 'No logs yet' })}
          description={t('logs.emptyBody', {
            defaultValue: 'Launch the game once and its log will appear here.',
          })}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardContent className="p-2">
              <ScrollArea className="h-[520px]">
                <div className="space-y-1">
                  {logs.map((log) => (
                    <button
                      key={log.path}
                      onClick={() => {
                        setSelected(log.path)
                        setAnalysis(null)
                      }}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        selected === log.path
                          ? 'bg-[var(--surface-2)] text-[var(--text)]'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-2)]/60',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {log.instanceId
                            ? `${instances.find((i) => i.id === log.instanceId)?.name ?? log.instanceId} · `
                            : ''}
                          {log.path.split(/[\\/]/).slice(-1)[0]}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
                        <span>{formatBytes(log.size)}</span>
                        <span>{formatRelativeTime(log.modifiedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t('logs.filter', { defaultValue: 'Filter lines…' })}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={analyze}>
                <Stethoscope className="mr-2 h-4 w-4" />
                {t('logs.analyze', { defaultValue: 'Analyze' })}
              </Button>
              <Button variant="outline" size="icon" onClick={copy} title="Copy">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={exportFile} title="Export">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
              <label className="flex items-center gap-2">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                {t('logs.autoRefresh', { defaultValue: 'Auto refresh' })}
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={wrap} onCheckedChange={setWrap} />
                {t('logs.wrap', { defaultValue: 'Wrap lines' })}
              </label>
              <span>
                {lines.length} / {text.split(/\r?\n/).length} lines
                {selectedInfo ? ` • ${formatBytes(selectedInfo.size)}` : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void qc.invalidateQueries({ queryKey: ['log-content', selected] })}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {t('common.refresh', { defaultValue: 'Refresh' })}
              </Button>
            </div>

            {analysis && (
              <Card className="border-[var(--accent)]/30">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--warning)]" />
                    <div>
                      <p className="font-medium">{analysis.summary}</p>
                      {!analysis.causes.length && (
                        <p className="text-sm text-[var(--muted)]">
                          {t('logs.noKnownCause', {
                            defaultValue: 'No known pattern found in this log.',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  {analysis.causes.map((cause) => (
                    <div
                      key={cause.id}
                      className={cn('rounded-lg border p-3 text-sm', SEVERITY_STYLES[cause.severity])}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        {cause.title}
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {cause.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 opacity-90">{cause.tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[430px]">
                  <pre
                    className={cn(
                      'p-4 font-mono text-[11.5px] leading-relaxed text-[var(--text)]',
                      wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                    )}
                  >
                    {lines.length ? lines.join('\n') : t('logs.noMatch', { defaultValue: 'No matching lines.' })}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
