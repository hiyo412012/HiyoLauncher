import { useTranslation } from 'react-i18next'

import type { MrSearchHit } from '@shared/types'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ProjectCardProps {
  hit: MrSearchHit
  installed?: boolean
  onClick?: () => void
  onInstall?: () => void
}

export function ProjectCard({ hit, installed = false, onClick, onInstall }: ProjectCardProps) {
  const { t } = useTranslation()

  return (
    <Card
      className={cn(
        'group relative flex h-full flex-col overflow-hidden transition-all hover:shadow-md',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          {hit.icon_url ? (
            <img
              src={hit.icon_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold">
              {hit.title.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold leading-tight">{hit.title}</h3>
              {installed && (
                <Badge variant="secondary" className="shrink-0">
                  {t('browse.installed', { defaultValue: 'Installed' })}
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{hit.author}</p>
          </div>
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">{hit.description}</p>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {hit.categories.slice(0, 3).map((category) => (
              <Badge key={category} variant="outline" className="text-[10px]">
                {category}
              </Badge>
            ))}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {t('browse.downloads', { defaultValue: '{{count}} downloads', count: formatNumber(hit.downloads) })}
          </span>
        </div>

        {onInstall && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 w-full"
            onClick={(event) => {
              event.stopPropagation()
              onInstall()
            }}
          >
            {t('browse.install', { defaultValue: 'Install' })}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}