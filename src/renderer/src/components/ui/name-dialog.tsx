import { useEffect, useState } from 'react'
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

export interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  maxLength?: number
  onConfirm: (value: string) => void | Promise<void>
}

/** Small accessible replacement for window.prompt(), which Electron does not support. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  defaultValue = '',
  placeholder,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  maxLength = 64,
  onConfirm,
}: NameDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      setBusy(false)
    }
  }, [open, defaultValue])

  const submit = async () => {
    const clean = value.trim()
    if (!clean) return
    setBusy(true)
    try {
      await onConfirm(clean)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          {label ? <Label htmlFor="name-dialog-input">{label}</Label> : null}
          <Input
            id="name-dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !value.trim()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
