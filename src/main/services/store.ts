import fs from 'node:fs/promises'
import path from 'node:path'
import { PathUnsafeError } from '../util/path-safety'

export class JsonStore<T> {
  private filePath: string
  private backupPath: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.backupPath = filePath + '.bak'
  }

  get path(): string { return this.filePath }

  async read(fallback: T): Promise<T> {
    const tryRead = async (p: string): Promise<T | null> => {
      try {
        const raw = await fs.readFile(p, 'utf8')
        return JSON.parse(raw) as T
      } catch (e: any) {
        if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return null
        return null
      }
    }
    const primary = await tryRead(this.filePath)
    if (primary !== null) return primary
    const backup = await tryRead(this.backupPath)
    if (backup !== null) return backup
    return fallback
  }

  async write(value: T): Promise<void> {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })
    const tmp = this.filePath + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 })
    // backup existing
    try {
      await fs.rename(this.filePath, this.backupPath)
    } catch (e: any) {
      if (e && e.code !== 'ENOENT') throw e
    }
    await fs.rename(tmp, this.filePath)
    try { await fs.copyFile(this.filePath, this.backupPath) } catch {}
  }

  async init(defaults: T): Promise<T> {
    try {
      await fs.access(this.filePath)
      return await this.read(defaults)
    } catch {
      await this.write(defaults)
      return defaults
    }
  }
}

export function mergeDeep<T extends Record<string, any>>(base: T, patch: any): T {
  if (patch === undefined || patch === null) return base
  if (Array.isArray(patch)) return patch as any
  if (typeof patch !== 'object') return patch as any
  const out: any = Array.isArray(base) ? [...base] : { ...base }
  for (const key of Object.keys(patch)) {
    const pv = patch[key]
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && base && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      out[key] = mergeDeep(base[key], pv)
    } else if (pv !== undefined) {
      out[key] = pv
    }
  }
  return out as T
}

export { PathUnsafeError }
