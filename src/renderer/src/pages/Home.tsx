import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app'
import { useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { NameDialog } from '@/components/ui/name-dialog'
import { cn } from '@/lib/utils'
import { Play, Square, Plus, Package, Server, User, Clock, HardDrive } from 'lucide-react'
import { toast } from 'sonner'
import type { Instance, GameState, Account } from '@shared/types'

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { selectedInstanceId, setSelectedInstance, selectedAccountId, setSelectedAccount } = useAppStore()
  const { setCreateInstanceOpen } = useUiStore()

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => api.settings.get() })
  const instancesQuery = useQuery({ queryKey: ['instances'], queryFn: () => api.instances.list() })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounts.list() })

  const [gameState, setGameState] = useState<GameState | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false)

  useEffect(() => {
    const unsubState = api.onGameState((s) => setGameState(s))
    const unsubLog = api.onGameLog((p) => {
      setLogLines((prev) => [...prev, ...p.lines].slice(-40))
    })
    const unsubExit = api.onGameExit((p) => {
      setGameState((prev) =>
        prev && prev.instanceId === p.instanceId ? { ...prev, phase: 'exited', exitCode: p.code ?? undefined } : prev,
      )
    })
    return () => {
      unsubState()
      unsubLog()
      unsubExit()
    }
  }, [])

  const instances = instancesQuery.data ?? []
  const accounts = accountsQuery.data ?? []

  const heroInstance = useMemo(() => {
    if (selectedInstanceId) {
      const found = instances.find((i) => i.id === selectedInstanceId)
      if (found) return found
    }
    const sorted = [...instances].sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    return sorted[0] ?? null
  }, [instances, selectedInstanceId])

  useEffect(() => {
    if (heroInstance && !selectedInstanceId) setSelectedInstance(heroInstance.id)
  }, [heroInstance, selectedInstanceId, setSelectedInstance])

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0]

  const launchMutation = useMutation({
    mutationFn: (inst: Instance) =>
      api.launch.start({ instanceId: inst.id, accountId: activeAccount?.id }),
    onSuccess: () => {
      setLogLines([])
      qc.invalidateQueries({ queryKey: ['instances'] })
    },
    onError: (e: unknown) => {
      const err = e as { code?: string; message?: string }
      toast.error(`${err?.code ?? 'ERROR'}: ${err?.message ?? 'Launch failed'}`)
    },
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.launch.stop(id),
  })

  const isRunning = gameState && gameState.instanceId === heroInstance?.id && (gameState.phase === 'running' || gameState.phase === 'launching' || gameState.phase === 'downloading' || gameState.phase === 'preparing')

  const recentInstances = useMemo(
    () => [...instances].sort((a, b) => (b.lastPlayedAt ?? b.createdAt) - (a.lastPlayedAt ?? a.createdAt)).slice(0, 6),
    [instances],
  )

  if (instancesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (instances.length === 0) {
    return (
      <div className="space-y-6 text-center py-16">
        <Plus className="w-8 h-8 mx-auto opacity-60" />
        <h2 className="text-xl font-semibold">{t('home.noInstanceTitle', { defaultValue: 'No instances yet' })}</h2>
        <p className="opacity-70">{t('home.noInstanceDesc', { defaultValue: 'Create your first instance to start playing.' })}</p>
        <Button onClick={() => { setCreateInstanceOpen(true); navigate('/instances') }}>
          {t('home.createInstance', { defaultValue: 'Create instance' })}
        </Button>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6 text-center py-16">
        <User className="w-8 h-8 mx-auto opacity-60" />
        <h2 className="text-xl font-semibold">{t('home.noAccountTitle', { defaultValue: 'No account' })}</h2>
        <p className="opacity-70">{t('home.noAccountDesc', { defaultValue: 'Add an offline account to play.' })}</p>
        <Button onClick={() => setOfflineDialogOpen(true)}>
          {t('account.addOffline', { defaultValue: 'Add offline account' })}
        </Button>
        <NameDialog
          open={offlineDialogOpen}
          onOpenChange={setOfflineDialogOpen}
          title={t('account.addOffline', { defaultValue: 'Add offline account' })}
          description={t('account.offlineHint', {
            defaultValue: 'Use 3-16 letters, numbers or underscores. For offline and LAN servers.',
          })}
          label={t('account.offlineName', { defaultValue: 'Offline account name' })}
          placeholder="Steve"
          maxLength={16}
          confirmLabel={t('common.add', { defaultValue: 'Add' })}
          onConfirm={async (name) => {
            const acc = await api.accounts.addOffline(name)
            setSelectedAccount(acc.id)
            await qc.invalidateQueries({ queryKey: ['accounts'] })
            toast.success(t('account.added', { defaultValue: 'Account added' }))
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {heroInstance && (
        <Card className="overflow-hidden">
          <div
            className="h-44 relative"
            style={{
              background: heroInstance.cover
                ? `url(${heroInstance.cover}) center/cover`
                : `linear-gradient(135deg, ${settingsQuery.data?.accent ?? '#5ec8d8'}33, #071a22)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)]/80 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{heroInstance.mcVersion}</Badge>
                  <Badge variant="secondary">{heroInstance.loader}</Badge>
                  {heroInstance.loaderVersion && <Badge variant="outline">{heroInstance.loaderVersion}</Badge>}
                </div>
                <h2 className="text-2xl font-bold">{heroInstance.name}</h2>
                <div className="text-sm opacity-80 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> {Math.round((heroInstance.memoryMb ?? settingsQuery.data?.defaultMemoryMb ?? 4096) / 1024)}GB</span>
                  {heroInstance.lastPlayedAt && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(heroInstance.lastPlayedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeAccount && (
                  <Badge variant="outline" className="gap-1">
                    <User className="w-3 h-3" />
                    {activeAccount.name}
                  </Badge>
                )}
                {isRunning ? (
                  <Button variant="destructive" onClick={() => stopMutation.mutate(heroInstance.id)} disabled={stopMutation.isPending}>
                    <Square className="w-4 h-4 mr-1" />
                    {t('home.stop', { defaultValue: 'Stop' })}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => launchMutation.mutate(heroInstance)}
                    disabled={launchMutation.isPending}
                  >
                    <Play className="w-5 h-5 mr-1" />
                    {launchMutation.isPending ? t('home.launching', { defaultValue: 'Launching...' }) : t('home.play', { defaultValue: 'Play' })}
                  </Button>
                )}
              </div>
            </div>
          </div>
          {(gameState?.instanceId === heroInstance.id && gameState.progress) && (
            <CardContent className="pt-4">
              <Progress value={gameState.progress.total ? ((gameState.progress.current ?? 0) / (gameState.progress.total ?? 1)) * 100 : 0} />
              <div className="text-xs opacity-70 mt-1">{gameState.phase} {gameState.progress.stage ?? ''}</div>
            </CardContent>
          )}
          {gameState?.instanceId === heroInstance.id && logLines.length > 0 && (
            <CardContent>
              <div className="rounded-lg bg-black/40 p-3 font-mono text-xs max-h-32 overflow-auto">
                {logLines.slice(-12).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:bg-[var(--surface)]/80" onClick={() => navigate('/browse')}>
          <CardContent className="pt-6 flex flex-col items-center gap-2">
            <CompassIcon />
            <span className="text-sm">{t('home.browseMods', { defaultValue: 'Browse mods' })}</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-[var(--surface)]/80" onClick={() => { setCreateInstanceOpen(true); navigate('/instances') }}>
          <CardContent className="pt-6 flex flex-col items-center gap-2">
            <Plus className="w-6 h-6" />
            <span className="text-sm">{t('home.newInstance', { defaultValue: 'New instance' })}</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-[var(--surface)]/80" onClick={() => navigate('/servers')}>
          <CardContent className="pt-6 flex flex-col items-center gap-2">
            <Server className="w-6 h-6" />
            <span className="text-sm">{t('home.servers', { defaultValue: 'Servers' })}</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-[var(--surface)]/80" onClick={() => navigate('/skins')}>
          <CardContent className="pt-6 flex flex-col items-center gap-2">
            <User className="w-6 h-6" />
            <span className="text-sm">{t('home.skins', { defaultValue: 'Skins' })}</span>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="font-semibold mb-3">{t('home.recent', { defaultValue: 'Recent instances' })}</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {recentInstances.map((inst) => (
            <Card
              key={inst.id}
              className="min-w-[200px] cursor-pointer hover:bg-[var(--surface)]/80"
              onClick={() => { setSelectedInstance(inst.id); navigate(`/instances/${inst.id}`) }}
            >
              <CardContent className="pt-4">
                <div className="font-medium truncate">{inst.name}</div>
                <div className="text-xs opacity-70">{inst.mcVersion} • {inst.loader}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function CompassIcon() {
  return <Package className="w-6 h-6" />
}