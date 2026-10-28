import fs from 'node:fs/promises'
import path from 'node:path'
import { unzipSync, strFromU8, strToU8, zipSync } from 'fflate'
import type { Instance, Loader } from '../../shared/types'
import { PathUnsafeError } from '../util/path-safety'
import { getPaths } from './paths'
import { createInstance, getInstance, updateInstance } from './instances'
import { downloadFile } from './download'
import { installVanilla } from './game'
import { installLoader } from './loaders'
import { getProjectVersions, getVersion, sortVersions } from './modrinth'

export interface MrpackFile {
  path: string
  hashes: { sha1?: string; sha512?: string }
  env?: { client?: string; server?: string }
  downloads: string[]
  fileSize: number
}

export interface MrpackInfo {
  name: string
  versionId: string
  mcVersion: string
  loader: Loader
  loaderVersion?: string
  files: MrpackFile[]
  overrides: string[]
  clientOverrides: string[]
  formatVersion: number
}

function assertZipPath(p: string): void {
  if (!p || typeof p !== 'string') throw new PathUnsafeError('unsafe entry')
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) throw new PathUnsafeError('absolute entry')
  if (p.includes('\\')) throw new PathUnsafeError('separator')
  const segs = p.split('/')
  if (segs.includes('..') || segs.includes('.')) {
    // allow '.'? reject to be safe for traversal; but filenames may contain dots not segments
  }
  if (segs.some((s) => s === '..')) throw new PathUnsafeError('traversal')
}

export async function parseMrpack(input: string | Buffer | Uint8Array): Promise<MrpackInfo> {
  let buf: Uint8Array
  if (typeof input === 'string') {
    const data = await fs.readFile(input)
    buf = new Uint8Array(data)
  } else if (Buffer.isBuffer(input)) {
    buf = new Uint8Array(input as Buffer)
  } else {
    buf = input as Uint8Array
  }

  const unzipped = unzipSync(buf)

  for (const p of Object.keys(unzipped)) {
    assertZipPath(p)
  }

  const indexEntry = unzipped['modrinth.index.json']
  if (!indexEntry) throw new Error('NOT_FOUND')
  const index = JSON.parse(strFromU8(indexEntry))

  if (index.formatVersion !== 1) throw new Error('VERSION')
  if (index.game !== 'minecraft') throw new Error('VERSION')

  const deps = index.dependencies || {}
  const mcVersion = deps.minecraft
  if (!mcVersion) throw new Error('VERSION')

  let loader: Loader = 'vanilla'
  let loaderVersion: string | undefined
  if (deps['fabric-loader']) {
    loader = 'fabric'
    loaderVersion = deps['fabric-loader']
  } else if (deps['quilt-loader']) {
    loader = 'quilt'
    loaderVersion = deps['quilt-loader']
  } else if (deps['forge']) {
    loader = 'forge'
    loaderVersion = deps['forge']
  } else if (deps['neoforge']) {
    loader = 'neoforge'
    loaderVersion = deps['neoforge']
  }

  const files: MrpackFile[] = (index.files || []).map((f: any) => ({
    path: f.path,
    hashes: f.hashes || {},
    env: f.env,
    downloads: f.downloads || [],
    fileSize: f.fileSize || 0,
  }))

  for (const f of files) {
    assertZipPath(f.path)
  }

  const overrides = Object.keys(unzipped).filter((p) => p.startsWith('overrides/') && p !== 'overrides/')
  const clientOverrides = Object.keys(unzipped).filter((p) => p.startsWith('client-overrides/') && p !== 'client-overrides/')

  for (const p of [...overrides, ...clientOverrides]) {
    assertZipPath(p)
  }

  return {
    name: index.name,
    versionId: index.versionId,
    mcVersion,
    loader,
    loaderVersion,
    files,
    overrides,
    clientOverrides,
    formatVersion: index.formatVersion,
  }
}

async function sendProgress(payload: any): Promise<void> {
  try {
    const { BrowserWindow } = await import('electron')
    for (const w of BrowserWindow.getAllWindows()) {
      try { w.webContents.send('content:progress', payload) } catch {}
    }
  } catch {}
}

export async function installModpack(input: any, opts?: any): Promise<string> {
  const onProgress = opts?.onProgress || input?.onProgress
  const pH = getPaths()
  await pH.ensureDirs()

  let projectId = input?.projectId
  let zipPath: string | undefined
  let parsed: MrpackInfo
  let mrVersionId: string | undefined

  if (projectId) {
    let latest: any
    if (input?.versionId) {
      latest = await getVersion(input.versionId)
    } else {
      const versions = await getProjectVersions(projectId, {})
      if (!versions?.length) throw new Error('NOT_FOUND')
      latest = sortVersions(versions)[0]
    }
    mrVersionId = latest.id
    const file = (latest.files || []).find((f: any) => f.primary) || (latest.files || [])[0]
    if (!file) throw new Error('NOT_FOUND')
    zipPath = path.join(pH.cacheDir, 'modpacks', `${latest.id}.mrpack`)
    await fs.mkdir(path.dirname(zipPath), { recursive: true })
    await downloadFile({ urls: [file.url], dest: zipPath, sha1: file.hashes?.sha1, size: file.size })
    parsed = await parseMrpack(zipPath)
  } else if (input?.filePath) {
    parsed = await parseMrpack(input.filePath)
    zipPath = input.filePath
  } else {
    throw new Error('VALIDATION')
  }

  const name = input?.instanceName || input?.name || parsed.name

  const inst = await createInstance({
    name,
    mcVersion: parsed.mcVersion,
    loader: parsed.loader,
    loaderVersion: parsed.loaderVersion,
  })

  const progress = (stage: string, current?: number, total?: number) => {
    if (onProgress) onProgress({ stage, current, total })
    sendProgress({ instanceId: inst.id, stage, current, total })
  }

  progress('vanilla', 0, 1)
  await installVanilla(parsed.mcVersion, { onProgress })

  let versionId = parsed.mcVersion
  if (parsed.loader !== 'vanilla') {
    progress('loader', 0, 1)
    const lid = await installLoader(inst, { onProgress })
    versionId = lid
    await updateInstance(inst.id, { versionId: lid, loaderVersion: parsed.loaderVersion })
  }

  const files = parsed.files.filter((f) => f.env?.client !== 'unsupported')
  let i = 0
  for (const f of files) {
    progress('files', i, files.length)
    const url = f.downloads?.[0]
    if (!url) { i++; continue }
    if (f.path.startsWith('/') || f.path.includes('..')) throw new PathUnsafeError('unsafe')
    const dest = path.join(pH.instanceDir(inst.id), ...f.path.split('/'))
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await downloadFile({ urls: [url], dest, sha1: f.hashes?.sha1, size: f.fileSize })
    i++
  }

  progress('overrides', 0, 1)
  const buf = await fs.readFile(zipPath!)
  const unzipped = unzipSync(new Uint8Array(buf))

  const writeEntry = async (entryPath: string, targetRel: string) => {
    const data = unzipped[entryPath]
    if (!data) return
    const dest = path.join(pH.instanceDir(inst.id), ...targetRel.split('/'))
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, data)
  }

  for (const key of parsed.overrides) {
    const rel = key.slice('overrides/'.length)
    if (!rel) continue
    await writeEntry(key, rel)
  }
  for (const key of parsed.clientOverrides) {
    const rel = key.slice('client-overrides/'.length)
    if (!rel) continue
    await writeEntry(key, rel)
  }

  await updateInstance(inst.id, {
    modpack: {
      projectId: projectId || '',
      versionId: mrVersionId ?? parsed.versionId,
      name: parsed.name,
      version: parsed.versionId,
    },
  })

  progress('done', files.length, files.length)
  return inst.id
}

export async function checkModpackUpdate(instanceId: string): Promise<any> {
  const inst = await getInstance(instanceId)
  if (!inst?.modpack?.projectId) return { available: false }
  const versions = await getProjectVersions(inst.modpack.projectId, {})
  if (!versions?.length) return { available: false }
  const latest = sortVersions(versions)[0]
  if (latest.id === inst.modpack.versionId) {
    return { available: false, versionId: latest.id }
  }
  return {
    available: true,
    versionId: latest.id,
    currentVersionId: inst.modpack.versionId,
    versionNumber: latest.versionNumber,
  }
}

export async function updateModpack(instanceId: string, opts?: any): Promise<void> {
  const pH = getPaths()

  const inst = await getInstance(instanceId)
  if (!inst?.modpack?.projectId) throw new Error('NOT_FOUND')

  const versions = await getProjectVersions(inst.modpack.projectId, {})
  if (!versions?.length) throw new Error('NOT_FOUND')
  const latest = sortVersions(versions)[0]

  const file = (latest.files || []).find((f: any) => f.primary) || (latest.files || [])[0]
  if (!file) throw new Error('NOT_FOUND')
  const dest = path.join(pH.cacheDir, 'modpacks', `${latest.id}.mrpack`)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await downloadFile({ urls: [file.url], dest, sha1: file.hashes?.sha1, size: file.size })

  const parsed = await parseMrpack(dest)

  const files = parsed.files.filter((f) => f.env?.client !== 'unsupported')
  for (const f of files) {
    const url = f.downloads?.[0]
    if (!url) continue
    const destFile = path.join(pH.instanceDir(instanceId), ...f.path.split('/'))
    await fs.mkdir(path.dirname(destFile), { recursive: true })
    await downloadFile({ urls: [url], dest: destFile, sha1: f.hashes?.sha1, size: f.fileSize })
  }

  const buf = await fs.readFile(dest)
  const unzipped = unzipSync(new Uint8Array(buf))
  for (const key of parsed.overrides) {
    const rel = key.slice('overrides/'.length)
    if (!rel) continue
    const data = unzipped[key]
    if (!data) continue
    const target = path.join(pH.instanceDir(instanceId), ...rel.split('/'))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, data)
  }
  for (const key of parsed.clientOverrides) {
    const rel = key.slice('client-overrides/'.length)
    if (!rel) continue
    const data = unzipped[key]
    if (!data) continue
    const target = path.join(pH.instanceDir(instanceId), ...rel.split('/'))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, data)
  }

  await updateInstance(instanceId, {
    modpack: {
      projectId: inst.modpack.projectId,
      versionId: latest.id,
      name: parsed.name,
      version: latest.id,
    },
  })
}