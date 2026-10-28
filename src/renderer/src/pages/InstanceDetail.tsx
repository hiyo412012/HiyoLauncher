import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { Play, Square, Trash2, Wrench, FolderOpen, Pencil, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { Instance, InstalledContent, JavaInfo } from '@shared/types'

export default function InstanceDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { setSelectedInstance } = useAppStore()

  const instancesQuery = useQuery({ queryKey: ['instances'], queryFn: () => api.instances.list() })
  const instance = (instancesQuery.data ?? []).find((i) => i.id === id)

  const contentQuery = useQuery({
    queryKey: ['content', id],
    queryFn: () => api.content.list(id!),
    enabled: !!id,
  })

  const javaQuery = useQuery({ queryKey: ['java'], queryFn: () => api.java.detect() })

  useEffect(() => {
    if (id) setSelectedInstance(id)
  }, [id, setSelectedInstance])

  // form state
  const [name, setName] = useState('')
  const [memoryMb, setMemoryMb] = useState(4096)
  const [resW, setResW] = useState(854)
  const [resH, setResH] = useState(480)
  const [fullscreen, setFullscreen] = useState(false)
  const [javaPath, setJavaPath] = useState('')
  const [jvmArgs, setJvmArgs] = useState('')
  const [gameArgs, setGameArgs] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (instance) {
      setName(instance.name)
      setMemoryMb(instance.memoryMb ?? 4096)
      setResW(instance.resolution?.width ?? 854)
      setResH(instance.resolution?.height ?? 480)
      setFullscreen(instance.resolution?.fullscreen ?? false)
      setJavaPath(instance.javaPath ?? '')
      setJvmArgs((instance.jvmArgs ?? []).join(' '))
      setGameArgs((instance.gameArgs ?? []).join(' '))
      setEditName(instance.name)
    }
  }, [instance])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.instances.update(id!, {
        name,
        memoryMb,
        javaPath: javaPath || undefined,
        jvmArgs: jvmArgs.trim() ? jvmArgs.trim().split(/\s+/) : [],
        gameArgs: gameArgs.trim() ? gameArgs.trim().split(/\s+/) : [],
        resolution: { width: resW, height: resH, fullscreen },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] })
      toast.success(t('instance.saved', { defaultValue: 'Saved' }))
    },
    onError: (e: unknown) => {
      const err = e as { message?: string }
      toast.error(err?.message ?? 'Failed')
    },
  })

  const launchMutation = useMutation({
    mutationFn: () => api.launch.start({ instanceId: id! }),
    onError: (e: unknown) => {
      const err = e as { code?: string; message?: string }
      toast.error(`${err?.code ?? ''} ${err?.message ?? 'Launch failed'}`)
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => api.launch.stop(id!),
  })

  const repairMutation = useMutation({
    mutationFn: () => api.instances.repair(id!),
    onSuccess: () => toast.success(t('instance.repaired', { defaultValue: 'Repaired' })),
  })

  const deleteMutation = useMutation({
    mutationFn: (deleteFiles: boolean) => api.instances.remove(id!, deleteFiles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] })
      navigate('/instances')
    },
  })

  const contentPath = (c: InstalledContent) => {
    const folder =
      c.kind === 'mod'
        ? 'mods'
        : c.kind === 'resourcepack'
          ? 'resourcepacks'
          : c.kind === 'shader'
            ? 'shaderpacks'
            : 'datapacks'
    return `${folder}/${c.filename}`
  }

  const toggleMutation = useMutation({
    mutationFn: (c: InstalledContent) =>
      api.content.toggle({ instanceId: id!, path: contentPath(c), enabled: !c.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content', id] }),
  })

  const removeContentMutation = useMutation({
    mutationFn: (c: InstalledContent) =>
      api.content.remove({ instanceId: id!, path: contentPath(c) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content', id] }),
  })

  const [running, setRunning] = useState(false)
  // track running via game state
  React.useEffect(() => {
    const unsub = api.onGameState((s) => {
      if (s.instanceId === id) setRunning(s.phase === 'running' || s.phase === 'launching' || s.phase === 'downloading' || s.phase === 'preparing')
    })
    return unsub
  }, [id])

  if (!instance) {
    return <div className="opacity-70">{t('common.loading', { defaultValue: 'Loading...' })}</div>
  }

  const mods = (contentQuery.data ?? []).filter((c) => c.kind === 'mod')
  const resourcePacks = (contentQuery.data ?? []).filter((c) => c.kind === 'resourcepack')
  const shaders = (contentQuery.data ?? []).filter((c) => c.kind === 'shader')

  const renderContentList = (items: InstalledContent[], kindLabel: string, browseKind: string) => (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => navigate(`/browse?instance=${id}&kind=${browseKind}`)}>
          {t('content.browse', { defaultValue: 'Browse' })} {kindLabel}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title={t('content.emptyTitle', { defaultValue: 'No items' })}
          description={t('content.emptyDesc', { defaultValue: 'Nothing installed yet.' })}
        />
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.filename}</div>
                  <div className="text-xs opacity-70">{c.versionNumber ?? ''} {c.enabled ? '' : `(${t('content.disabled', { defaultValue: 'disabled' })})`}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={c.enabled} onCheckedChange={() => toggleMutation.mutate(c)} />
                  <Button variant="ghost" size="icon" onClick={() => removeContentMutation.mutate(c)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)]/40 to-[var(--surface)] flex items-center justify-center text-2xl font-bold">
            {instance.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{instance.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge>{instance.mcVersion}</Badge>
              <Badge variant="secondary">{instance.loader}</Badge>
              {instance.loaderVersion && <Badge variant="outline">{instance.loaderVersion}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('instance.edit', { defaultValue: 'Edit instance' })}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t('instance.name', { defaultValue: 'Name' })}</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <Label>{t('instance.icon', { defaultValue: 'Icon (data URL)' })}</Label>
                  <Input
                    placeholder="data:image/..."
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) api.instances.setIcon(instance.id, v).then(() => qc.invalidateQueries({ queryKey: ['instances'] }))
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
                <Button
                  onClick={() => {
                    api.instances.update(instance.id, { name: editName }).then(() => {
                      qc.invalidateQueries({ queryKey: ['instances'] })
                      setEditOpen(false)
                      toast.success(t('instance.saved', { defaultValue: 'Saved' }))
                    })
                  }}
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {running ? (
            <Button variant="destructive" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
              <Square className="w-4 h-4 mr-1" /> {t('common.stop', { defaultValue: 'Stop' })}
            </Button>
          ) : (
            <Button onClick={() => launchMutation.mutate()} disabled={launchMutation.isPending}>
              <Play className="w-4 h-4 mr-1" /> {launchMutation.isPending ? t('home.launching', { defaultValue: 'Launching...' }) : t('common.play', { defaultValue: 'Play' })}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('tab.overview', { defaultValue: 'Overview' })}</TabsTrigger>
          <TabsTrigger value="mods">{t('tab.mods', { defaultValue: 'Mods' })} ({mods.length})</TabsTrigger>
          <TabsTrigger value="resourcepacks">{t('tab.resourcePacks', { defaultValue: 'Resource packs' })}</TabsTrigger>
          <TabsTrigger value="shaders">{t('tab.shaders', { defaultValue: 'Shaders' })}</TabsTrigger>
          <TabsTrigger value="settings">{t('tab.settings', { defaultValue: 'Settings' })}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>{t('overview.details', { defaultValue: 'Details' })}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="opacity-70">MC</span><span>{instance.mcVersion}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Loader</span><span>{instance.loader} {instance.loaderVersion ?? ''}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Memory</span><span>{Math.round((instance.memoryMb ?? 4096) / 1024)}GB</span></div>
                <div className="flex justify-between"><span className="opacity-70">Last played</span><span>{instance.lastPlayedAt ? new Date(instance.lastPlayedAt).toLocaleString() : '-'}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Playtime</span><span>{Math.round(instance.playTimeMs / 60000)}m</span></div>
                <div className="flex justify-between"><span className="opacity-70">Mods</span><span>{mods.length}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t('overview.quickLinks', { defaultValue: 'Quick links' })}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/browse?instance=${id}&kind=mod`)}>
                  {t('overview.browseMods', { defaultValue: 'Browse mods' })}
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => api.instances.openFolder(id!)}>
                  <FolderOpen className="w-4 h-4 mr-2" /> {t('instance.openFolder', { defaultValue: 'Open folder' })}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mods">{renderContentList(mods, 'Mods', 'mod')}</TabsContent>
        <TabsContent value="resourcepacks">{renderContentList(resourcePacks, 'Resource packs', 'resourcepack')}</TabsContent>
        <TabsContent value="shaders">{renderContentList(shaders, 'Shaders', 'shader')}</TabsContent>

        <TabsContent value="settings">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader><CardTitle>{t('settings.memory', { defaultValue: 'Memory' })}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>{Math.round(memoryMb / 1024)} GB</span>
                </div>
                <Slider value={[memoryMb]} onValueChange={(v) => setMemoryMb(v[0])} min={1024} max={32768} step={512} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('settings.resolution', { defaultValue: 'Resolution' })}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Width</Label>
                    <Input type="number" value={resW} onChange={(e) => setResW(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Height</Label>
                    <Input type="number" value={resH} onChange={(e) => setResH(Number(e.target.value))} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={fullscreen} onCheckedChange={setFullscreen} />
                  <Label>{t('settings.fullscreen', { defaultValue: 'Fullscreen' })}</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('settings.java', { defaultValue: 'Java' })}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={javaPath} onChange={(e) => setJavaPath(e.target.value)} placeholder="/path/to/java" />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const p = await api.app.pickFile([{ name: 'Java', extensions: ['exe', ''] }])
                      if (p) setJavaPath(p)
                    }}
                  >
                    {t('common.browse', { defaultValue: 'Browse' })}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const j = (javaQuery.data ?? []).sort((a, b) => b.major - a.major)[0]
                      if (j) setJavaPath(j.path)
                    }}
                  >
                    {t('settings.detect', { defaultValue: 'Detect' })}
                  </Button>
                </div>
                {javaQuery.data && javaQuery.data.length > 0 && (
                  <div className="text-xs opacity-70">
                    {t('settings.detected', { defaultValue: 'Detected' })}: {javaQuery.data.map((j: JavaInfo) => `Java ${j.major}`).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('settings.jvmArgs', { defaultValue: 'JVM arguments' })}</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} rows={3} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('settings.gameArgs', { defaultValue: 'Game arguments' })}</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={gameArgs} onChange={(e) => setGameArgs(e.target.value)} rows={3} />
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save' })}
              </Button>
            </div>

            <Card className="border-red-500/30">
              <CardHeader><CardTitle className="text-red-400">{t('settings.dangerZone', { defaultValue: 'Danger zone' })}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" onClick={() => repairMutation.mutate()} disabled={repairMutation.isPending}>
                  <Wrench className="w-4 h-4 mr-2" /> {t('instance.repair', { defaultValue: 'Repair' })}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm(t('instance.deleteConfirm', { defaultValue: 'Delete this instance?' }))) {
                      const delFiles = window.confirm(t('instance.deleteFilesConfirm', { defaultValue: 'Also delete files?' }))
                      deleteMutation.mutate(delFiles)
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete', { defaultValue: 'Delete' })}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}