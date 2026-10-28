import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app'
import { useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { NameDialog } from '@/components/ui/name-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Grid3X3, List, Plus, Search, MoreVertical, Play, FolderOpen, Copy, Wrench, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Instance, MinecraftVersionSummary, Loader } from '@shared/types'

const LOADERS: Loader[] = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']

export default function Instances() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { viewMode, setViewMode, setSelectedInstance } = useAppStore()
  const { createInstanceOpen, setCreateInstanceOpen } = useUiStore()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'recent' | 'created'>('recent')
  const [form, setForm] = useState({ name: '', mcVersion: '', loader: 'vanilla' as Loader, loaderVersion: '' })
  const [cloneSource, setCloneSource] = useState<Instance | null>(null)

  const instancesQuery = useQuery({ queryKey: ['instances'], queryFn: () => api.instances.list() })
  const versionsQuery = useQuery({ queryKey: ['versions'], queryFn: () => api.versions.list() })
  const loadersQuery = useQuery({
    queryKey: ['loaders', form.loader, form.mcVersion],
    queryFn: () => api.versions.loaders(form.loader, form.mcVersion),
    enabled: form.loader !== 'vanilla' && !!form.mcVersion,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.instances.create({
        name: form.name.trim(),
        mcVersion: form.mcVersion,
        loader: form.loader,
        loaderVersion: form.loaderVersion || undefined,
      }),
    onSuccess: (inst) => {
      setSelectedInstance(inst.id)
      setCreateInstanceOpen(false)
      setForm({ name: '', mcVersion: '', loader: 'vanilla', loaderVersion: '' })
      qc.invalidateQueries({ queryKey: ['instances'] })
      toast.success(t('instance.created', { defaultValue: 'Instance created' }))
    },
    onError: (e: unknown) => {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteFiles }: { id: string; deleteFiles: boolean }) =>
      api.instances.remove(id, deleteFiles),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  })

  const cloneMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) => api.instances.clone(id, newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  })

  const repairMutation = useMutation({
    mutationFn: (id: string) => api.instances.repair(id),
    onSuccess: () => toast.success(t('instance.repaired', { defaultValue: 'Repaired' })),
  })

  const launchMutation = useMutation({
    mutationFn: (id: string) => api.launch.start({ instanceId: id }),
    onError: (e: unknown) => {
      const err = e as { code?: string; message?: string }
      toast.error(`${err?.code ?? ''} ${err?.message ?? 'Launch failed'}`)
    },
  })

  const instances = instancesQuery.data ?? []
  const filtered = useMemo(() => {
    let list = instances.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'recent') list = [...list].sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    else list = [...list].sort((a, b) => b.createdAt - a.createdAt)
    return list
  }, [instances, search, sort])

  const groupedVersions = useMemo(() => {
    const releases = (versionsQuery.data ?? []).filter((v) => v.type === 'release').slice(0, 25)
    const snapshots = (versionsQuery.data ?? []).filter((v) => v.type === 'snapshot').slice(0, 10)
    return { releases, snapshots }
  }, [versionsQuery.data])

  useEffect(() => {
    const releases = (versionsQuery.data ?? []).filter((v) => v.type === 'release')
    if (!form.mcVersion && releases.length) setForm((f) => ({ ...f, mcVersion: releases[0].id }))
  }, [versionsQuery.data, form.mcVersion])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search', { defaultValue: 'Search...' })} className="pl-9" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{t('sort.recent', { defaultValue: 'Recent' })}</SelectItem>
            <SelectItem value="name">{t('sort.name', { defaultValue: 'Name' })}</SelectItem>
            <SelectItem value="created">{t('sort.created', { defaultValue: 'Created' })}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-[var(--ring)]/20 overflow-hidden">
          <button
            className={cn('px-3 py-2', viewMode === 'grid' && 'bg-[var(--accent)]/15')}
            onClick={() => setViewMode('grid')}
            aria-label="Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            className={cn('px-3 py-2', viewMode === 'list' && 'bg-[var(--accent)]/15')}
            onClick={() => setViewMode('list')}
            aria-label="List"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        <Dialog open={createInstanceOpen} onOpenChange={setCreateInstanceOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              {t('instance.create', { defaultValue: 'Create instance' })}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('instance.createTitle', { defaultValue: 'Create instance' })}</DialogTitle>
              <DialogDescription>{t('instance.createDesc', { defaultValue: 'Set up a new Minecraft instance.' })}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm">{t('instance.name', { defaultValue: 'Name' })}</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">{t('instance.mcVersion', { defaultValue: 'Minecraft version' })}</label>
                <Select value={form.mcVersion} onValueChange={(v) => setForm({ ...form, mcVersion: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-xs opacity-60">Release</div>
                    {groupedVersions.releases.map((v: MinecraftVersionSummary) => (
                      <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs opacity-60">Snapshot</div>
                    {groupedVersions.snapshots.map((v: MinecraftVersionSummary) => (
                      <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">{t('instance.loader', { defaultValue: 'Loader' })}</label>
                <Select value={form.loader} onValueChange={(v) => setForm({ ...form, loader: v as Loader })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOADERS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.loader !== 'vanilla' && (
                <div>
                  <label className="text-sm">{t('instance.loaderVersion', { defaultValue: 'Loader version' })}</label>
                  <Select value={form.loaderVersion} onValueChange={(v) => setForm({ ...form, loaderVersion: v })}>
                    <SelectTrigger><SelectValue placeholder={t('common.select', { defaultValue: 'Select' })} /></SelectTrigger>
                    <SelectContent>
                      {(loadersQuery.data ?? []).map((lv) => (
                        <SelectItem key={lv.version} value={lv.version}>{lv.version}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateInstanceOpen(false)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.name.trim() || !form.mcVersion || createMutation.isPending}
              >
                {createMutation.isPending ? t('common.creating', { defaultValue: 'Creating...' }) : t('common.create', { defaultValue: 'Create' })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {instancesQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Plus className="w-8 h-8" />}
          title={t('instance.emptyTitle', { defaultValue: 'No instances' })}
          description={t('instance.emptyDesc', { defaultValue: 'Create your first instance to get started.' })}
          action={<Button onClick={() => setCreateInstanceOpen(true)}>{t('instance.create', { defaultValue: 'Create instance' })}</Button>}
        />
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
          {filtered.map((inst) => (
            <Card key={inst.id} className="hover:bg-[var(--surface)]/80 transition">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{inst.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge>{inst.mcVersion}</Badge>
                    <Badge variant="secondary">{inst.loader}</Badge>
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => launchMutation.mutate(inst.id)}>
                      <Play className="w-4 h-4 mr-2" /> {t('common.play', { defaultValue: 'Play' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => api.instances.openFolder(inst.id)}>
                      <FolderOpen className="w-4 h-4 mr-2" /> {t('instance.openFolder', { defaultValue: 'Open folder' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCloneSource(inst)}>
                      <Copy className="w-4 h-4 mr-2" /> {t('instance.clone', { defaultValue: 'Clone' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => repairMutation.mutate(inst.id)}>
                      <Wrench className="w-4 h-4 mr-2" /> {t('instance.repair', { defaultValue: 'Repair' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-400"
                      onClick={() => {
                        if (window.confirm(t('instance.deleteConfirm', { defaultValue: 'Delete this instance?' }))) {
                          const delFiles = window.confirm(t('instance.deleteFilesConfirm', { defaultValue: 'Also delete files?' }))
                          deleteMutation.mutate({ id: inst.id, deleteFiles: delFiles })
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete', { defaultValue: 'Delete' })}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="text-xs opacity-70">
                  {inst.lastPlayedAt ? new Date(inst.lastPlayedAt).toLocaleString() : t('instance.neverPlayed', { defaultValue: 'Never played' })}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => { setSelectedInstance(inst.id); navigate(`/instances/${inst.id}`) }}>
                    {t('common.details', { defaultValue: 'Details' })}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => launchMutation.mutate(inst.id)}>
                    <Play className="w-3.5 h-3.5 mr-1" /> {t('common.play', { defaultValue: 'Play' })}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NameDialog
        open={!!cloneSource}
        onOpenChange={(open) => !open && setCloneSource(null)}
        title={t('instance.clone', { defaultValue: 'Clone instance' })}
        description={t('instance.cloneDesc', {
          defaultValue: 'Creates a copy with its own mods, configs and worlds.',
        })}
        label={t('instance.cloneName', { defaultValue: 'New instance name' })}
        defaultValue={cloneSource ? `${cloneSource.name} (copy)` : ''}
        confirmLabel={t('common.clone', { defaultValue: 'Clone' })}
        onConfirm={async (newName) => {
          if (!cloneSource) return
          await cloneMutation.mutateAsync({ id: cloneSource.id, newName })
          setCloneSource(null)
        }}
      />
    </div>
  )
}