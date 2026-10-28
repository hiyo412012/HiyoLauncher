const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), BYTE_UNITS.length - 1)
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${BYTE_UNITS[i]}`
}

export function formatNumber(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return '0'
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  } catch {
    return String(value)
  }
}

export function formatPlaytime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0m'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function formatRelativeTime(
  input: number | string | Date,
  locale: string = 'vi',
  now: number = Date.now(),
): string {
  const date = input instanceof Date ? input : new Date(input)
  const time = date.getTime()
  if (!Number.isFinite(time)) return ''
  const diff = time - now
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second')
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  if (abs < 2_592_000_000) return rtf.format(Math.round(diff / 86_400_000), 'day')
  if (abs < 31_536_000_000) return rtf.format(Math.round(diff / 2_592_000_000), 'month')
  return rtf.format(Math.round(diff / 31_536_000_000), 'year')
}

export function formatDate(
  input: number | string | Date,
  locale: string = 'vi',
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = input instanceof Date ? input : new Date(input)
  if (!Number.isFinite(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}