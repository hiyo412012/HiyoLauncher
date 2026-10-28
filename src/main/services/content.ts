import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { assertSafeSegment, PathUnsafeError } from '../util/path-safety'
import type { Instance, InstalledContent, MrVersion, ContentKind } from '../../shared/types'
import { getPaths } from './paths'
import { getInstance } from './instances'
import { downloadFile } from './download'
import * as ModrinthMod from './modrinth'

const M: any = ModrinthMod

function gameRoot(): string {
  return getPaths().gameRoot
}
function instanceDir(id: string): string {
  return getPaths().instanceDir(id)
}
async function ensureDirs(): Promise<void> {
  await getPaths().ensureDirs()
}

export type { InstalledContent }

export function kindFolder(kind: ContentKind): string {
  switch (kind) {
    case 'mod':
      return 'mods'
    case 'resourcepack':
      return 'resourcepacks'
    case 'shader':
      return 'shaderpacks'
    case 'datapack':
      return 'datapacks'
  }
}

export function folderFor(instanceId: string, kind: ContentKind): string {
  return path.join(instanceDir(instanceId), kindFolder(kind))
}

export function isCompatible(version: MrVersion, instance: Instance, kind: ContentKind): boolean {
  if (version.gameVersions?.length && !version.gameVersions.includes(instance.mcVersion)) return false
  if (kind === 'mod' && version.loaders?.length && !version.loaders.includes(instance.loader)) return false
  return true
}

function incompatible(message: string): never {
  const e: any = new Error(message)
  e.code = 'CONTENT_INCOMPATIBLE'
  throw e
}

function resolveSafePath(root: string, p: string): string {
  const cleaned = p.replace(/\\/g, '/')
  const resolved = path.resolve(root, cleaned)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new PathUnsafeError('escapes root')
  }
  return resolved
}

async function readMetadata(instanceId: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(path.join(instanceDir(instanceId), 'mods', '.hiyo-content.json'), 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeMetadata(instanceId: string, arr: any[]): Promise<void> {
  const dir = path.join(instanceDir(instanceId), 'mods')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, '.hiyo-content.json'), JSON.stringify(arr, null, 2))
}

export async function listContent(instanceId: string): Promise<InstalledContent[]> {
  const meta = await readMetadata(instanceId)
  const metaMap = new Map(meta.map((m: any) => [m.filename, m]))
  const out: InstalledContent[] = []
  const kinds: ContentKind[] = ['mod', 'resourcepack', 'shader', 'datapack']
  for (const kind of kinds) {
    const folder = folderFor(instanceId, kind)
    let entries: string[] = []
    try {
      entries = await fs.readdir(folder)
    } catch {
      entries = []
    }
    for (const name of entries) {
      if (name === '.hiyo-content.json') continue
      const baseEnabledName = name.endsWith('.disabled') ? name.slice(0, -9) : name
      const enabled = !name.endsWith('.disabled')
      const m = metaMap.get(baseEnabledName) || metaMap.get(name)
      out.push({
        id: baseEnabledName,
        instanceId,
        kind,
        filename: baseEnabledName,
        enabled,
        projectId: m?.projectId,
        versionId: m?.versionId,
        versionNumber: m?.versionNumber,
        sha1: m?.sha1,
        installedAt: m?.installedAt ?? 0,
      })
    }
  }
  return out
}

export async function resolveDependencies(
  version: MrVersion,
  kind: ContentKind,
  instance?: Instance,
  depth = 0,
  seen: Set<string> = new Set(),
): Promise<MrVersion[]> {
  const out: MrVersion[] = []
  if (depth > 8) return out
  const deps = version.dependencies || []
  for (const d of deps) {
    if (d.dependencyType !== 'required') continue
    const key = d.projectId || d.versionId
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    let depVersion: MrVersion | null = null
    if (d.versionId) {
      depVersion = await M.getVersion(d.versionId)
    } else if (d.projectId) {
      const versions = await M.getProjectVersions(d.projectId, instance ? {
        loader: instance.loader === 'vanilla' ? undefined : instance.loader,
        mcVersion: instance.mcVersion,
      } : {})
      depVersion = versions?.[0] ?? null
    }
    if (!depVersion) continue
    if (instance && !isCompatible(depVersion, instance, kind)) incompatible('Dependency incompatible')
    out.push(depVersion)
    const nested = await resolveDependencies(depVersion, kind, instance, depth + 1, seen)
    out.push(...nested)
  }
  return out
}

export async function installContent(input: {
  instanceId: string
  projectId: string
  versionId?: string
  kind: ContentKind
}): Promise<InstalledContent[]> {
  await ensureDirs()
  const inst = await getInstance(input.instanceId)
  const project = await M.getProject(input.projectId)
  const expectedType = input.kind === 'mod' ? 'mod' : input.kind === 'resourcepack' ? 'resourcepack' : input.kind === 'shader' ? 'shader' : 'datapack'
  if (project.projectType !== expectedType) incompatible('Project type mismatch')

  let version: MrVersion
  if (input.versionId) {
    version = await M.getVersion(input.versionId)
  } else {
    const versions = await M.getProjectVersions(input.projectId, {
      loader: inst.loader === 'vanilla' ? undefined : inst.loader,
      mcVersion: inst.mcVersion,
    })
    if (!versions?.length) throw new Error('NOT_FOUND')
    version = versions[0]
  }
  if (!isCompatible(version, inst, input.kind)) incompatible('Incompatible content')

  const deps = await resolveDependencies(version, input.kind, inst)
  const all = [version, ...deps]
  const seenVersions = new Set<string>()
  const unique = all.filter((v) => {
    if (seenVersions.has(v.id)) return false
    seenVersions.add(v.id)
    return true
  })

  const folder = folderFor(input.instanceId, input.kind)
  await fs.mkdir(folder, { recursive: true })
  const meta = await readMetadata(input.instanceId)
  const installed: InstalledContent[] = []

  for (const v of unique) {
    const file = (v.files || []).find((f: any) => f.primary) || (v.files || [])[0]
    if (!file) continue
    const filename = file.filename
    assertSafeSegment(filename)
    const dest = path.join(folder, filename)
    await downloadFile({ url: file.url, urls: [file.url], dest, sha1: file.hashes?.sha1, size: file.size })

    const idx = meta.findIndex((m: any) => m.filename === filename)
    const entry = {
      projectId: v.projectId,
      projectSlug: project.slug,
      projectTitle: project.title,
      versionId: v.id,
      versionNumber: v.versionNumber,
      filename,
      sha1: file.hashes?.sha1,
      kind: input.kind,
      installedAt: Date.now(),
      iconUrl: project.iconUrl,
    }
    if (idx >= 0) meta[idx] = entry
    else meta.push(entry)

    installed.push({
      id: filename,
      instanceId: input.instanceId,
      kind: input.kind,
      filename,
      enabled: true,
      projectId: v.projectId,
      versionId: v.id,
      versionNumber: v.versionNumber,
      sha1: file.hashes?.sha1,
      installedAt: entry.installedAt,
    })
  }
  await writeMetadata(input.instanceId, meta)
  return installed
}

export async function toggleContent(instanceId: string, p: string, enabled: boolean): Promise<void> {
  const root = instanceDir(instanceId)
  const abs = resolveSafePath(root, p)
  const dir = path.dirname(abs)
  const base = path.basename(abs).replace(/\.disabled$/, '')
  const enabledPath = path.join(dir, base)
  const disabledPath = path.join(dir, base + '.disabled')

  if (enabled) {
    try { await fs.rename(disabledPath, enabledPath) } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e
    }
  } else {
    try { await fs.rename(enabledPath, disabledPath) } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e
    }
  }
}

export async function removeContent(instanceId: string, p: string): Promise<void> {
  const root = instanceDir(instanceId)
  const abs = resolveSafePath(root, p)
  await fs.rm(abs, { force: true }).catch(() => {})
  const base = path.basename(abs).replace(/\.disabled$/, '')
  const disabled = path.join(path.dirname(abs), base + '.disabled')
  await fs.rm(disabled, { force: true }).catch(() => {})

  const meta = await readMetadata(instanceId)
  const filtered = meta.filter((m: any) => m.filename !== base)
  await writeMetadata(instanceId, filtered)
}

export const deleteContent = removeContent

export async function checkUpdates(instanceId: string): Promise<any[]> {
  const inst = await getInstance(instanceId)
  const meta = await readMetadata(instanceId)
  const out: any[] = []
  for (const m of meta) {
    let versions: MrVersion[] = []
    try {
      versions = await M.getProjectVersions(m.projectId, {
        loader: inst.loader === 'vanilla' ? undefined : inst.loader,
        mcVersion: inst.mcVersion,
      })
    } catch {
      continue
    }
    if (!versions?.length) continue
    const latest = versions[0]
    const latestFile = (latest.files || []).find((f: any) => f.primary) || (latest.files || [])[0]
    const latestSha = latestFile?.hashes?.sha1
    if (latest.id !== m.versionId && latestSha && latestSha !== m.sha1) {
      out.push({
        instanceId,
        kind: m.kind,
        filename: m.filename,
        path: path.join(kindFolder(m.kind), m.filename),
        projectId: m.projectId,
        currentVersionId: m.versionId,
        latestVersionId: latest.id,
        latestVersionNumber: latest.versionNumber,
        sha1: m.sha1,
      })
    }
  }
  return out
}

export async function updateContent(instanceId: string, p: string, versionId?: string): Promise<any> {
  const inst = await getInstance(instanceId)
  const meta = await readMetadata(instanceId)
  const base = path.basename(p).replace(/\.disabled$/, '')
  const entry = meta.find((m: any) => m.filename === base)
  if (!entry) throw new Error('NOT_FOUND')

  const version: MrVersion = versionId
    ? await M.getVersion(versionId)
    : (await M.getProjectVersions(entry.projectId, {
        loader: inst.loader === 'vanilla' ? undefined : inst.loader,
        mcVersion: inst.mcVersion,
      }))[0]
  if (!version) throw new Error('NOT_FOUND')
  if (!isCompatible(version, inst, entry.kind)) incompatible('Incompatible')

  const file = (version.files || []).find((f: any) => f.primary) || (version.files || [])[0]
  if (!file) throw new Error('NOT_FOUND')
  const folder = folderFor(instanceId, entry.kind)
  const newFilename = file.filename
  assertSafeSegment(newFilename)
  const newDest = path.join(folder, newFilename)
  await downloadFile({ url: file.url, urls: [file.url], dest: newDest, sha1: file.hashes?.sha1, size: file.size })

  if (newFilename !== base) {
    await fs.rm(path.join(folder, base), { force: true }).catch(() => {})
    await fs.rm(path.join(folder, base + '.disabled'), { force: true }).catch(() => {})
  }

  entry.versionId = version.id
  entry.versionNumber = version.versionNumber
  entry.filename = newFilename
  entry.sha1 = file.hashes?.sha1
  entry.installedAt = Date.now()
  await writeMetadata(instanceId, meta)
  return {
    id: newFilename,
    instanceId,
    kind: entry.kind,
    filename: newFilename,
    enabled: true,
    projectId: entry.projectId,
    versionId: version.id,
    versionNumber: version.versionNumber,
    sha1: file.hashes?.sha1,
    installedAt: entry.installedAt,
  }
}