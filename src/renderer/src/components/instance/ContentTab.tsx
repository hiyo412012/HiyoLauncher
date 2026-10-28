import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Boxes, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { InstalledContent } from '@shared/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

type KindFilter = 'all' | InstalledContent['kind']

const KIND_KEY: Record<InstalledContent['kind'], string> = {
  mod: 'content.kinds.mods',
  resourcepack: 'content.kinds.resourcePacks',
  shader: 'content.kinds.shaders',
  datapack: 'content.kinds.datapacks',
}

function contentPath(content: InstalledContent): string {
  const folder =
    content.kind === 'mod'
      ? 'mods'
      : content.kind === 'resourcepack'
        ? 'resourcepacks'
        : content.kind === 'shader'
          ? 'shaderpacks'
          : 'datapacks'
  return `${folder}/${content.filename}`
}

export default function ContentTab({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [kind, setKind] = useState<KindFilter>('all')
  const [search, setSearch] = useState('')

  const contentQuery = useQuery({
    queryKey: ['content', instanceId],
    queryFn: () => api.content.list(instanceId),
  })

  const toggleMutation = useMutation({
    mutationFn: (content: InstalledContent) =>
      api.content.toggle({
        instanceId,
        path: contentPath(content),
        enabled: !content.enabled,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content', instanceId] }),
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not update content'),
  })

  const removeMutation = useMutation({
    mutationFn: (content: InstalledContent) =>
      api.content.remove({ instanceId, path: contentPath(content) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content', instanceId] }),
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not remove content'),
  })

  const items = contentQuery.data ?? []
  const counts = useMemo(
    () => ({
      all: items.length,
      mod: items.filter((item) => item.kind === 'mod').length,
      resourcepack: items.filter((item) => item.kind === 'resourcepack').length,
      shader: items.filter((item) => item.kind === 'shader').length,
      datapack: items.filter((item) => item.kind === 'datapack').length,
    }),
    [items],
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items
      .filter((item) => kind === 'all' || item.kind === kind)
      .filter(
        (item) =>
          !needle ||
          item.filename.toLowerCase().includes(needle) ||
          (item.versionNumber ?? '').toLowerCase().includes(needle),
      )
  }, [items, kind, search])

  if (contentQuery.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-16 w-full rounded-[var(--radius-lg)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('content.search', { defaultValue: 'Search content' })}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => navigate(`/browse?instance=${instanceId}&kind=mod`)}>
          <Plus className="h-4 w-4" />
          {t('content.add', { defaultValue: 'Add content' })}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'mod', 'resourcepack', 'shader', 'datapack'] as KindFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors',
              kind === value
                ? 'border-transparent bg-[var(--accent)] text-[var(--bg)]'
                : 'border-[color-mix(in_srgb,var(--text)_12%,transparent)] text-[var(--muted)] hover:text-[var(--text)]',
            )}
          >
            {value === 'all'
              ? t('common.all', { defaultValue: 'All' })
              : t(KIND_KEY[value])}
            <span className="opacity-70">{counts[value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={t('content.emptyTitle', { defaultValue: 'No content yet' })}
          description={
            search
              ? t('content.noResults', { defaultValue: 'No content matches your search.' })
              : t('content.emptyDesc', { defaultValue: 'Install mods, resource packs or shaders from Modrinth.' })
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((content) => (
            <Card key={content.id} className="overflow-hidden">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
                  <Boxes className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-sm font-medium', !content.enabled && 'opacity-60')}>
                    {content.filename}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {[content.versionNumber, t(KIND_KEY[content.kind]), content.enabled ? null : t('content.disabled', { defaultValue: 'disabled' })]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <Switch
                  checked={content.enabled}
                  onCheckedChange={() => toggleMutation.mutate(content)}
                  aria-label={t('content.toggle', { defaultValue: 'Enable content' })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate(content)}
                  aria-label={t('common.remove', { defaultValue: 'Remove' })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
