import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { ContentKind, MrVersion } from '@shared/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface InstallDialogProps {
  projectId: string
  kind: ContentKind | 'modpack'
  instanceId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function friendlyError(code: string | undefined, message: string | undefined, t: (key: string, opts?: any) => string) {
  switch (code) {
    case 'CONTENT_INCOMPATIBLE':
      return t('install.error.incompatible', {
        defaultValue: 'This version is not compatible with the selected instance.',
      })
    case 'NETWORK':
      return t('install.error.network', {
        defaultValue: 'Network error. Check your connection and try again.',
      })
    case 'AUTH':
      return t('install.error.auth', {
        defaultValue: 'Authentication is required to complete this action.',
      })
    default:
      return message || t('install.error.generic', { defaultValue: 'Installation failed.' })
  }
}

export function InstallDialog({ projectId, kind, instanceId, open, onOpenChange }: InstallDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const selectedInstanceId = useAppStore((state) => state.selectedInstanceId)

  const [internalOpen, setInternalOpen] = useState(false)
  const controlled = open !== undefined
  const isOpen = controlled ? Boolean(open) : internalOpen

  const setOpen = (value: boolean) => {
    if (!controlled) setInternalOpen(value)
    onOpenChange?.(value)
  }

  const [targetInstanceId, setTargetInstanceId] = useState<string | undefined>(instanceId ?? selectedInstanceId ?? undefined)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [instanceName, setInstanceName] = useState('')
  const [installing, setInstalling] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setTargetInstanceId(instanceId ?? selectedInstanceId ?? undefined)
  }, [instanceId, selectedInstanceId])

  useEffect(() => {
    setSelectedVersionId(null)
    setErrorMessage(null)
  }, [projectId, targetInstanceId])

  const instancesQuery = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.instances.list(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  })

  const projectQuery = useQuery({
    queryKey: ['modrinth', 'project', projectId],
    queryFn: () => api.modrinth.project(projectId),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  })

  const targetInstance = instancesQuery.data?.find((instance) => instance.id === targetInstanceId)

  const loaderFilter = kind === 'modpack' ? undefined : targetInstance?.loader && targetInstance.loader !== 'vanilla' ? targetInstance.loader : undefined
  const mcVersionFilter = kind === 'modpack' ? undefined : targetInstance?.mcVersion

  const versionsQuery = useQuery({
    queryKey: ['modrinth', 'versions', projectId, loaderFilter, mcVersionFilter],
    queryFn: () => api.modrinth.versions(projectId, { loader: loaderFilter, mcVersion: mcVersionFilter }),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  })

  const versions = versionsQuery.data ?? []

  const isCompatible = (version: MrVersion) => {
    const loaderOk = !loaderFilter || version.loaders.includes(loaderFilter)
    const mcOk = !mcVersionFilter || version.gameVersions.includes(mcVersionFilter)
    return loaderOk && mcOk
  }

  useEffect(() => {
    if (!versions.length) return
    if (selectedVersionId && versions.some((version) => version.id === selectedVersionId)) return

    const compatibleVersions = versions.filter(isCompatible)
    const pool = compatibleVersions.length > 0 ? compatibleVersions : versions
    const preferred = pool.find((version) => version.versionType === 'release') ?? pool[0]
    setSelectedVersionId(preferred.id)
  }, [versions, selectedVersionId, loaderFilter, mcVersionFilter])

  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null

  useEffect(() => {
    if (kind === 'modpack' && selectedVersion && projectQuery.data) {
      setInstanceName(`${projectQuery.data.title} ${selectedVersion.versionNumber}`)
    }
  }, [kind, selectedVersion?.id, projectQuery.data?.id])

  const primaryFile = selectedVersion?.files.find((file) => file.primary) ?? selectedVersion?.files[0]
  const dependencyCount = selectedVersion?.dependencies.filter((dependency) => dependency.dependencyType === 'required').length ?? 0
  const totalSize = selectedVersion?.files.reduce((sum, file) => sum + (file.size || 0), 0) ?? 0

  const handleInstall = async () => {
    if (!selectedVersion) return
    setErrorMessage(null)
    setInstalling(true)

    try {
      if (kind === 'modpack') {
        const result = await api.modpack.install({
          projectId,
          versionId: selectedVersion.id,
          name: instanceName.trim() || `${projectQuery.data?.title ?? 'Modpack'} ${selectedVersion.versionNumber}`,
        })
        toast.success(t('install.success', { defaultValue: 'Installed successfully.' }), {
          action: {
            label: t('install.openInstance', { defaultValue: 'Open instance' }),
            onClick: () => navigate(`/instances/${result.instanceId}`),
          },
        })
        queryClient.invalidateQueries({ queryKey: ['instances'] })
      } else {
        if (!targetInstanceId) {
          throw new Error(t('install.noInstance', { defaultValue: 'Select a target instance.' }))
        }
        await api.content.install({
          instanceId: targetInstanceId,
          projectId,
          versionId: selectedVersion.id,
          kind: kind as ContentKind,
        })
        toast.success(t('install.success', { defaultValue: 'Installed successfully.' }), {
          action: {
            label: t('install.openInstance', { defaultValue: 'Open instance' }),
            onClick: () => navigate(`/instances/${targetInstanceId}`),
          },
        })
        queryClient.invalidateQueries({ queryKey: ['content', 'list', targetInstanceId] })
      }

      setOpen(false)
    } catch (error: any) {
      const message = friendlyError(error?.code, error?.message, t)
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {projectQuery.data?.title ?? t('install.title', { defaultValue: 'Install' })}
          </DialogTitle>
          <DialogDescription>
            {t('install.description', {
              defaultValue: 'Choose a compatible version and target instance.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {versionsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('install.noVersions', { defaultValue: 'No versions available for this project.' })}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="install-version">{t('install.version', { defaultValue: 'Version' })}</Label>
                <Select value={selectedVersionId ?? ''} onValueChange={setSelectedVersionId}>
                  <SelectTrigger id="install-version">
                    <SelectValue placeholder={t('install.selectVersion', { defaultValue: 'Select a version' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((version) => {
                      const compatible = isCompatible(version)
                      return (
                        <SelectItem key={version.id} value={version.id} disabled={!compatible}>
                          {version.versionNumber} · {version.versionType}
                          {!compatible ? ` (${t('install.incompatible', { defaultValue: 'incompatible' })})` : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedVersion && (
                <Card>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedVersion.versionType}</Badge>
                      {selectedVersion.gameVersions.map((gameVersion) => (
                        <Badge key={gameVersion} variant="secondary">
                          {gameVersion}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground">
                      {t('install.fileSize', { defaultValue: 'File size' })}: {formatBytes(primaryFile?.size ?? totalSize)}
                    </p>
                    <p className="text-muted-foreground">
                      {t('install.dependencies', {
                        defaultValue: 'Required dependencies: {{count}}',
                        count: dependencyCount,
                      })}
                    </p>
                    {kind === 'modpack' && (
                      <p className="text-amber-600 dark:text-amber-400">
                        {t('install.sizeWarning', {
                          defaultValue: 'This modpack may download a large amount of data.',
                        })}{' '}
                        ({formatBytes(totalSize)})
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {kind === 'modpack' ? (
                <div className="space-y-2">
                  <Label htmlFor="instance-name">{t('modpacks.instanceName', { defaultValue: 'Instance name' })}</Label>
                  <Input
                    id="instance-name"
                    value={instanceName}
                    onChange={(event) => setInstanceName(event.target.value)}
                  />
                </div>
              ) : !instanceId ? (
                <div className="space-y-2">
                  <Label htmlFor="target-instance">{t('install.targetInstance', { defaultValue: 'Target instance' })}</Label>
                  <Select value={targetInstanceId ?? ''} onValueChange={setTargetInstanceId}>
                    <SelectTrigger id="target-instance">
                      <SelectValue placeholder={t('install.selectInstance', { defaultValue: 'Select an instance' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {(instancesQuery.data ?? []).map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.name} ({instance.mcVersion})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('install.targetInstance', { defaultValue: 'Target instance' })}:{' '}
                  {targetInstance?.name ?? instanceId}
                </p>
              )}
            </>
          )}

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          {installing && (
            <div className="space-y-2">
              <Progress value={undefined} />
              <p className="text-xs text-muted-foreground">
                {t('install.progress', { defaultValue: 'Installing, please wait…' })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={installing}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button onClick={handleInstall} disabled={installing || !selectedVersion || (!targetInstanceId && kind !== 'modpack')}>
            {installing
              ? t('install.installing', { defaultValue: 'Installing…' })
              : t('install.install', { defaultValue: 'Install' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}