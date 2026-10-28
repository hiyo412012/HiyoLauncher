import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api as hiyoApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme/ThemeProvider'
import * as ThemeModule from '@/components/theme/ThemeProvider'
import { useAppStore } from '@/stores/app'
import * as StoreModule from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ThemePicker } from '@/components/settings/ThemePicker'
import { JavaPicker } from '@/components/settings/JavaPicker'
import { SettingsSection } from '@/components/settings/SettingsSection'
import type { Account, Settings, CrashCause } from '@shared/types'
import * as Lucide from 'lucide-react'

const _api: any = hiyoApi ?? (window as any).hiyo
const _useTheme: any = (ThemeModule as any).useTheme ?? (window as any).__useTheme
const _useAppStore: any = (StoreModule as any).useAppStore ?? (window as any).__useAppStore

const SECTIONS = [
  { id: 'appearance', labelKey: 'settings.appearance', fallback: 'Appearance' },
  { id: 'game', labelKey: 'settings.game', fallback: 'Game' },
  { id: 'accounts', labelKey: 'settings.accounts', fallback: 'Accounts' },
  { id: 'integrations', labelKey: 'settings.integrations', fallback: 'Integrations' },
  { id: 'advanced', labelKey: 'settings.advanced', fallback: 'Advanced' },
  { id: 'about', labelKey: 'settings.about', fallback: 'About' },
]

export default function Settings() {
  const { t, i18n } = useTranslation()
  const theme = _useTheme ? _useTheme() : {}
  const refreshTheme = theme?.refresh
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [section, setSection] = useState('appearance')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => _api.settings.get(),
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => _api.accounts.list(),
  })

  const { data: appInfo } = useQuery({
    queryKey: ['appInfo'],
    queryFn: () => _api.app.info(),
  })

  const updateMutation = useMutation({
    mutationFn: (patch: any) => _api.settings.update(patch),
    onSuccess: (data: Settings) => {
      qc.setQueryData(['settings'], data)
      if (refreshTheme) refreshTheme()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Update failed'),
  })

  const update = (patch: any) => updateMutation.mutate(patch)

  useEffect(() => {
    if (settings?.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language)
    }
  }, [settings?.language])

  // device code
  const [deviceCode, setDeviceCode] = useState<any>(null)
  const [msLoading, setMsLoading] = useState(false)
  const [msDialogOpen, setMsDialogOpen] = useState(false)

  useEffect(() => {
    const unsub = _api.onAuthDeviceCode?.((info: any) => {
      setDeviceCode(info)
      setMsDialogOpen(true)
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  const handleMsLogin = async () => {
    setMsLoading(true)
    setMsDialogOpen(true)
    try {
      const acc = await _api.accounts.msLogin()
      if (acc) {
        toast.success('Logged in')
        qc.invalidateQueries({ queryKey: ['accounts'] })
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Login failed')
    } finally {
      setMsLoading(false)
      setDeviceCode(null)
    }
  }

  const handleOfflineAdd = async (name: string) => {
    try {
      await _api.accounts.addOffline(name)
      toast.success('Account added')
      qc.invalidateQueries({ queryKey: ['accounts'] })
      return true
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed')
      return false
    }
  }

  const handleRemoveAccount = async (id: string) => {
    try {
      await _api.accounts.remove(id)
      toast.success('Removed')
      qc.invalidateQueries({ queryKey: ['accounts'] })
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed')
    }
  }

  // updater
  const [updaterStatus, setUpdaterStatus] = useState<any>(null)
  useEffect(() => {
    const unsub = _api.onUpdaterStatus?.((s: any) => setUpdaterStatus(s))
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  const handleUpdaterCheck = async () => {
    try {
      const s = await _api.misc.updaterCheck()
      setUpdaterStatus(s)
    } catch (e: any) {
      toast.error(e?.message ?? 'Check failed')
    }
  }

  const handleUpdaterDownload = async () => {
    try { await _api.misc.updaterDownload() } catch (e: any) { toast.error(e?.message ?? 'Download failed') }
  }
  const handleUpdaterInstall = async () => {
    try { await _api.misc.updaterInstall() } catch (e: any) { toast.error(e?.message ?? 'Install failed') }
  }

  // discord toggle handler
  const handleDiscordToggle = (enabled: boolean) => {
    update({ discordRpc: enabled })
    _api.misc.discordSet(enabled).catch((e: any) => toast.error(e?.message ?? 'Failed'))
  }

  // suggest memory
  const suggestMemory = () => {
    const devMem = (navigator as any).deviceMemory
    const gb = devMem ? devMem : 8
    const suggested = Math.min(Math.max(Math.round((gb * 1024) / 2), 2048), 8192)
    update({ defaultMemoryMb: suggested })
  }

  // offline dialog state
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [offlineName, setOfflineName] = useState('')
  const [removeAccId, setRemoveAccId] = useState<string | null>(null)

  const [resetOpen, setResetOpen] = useState(false)

  // device code copy
  const copyCode = () => {
    if (deviceCode?.userCode) {
      navigator.clipboard.writeText(deviceCode.userCode).then(() => toast.success('Copied'))
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const s = settings as Settings

  return (
    <div className="flex h-full">
      <nav className="hidden w-56 shrink-0 border-r p-4 md:block">
        <div className="space-y-1">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setSection(sec.id)}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                section === sec.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              )}
            >
              {t(sec.labelKey, { defaultValue: sec.fallback })}
            </button>
          ))}
        </div>
      </nav>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-8 p-6">
          {/* mobile section select */}
          <div className="md:hidden">
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SECTIONS.map((sec) => (
                  <SelectItem key={sec.id} value={sec.id}>{t(sec.labelKey, { defaultValue: sec.fallback })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {section === 'appearance' && (
            <SettingsSection id="appearance" title={t('settings.appearance', { defaultValue: 'Appearance' })} description={t('settings.appearanceDesc', { defaultValue: 'Customize how HiyoLauncher looks.' })}>
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.theme', { defaultValue: 'Theme' })}</CardTitle>
                  <CardDescription>{t('settings.choosePreset', { defaultValue: 'Choose a preset.' })}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ThemePicker value={s.theme} onChange={(theme) => update({ theme })} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.mode', { defaultValue: 'Mode' })}</CardTitle></CardHeader>
                <CardContent>
                  <Tabs value={s.mode} onValueChange={(v) => update({ mode: v as any })}>
                    <TabsList>
                      <TabsTrigger value="dark">{t('settings.dark', { defaultValue: 'Dark' })}</TabsTrigger>
                      <TabsTrigger value="light">{t('settings.light', { defaultValue: 'Light' })}</TabsTrigger>
                      <TabsTrigger value="system">{t('settings.system', { defaultValue: 'System' })}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.accentColor', { defaultValue: 'Accent color' })}</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-3">
                  <Input type="color" value={s.accent} onChange={(e) => update({ accent: e.target.value })} className="h-10 w-16 p-1" />
                  <Input value={s.accent} onChange={(e) => update({ accent: e.target.value })} className="max-w-xs" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.background', { defaultValue: 'Background' })}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.type', { defaultValue: 'Type' })}</Label>
                    <Select value={s.background.type} onValueChange={(v) => update({ background: { ...s.background, type: v as any } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('settings.none', { defaultValue: 'None' })}</SelectItem>
                        <SelectItem value="gradient">{t('settings.gradient', { defaultValue: 'Gradient' })}</SelectItem>
                        <SelectItem value="image">{t('settings.image', { defaultValue: 'Image' })}</SelectItem>
                        <SelectItem value="video">{t('settings.video', { defaultValue: 'Video' })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {s.background.type !== 'none' && (
                    <div className="space-y-2">
                      <Label>{t('settings.value', { defaultValue: 'Value' })}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={s.background.value ?? ''}
                          onChange={(e) => update({ background: { ...s.background, value: e.target.value } })}
                          placeholder={s.background.type === 'gradient' ? t('settings.cssGradient', { defaultValue: 'CSS gradient' }) : t('settings.filePath', { defaultValue: 'File path' })}
                        />
                        {(s.background.type === 'image' || s.background.type === 'video') && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              const filters = s.background.type === 'image'
                                ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
                                : [{ name: 'Videos', extensions: ['mp4', 'webm'] }]
                              const path = await _api.app.pickFile(filters)
                              if (path) update({ background: { ...s.background, value: path } })
                            }}
                          >
                            Browse
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{t('settings.blur', { defaultValue: 'Blur' })}: {s.background.blur}</Label>
                    <Slider min={0} max={30} value={[s.background.blur]} onValueChange={([v]) => update({ background: { ...s.background, blur: v } })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.dim', { defaultValue: 'Dim' })}: {s.background.dim}</Label>
                    <Slider min={0} max={80} value={[s.background.dim]} onValueChange={([v]) => update({ background: { ...s.background, dim: v } })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.opacity', { defaultValue: 'Opacity' })}: {s.background.opacity.toFixed(2)}</Label>
                    <Slider min={0} max={1} step={0.05} value={[s.background.opacity]} onValueChange={([v]) => update({ background: { ...s.background, opacity: v } })} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.density', { defaultValue: 'Density' })}</CardTitle></CardHeader>
                <CardContent>
                  <Select value={s.density} onValueChange={(v) => update({ density: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cozy">{t('settings.cozy', { defaultValue: 'Cozy' })}</SelectItem>
                      <SelectItem value="compact">{t('settings.compact', { defaultValue: 'Compact' })}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.fontScale', { defaultValue: 'Font scale' })}: {s.fontScale.toFixed(2)}</CardTitle></CardHeader>
                <CardContent>
                  <Slider min={0.85} max={1.2} step={0.05} value={[s.fontScale]} onValueChange={([v]) => update({ fontScale: v })} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.sidebarSide', { defaultValue: 'Sidebar side' })}</CardTitle></CardHeader>
                <CardContent>
                  <Select value={s.sidebarSide} onValueChange={(v) => update({ sidebarSide: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t('settings.left', { defaultValue: 'Left' })}</SelectItem>
                      <SelectItem value="right">{t('settings.right', { defaultValue: 'Right' })}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.animations', { defaultValue: 'Animations' })}</CardTitle></CardHeader>
                <CardContent>
                  <Switch checked={s.animations} onCheckedChange={(v) => update({ animations: v })} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('settings.language', { defaultValue: 'Language' })}</CardTitle></CardHeader>
                <CardContent>
                  <Select
                    value={s.language}
                    onValueChange={(v) => {
                      update({ language: v as any })
                      i18n.changeLanguage(v)
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vi">Tiếng Việt</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </SettingsSection>
          )}

          {section === 'game' && (
            <SettingsSection id="game" title="Game" description="Game installation and defaults.">
              <Card>
                <CardHeader><CardTitle>Game root</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={s.gameRoot} onChange={(e) => update({ gameRoot: e.target.value })} />
                    <Button type="button" variant="outline" onClick={async () => {
                      const p = await _api.app.pickDirectory()
                      if (p) update({ gameRoot: p })
                    }}>Browse</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Folder containing instances, versions, libraries and assets.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Default memory: {Math.round(s.defaultMemoryMb / 1024)} GB</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Slider
                    min={1024}
                    max={32768}
                    step={1024}
                    value={[s.defaultMemoryMb]}
                    onValueChange={([v]) => update({ defaultMemoryMb: v })}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={suggestMemory}>Auto-suggest</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Show snapshots</CardTitle></CardHeader>
                <CardContent>
                  <Switch checked={s.showSnapshots} onCheckedChange={(v) => update({ showSnapshots: v })} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Download concurrency: {s.concurrency}</CardTitle></CardHeader>
                <CardContent>
                  <Slider min={1} max={16} step={1} value={[s.concurrency]} onValueChange={([v]) => update({ concurrency: v })} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Java runtime</CardTitle></CardHeader>
                <CardContent>
                  <JavaPicker value={undefined} onChange={() => {}} />
                </CardContent>
              </Card>
            </SettingsSection>
          )}

          {section === 'accounts' && (
            <SettingsSection id="accounts" title="Accounts" description="Microsoft and offline accounts.">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Accounts</CardTitle>
                    <CardDescription>Manage your Minecraft accounts.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleMsLogin} disabled={msLoading}>
                      {msLoading ? 'Logging in...' : 'Microsoft login'}
                    </Button>
                    <Dialog open={offlineOpen} onOpenChange={setOfflineOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">Add offline</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add offline account</DialogTitle>
                          <DialogDescription>Username 3-16 chars, alphanumeric/underscore.</DialogDescription>
                        </DialogHeader>
                        <Input
                          value={offlineName}
                          onChange={(e) => setOfflineName(e.target.value)}
                          placeholder="Username"
                        />
                        <DialogFooter>
                          <Button onClick={async () => {
                            if (!/^[a-zA-Z0-9_]{3,16}$/.test(offlineName)) {
                              toast.error('Invalid username')
                              return
                            }
                            const ok = await handleOfflineAdd(offlineName)
                            if (ok) { setOfflineOpen(false); setOfflineName('') }
                          }}>Add</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(accounts as Account[] | undefined)?.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Avatar>
                        {acc.avatarUrl ? <AvatarImage src={acc.avatarUrl} /> : null}
                        <AvatarFallback>{acc.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{acc.name}</div>
                        <div className="text-xs text-muted-foreground">{acc.uuid}</div>
                      </div>
                      <Badge variant={acc.type === 'microsoft' ? 'default' : 'secondary'}>{acc.type}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setRemoveAccId(acc.id)}>Remove</Button>
                    </div>
                  ))}
                  {!accounts?.length && <p className="text-sm text-muted-foreground">No accounts.</p>}
                </CardContent>
              </Card>

              {/* remove confirm */}
              <Dialog open={!!removeAccId} onOpenChange={(o) => { if (!o) setRemoveAccId(null) }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Remove account?</DialogTitle>
                    <DialogDescription>This cannot be undone.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRemoveAccId(null)}>Cancel</Button>
                    <Button variant="destructive" onClick={async () => { if (removeAccId) await handleRemoveAccount(removeAccId); setRemoveAccId(null) }}>Remove</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* device code dialog */}
              <Dialog open={msDialogOpen} onOpenChange={setMsDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Microsoft login</DialogTitle>
                    <DialogDescription>Enter the code on the verification page.</DialogDescription>
                  </DialogHeader>
                  {deviceCode ? (
                    <div className="space-y-3">
                      <div className="text-center text-3xl font-bold tracking-widest">{deviceCode.userCode}</div>
                      <div className="flex gap-2">
                        <Button className="flex-1" onClick={copyCode}>Copy code</Button>
                        <Button className="flex-1" variant="outline" onClick={() => _api.app.openExternal(deviceCode.verificationUri)}>Open link</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Waiting for device code...</div>
                  )}
                </DialogContent>
              </Dialog>
            </SettingsSection>
          )}

          {section === 'integrations' && (
            <SettingsSection id="integrations" title="Integrations" description="Third-party integrations.">
              <Card>
                <CardHeader><CardTitle>Discord Rich Presence</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={s.discordRpc} onCheckedChange={handleDiscordToggle} />
                    <span className="text-sm">Enable Discord RPC</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Only works when Discord is running.</p>
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input value={s.discordClientId} onChange={(e) => update({ discordClientId: e.target.value })} />
                  </div>
                </CardContent>
              </Card>
            </SettingsSection>
          )}

          {section === 'advanced' && (
            <SettingsSection id="advanced" title="Advanced" description="Advanced settings.">
              <Card>
                <CardHeader><CardTitle>Microsoft Azure client ID</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Input value={s.msClientId} onChange={(e) => update({ msClientId: e.target.value })} />
                  <Button variant="link" className="px-0" onClick={() => _api.app.openExternal('https://github.com/hiyo412012/HiyoLauncher/blob/main/docs/microsoft-auth.md')}>
                    How to get a client ID
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Reset settings</CardTitle></CardHeader>
                <CardContent>
                  <Button variant="destructive" onClick={() => setResetOpen(true)}>Reset to defaults</Button>
                </CardContent>
              </Card>

              <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset settings?</DialogTitle>
                    <DialogDescription>All settings will be restored to defaults.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={async () => {
                      try {
                        const d = await _api.settings.reset()
                        qc.setQueryData(['settings'], d)
                        if (refreshTheme) refreshTheme()
                        toast.success('Reset')
                      } catch (e: any) { toast.error(e?.message ?? 'Failed') }
                      setResetOpen(false)
                    }}>Reset</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SettingsSection>
          )}

          {section === 'about' && (
            <SettingsSection id="about" title="About" description="HiyoLauncher info.">
              <Card>
                <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
                  <div className="text-2xl font-bold">HiyoLauncher</div>
                  <Badge variant="secondary">v{appInfo?.version}</Badge>
                  <p className="text-sm text-muted-foreground">{appInfo?.name}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Links</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => _api.app.openExternal('https://github.com/hiyo412012/HiyoLauncher')}>GitHub</Button>
                  <Button variant="outline" onClick={() => _api.app.openExternal('https://modrinth.com')}>Modrinth</Button>
                  <Button variant="outline" onClick={() => _api.app.openExternal('https://github.com/hiyo412012/HiyoLauncher/issues')}>Report issue</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Updater</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">State: {updaterStatus?.state ?? 'idle'}</div>
                  {updaterStatus?.version ? <div className="text-sm">Version: {updaterStatus.version}</div> : null}
                  {updaterStatus?.progress != null ? (
                    <div className="h-2 w-full rounded bg-muted">
                      <div className="h-2 rounded bg-primary" style={{ width: `${updaterStatus.progress}%` }} />
                    </div>
                  ) : null}
                  {updaterStatus?.error ? <div className="text-sm text-destructive">{updaterStatus.error}</div> : null}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdaterCheck}>Check</Button>
                    <Button size="sm" variant="outline" onClick={handleUpdaterDownload}>Download</Button>
                    <Button size="sm" variant="outline" onClick={handleUpdaterInstall}>Install</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
                  <p>License: MIT</p>
                  <p>HiyoLauncher is not affiliated with Mojang or Microsoft.</p>
                </CardContent>
              </Card>
            </SettingsSection>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

