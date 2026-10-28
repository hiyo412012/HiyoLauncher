import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Instance, MrSearchHit } from '@shared/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { ModpackCard } from '@/components/content/ModpackCard'
import { ContentRow } from '@/components/content/ContentRow'
import { InstallDialog } from '@/components/content/InstallDialog'

const PAGE_SIZE = 20

export function Modpacks() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [installProjectId, setInstallProjectId] = useState<string | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(handle)
  }, [query])

  const popularQuery = useQuery({
    queryKey: ['modrinth', 'search', 'modpack', 'popular'],
    queryFn: () =>
      api.modrinth.search({
        projectType: 'modpack',
        sort: 'downloads',
        limit: 12,
        offset: 0,
      }),
    staleTime: 5 * 60 * 1000,
  })

  const updatedQuery = useQuery({
    queryKey: ['modrinth', 'search', 'modpack', 'updated'],
    queryFn: () =>
      api.modrinth.search({
        projectType: 'modpack',
        sort: 'updated',
        limit: 12,
        offset: 0,
      }),
    staleTime: 5 * 60 * 1000,
  })

  const searchQuery = useInfiniteQuery({
    queryKey: ['modrinth', 'search', 'modpack', debouncedQuery],
    queryFn: ({ pageParam }) =>
      api.modrinth.search({
        query: debouncedQuery || undefined,
        projectType: 'modpack',
        sort: debouncedQuery ? 'relevance' : 'downloads',
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
    enabled: debouncedQuery.length > 0,
  })

  const instancesQuery = useQuery({
    queryKey: ['instances'],
    queryFn: () => api.instances.list(),
    staleTime: 5 * 60 * 1000,
  })

  const modpackInstances = useMemo(
    () => (instancesQuery.data ?? []).filter((instance) => Boolean(instance.modpack)),
    [instancesQuery.data],
  )

  const updateChecks = useQueries({
    queries: modpackInstances.map((instance) => ({
      queryKey: ['modpack', 'checkUpdate', instance.id],
      queryFn: () => api.modpack.checkUpdate(instance.id),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const handleUpdate = async (instance: Instance) => {
    try {
      await api.modpack.update(instance.id)
      toast.success(t('modpacks.updated', { defaultValue: 'Modpack updated.' }))
      queryClient.invalidateQueries({ queryKey: ['instances'] })
    } catch (error: any) {
      toast.error(error?.message || t('modpacks.updateFailed', { defaultValue: 'Update failed.' }))
    }
  }

  const handleDelete = async (instance: Instance) => {
    if (!window.confirm(t('modpacks.deleteConfirm', { defaultValue: 'Delete this instance?' }))) return
    try {
      await api.instances.remove(instance.id, true)
      toast.success(t('modpacks.deleted', { defaultValue: 'Instance deleted.' }))
      queryClient.invalidateQueries({ queryKey: ['instances'] })
    } catch (error: any) {
      toast.error(error?.message || t('modpacks.deleteFailed', { defaultValue: 'Delete failed.' }))
    }
  }

  const renderCard = (hit: MrSearchHit) => (
    <ModpackCard
      key={hit.project_id}
      hit={hit}
      onClick={() => setInstallProjectId(hit.project_id)}
      onInstall={() => setInstallProjectId(hit.project_id)}
    />
  )

  const searchHits = searchQuery.data?.pages.flatMap((page) => page.hits) ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('modpacks.title', { defaultValue: 'Modpacks' })}</h1>
        <p className="text-sm text-muted-foreground">
          {t('modpacks.subtitle', { defaultValue: 'Discover and install curated Minecraft modpacks.' })}
        </p>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('modpacks.searchPlaceholder', { defaultValue: 'Search modpacks…' })}
        aria-label={t('modpacks.search', { defaultValue: 'Search modpacks' })}
      />

      {debouncedQuery ? (
        searchQuery.isLoading && searchHits.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-14 w-14 rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchHits.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t('modpacks.empty', { defaultValue: 'No modpacks found.' })}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {searchHits.map(renderCard)}
            </div>
            {searchQuery.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => searchQuery.fetchNextPage()}
                  disabled={searchQuery.isFetchingNextPage}
                >
                  {searchQuery.isFetchingNextPage
                    ? t('common.loading', { defaultValue: 'Loading…' })
                    : t('modpacks.loadMore', { defaultValue: 'Load more' })}
                </Button>
              </div>
            )}
          </>
        )
      ) : (
        <>
          <ContentRow
            title={t('modpacks.popular', { defaultValue: 'Popular' })}
            loading={popularQuery.isLoading}
            emptyText={t('modpacks.empty', { defaultValue: 'No modpacks found.' })}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(popularQuery.data?.hits ?? []).map(renderCard)}
            </div>
          </ContentRow>

          <ContentRow
            title={t('modpacks.recentlyUpdated', { defaultValue: 'Recently updated' })}
            loading={updatedQuery.isLoading}
            emptyText={t('modpacks.empty', { defaultValue: 'No modpacks found.' })}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(updatedQuery.data?.hits ?? []).map(renderCard)}
            </div>
          </ContentRow>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('modpacks.installed', { defaultValue: 'Installed modpacks' })}</h2>
        {modpackInstances.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('modpacks.noInstalled', { defaultValue: 'No modpack instances yet.' })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {modpackInstances.map((instance, index) => {
              const update = updateChecks[index]?.data
              const checking = updateChecks[index]?.isLoading
              return (
                <Card key={instance.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{instance.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {instance.mcVersion} · {instance.loader}
                          {instance.modpack && ` · ${instance.modpack.version}`}
                        </p>
                      </div>
                      {update?.available && (
                        <Badge variant="secondary">{t('modpacks.updateAvailable', { defaultValue: 'Update available' })}</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => navigate(`/instances/${instance.id}`)}>
                        {t('modpacks.open', { defaultValue: 'Open' })}
                      </Button>
                      {update?.available && (
                        <Button size="sm" variant="secondary" onClick={() => handleUpdate(instance)} disabled={checking}>
                          {t('modpacks.update', { defaultValue: 'Update' })}
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(instance)}>
                        {t('modpacks.delete', { defaultValue: 'Delete' })}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {installProjectId && (
        <InstallDialog
          projectId={installProjectId}
          kind="modpack"
          open
          onOpenChange={(open) => {
            if (!open) setInstallProjectId(null)
          }}
        />
      )}
    </div>
  )
}

export default Modpacks

