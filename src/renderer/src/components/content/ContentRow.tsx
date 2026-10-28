import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface ContentRowProps {
  title: string
  description?: string
  children?: React.ReactNode
  items?: unknown[]
  renderItem?: (item: unknown, index: number) => React.ReactNode
  loading?: boolean
  skeletonCount?: number
  emptyText?: string
  className?: string
}

export function ContentRow({
  title,
  description,
  children,
  items,
  renderItem,
  loading = false,
  skeletonCount = 6,
  emptyText,
  className,
}: ContentRowProps) {
  const { t } = useTranslation()

  const renderedChildren =
    children ??
    (items && renderItem ? items.map((item, index) => renderItem(item, index)) : null)

  const hasContent = Boolean(renderedChildren && (!Array.isArray(renderedChildren) || renderedChildren.length > 0))

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <Card key={index} className="w-64 shrink-0">
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hasContent ? (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-2">{renderedChildren}</div>
        </ScrollArea>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyText ?? t('content.empty', { defaultValue: 'No content available.' })}
        </div>
      )}
    </section>
  )
}