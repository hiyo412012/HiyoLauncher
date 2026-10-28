import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { Account } from '@shared/types'
import { SkinViewer } from 'skinview3d'
import defaultSkinUrl from '@/assets/default-skin.png'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function pathToFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

export function Skins() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
    staleTime: 5 * 60 * 1000,
  })

  const accounts = accountsQuery.data ?? []
  const [accountId, setAccountId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id)
    }
  }, [accounts, accountId])

  const selectedAccount = accounts.find((account) => account.id === accountId)

  const skinQuery = useQuery({
    queryKey: ['skin', accountId],
    queryFn: () => api.skins.get(accountId!),
    enabled: Boolean(accountId),
    staleTime: 5 * 60 * 1000,
  })

  const [autoRotate, setAutoRotate] = useState(true)
  const [model, setModel] = useState<'classic' | 'slim'>('classic')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (skinQuery.data?.model === 'slim') setModel('slim')
    else if (skinQuery.data?.model === 'default' || skinQuery.data?.model === 'classic') setModel('classic')
  }, [skinQuery.data?.model])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<SkinViewer | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const viewer = new SkinViewer({
      canvas,
      width: 320,
      height: 420,
      enableControls: true,
      animation: undefined,
    })
    viewer.autoRotate = autoRotate
    viewerRef.current = viewer

    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (viewer) viewer.autoRotate = autoRotate
  }, [autoRotate])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    const skinUrl = skinQuery.data?.url
    const skinModel = model === 'slim' ? 'slim' : 'default'
    if (skinUrl) {
      void viewer.loadSkin(skinUrl, { model: skinModel }).catch(() => {
        void viewer.loadSkin(defaultSkinUrl, { model: 'default' }).catch(() => {})
      })
    } else {
      void viewer.loadSkin(defaultSkinUrl, { model: 'default' }).catch(() => {})
    }
  }, [skinQuery.data?.url, model])

  const handleUpload = async () => {
    if (!accountId || !selectedAccount) return

    const filePath = await api.app.pickFile([{ name: 'PNG image', extensions: ['png'] }])
    if (!filePath) return

    setUploading(true)
    try {
      const image = new Image()
      image.src = pathToFileUrl(filePath)
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('image-load-failed'))
      })

      const bitmap = await createImageBitmap(image)
      const { width, height } = bitmap
      if (typeof bitmap.close === 'function') bitmap.close()

      const validSize = (width === 64 && height === 64) || (width === 64 && height === 32)
      if (!validSize) {
        toast.error(
          t('skins.invalidSize', {
            defaultValue: 'Skin must be a 64×64 or 64×32 PNG image.',
          }),
        )
        return
      }

      const variant = model === 'slim' ? 'slim' : 'classic'
      if (selectedAccount.type === 'microsoft') {
        await api.skins.upload({ accountId, filePath, variant })
      } else {
        await api.skins.setOffline({ accountId, filePath })
      }

      toast.success(t('skins.uploaded', { defaultValue: 'Skin uploaded.' }))
      queryClient.invalidateQueries({ queryKey: ['skin', accountId] })
    } catch (error: any) {
      toast.error(error?.message || t('skins.uploadFailed', { defaultValue: 'Skin upload failed.' }))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('skins.title', { defaultValue: 'Skins' })}</h1>
        <p className="text-sm text-muted-foreground">
          {t('skins.subtitle', { defaultValue: 'Preview and manage player skins.' })}
        </p>
      </div>

      {accountsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('skins.noAccounts', { defaultValue: 'Add an account to manage skins.' })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="skin-account">{t('skins.account', { defaultValue: 'Account' })}</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="skin-account">
                    <SelectValue placeholder={t('skins.selectAccount', { defaultValue: 'Select account' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account: Account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-rotate">{t('skins.autoRotate', { defaultValue: 'Auto-rotate' })}</Label>
                <Switch id="auto-rotate" checked={autoRotate} onCheckedChange={setAutoRotate} />
              </div>

              <div className="space-y-2">
                <Label>{t('skins.model', { defaultValue: 'Model' })}</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={model === 'classic' ? 'default' : 'outline'}
                    onClick={() => setModel('classic')}
                  >
                    {t('skins.classic', { defaultValue: 'Classic' })}
                  </Button>
                  <Button
                    size="sm"
                    variant={model === 'slim' ? 'default' : 'outline'}
                    onClick={() => setModel('slim')}
                  >
                    {t('skins.slim', { defaultValue: 'Slim' })}
                  </Button>
                </div>
              </div>

              <Button onClick={handleUpload} disabled={uploading || !accountId} className="w-full">
                {uploading
                  ? t('skins.uploading', { defaultValue: 'Uploading…' })
                  : t('skins.upload', { defaultValue: 'Upload PNG' })}
              </Button>

              {selectedAccount?.type === 'offline' && (
                <p className="text-xs text-muted-foreground">
                  {t('skins.offlineNote', {
                    defaultValue:
                      'Offline skins require CustomSkinLoader for in-game visibility.',
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="relative flex min-h-[420px] items-center justify-center p-4">
              <canvas ref={canvasRef} className="max-w-full" />
              {skinQuery.isLoading && (
                <Skeleton className="absolute inset-4 rounded-lg" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Skins

