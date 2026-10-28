import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  Clock,
  FolderOpen,
  Globe,
  HardDrive,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WorldBackupProgress, WorldSummary } from '@shared/types'
import { api } from '@/lib/api'
import { formatBytes, formatDate, formatRelativeTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export default function WorldsTab({ instanceId, running }: { instanceId: string; running: boolean }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState<WorldSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<WorldSummary | null>(null)
  const [backupFirst, setBackupFirst] = useState(true)
  const [backupsFor, setBackupsFor] = useState<WorldSummary | null>(null)
  const [progress, setProgress] = useState<WorldBackupProgress | null>(null)

  const worldsQuery = useQuery({
    queryKey: ['worlds', instanceId],
    queryFn: () => api.worlds.list(instanceId),
  })
  const backupsQuery = useQuery({
    queryKey: ['worldBackups', instanceId],
    queryFn: () => api.worlds.backups(instanceId),
  })

  useEffect(() => {
    const unsubscribe = api.onWorldBackupProgress((payload) => {
      if (payload.instanceId !== instanceId) return
      setProgress(payload)
      if (payload.total > 0 && payload.current >= payload.total) {
        window.setTimeout(() => setProgress(null), 1200)
      }
    })
    return unsubscribe
  }, [instanceId])

  const playMutation = useMutation({
    mutationFn: (world: WorldSummary) =>
      api.launch.start({
        instanceId,
        quickPlay: { type: 'singleplayer', value: world.folder },
      }),
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not launch world'),
  })

  const backupMutation = useMutation({
    mutationFn: (world: WorldSummary) => api.worlds.backup(instanceId, world.folder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worldBackups', instanceId] })
      toast.success(t('worlds.backupCreated', { defaultValue: 'Backup created' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Backup failed'),
  })

  const renameMutation = useMutation({
    mutationFn: ({ world, name }: { world: WorldSummary; name: string }) =>
      api.worlds.rename(instanceId, world.folder, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worlds', instanceId] })
      setRenaming(null)
      toast.success(t('worlds.renamed', { defaultValue: 'World renamed' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Rename failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ world, backup }: { world: WorldSummary; backup: boolean }) =>
      api.worlds.remove(instanceId, world.folder, backup),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worlds', instanceId] })
      qc.invalidateQueries({ queryKey: ['worldBackups', instanceId] })
      setDeleting(null)
      toast.success(t('worlds.deleted', { defaultValue: 'World moved to trash' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not delete world'),
  })

  const restoreMutation = useMutation({
    mutationFn: (file: string) => api.worlds.restore(instanceId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worlds', instanceId] })
      qc.invalidateQueries({ queryKey: ['worldBackups', instanceId] })
      toast.success(t('worlds.restored', { defaultValue: 'World restored' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Restore failed'),
  })

  const deleteBackupMutation = useMutation({
    mutationFn: (file: string) => api.worlds.removeBackup(instanceId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worldBackups', instanceId] })
      toast.success(t('worlds.backupDeleted', { defaultValue: 'Backup deleted' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not delete backup'),
  })

  const worlds = worldsQuery.data ?? []
  const backups = backupsQuery.data ?? []
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return worlds
    return worlds.filter((world) => world.name.toLowerCase().includes(needle))
  }, [worlds, search])

  const backupsOf = (folder: string) => backups.filter((backup) => backup.world === folder)

  if (worldsQuery.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-20 w-full rounded-[var(--radius-lg)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('worlds.search', { defaultValue: 'Search worlds' })}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => api.files.open(instanceId, 'saves')}>
          <FolderOpen className="h-4 w-4" />
          {t('worlds.openFolder', { defaultValue: 'Open saves folder' })}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={t('worlds.emptyTitle', { defaultValue: 'No worlds yet' })}
          description={
            search
              ? t('worlds.noResults', { defaultValue: 'No worlds match your search.' })
              : t('worlds.emptyDesc', {
                  defaultValue: 'Worlds appear here after you create or download one in Minecraft.',
                })
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((world) => {
            const worldBackups = backupsOf(world.folder)
            const active =
              progress &&
              (progress.world === world.folder || (!progress.world && progress.phase === 'extract'))
            return (
              <Card key={world.folder} className="overflow-hidden">
                <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{world.name}</span>
                      {world.hardcore && (
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--danger)]">
                          {t('worlds.hardcore', { defaultValue: 'Hardcore' })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                      {world.version && <span>MC {world.version}</span>}
                      {world.gameMode && <span>{world.gameMode}</span>}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {world.lastPlayedAt
                          ? formatRelativeTime(world.lastPlayedAt, i18n.language)
                          : t('worlds.neverPlayed', { defaultValue: 'Never played' })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(world.sizeBytes)}
                      </span>
                      {worldBackups.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Archive className="h-3 w-3" />
                          {t('worlds.backupCount', {
                            count: worldBackups.length,
                            defaultValue: `${worldBackups.length} backups`,
                          })}
                        </span>
                      )}
                    </div>
                    {active && progress && (
                      <div className="mt-2 max-w-sm space-y-1">
                        <Progress
                          value={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                        />
                        <div className="text-[11px] text-[var(--muted)]">
                          {progress.phase === 'compress'
                            ? t('worlds.backingUp', { defaultValue: 'Creating backup…' })
                            : t('worlds.restoring', { defaultValue: 'Restoring world…' })}{' '}
                          {progress.total > 0
                            ? `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`
                            : formatBytes(progress.current)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => playMutation.mutate(world)}
                      disabled={running || playMutation.isPending}
                      title={running ? t('worlds.stopFirst', { defaultValue: 'Stop the game first' }) : undefined}
                    >
                      <Play className="h-4 w-4" />
                      {t('common.play', { defaultValue: 'Play' })}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('worlds.actions', { defaultValue: 'World actions' })}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onSelect={() => {
                            setRenaming(world)
                            setRenameValue(world.name)
                          }}
                          disabled={running}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('worlds.rename', { defaultValue: 'Rename world' })}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => backupMutation.mutate(world)}
                          disabled={running || backupMutation.isPending}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          {t('worlds.backup', { defaultValue: 'Create backup' })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setBackupsFor(world)}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          {t('worlds.backups', { defaultValue: 'Backups' })} ({worldBackups.length})
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => api.files.open(instanceId, `saves/${world.folder}`)}>
                          <FolderOpen className="mr-2 h-4 w-4" />
                          {t('worlds.openWorldFolder', { defaultValue: 'Open world folder' })}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-[var(--danger)] focus:text-[var(--danger)]"
                          onSelect={() => {
                            setDeleting(world)
                            setBackupFirst(true)
                          }}
                          disabled={running}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('worlds.delete', { defaultValue: 'Delete world' })}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('worlds.rename', { defaultValue: 'Rename world' })}</DialogTitle>
            <DialogDescription>
              {t('worlds.renameDesc', {
                defaultValue: 'This only changes the display name inside level.dat. The folder stays the same.',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="world-name">{t('worlds.name', { defaultValue: 'World name' })}</Label>
            <Input
              id="world-name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={64}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              disabled={!renameValue.trim() || renameMutation.isPending}
              onClick={() => renaming && renameMutation.mutate({ world: renaming, name: renameValue.trim() })}
            >
              {t('common.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('worlds.deleteTitle', { defaultValue: 'Delete world?' })}</DialogTitle>
            <DialogDescription>
              {t('worlds.deleteDesc', {
                defaultValue: 'The world folder is moved to your system trash.',
              })}
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--text)_10%,transparent)] p-3 text-sm">
            <Checkbox
              checked={backupFirst}
              onCheckedChange={(value) => setBackupFirst(value === true)}
              className="mt-0.5"
            />
            <span>
              {t('worlds.backupBeforeDelete', { defaultValue: 'Create a backup before deleting' })}
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {t('worlds.backupBeforeDeleteHint', {
                  defaultValue: 'Recommended. The backup stays in the instance backups folder.',
                })}
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate({ world: deleting, backup: backupFirst })}
            >
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!backupsFor} onOpenChange={(open) => !open && setBackupsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('worlds.backupsFor', { defaultValue: 'Backups of {{name}}', name: backupsFor?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>
              {t('worlds.backupsDesc', {
                defaultValue: 'Restoring replaces the current world after creating a safety backup.',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-auto">
            {backupsFor && backupsOf(backupsFor.folder).length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--muted)]">
                {t('worlds.noBackups', { defaultValue: 'No backups yet.' })}
              </p>
            )}
            {backupsFor &&
              backupsOf(backupsFor.folder).map((backup) => (
                <div
                  key={backup.file}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--text)_8%,transparent)] px-3 py-2"
                >
                  <Archive className="h-4 w-4 text-[var(--accent)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {formatDate(backup.createdAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{formatBytes(backup.sizeBytes)}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={running || restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(backup.file)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('worlds.restore', { defaultValue: 'Restore' })}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleteBackupMutation.isPending}
                    onClick={() => deleteBackupMutation.mutate(backup.file)}
                    aria-label={t('worlds.deleteBackup', { defaultValue: 'Delete backup' })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupsFor(null)}>
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
