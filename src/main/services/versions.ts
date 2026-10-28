import fs from 'node:fs/promises'
import path from 'node:path'
import { MinecraftFolder, Version } from '@xmcl/core'
import type { Paths } from './paths'
import { downloadFile, sha1File } from '../util/download'
import type { MinecraftVersionSummary } from '../../shared/types'

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const CACHE_TTL_MS = 60 * 60 * 1000

export interface VersionsOptions {
  paths?: Paths
  fetch?: typeof fetch
  force?: boolean
}

function resolvePaths(opts?: VersionsOptions): Paths | null {
  if (opts?.paths) return opts.paths
  return null
}

function cacheDir(opts?: VersionsOptions): string {
  const p = resolvePaths(opts)
  if (p) return p.cacheDir
  return path.join(process.cwd(), '.hiyo-cache')
}

function gameRoot(opts?: VersionsOptions): string {
  const p = resolvePaths(opts)
  if (p) return p.gameRoot
  return path.join(process.cwd(), '.hiyo-game')
}

function manifestCacheFile(opts?: VersionsOptions): string {
  return path.join(cacheDir(opts), 'mojang', 'version_manifest_v2.json')
}

function manifestMetaFile(opts?: VersionsOptions): string {
  return path.join(cacheDir(opts), 'mojang', 'version_manifest_v2.meta.json')
}

async function readCachedManifest(opts?: VersionsOptions): Promise<any | null> {
  try {
    const metaRaw = await fs.readFile(manifestMetaFile(opts), 'utf8')
    const meta = JSON.parse(metaRaw)
    if (Date.now() - (meta?.cachedAt ?? 0) > CACHE_TTL_MS) return null
    const raw = await fs.readFile(manifestCacheFile(opts), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeCachedManifest(manifest: any, opts?: VersionsOptions): Promise<void> {
  const dir = path.dirname(manifestCacheFile(opts))
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(manifestCacheFile(opts), JSON.stringify(manifest), 'utf8')
  await fs.writeFile(manifestMetaFile(opts), JSON.stringify({ cachedAt: Date.now() }), 'utf8')
}

export async function fetchVersionManifest(opts?: VersionsOptions): Promise<any> {
  const cached = opts?.force ? null : await readCachedManifest(opts)
  if (cached) return cached
  const fetchImpl = opts?.fetch ?? fetch
  const res = await fetchImpl(MANIFEST_URL)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const manifest = await res.json()
  try { await writeCachedManifest(manifest, opts) } catch {}
  return manifest
}

export async function listMinecraftVersions(
  forceOrOpts?: boolean | VersionsOptions,
): Promise<MinecraftVersionSummary[]> {
  const opts: VersionsOptions =
    typeof forceOrOpts === 'boolean' ? { force: forceOrOpts } : (forceOrOpts ?? {})
  const manifest = await fetchVersionManifest(opts)
  const versions = (manifest?.versions ?? []) as any[]
  return versions.map((v) => ({
    id: v.id,
    type: v.type,
    url: v.url,
    time: v.time,
    releaseTime: v.releaseTime,
  }))
}

export async function getVersionEntry(id: string, opts?: VersionsOptions): Promise<any> {
  const manifest = await fetchVersionManifest(opts)
  const versions = (manifest?.versions ?? []) as any[]
  const entry = versions.find((v) => v.id === id)
  if (!entry) throw new Error('VERSION_NOT_FOUND')
  return entry
}

export async function downloadVersionJson(id: string, opts?: VersionsOptions): Promise<string> {
  const paths = resolvePaths(opts)
  const root = gameRoot(opts)
  const entry = await getVersionEntry(id, opts)
  const destDir = path.join(root, 'versions', id)
  await fs.mkdir(destDir, { recursive: true })
  const dest = path.join(destDir, `${id}.json`)
  // if exists, skip
  try {
    await fs.access(dest)
    return dest
  } catch {}
  await downloadFile({ urls: entry.url, dest, sha1: undefined, fetch: opts?.fetch })
  return dest
}

export async function getVersionMeta(id: string, opts?: VersionsOptions): Promise<any> {
  const root = gameRoot(opts)
  const dest = path.join(root, 'versions', id, `${id}.json`)
  try {
    const raw = await fs.readFile(dest, 'utf8')
    return JSON.parse(raw)
  } catch {}
  await downloadVersionJson(id, opts)
  const raw = await fs.readFile(dest, 'utf8')
  return JSON.parse(raw)
}

export async function resolveVersion(id: string, opts?: VersionsOptions): Promise<any> {
  const root = gameRoot(opts)
  const mf = MinecraftFolder.from(root)
  return await Version.parse(mf, id)
}

// Back-compat aliases
export const getVersionJson = getVersionMeta
export const installJavaRuntime = undefined

export class VersionsService {
  constructor(private paths: Paths) {}
  async list(force = false): Promise<MinecraftVersionSummary[]> {
    return listMinecraftVersions({ paths: this.paths, force })
  }
  async getMeta(id: string): Promise<any> {
    return getVersionMeta(id, { paths: this.paths })
  }
  async downloadJson(id: string): Promise<string> {
    return downloadVersionJson(id, { paths: this.paths })
  }
  async resolve(id: string): Promise<any> {
    return resolveVersion(id, { paths: this.paths })
  }
}
