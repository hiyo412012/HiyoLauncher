import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ClipboardCopy, FolderOpen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ScreenshotEntry } from '@shared/types'
import { api } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

function screenshotUrl(instanceId: string, file: string): string {
  return `hiyo-shot://instance/${instanceId}/${encodeURIComponent(file)}`
}

export default function ScreenshotsTab({ instanceId }: { instanceId: string }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<ScreenshotEntry | null>(null)

  const shotsQuery = useQuery({
    queryKey: ['screenshots', instanceId],
    queryFn: () => api.screenshots.list(instanceId),
  })

  const copyMutation = useMutation({
    mutationFn: (shot: ScreenshotEntry) => api.screenshots.copy(instanceId, shot.file),
    onSuccess: () => toast.success(t('screenshots.copied', { defaultValue: 'Screenshot copied' })),
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not copy screenshot'),
  })

  const deleteMutation = useMutation({
    mutationFn: (shot: ScreenshotEntry) => api.screenshots.trash(instanceId, shot.file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screenshots', instanceId] })
      setSelected(null)
      toast.success(t('screenshots.deleted', { defaultValue: 'Screenshot moved to trash' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not delete screenshot'),
  })

  const shots = shotsQuery.data ?? []

  if (shotsQuery.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="aspect-video w-full rounded-[var(--radius-lg)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-[var(--muted)]">
          {t('screenshots.count', {
            count: shots.length,
            defaultValue: `${shots.length} screenshots`,
          })}
        </div>
        <Button variant="outline" size="sm" onClick={() => api.files.open(instanceId, 'screenshots')}>
          <FolderOpen className="h-4 w-4" />
          {t('screenshots.openFolder', { defaultValue: 'Open folder' })}
        </Button>
      </div>

      {shots.length === 0 ? (
        <EmptyState
          title={t('screenshots.emptyTitle', { defaultValue: 'No screenshots yet' })}
          description={t('screenshots.emptyDesc', {
            defaultValue: 'Press F2 in Minecraft to capture a screenshot. It will show up here.',
          })}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {shots.map((shot) => (
            <button
              key={shot.file}
              type="button"
              onClick={() => setSelected(shot)}
              className="group relative aspect-video overflow-hidden rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--text)_10%,transparent)] bg-[var(--surface-2)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <img
                src={screenshotUrl(instanceId, shot.file)}
                alt={shot.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-[11px] font-medium text-white">
                {formatDate(shot.createdAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl overflow-hidden p-0">
          <DialogTitle className="sr-only">{selected?.name ?? 'Screenshot'}</DialogTitle>
          {selected && (
            <>
              <div className="flex max-h-[70vh] items-center justify-center bg-black">
                <img
                  src={screenshotUrl(instanceId, selected.file)}
                  alt={selected.name}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{selected.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {formatDate(selected.createdAt, i18n.language)} · {formatBytes(selected.sizeBytes)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyMutation.mutate(selected)}
                  disabled={copyMutation.isPending}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {t('common.copy', { defaultValue: 'Copy' })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => api.files.reveal(instanceId, `screenshots/${selected.file}`)}
                >
                  <FolderOpen className="h-4 w-4" />
                  {t('screenshots.reveal', { defaultValue: 'Show in folder' })}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[var(--danger)]"
                  onClick={() => deleteMutation.mutate(selected)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete', { defaultValue: 'Delete' })}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
