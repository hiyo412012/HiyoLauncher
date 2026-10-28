import React from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ServerEntry, ServerStatus } from '@shared/types'

export interface ServerCardProps {
  server: ServerEntry
  index: number
  status?: ServerStatus
  pinging?: boolean
  onPing?: () => void
  onJoin?: () => void
  onRemove?: () => void
  className?: string
}

function stripMotd(s?: string) {
  if (!s) return ''
  return s.replace(/§[0-9a-fk-or]/gi, '')
}

export function ServerCard({ server, index, status, pinging, onPing, onJoin, onRemove, className }: ServerCardProps) {
  const online = status?.online ?? false
  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="relative">
          {status?.icon ? (
            <img src={status.icon} alt="" className="h-10 w-10 rounded-md" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold">
              {server.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
              online ? 'bg-emerald-500' : 'bg-zinc-400'
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base">{server.name}</CardTitle>
          <CardDescription className="truncate">{server.ip}</CardDescription>
        </div>
        <Badge variant={online ? 'default' : 'secondary'}>{online ? 'Online' : 'Offline'}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {status ? (
          <>
            {online ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  Players: {status.players ?? 0}/{status.max ?? 0}
                </span>
                {status.version ? <span>Version: {status.version}</span> : null}
                {status.latency != null ? <span>{status.latency} ms</span> : null}
              </div>
            ) : status.error ? (
              <div className="text-destructive">{status.error}</div>
            ) : null}
            {status.motd ? (
              <div className="line-clamp-2 text-xs text-muted-foreground">{stripMotd(status.motd)}</div>
            ) : null}
          </>
        ) : (
          <Skeleton className="h-4 w-3/4" />
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onPing} disabled={pinging}>
            {pinging ? 'Pinging...' : 'Ping'}
          </Button>
          <Button size="sm" onClick={onJoin}>
            Join
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ServerCard