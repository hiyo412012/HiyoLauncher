import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  File,
  FileArchive,
  FileText,
  Folder,
  FolderOpen,
  ImageIcon,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import type { InstanceFileEntry } from '@shared/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatBytes, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
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
import { Skeleton } from '@/components/ui/skeleton'

const MANAGED_DIRS = new Set(['mods', 'resourcepacks', 'shaderpacks', 'datapacks'])

function isManagedPath(path: string): boolean {
  const first = path.split('/').filter(Boolean)[0]
  return !!first && MANAGED_DIRS.has(first)
}

function iconFor(entry: InstanceFileEntry) {
  if (entry.isDirectory) return Folder
  const extension = entry.name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) return ImageIcon
  if (['zip', 'jar', 'mrpack', 'gz'].includes(extension)) return FileArchive
  if (['txt', 'log', 'json', 'toml', 'cfg', 'yml', 'yaml', 'md'].includes(extension)) return FileText
  return File
}

export default function FilesTab({ instanceId }: { instanceId: string }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [path, setPath] = useState('')
  const [renaming, setRenaming] = useState<InstanceFileEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<InstanceFileEntry | null>(null)

  const filesQuery = useQuery({
    queryKey: ['files', instanceId, path],
    queryFn: () => api.files.list(instanceId, path),
  })

  const managed = isManagedPath(path)
  const entries = filesQuery.data ?? []
  const crumbs = useMemo(() => path.split('/').filter(Boolean), [path])

  const uploadMutation = useMutation({
    mutationFn: () => api.files.import(instanceId, path),
    onSuccess: (imported: InstanceFileEntry[]) => {
      if (imported.length === 0) return
      qc.invalidateQueries({ queryKey: ['files', instanceId, path] })
      toast.success(
        t('files.uploaded', {
          count: imported.length,
          defaultValue: `Added ${imported.length} file(s)`,
        }),
      )
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not add files'),
  })

  const renameMutation = useMutation({
    mutationFn: ({ entry, name }: { entry: InstanceFileEntry; name: string }) =>
      api.files.rename(instanceId, entry.path, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files', instanceId, path] })
      setRenaming(null)
      toast.success(t('files.renamed', { defaultValue: 'Renamed' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not rename'),
  })

  const deleteMutation = useMutation({
    mutationFn: (entry: InstanceFileEntry) => api.files.trash(instanceId, entry.path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files', instanceId, path] })
      setDeleting(null)
      toast.success(t('files.trashed', { defaultValue: 'Moved to trash' }))
    },
    onError: (error: unknown) => toast.error((error as Error)?.message ?? 'Could not delete'),
  })

  const navigateInto = (entry: InstanceFileEntry) => {
    if (entry.isDirectory) {
      setPath(entry.path)
      return
    }
    void api.files.open(instanceId, entry.path)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--text)_10%,transparent)] bg-[var(--surface)] px-3 py-2 text-sm">
          <button
            type="button"
            className="shrink-0 font-medium text-[var(--accent)] hover:underline"
            onClick={() => setPath('')}
          >
            {t('files.instanceRoot', { defaultValue: 'Instance' })}
          </button>
          {crumbs.map((crumb, index) => {
            const target = crumbs.slice(0, index + 1).join('/')
            return (
              <React.Fragment key={target}>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                <button
                  type="button"
                  className={cn(
                    'shrink-0 rounded px-1 py-0.5 hover:bg-[var(--surface-2)]',
                    index === crumbs.length - 1 && 'font-medium text-[var(--text)]',
                  )}
                  onClick={() => setPath(target)}
                >
                  {crumb}
                </button>
              </React.Fragment>
            )
          })}
        </div>
        <Button variant="outline" size="sm" onClick={() => filesQuery.refetch()} disabled={filesQuery.isFetching}>
          <RefreshCw className={cn('h-4 w-4', filesQuery.isFetching && 'animate-spin')} />
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
        <Button variant="outline" size="sm" onClick={() => api.files.open(instanceId, path)}>
          <FolderOpen className="h-4 w-4" />
          {t('files.openFolder', { defaultValue: 'Open folder' })}
        </Button>
        <Button size="sm" onClick={() => uploadMutation.mutate()} disabled={managed || uploadMutation.isPending}>
          <Upload className="h-4 w-4" />
          {t('files.upload', { defaultValue: 'Add files' })}
        </Button>
      </div>

      {managed && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-xs text-[var(--warning)]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          {t('files.managedBanner', {
            defaultValue:
              'This folder is managed by the Content tab. Rename, upload and delete are disabled here to keep Modrinth metadata in sync.',
          })}
        </div>
      )}

      {filesQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-11 w-full rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title={t('files.emptyTitle', { defaultValue: 'This folder is empty' })}
          description={
            managed
              ? t('files.emptyManaged', { defaultValue: 'Install content from the Content tab.' })
              : t('files.emptyDesc', { defaultValue: 'Add files or create content in Minecraft.' })
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--text)_8%,transparent)]">
          <div className="hidden grid-cols-[1fr_110px_170px_40px] gap-3 border-b border-[color-mix(in_srgb,var(--text)_8%,transparent)] bg-[var(--surface-2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] md:grid">
            <span>{t('files.name', { defaultValue: 'Name' })}</span>
            <span>{t('files.size', { defaultValue: 'Size' })}</span>
            <span>{t('files.modified', { defaultValue: 'Modified' })}</span>
            <span />
          </div>
          {entries.map((entry) => {
            const Icon = iconFor(entry)
            const protectedEntry = entry.path === 'instance.json'
            return (
              <div
                key={entry.path}
                className="grid grid-cols-[1fr_40px] items-center gap-3 border-b border-[color-mix(in_srgb,var(--text)_6%,transparent)] px-4 py-2.5 text-sm last:border-b-0 hover:bg-[var(--surface-2)] md:grid-cols-[1fr_110px_170px_40px]"
                onDoubleClick={() => navigateInto(entry)}
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 text-left"
                  onClick={() => navigateInto(entry)}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      entry.isDirectory ? 'text-[var(--accent)]' : 'text-[var(--muted)]',
                    )}
                  />
                  <span className="truncate font-medium">{entry.name}</span>
                  {entry.managed && <Lock className="h-3 w-3 shrink-0 text-[var(--muted)]" />}
                </button>
                <span className="hidden text-xs text-[var(--muted)] md:block">
                  {entry.isDirectory ? '—' : formatBytes(entry.size)}
                </span>
                <span className="hidden text-xs text-[var(--muted)] md:block">
                  {formatDate(entry.modifiedAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('files.actions', { defaultValue: 'File actions' })}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => navigateInto(entry)}>
                      {entry.isDirectory ? <FolderOpen className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
                      {entry.isDirectory
                        ? t('files.open', { defaultValue: 'Open' })
                        : t('files.openDefault', { defaultValue: 'Open with default app' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => api.files.reveal(instanceId, entry.path)}>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      {t('files.reveal', { defaultValue: 'Show in folder' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenaming(entry)
                        setRenameValue(entry.name)
                      }}
                      disabled={entry.managed || managed || protectedEntry}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('files.rename', { defaultValue: 'Rename' })}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-[var(--danger)] focus:text-[var(--danger)]"
                      onSelect={() => setDeleting(entry)}
                      disabled={entry.managed || managed || protectedEntry}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete', { defaultValue: 'Delete' })}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('files.renameTitle', { defaultValue: 'Rename' })}</DialogTitle>
            <DialogDescription>
              {t('files.renameDesc', { defaultValue: 'The file extension is kept as part of the name.' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="file-name">{t('files.newName', { defaultValue: 'New name' })}</Label>
            <Input
              id="file-name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={255}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              disabled={!renameValue.trim() || renameValue === renaming?.name || renameMutation.isPending}
              onClick={() =>
                renaming && renameMutation.mutate({ entry: renaming, name: renameValue.trim() })
              }
            >
              {t('common.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('files.deleteTitle', { defaultValue: 'Move to trash?' })}</DialogTitle>
            <DialogDescription>
              {t('files.deleteDesc', { defaultValue: 'The item is moved to your system trash.' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting)}
            >
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
