import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { PathUnsafeError } from './path-safety'

export const MAX_CONCURRENCY = 8

export interface DownloadProgress {
  label?: string
  current: number
  total: number
  bytesPerSec?: number
}

export interface DownloadFileInput {
  /** URL or list of mirror URLs */
  url?: string
  urls?: string | string[]
  /** destination file path */
  dest?: string
  destination?: string
  path?: string
  sha1?: string
  checksum?: string
  hash?: string
  size?: number
  signal?: AbortSignal
  label?: string
  onProgress?: (p: DownloadProgress) => void
  fetch?: typeof fetch
  retries?: number
}

export interface DownloadFilesOptions {
  concurrency?: number
  onProgress?: (p: DownloadProgress) => void
  signal?: AbortSignal
}

function resolveUrls(input: DownloadFileInput): string[] {
  const raw = input.urls ?? input.url
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return []
}

function resolveDest(input: DownloadFileInput): string {
  return (input.dest ?? input.destination ?? input.path ?? '').trim()
}

function resolveSha1(input: DownloadFileInput): string | undefined {
  return input.sha1 ?? input.checksum ?? input.hash
}

function assertSafeDest(dest: string): void {
  if (!dest) throw new PathUnsafeError('empty dest')
  if (dest.includes('\u0000')) throw new PathUnsafeError('NUL in dest')
  const parts = dest.split(/[\\/]/)
  for (const seg of parts) {
    if (seg === '..') throw new PathUnsafeError('traversal in dest')
  }
  // reject relative traversal tokens
  if (dest.includes('..')) {
    // allow only if not a segment? still unsafe
    throw new PathUnsafeError('traversal in dest')
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const trimmed = header.trim()
  const secs = Number(trimmed)
  if (!Number.isNaN(secs) && secs >= 0) return secs * 1000
  // HTTP-date
  const date = Date.parse(trimmed)
  if (!Number.isNaN(date)) {
    const delta = date - Date.now()
    return delta > 0 ? delta : 0
  }
  return null
}

export async function sha1File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

interface ThrottledProgress {
  (current: number, total: number, label?: string): void
  flush: () => void
}

function makeThrottledProgress(
  cb: (p: DownloadProgress) => void,
  label: string | undefined,
  minInterval = 100,
): ThrottledProgress {
  let last = 0
  let pending: { current: number; total: number } | null = null
  let timer: NodeJS.Timeout | null = null
  const emit = (current: number, total: number) => {
    cb({ label, current, total })
  }
  const fn = ((current: number, total: number, lbl?: string) => {
    const now = Date.now()
    const l = lbl ?? label
    if (now - last >= minInterval) {
      last = now
      emit(current, total)
      if (l !== label) {
        // keep label param unused warning guard
      }
    } else {
      pending = { current, total }
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          if (pending) {
            last = Date.now()
            emit(pending.current, pending.total)
            pending = null
          }
        }, minInterval)
      }
    }
  }) as ThrottledProgress
  fn.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (pending) {
      emit(pending.current, pending.total)
      pending = null
    }
  }
  return fn
}

export async function downloadFile(input: DownloadFileInput): Promise<string> {
  const urls = resolveUrls(input)
  if (!urls.length) throw new Error('NO_URL')
  const dest = resolveDest(input)
  assertSafeDest(dest)
  const sha1 = resolveSha1(input)
  const fetchImpl = input.fetch ?? fetch
  const signal = input.signal
  const retries = input.retries ?? 3
  const partPath = dest + '.part'
  const delays = [1000, 2000, 4000]

  await fsp.mkdir(path.dirname(dest), { recursive: true })

  // Fast path: exact size match is enough for launcher-managed game files.
  if (input.size && input.size > 0) {
    try {
      const stat = await fsp.stat(dest)
      if (stat.isFile() && stat.size === input.size) return dest
    } catch {}
  }

  // Fast path: an existing file with a matching checksum never needs downloading.
  if (sha1) {
    try {
      const actual = await sha1File(dest)
      if (actual.toLowerCase() === sha1.toLowerCase()) return dest
    } catch {}
  }

  const throttled = input.onProgress
    ? makeThrottledProgress(input.onProgress, input.label, 100)
    : null

  let lastError: any = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      await safeUnlink(partPath)
      throw new Error('ABORTED')
    }
    let attemptFailed = false
    for (const url of urls) {
      try {
        const res = await fetchImpl(url, { signal })
        if (res.status === 429) {
          const wait = parseRetryAfter(res.headers.get('retry-after'))
          await sleep(wait ?? delays[Math.min(attempt, delays.length - 1)])
          throw new Error('HTTP_429')
        }
        if (!res.ok) {
          throw new Error(`HTTP_${res.status}`)
        }
        const total = input.size ?? Number(res.headers.get('content-length') ?? 0) ?? 0
        const body = res.body
        if (!body) throw new Error('NO_BODY')

        // stream to part file
        await fsp.mkdir(path.dirname(partPath), { recursive: true })
        const fileStream = fs.createWriteStream(partPath)
        let current = 0
        const nodeStream = Readable.fromWeb(body as any)
        nodeStream.on('data', (chunk: Buffer) => {
          current += chunk.length
          if (throttled) throttled(current, total || current, input.label)
          if (signal?.aborted) nodeStream.destroy(new Error('ABORTED'))
        })
        await pipeline(nodeStream, fileStream)
        if (total > 0 && current !== total) {
          throw new Error(`INCOMPLETE_DOWNLOAD ${dest} expected ${total} bytes got ${current}`)
        }
        if (current === 0) {
          throw new Error(`EMPTY_DOWNLOAD ${dest}`)
        }

        throttled?.flush()

        // verify sha1
        if (sha1) {
          const actual = await sha1File(partPath)
          if (actual.toLowerCase() !== sha1.toLowerCase()) {
            await safeUnlink(partPath)
            throw new Error(`CHECKSUM_MISMATCH ${dest} expected ${sha1} got ${actual}`)
          }
        }

        // rename part -> dest
        try { await fsp.unlink(dest) } catch {}
        await fsp.rename(partPath, dest)
        return dest
      } catch (e: any) {
        lastError = e
        attemptFailed = true
        if (typeof e?.message === 'string' && e.message.startsWith('CHECKSUM_MISMATCH')) {
          await safeUnlink(partPath)
          throw e
        }
        if (signal?.aborted || e?.message === 'ABORTED') {
          await safeUnlink(partPath)
          throw e
        }
        // try next mirror
        continue
      }
    }

    if (!attemptFailed) {
      // success already returned
    }

    if (attempt < retries) {
      const delay = delays[Math.min(attempt, delays.length - 1)]
      // honor 429 retry-after already slept; here base delay
      await sleep(delay)
    }
  }

  await safeUnlink(partPath)
  throw lastError ?? new Error('DOWNLOAD_FAILED')
}

async function safeUnlink(p: string): Promise<void> {
  try { await fsp.unlink(p) } catch {}
}

export async function downloadFiles(
  files: DownloadFileInput[],
  options: DownloadFilesOptions = {},
): Promise<string[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? MAX_CONCURRENCY, MAX_CONCURRENCY))
  const signal = options.signal
  const results: string[] = new Array(files.length)
  let index = 0
  let active = 0
  let doneCount = 0
  // aggregate progress
  const totals = files.map((f) => f.size ?? 0)
  const currents = files.map(() => 0)
  const report = () => {
    if (options.onProgress) {
      const cur = currents.reduce((a, b) => a + b, 0)
      const tot = totals.reduce((a, b) => a + b, 0)
      options.onProgress({ label: 'download', current: cur, total: tot })
    }
  }

  return await new Promise<string[]>((resolve, reject) => {
    const runNext = () => {
      if (signal?.aborted) {
        reject(new Error('ABORTED'))
        return
      }
      while (active < concurrency && index < files.length) {
        const i = index++
        active++
        const input = { ...files[i] }
        // wrap onProgress to aggregate
        const origProgress = input.onProgress
        input.onProgress = (p) => {
          currents[i] = p.current
          if (p.total) totals[i] = p.total
          if (origProgress) origProgress(p)
          report()
        }
        downloadFile(input)
          .then((dest) => {
            results[i] = dest
            active--
            doneCount++
            runNext()
            if (doneCount === files.length) resolve(results)
          })
          .catch((e) => {
            reject(e)
          })
      }
    }
    if (files.length === 0) resolve([])
    else runNext()
  })
}
