import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw, Server } from 'lucide-react'
import { toast } from 'sonner'
import type { ServerEntry, ServerStatus } from '@shared/types'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ServerCard } from '@/components/servers/ServerCard'

export default function Servers() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const selectedInstanceId = useAppStore((s) => s.selectedInstanceId)
  const selectedAccountId = useAppStore((s) => s.selectedAccountId)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [statuses, setStatuses] = useState<Record<string, ServerStatus>>({})
  const [pinging, setPinging] = useState<Record<string, boolean>>({})

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => api.servers.list(),
  })

  const instancesQuery = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.instances.list(),
  })

  const servers = serversQuery.data ?? []
  const selectedInstance = instancesQuery.data?.find((i) => i.id === selectedInstanceId)

  const pingOne = async (server: ServerEntry) => {
    setPinging((p) => ({ ...p, [server.ip]: true }))
    try {
      const status = await api.servers.ping({ host: server.ip })
      setStatuses((s) => ({ ...s, [server.ip]: status }))
    } catch (e: any) {
      toast.error(e?.message ?? 'Ping failed')
    } finally {
      setPinging((p) => ({ ...p, [server.ip]: false }))
    }
  }

  const pingAll = async (list: ServerEntry[]) => {
    await Promise.all(list.map((s) => pingOne(s)))
  }

  useEffect(() => {
    if (servers.length) void pingAll(servers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length])

  useEffect(() => {
    if (!servers.length) return
    const timer = setInterval(() => void pingAll(servers), 60_000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length])

  const addMutation = useMutation({
    mutationFn: () =>
      api.servers.add({
        name: name.trim(),
        ip: address.trim(),
      }),
    onSuccess: async () => {
      setAddOpen(false)
      setName('')
      setAddress('')
      await qc.invalidateQueries({ queryKey: ['servers'] })
      toast.success(t('servers.added', { defaultValue: 'Server added' }))
    },
    onError: (e: any) => toast.error(e?.message ?? 'Could not add server'),
  })

  const removeMutation = useMutation({
    mutationFn: (index: number) => api.servers.remove(index),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['servers'] })
      toast.success(t('servers.removed', { defaultValue: 'Server removed' }))
    },
    onError: (e: any) => toast.error(e?.message ?? 'Could not remove server'),
  })

  const joinMutation = useMutation({
    mutationFn: (index: number) => {
      if (!selectedInstanceId) throw new Error('Select an instance first')
      return api.servers.join(selectedInstanceId, index, selectedAccountId ?? undefined)
    },
    onSuccess: () =>
      toast.success(
        t('servers.joining', { defaultValue: 'Launching Minecraft and joining the server…' }),
      ),
    onError: (e: any) => {
      if (!selectedInstanceId) {
        toast.error(
          t('servers.needInstance', {
            defaultValue: 'Choose an instance first (Instances → select)',
          }),
        )
        navigate('/instances')
        return
      }
      toast.error(e?.message ?? 'Could not join server')
    },
  })

  const content = useMemo(() => {
    if (serversQuery.isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      )
    }
    if (!servers.length) {
      return (
        <EmptyState
          icon={<Server className="h-8 w-8" />}
          title={t('servers.emptyTitle', { defaultValue: 'No servers yet' })}
          description={t('servers.emptyBody', {
            defaultValue: 'Add your favourite servers to ping them and join with one click.',
          })}
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('servers.add', { defaultValue: 'Add server' })}
            </Button>
          }
        />
      )
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {servers.map((server, index) => (
          <ServerCard
            key={`${server.ip}-${index}`}
            server={server}
            index={index}
            status={statuses[server.ip]}
            pinging={!!pinging[server.ip]}
            onPing={() => void pingOne(server)}
            onJoin={() => joinMutation.mutate(index)}
            onRemove={() => {
              if (window.confirm(`Remove ${server.name}?`)) removeMutation.mutate(index)
            }}
          />
        ))}
      </div>
    )
  }, [servers, serversQuery.isLoading, statuses, pinging, joinMutation, removeMutation, t])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('nav.servers', { defaultValue: 'Servers' })}</h1>
          <p className="text-sm text-[var(--muted)]">
            {selectedInstance
              ? `Joining with ${selectedInstance.name}`
              : t('servers.pickInstance', { defaultValue: 'Select an instance to enable one-click join' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void pingAll(servers)} disabled={!servers.length}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('servers.refresh', { defaultValue: 'Refresh' })}
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('servers.add', { defaultValue: 'Add server' })}
          </Button>
        </div>
      </div>

      {content}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('servers.add', { defaultValue: 'Add server' })}</DialogTitle>
            <DialogDescription>
              {t('servers.addHint', {
                defaultValue: 'Use host:port for custom ports, e.g. play.example.net:25566',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">{t('servers.name', { defaultValue: 'Name' })}</Label>
              <Input
                id="server-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My server"
                maxLength={64}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-address">
                {t('servers.address', { defaultValue: 'Address' })}
              </Label>
              <Input
                id="server-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="play.example.net:25565"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!name.trim() || !address.trim() || addMutation.isPending}
            >
              {t('common.add', { defaultValue: 'Add' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
