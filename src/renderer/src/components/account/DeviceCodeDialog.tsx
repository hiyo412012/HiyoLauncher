import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { DeviceCodeInfo } from '@shared/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface DeviceCodeDialogProps {
  info: DeviceCodeInfo | null
  onClose: () => void
}

export function DeviceCodeDialog({ info, onClose }: DeviceCodeDialogProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [info?.userCode])

  const copy = async () => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.userCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard unavailable')
    }
  }

  return (
    <Dialog open={!!info} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in with Microsoft</DialogTitle>
          <DialogDescription>
            Open the Microsoft page, enter this code, then come back. This window will update
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            onClick={copy}
            className="group flex w-full items-center justify-between rounded-xl border border-[var(--accent)]/30 bg-[var(--surface-2)] px-5 py-4 text-left transition hover:border-[var(--accent)]/60"
            title="Copy code"
          >
            <span className="font-mono text-2xl font-semibold tracking-[0.2em] text-[var(--accent)]">
              {info?.userCode ?? '—'}
            </span>
            {copied ? (
              <Check className="h-5 w-5 text-emerald-400" />
            ) : (
              <Copy className="h-5 w-5 opacity-60 group-hover:opacity-100" />
            )}
          </button>

          <Button
            className="w-full"
            onClick={() => info && api.app.openExternal(info.verificationUri)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open {info?.verificationUri ?? 'microsoft.com/link'}
          </Button>

          <p className="text-xs text-[var(--muted)]">
            The code expires in about {Math.max(1, Math.round((info?.expiresIn ?? 900) / 60))}{' '}
            minutes. HiyoLauncher never sees your password.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
