import fs from 'node:fs/promises'
import path from 'node:path'
import { assertSafeSegment } from '../util/path-safety'
import { resolveInstancePath } from './instance-files'
import type { ScreenshotEntry } from '../../shared/types'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export function isScreenshotFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase())
}

export function screenshotPath(root: string, file: string): string {
  assertSafeSegment(file)
  if (!isScreenshotFile(file)) throw new Error('UNSUPPORTED_IMAGE')
  return resolveInstancePath(root, `screenshots/${file}`)
}

export async function listScreenshots(root: string): Promise<ScreenshotEntry[]> {
  const dir = resolveInstancePath(root, 'screenshots')
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const shots: ScreenshotEntry[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !isScreenshotFile(entry.name)) continue
    const full = path.join(dir, entry.name)
    try {
      const stat = await fs.stat(full)
      shots.push({
        file: entry.name,
        name: path.basename(entry.name, path.extname(entry.name)),
        sizeBytes: stat.size,
        createdAt: stat.mtimeMs,
      })
    } catch {
      // Skip files that disappear while listing.
    }
  }
  return shots.sort((a, b) => b.createdAt - a.createdAt)
}
