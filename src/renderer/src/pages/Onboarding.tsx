import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Globe, FolderOpen, Palette, Gamepad2, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { MinecraftVersionSummary, Loader } from '@shared/types'

const THEMES = [
  { id: 'ocean', label: 'Ocean', accent: '#5ec8d8', bg: '#071a22' },
  { id: 'aurora', label: 'Aurora', accent: '#7dd3a8', bg: '#0a1f1a' },
  { id: 'voxel', label: 'Voxel', accent: '#d8a85e', bg: '#1f1a0a' },
  { id: 'mono', label: 'Mono', accent: '#b8b8b8', bg: '#111111' },
] as const

const LOADERS: Loader[] = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']

export default function Onboarding() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setSelectedInstance } = useAppStore()
  const [step, setStep] = useState(0)
  const [language, setLanguage] = useState<'vi' | 'en'>('vi')
  const [gameRoot, setGameRoot] = useState<string>('')
  const [theme, setTheme] = useState<string>('ocean')
  const [mode, setMode] = useState<'dark' | 'light'>('dark')
  const [name, setName] = useState('')
  const [mcVersion, setMcVersion] = useState('')
  const [loader, setLoader] = useState<Loader>('vanilla')
  const [loaderVersion, setLoaderVersion] = useState('')

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => api.settings.get() })
  const versionsQuery = useQuery({ queryKey: ['versions'], queryFn: () => api.versions.list() })
  const loadersQuery = useQuery({
    queryKey: ['loaders', loader, mcVersion],
    queryFn: () => api.versions.loaders(loader, mcVersion),
    enabled: loader !== 'vanilla' && !!mcVersion,
  })

  useEffect(() => {
    if (settingsQuery.data) {
      setLanguage(settingsQuery.data.language)
      setGameRoot(settingsQuery.data.gameRoot)
      setTheme(settingsQuery.data.theme)
      setMode(settingsQuery.data.mode === 'light' ? 'light' : 'dark')
    }
  }, [settingsQuery.data])

  useEffect(() => {
    const releases = (versionsQuery.data ?? []).filter((v) => v.type === 'release')
    if (!mcVersion && releases.length) setMcVersion(releases[0].id)
  }, [versionsQuery.data, mcVersion])

  const updateSettings = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.settings.update(patch as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const createInstance = useMutation({
    mutationFn: () =>
      api.instances.create({
        name: name.trim(),
        mcVersion,
        loader,
        loaderVersion: loaderVersion || undefined,
      }),
    onSuccess: (inst) => {
      setSelectedInstance(inst.id)
      api.settings.update({ onboardingDone: true }).then(() => {
        qc.invalidateQueries({ queryKey: ['settings'] })
        navigate('/', { replace: true })
      })
    },
    onError: (e: unknown) => {
      const err = e as { message?: string; code?: string }
      toast.error(err?.message ?? 'Failed to create instance')
    },
  })

  const steps = [
    t('onboarding.stepLanguage', { defaultValue: 'Language' }),
    t('onboarding.stepFolder', { defaultValue: 'Game folder' }),
    t('onboarding.stepTheme', { defaultValue: 'Theme' }),
    t('onboarding.stepInstance', { defaultValue: 'First instance' }),
  ]

  const goNext = async () => {
    if (step === 0) {
      await updateSettings.mutateAsync({ language })
      i18n.changeLanguage(language)
    } else if (step === 1) {
      await updateSettings.mutateAsync({ gameRoot })
    } else if (step === 2) {
      await updateSettings.mutateAsync({ theme, mode })
    }
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const groupedVersions = useMemo(() => {
    const releases = (versionsQuery.data ?? []).filter((v) => v.type === 'release').slice(0, 20)
    const snapshots = (versionsQuery.data ?? []).filter((v) => v.type === 'snapshot').slice(0, 10)
    return { releases, snapshots }
  }, [versionsQuery.data])

  const canNext =
    step === 0 ||
    (step === 1 && !!gameRoot) ||
    (step === 2) ||
    (step === 3 && name.trim().length > 0 && !!mcVersion)

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('onboarding.title', { defaultValue: 'Welcome to HiyoLauncher' })}</h1>
          <p className="opacity-70 text-sm">{t('onboarding.subtitle', { defaultValue: 'Let’s set things up in a few steps.' })}</p>
        </div>
        <Progress value={((step + 1) / steps.length) * 100} className="mb-6" />
        <div className="flex gap-2 mb-6">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex-1 text-center text-xs py-1 rounded-full',
                i <= step ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'opacity-50',
              )}
            >
              {s}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[step]}</CardTitle>
            <CardDescription>
              {step === 0 && t('onboarding.langDesc', { defaultValue: 'Choose your language.' })}
              {step === 1 && t('onboarding.folderDesc', { defaultValue: 'Choose where Minecraft files are stored.' })}
              {step === 2 && t('onboarding.themeDesc', { defaultValue: 'Pick a theme and mode.' })}
              {step === 3 && t('onboarding.instanceDesc', { defaultValue: 'Create your first instance.' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <div className="grid grid-cols-2 gap-3">
                {(['vi', 'en'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition',
                      language === l ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--ring)]/20',
                    )}
                  >
                    <Globe className="w-5 h-5 mb-2" />
                    <div className="font-medium">{l === 'vi' ? 'Tiếng Việt' : 'English'}</div>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <div className="text-sm opacity-70">{t('onboarding.defaultPath', { defaultValue: 'Default' })}: {settingsQuery.data?.gameRoot}</div>
                <div className="flex gap-2">
                  <Input value={gameRoot} onChange={(e) => setGameRoot(e.target.value)} />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const p = await api.app.pickDirectory()
                      if (p) setGameRoot(p)
                    }}
                  >
                    <FolderOpen className="w-4 h-4 mr-1" />
                    {t('common.browse', { defaultValue: 'Browse' })}
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {THEMES.map((th) => (
                    <button
                      key={th.id}
                      onClick={() => setTheme(th.id)}
                      className={cn(
                        'rounded-xl border p-3 text-left transition',
                        theme === th.id ? 'border-[var(--accent)]' : 'border-[var(--ring)]/20',
                      )}
                      style={{ background: th.bg }}
                    >
                      <div className="w-6 h-6 rounded-full mb-2" style={{ background: th.accent }} />
                      <div className="text-sm font-medium" style={{ color: '#e6f7f9' }}>{th.label}</div>
                      {theme === th.id && <Check className="w-4 h-4 mt-1 text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(['dark', 'light'] as const).map((m) => (
                    <Button
                      key={m}
                      variant={mode === m ? 'default' : 'outline'}
                      onClick={() => setMode(m)}
                    >
                      <Palette className="w-4 h-4 mr-1" />
                      {m === 'dark' ? t('theme.dark', { defaultValue: 'Dark' }) : t('theme.light', { defaultValue: 'Light' })}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm">{t('instance.name', { defaultValue: 'Instance name' })}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Instance" />
                </div>
                <div>
                  <label className="text-sm">{t('instance.mcVersion', { defaultValue: 'Minecraft version' })}</label>
                  <Select value={mcVersion} onValueChange={setMcVersion}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-xs opacity-60">{t('version.release', { defaultValue: 'Release' })}</div>
                      {groupedVersions.releases.map((v: MinecraftVersionSummary) => (
                        <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                      ))}
                      <div className="px-2 py-1 text-xs opacity-60">{t('version.snapshot', { defaultValue: 'Snapshot' })}</div>
                      {groupedVersions.snapshots.map((v: MinecraftVersionSummary) => (
                        <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">{t('instance.loader', { defaultValue: 'Loader' })}</label>
                  <Select value={loader} onValueChange={(v) => setLoader(v as Loader)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LOADERS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {loader !== 'vanilla' && (
                  <div>
                    <label className="text-sm">{t('instance.loaderVersion', { defaultValue: 'Loader version' })}</label>
                    <Select value={loaderVersion} onValueChange={setLoaderVersion}>
                      <SelectTrigger><SelectValue placeholder={t('common.select', { defaultValue: 'Select' })} /></SelectTrigger>
                      <SelectContent>
                        {(loadersQuery.data ?? []).map((lv) => (
                          <SelectItem key={lv.version} value={lv.version}>{lv.version}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-xs opacity-60">{t('onboarding.downloadNotice', { defaultValue: 'Minecraft files will be downloaded on first launch. This may take a while.' })}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            {t('common.back', { defaultValue: 'Back' })}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={goNext} disabled={!canNext || updateSettings.isPending}>
              {t('common.next', { defaultValue: 'Next' })}
            </Button>
          ) : (
            <Button
              onClick={() => createInstance.mutate()}
              disabled={!canNext || createInstance.isPending}
            >
              <Gamepad2 className="w-4 h-4 mr-1" />
              {createInstance.isPending ? t('common.creating', { defaultValue: 'Creating...' }) : t('onboarding.finish', { defaultValue: 'Finish & create' })}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}