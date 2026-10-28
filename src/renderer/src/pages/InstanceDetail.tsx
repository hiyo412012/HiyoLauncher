import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import ContentTab from '@/components/instance/ContentTab'
import WorldsTab from '@/components/instance/WorldsTab'
import ScreenshotsTab from '@/components/instance/ScreenshotsTab'
import FilesTab from '@/components/instance/FilesTab'
import InstanceLogsTab from '@/components/instance/InstanceLogsTab'
import { formatDate, formatPlaytime, formatRelativeTime } from '@/lib/format'
import {
  Boxes,
  Clock,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  Pencil,
  Play,
  Settings as SettingsIcon,
  Square,
  Terminal,
  Timer,
  Trash2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Instance, JavaInfo } from '@shared/types'

export default function InstanceDetail() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { setSelectedInstance } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'overview'
  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    setSearchParams(next, { replace: true })
  }

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

  const [running, setRunning] = useState(false)
  // track running via game state
  React.useEffect(() => {
    let active = true
    api.launch
      .status()
      .then((states) => {
        if (active) setRunning(states.some((state) => state.instanceId === id))
      })
      .catch(() => {})
    const unsub = api.onGameState((s) => {
      if (s.instanceId === id)
        setRunning(
          s.phase === 'running' ||
            s.phase === 'launching' ||
            s.phase === 'downloading' ||
            s.phase === 'preparing',
        )
    })
    return () => {
      active = false
      unsub()
    }
  }, [id])

  if (!instance) {
    return <div className="opacity-70">{t('common.loading', { defaultValue: 'Loading...' })}</div>
  }

  const contentItems = contentQuery.data ?? []
  const modCount = contentItems.filter((item) => item.kind === 'mod').length
  const tabs = [
    { value: 'overview', label: t('tab.overview', { defaultValue: 'Overview' }), icon: LayoutDashboard },
    { value: 'content', label: t('tab.content', { defaultValue: 'Content' }), icon: Boxes },
    { value: 'worlds', label: t('tab.worlds', { defaultValue: 'Worlds' }), icon: Globe },
    { value: 'screenshots', label: t('tab.screenshots', { defaultValue: 'Screenshots' }), icon: ImageIcon },
    { value: 'files', label: t('tab.files', { defaultValue: 'Files' }), icon: FolderOpen },
    { value: 'logs', label: t('tab.logs', { defaultValue: 'Logs' }), icon: Terminal },
    { value: 'settings', label: t('tab.settings', { defaultValue: 'Settings' }), icon: SettingsIcon },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-2xl)] bg-gradient-to-br from-[color-mix(in_srgb,var(--accent)_40%,transparent)] to-[var(--surface)] text-2xl font-bold">
            {instance.icon ? (
              <img src={instance.icon} alt="" className="h-full w-full object-cover" />
            ) : (
              instance.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{instance.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{instance.mcVersion}</Badge>
              <Badge variant="secondary">{instance.loader}</Badge>
              {instance.loaderVersion && <Badge variant="outline">{instance.loaderVersion}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" />
                {formatPlaytime(instance.playTimeMs)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {instance.lastPlayedAt
                  ? formatRelativeTime(instance.lastPlayedAt, i18n.language)
                  : t('instance.neverPlayed', { defaultValue: 'Never played' })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Boxes className="h-3.5 w-3.5" />
                {t('instance.modCount', { count: modCount, defaultValue: `${modCount} mods` })}
              </span>
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
          <Button variant="outline" size="icon" onClick={() => api.instances.openFolder(instance.id)} aria-label={t('instance.openFolder', { defaultValue: 'Open folder' })}>
            <FolderOpen className="w-4 h-4" />
          </Button>
          {running ? (
            <Button variant="destructive" size="lg" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
              <Square className="w-4 h-4" /> {t('common.stop', { defaultValue: 'Stop' })}
            </Button>
          ) : (
            <Button size="lg" onClick={() => launchMutation.mutate()} disabled={launchMutation.isPending}>
              <Play className="w-4 h-4" /> {launchMutation.isPending ? t('home.launching', { defaultValue: 'Launching...' }) : t('common.play', { defaultValue: 'Play' })}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-fit max-w-full justify-start overflow-x-auto rounded-full bg-[var(--surface-2)] p-1">
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="gap-2 rounded-full px-3.5 py-2 data-[state=active]:bg-[var(--accent)] data-[state=active]:text-[var(--bg)]"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>{t('overview.details', { defaultValue: 'Details' })}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="opacity-70">MC</span><span>{instance.mcVersion}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Loader</span><span>{instance.loader} {instance.loaderVersion ?? ''}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Memory</span><span>{Math.round((instance.memoryMb ?? 4096) / 1024)}GB</span></div>
                <div className="flex justify-between"><span className="opacity-70">Last played</span><span>{instance.lastPlayedAt ? formatDate(instance.lastPlayedAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Playtime</span><span>{formatPlaytime(instance.playTimeMs)}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Mods</span><span>{modCount}</span></div>
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

        <TabsContent value="content" className="mt-4">
          <ContentTab instanceId={id!} />
        </TabsContent>

        <TabsContent value="worlds" className="mt-4">
          <WorldsTab instanceId={id!} running={running} />
        </TabsContent>

        <TabsContent value="screenshots" className="mt-4">
          <ScreenshotsTab instanceId={id!} />
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <FilesTab instanceId={id!} />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <InstanceLogsTab instanceId={id!} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
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