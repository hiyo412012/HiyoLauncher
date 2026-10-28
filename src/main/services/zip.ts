import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import { Unzip, UnzipInflate, Zip, ZipDeflate } from 'fflate'
import { PathUnsafeError } from '../util/path-safety'

interface WalkedFile {
  abs: string
  rel: string
  size: number
}

async function walkFiles(dir: string, base = dir): Promise<WalkedFile[]> {
  const out: WalkedFile[] = []
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(abs, base)))
    } else if (entry.isFile()) {
      const stat = await fsp.stat(abs)
      out.push({
        abs,
        rel: path.relative(base, abs).split(path.sep).join('/'),
        size: stat.size,
      })
    }
  }
  return out
}

const yieldToLoop = () => new Promise<void>((resolve) => setImmediate(resolve))

/**
 * Streams a directory into a ZIP file without loading the archive into memory.
 * Writes to a temporary file first so an interrupted backup never looks valid.
 */
export async function zipDirectory(
  sourceDir: string,
  outputFile: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const files = await walkFiles(sourceDir)
  const total = files.reduce((sum, file) => sum + file.size, 0)
  const temp = `${outputFile}.tmp-${process.pid}`
  await fsp.mkdir(path.dirname(outputFile), { recursive: true })

  const stream = fs.createWriteStream(temp)
  let blocked = false
  let zipError: Error | null = null
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      zipError = error
      return
    }
    if (chunk.length > 0 && !stream.write(Buffer.from(chunk))) blocked = true
    if (final) stream.end()
  })

  let current = 0
  try {
    for (const file of files) {
      const entry = new ZipDeflate(file.rel, { level: 6 })
      zip.add(entry)
      const reader = fs.createReadStream(file.abs, { highWaterMark: 1024 * 1024 })
      for await (const chunk of reader) {
        if (zipError) throw zipError
        entry.push(chunk as Buffer, false)
        current += (chunk as Buffer).length
        onProgress?.(current, total)
        if (blocked) {
          blocked = false
          await once(stream, 'drain')
        }
        await yieldToLoop()
      }
      entry.push(new Uint8Array(0), true)
      if (zipError) throw zipError
      if (blocked) {
        blocked = false
        await once(stream, 'drain')
      }
    }
    zip.end()
    await finished(stream)
    await fsp.rename(temp, outputFile)
  } catch (error) {
    stream.destroy()
    await fsp.rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

function safeZipEntry(name: string): string | null {
  const replaced = name.replace(/\\/g, '/')
  if (replaced.includes('\0')) throw new PathUnsafeError('NUL in ZIP entry')
  if (replaced.startsWith('/') || /^[a-zA-Z]:/.test(replaced)) {
    throw new PathUnsafeError('absolute ZIP entry')
  }
  const segments = replaced.split('/').filter((segment) => segment.length > 0 && segment !== '.')
  for (const segment of segments) {
    if (segment === '..') throw new PathUnsafeError('ZIP entry escapes destination')
  }
  if (segments.length === 0) return null
  return segments.join('/')
}

/** Streams a ZIP into a directory and rejects entries that escape it. */
export async function extractZip(
  zipFile: string,
  destination: string,
  onProgress?: (current: number) => void,
): Promise<void> {
  const root = path.resolve(destination)
  await fsp.mkdir(root, { recursive: true })

  const unzip = new Unzip()
  unzip.register(UnzipInflate)

  const pending: Promise<void>[] = []
  const drains = new Set<Promise<unknown>>()
  const errors: unknown[] = []
  let extracted = 0

  unzip.onfile = (file) => {
    let relative: string | null
    try {
      relative = safeZipEntry(file.name)
    } catch (error) {
      errors.push(error)
      return
    }
    if (relative === null) return
    const target = path.resolve(root, relative)
    if (target !== root && !target.startsWith(root + path.sep)) {
      errors.push(new PathUnsafeError('ZIP entry escapes destination'))
      return
    }

    pending.push(
      (async () => {
        try {
          await fsp.mkdir(path.dirname(target), { recursive: true })
          if (file.name.endsWith('/')) {
            await fsp.mkdir(target, { recursive: true })
            return
          }
          const stream = fs.createWriteStream(target)
          const done = new Promise<void>((resolve, reject) => {
            stream.on('finish', resolve)
            stream.on('error', reject)
          })
          file.ondata = (error, chunk, final) => {
            if (error) {
              stream.destroy(error)
              return
            }
            if (chunk.length > 0) {
              extracted += chunk.length
              onProgress?.(extracted)
              if (!stream.write(Buffer.from(chunk))) drains.add(once(stream, 'drain'))
            }
            if (final) stream.end()
          }
          file.start()
          await done
        } catch (error) {
          errors.push(error)
        }
      })(),
    )
  }

  try {
    for await (const chunk of fs.createReadStream(zipFile, { highWaterMark: 1024 * 1024 })) {
      unzip.push(chunk as Buffer, false)
      if (errors.length > 0) throw errors[0]
      if (drains.size > 0) {
        await Promise.race([...drains])
        for (const drain of [...drains]) drains.delete(drain)
      }
      await yieldToLoop()
    }
    unzip.push(new Uint8Array(0), true)
    await Promise.all(pending)
    if (errors.length > 0) throw errors[0]
  } catch (error) {
    await Promise.allSettled(pending)
    throw error
  }
}
