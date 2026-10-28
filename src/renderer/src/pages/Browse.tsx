import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { keepPreviousData } from '@tanstack/react-query'

import type { MrSearchHit } from '@shared/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ProjectCard } from '@/components/content/ProjectCard'
import { ContentRow } from '@/components/content/ContentRow'
import { InstallDialog } from '@/components/content/InstallDialog'

const PAGE_SIZE = 20

const MOD_CATEGORIES = [
  'adventure', 'cursed', 'decoration', 'economy', 'equipment', 'food', 'game-mechanics',
  'library', 'magic', 'management', 'minigame', 'mobs', 'optimization', 'social', 'storage',
  'technology', 'transportation', 'utility', 'worldgen',
]
const RESOURCEPACK_CATEGORIES = [
  '16x', '32x', '64x', '128x', '256x', '512x+', 'animated', 'font', 'gui', 'locale',
  'modded', 'photo-realistic', 'realistic', 'simplistic', 'themed', 'vanilla',
]
const SHADER_CATEGORIES = [
  'bloom', 'cartoon', 'cinematic', 'fantasy', 'low-end', 'pbr', 'potato', 'realistic',
  'semi-realistic', 'simple', 'stylized', 'vanilla',
]

const SORT_OPTIONS = ['relevance', 'downloads', 'follows', 'newest', 'updated'] as const
const LOADER_OPTIONS = ['any', 'fabric', 'quilt', 'forge', 'neoforge'] as const

type TabKey = 'mods' | 'resourcepacks' | 'shaders'

function tabToProjectType(tab: TabKey): 'mod' | 'resourcepack' | 'shader' {
  if (tab === 'mods') return 'mod'
  if (tab === 'resourcepacks') return 'resourcepack'
  return 'shader'
}

function categoryList(tab: TabKey): string[] {
  if (tab === 'mods') return MOD_CATEGORIES
  if (tab === 'resourcepacks') return RESOURCEPACK_CATEGORIES
  return SHADER_CATEGORIES
}

export function Browse() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const selectedInstanceId = useAppStore((state) => state.selectedInstanceId)

  const instanceParam = searchParams.get('instance') ?? undefined
  const instanceId = instanceParam ?? selectedInstanceId ?? undefined
  const kindParam = searchParams.get('kind')
  const qParam = searchParams.get('q') ?? ''

  const initialTab: TabKey =
    kindParam === 'resourcepack' || kindParam === 'resourcepacks'
      ? 'resourcepacks'
      : kindParam === 'shader' || kindParam === 'shaders'
        ? 'shaders'
        : 'mods'

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [query, setQuery] = useState(qParam)
  const [debouncedQuery, setDebouncedQuery] = useState(qParam)
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>('relevance')
  const [loader, setLoader] = useState<(typeof LOADER_OPTIONS)[number]>('any')
  const [mcVersion, setMcVersion] = useState('')
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [detailHit, setDetailHit] = useState<MrSearchHit | null>(null)
  const [installProjectId, setInstallProjectId] = useState<string | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(handle)
  }, [query])

  const instancesQuery = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.instances.list(),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const instance = instancesQuery.data?.find((item) => item.id === instanceId)
    if (instance?.mcVersion && !mcVersion) {
      setMcVersion(instance.mcVersion)
    }
  }, [instancesQuery.data, instanceId, mcVersion])

  useEffect(() => {
    const projectType = tabToProjectType(activeTab)
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('kind', projectType)
      if (instanceId) next.set('instance', instanceId)
      if (query) next.set('q', query)
      else next.delete('q')
      return next
    }, { replace: true })
  }, [activeTab, instanceId, query, setSearchParams])

  const projectType = tabToProjectType(activeTab)
  const loaderFilter = loader === 'any' ? undefined : loader

  const searchQuery = useInfiniteQuery({
    queryKey: ['modrinth', 'search', projectType, debouncedQuery, sort, loaderFilter, mcVersion, category],
    queryFn: ({ pageParam }) =>
      api.modrinth.search({
        query: debouncedQuery || undefined,
        projectType,
        loader: loaderFilter,
        mcVersion: mcVersion || undefined,
        category,
        sort,
        offset: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.hits.length
      return nextOffset < lastPage.total_hits ? nextOffset : undefined
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const contentQuery = useQuery({
    queryKey: ['content', 'list', instanceId],
    queryFn: () => api.content.list(instanceId!),
    enabled: Boolean(instanceId),
    staleTime: 5 * 60 * 1000,
  })

  const installedIds = useMemo(() => {
    return new Set((contentQuery.data ?? []).map((item) => item.projectId).filter(Boolean) as string[])
  }, [contentQuery.data])

  const hits = useMemo(() => searchQuery.data?.pages.flatMap((page) => page.hits) ?? [], [searchQuery.data])
  const totalHits = searchQuery.data?.pages[0]?.total_hits ?? 0

  const detailProjectQuery = useQuery({
    queryKey: ['modrinth', 'project', detailHit?.project_id],
    queryFn: () => api.modrinth.project(detailHit!.project_id),
    enabled: Boolean(detailHit),
    staleTime: 5 * 60 * 1000,
  })

  const detailVersionsQuery = useQuery({
    queryKey: ['modrinth', 'versions', detailHit?.project_id, loaderFilter, mcVersion],
    queryFn: () => api.modrinth.versions(detailHit!.project_id, { loader: loaderFilter, mcVersion: mcVersion || undefined }),
    enabled: Boolean(detailHit),
    staleTime: 5 * 60 * 1000,
  })

  const openInstallDialog = (projectId: string) => {
    setInstallProjectId(projectId)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('browse.title', { defaultValue: 'Browse' })}</h1>
        <p className="text-sm text-muted-foreground">
          {t('browse.subtitle', { defaultValue: 'Find mods, resource packs, and shaders on Modrinth.' })}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
        <TabsList>
          <TabsTrigger value="mods">{t('browse.tabs.mods', { defaultValue: 'Mods' })}</TabsTrigger>
          <TabsTrigger value="resourcepacks">{t('browse.tabs.resourcePacks', { defaultValue: 'Resource packs' })}</TabsTrigger>
          <TabsTrigger value="shaders">{t('browse.tabs.shaders', { defaultValue: 'Shaders' })}</TabsTrigger>
        </TabsList>

        {(['mods', 'resourcepacks', 'shaders'] as TabKey[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('browse.searchPlaceholder', { defaultValue: 'Search projects…' })}
                className="lg:max-w-sm"
                aria-label={t('browse.search', { defaultValue: 'Search' })}
              />

              <Select value={sort} onValueChange={(value) => setSort(value as (typeof SORT_OPTIONS)[number])}>
                <SelectTrigger className="lg:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`browse.sort.${option}`, { defaultValue: option })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={loader} onValueChange={(value) => setLoader(value as (typeof LOADER_OPTIONS)[number])}>
                <SelectTrigger className="lg:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOADER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === 'any'
                        ? t('browse.loader.any', { defaultValue: 'Any loader' })
                        : option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={mcVersion}
                onChange={(event) => setMcVersion(event.target.value)}
                placeholder={t('browse.mcVersion', { defaultValue: 'Minecraft version' })}
                className="lg:w-40"
                aria-label={t('browse.mcVersion', { defaultValue: 'Minecraft version' })}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categoryList(tab).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory((current) => (current === item ? undefined : item))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    category === item ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {searchQuery.isLoading && hits.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : searchQuery.isError ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t('browse.error', { defaultValue: 'Failed to load projects.' })}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => searchQuery.refetch()}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('browse.empty', { defaultValue: 'No projects found.' })}
        </div>
      ) : (
        <>
          <ContentRow
            title={t('browse.results', { defaultValue: 'Results' })}
            description={t('browse.resultCount', {
              defaultValue: '{{count}} projects',
              count: totalHits,
            })}
          >
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {hits.map((hit) => (
                <ProjectCard
                  key={hit.project_id}
                  hit={hit}
                  installed={installedIds.has(hit.project_id)}
                  onClick={() => setDetailHit(hit)}
                  onInstall={() => openInstallDialog(hit.project_id)}
                />
              ))}
            </div>
          </ContentRow>

          {searchQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => searchQuery.fetchNextPage()}
                disabled={searchQuery.isFetchingNextPage}
              >
                {searchQuery.isFetchingNextPage
                  ? t('common.loading', { defaultValue: 'Loading…' })
                  : t('browse.loadMore', { defaultValue: 'Load more' })}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(detailHit)} onOpenChange={(open) => !open && setDetailHit(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detailProjectQuery.data?.title ?? detailHit?.title}</DialogTitle>
            <DialogDescription>
              {detailProjectQuery.data?.description ?? detailHit?.description}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {detailProjectQuery.data?.body && (
                <p className="whitespace-pre-wrap text-sm">{detailProjectQuery.data.body}</p>
              )}

              {Array.isArray(detailProjectQuery.data?.gallery) && detailProjectQuery.data.gallery.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {detailProjectQuery.data.gallery
                    .map((item: any) => (typeof item === 'string' ? item : item?.url))
                    .filter(Boolean)
                    .map((url: string, index: number) => (
                      <img
                        key={index}
                        src={url}
                        alt=""
                        className="aspect-video w-full rounded-md object-cover"
                        loading="lazy"
                      />
                    ))}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="font-semibold">{t('browse.versions', { defaultValue: 'Versions' })}</h3>
                {detailVersionsQuery.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (detailVersionsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('browse.noVersions', { defaultValue: 'No compatible versions.' })}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(detailVersionsQuery.data ?? []).map((version) => (
                      <div key={version.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{version.versionNumber}</span>
                          <Badge variant="outline">{version.versionType}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {version.gameVersions.join(', ')} · {version.loaders.join(', ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(version.downloads)} {t('browse.downloads', { defaultValue: 'downloads' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDetailHit(null)}>
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
            {detailHit && (
              <Button onClick={() => openInstallDialog(detailHit.project_id)}>
                {t('browse.install', { defaultValue: 'Install' })}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {installProjectId && (
        <InstallDialog
          projectId={installProjectId}
          kind={projectType as any}
          instanceId={instanceId}
          open
          onOpenChange={(open) => {
            if (!open) setInstallProjectId(null)
          }}
        />
      )}
    </div>
  )
}

export default Browse

