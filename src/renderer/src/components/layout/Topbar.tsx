import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NameDialog } from '@/components/ui/name-dialog'
import { DeviceCodeDialog } from '@/components/account/DeviceCodeDialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Search, Play, Square, UserPlus, LogIn, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { GameState } from '@shared/types'

const titleMap: Record<string, string> = {
  '/': 'Home',
  '/instances': 'Instances',
  '/browse': 'Browse',
  '/modpacks': 'Modpacks',
  '/skins': 'Skins',
  '/servers': 'Servers',
  '/logs': 'Logs',
  '/settings': 'Settings',
  '/onboarding': 'Onboarding',
}

export default function Topbar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { selectedAccountId, setSelectedAccount } = useAppStore()
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounts.list() })
  const [running, setRunning] = useState<GameState | null>(null)

  useEffect(() => {
    const unsub = api.onGameState((s) => {
      if (s.phase === 'idle' || s.phase === 'exited') {
        setRunning((prev) => (prev?.instanceId === s.instanceId ? null : prev))
      } else {
        setRunning(s)
      }
    })
    return unsub
  }, [])

  const [deviceCode, setDeviceCode] = useState<import('@shared/types').DeviceCodeInfo | null>(null)

  useEffect(() => {
    return api.onAuthDeviceCode((info) => setDeviceCode(info))
  }, [])

  const msLoginMutation = useMutation({
    mutationFn: () => api.accounts.msLogin(),
    onSuccess: (acc) => {
      setDeviceCode(null)
      if (acc) setSelectedAccount(acc.id)
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e: any) => {
      setDeviceCode(null)
      toast.error(e?.message ?? 'Microsoft login failed')
    },
  })

  const addOfflineMutation = useMutation({
    mutationFn: (name: string) => api.accounts.addOffline(name),
    onSuccess: (acc) => {
      setSelectedAccount(acc.id)
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const [offlineOpen, setOfflineOpen] = useState(false)

  const accounts = accountsQuery.data ?? []
  const activeAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0]

  const handleAddOffline = () => setOfflineOpen(true)

  const pageTitle = titleMap[location.pathname] ?? titleMap[location.pathname.split('/')[1] ? '/' + location.pathname.split('/')[1] : '/'] ?? 'HiyoLauncher'

  const handleStop = () => {
    if (running) api.launch.stop(running.instanceId).catch(() => {})
  }

  return (
    <header className="h-16 shrink-0 border-b border-[var(--ring)]/10 bg-[var(--bg)]/40 backdrop-blur flex items-center gap-3 px-4">
      <div className="flex flex-col leading-tight">
        <span className="text-xs opacity-60">{t('topbar.breadcrumb', { defaultValue: 'HiyoLauncher' })}</span>
        <span className="font-semibold">{t(`page.${pageTitle.toLowerCase()}`, { defaultValue: pageTitle })}</span>
      </div>
      <div className="flex-1" />
      <button
        onClick={() => navigate('/browse')}
        className="hidden md:flex items-center gap-2 rounded-lg border border-[var(--ring)]/20 bg-[var(--surface)] px-3 py-1.5 text-sm opacity-80 hover:opacity-100"
      >
        <Search className="w-4 h-4" />
        <span>{t('topbar.search', { defaultValue: 'Search mods...' })}</span>
        <kbd className="ml-2 text-xs opacity-60">/</kbd>
      </button>
      {running && (
        <div className="flex items-center gap-2 rounded-full bg-[var(--accent)]/15 px-3 py-1.5 text-sm">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span>{t('topbar.playing', { defaultValue: 'Playing' })}</span>
          <button onClick={handleStop} className="ml-1 hover:text-red-300" aria-label={t('topbar.stop', { defaultValue: 'Stop' })}>
            <Square className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-xs">
              {(activeAccount?.name ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="max-w-[120px] truncate">{activeAccount?.name ?? t('account.none', { defaultValue: 'No account' })}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('account.switcher', { defaultValue: 'Accounts' })}</DropdownMenuLabel>
          {accounts.map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => setSelectedAccount(a.id)}>
              <span className={cn('w-2 h-2 rounded-full mr-2', a.id === selectedAccountId ? 'bg-[var(--accent)]' : 'bg-transparent')} />
              {a.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleAddOffline}>
            <UserPlus className="w-4 h-4 mr-2" />
            {t('account.addOffline', { defaultValue: 'Add offline account' })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => msLoginMutation.mutate()} disabled={msLoginMutation.isPending}>
            <LogIn className="w-4 h-4 mr-2" />
            {msLoginMutation.isPending ? t('account.loggingIn', { defaultValue: 'Logging in...' }) : t('account.msLogin', { defaultValue: 'Microsoft login' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog
        open={offlineOpen}
        onOpenChange={setOfflineOpen}
        title={t('account.addOffline', { defaultValue: 'Add offline account' })}
        description={t('account.offlineHint', {
          defaultValue: 'Use 3-16 letters, numbers or underscores. For offline and LAN servers.',
        })}
        label={t('account.offlineName', { defaultValue: 'Offline account name' })}
        placeholder="Steve"
        maxLength={16}
        confirmLabel={t('common.add', { defaultValue: 'Add' })}
        onConfirm={(name) => addOfflineMutation.mutateAsync(name).then(() => undefined)}
      />
      <DeviceCodeDialog info={deviceCode} onClose={() => setDeviceCode(null)} />
    </header>
  )
}