import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { assertSafeSegment } from '../util/path-safety'
import type { Paths } from './paths'
import type { Instance } from '../../shared/types'

const RESERVED_CHARS = /[<>:"/\\|?*]/

function validateName(name: string): void {
  if (typeof name !== 'string') throw new Error('INVALID_NAME')
  if (name.length < 1 || name.length > 48) throw new Error('INVALID_NAME')
  if (RESERVED_CHARS.test(name)) throw new Error('INVALID_NAME')
  if (name.startsWith('.')) throw new Error('INVALID_NAME')
  assertSafeSegment(name)
}

async function atomicWriteJson(file: string, value: any): Promise<void> {
  const dir = path.dirname(file)
  await fs.mkdir(dir, { recursive: true })
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8' })
  await fs.rename(tmp, file)
}

function newId(): string {
  return crypto.randomBytes(8).toString('hex').slice(0, 12).toLowerCase()
}

const FOLDERS = ['mods', 'config', 'saves', 'resourcepacks', 'shaderpacks', 'datapacks', 'logs']

export class InstanceService {
  constructor(private paths: Paths) {}

  private instanceFile(id: string): string {
    return path.join(this.paths.instanceDir(id), 'instance.json')
  }

  async list(): Promise<Instance[]> {
    const dir = this.paths.instancesDir
    let entries: string[] = []
    try { entries = await fs.readdir(dir) } catch { entries = [] }
    const out: Instance[] = []
    for (const e of entries) {
      try {
        const raw = await fs.readFile(path.join(dir, e, 'instance.json'), 'utf8')
        out.push(JSON.parse(raw) as Instance)
      } catch {}
    }
    return out.sort((a, b) => b.createdAt - a.createdAt)
  }

  async create(input: { name: string; mcVersion: string; loader: any; loaderVersion?: string; icon?: string }): Promise<Instance> {
    validateName(input.name)
    const existing = await this.list()
    if (existing.some((i) => i.name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error('CONFLICT')
    }
    const id = newId()
    assertSafeSegment(id)
    const now = Date.now()
    const inst: Instance = {
      id,
      name: input.name,
      icon: input.icon,
      mcVersion: input.mcVersion,
      loader: input.loader,
      loaderVersion: input.loaderVersion,
      versionId: '',
      createdAt: now,
      playTimeMs: 0,
    }
    // versionId default to mcVersion for vanilla
    if (!inst.versionId) inst.versionId = input.mcVersion
    const dir = this.paths.instanceDir(id)
    await fs.mkdir(dir, { recursive: true })
    for (const f of FOLDERS) await fs.mkdir(path.join(dir, f), { recursive: true })
    await atomicWriteJson(path.join(dir, 'instance.json'), inst)
    return inst
  }

  async get(id: string): Promise<Instance> {
    const raw = await fs.readFile(this.instanceFile(id), 'utf8')
    return JSON.parse(raw) as Instance
  }

  async update(id: string, patch: Partial<Instance>): Promise<Instance> {
    const current = await this.get(id)
    const merged = { ...current, ...patch, id: current.id }
    if (patch.name && patch.name !== current.name) {
      validateName(patch.name)
      const existing = await this.list()
      if (existing.some((i) => i.id !== id && i.name.toLowerCase() === patch.name!.toLowerCase())) {
        throw new Error('CONFLICT')
      }
    }
    await atomicWriteJson(this.instanceFile(id), merged)
    return merged
  }

  async remove(id: string, deleteFiles: boolean): Promise<void> {
    const dir = this.paths.instanceDir(id)
    if (deleteFiles) {
      await fs.rm(dir, { recursive: true, force: true })
    }
    // if not delete, leave folder; metadata removed by deleting instance.json? spec: remove without deleteFiles keeps folder.
    // We'll delete instance.json to remove from list
    try { await fs.unlink(this.instanceFile(id)) } catch {}
  }

  async clone(id: string, newName: string): Promise<Instance> {
    validateName(newName)
    const current = await this.get(id)
    const existing = await this.list()
    if (existing.some((i) => i.name.toLowerCase() === newName.toLowerCase())) {
      throw new Error('CONFLICT')
    }
    const newInst = await this.create({
      name: newName,
      mcVersion: current.mcVersion,
      loader: current.loader,
      loaderVersion: current.loaderVersion,
      icon: current.icon,
    })
    // copy extra fields
    const merged: Instance = {
      ...newInst,
      memoryMb: current.memoryMb,
      jvmArgs: current.jvmArgs ? [...current.jvmArgs] : undefined,
      gameArgs: current.gameArgs ? [...current.gameArgs] : undefined,
      resolution: current.resolution ? { ...current.resolution } : undefined,
      modpack: current.modpack ? { ...current.modpack } : undefined,
      notes: current.notes,
      group: current.group,
    }
    await atomicWriteJson(this.instanceFile(newInst.id), merged)
    return merged
  }

  async repair(id: string): Promise<void> {
    const inst = await this.get(id)
    const dir = this.paths.instanceDir(id)
    await fs.mkdir(dir, { recursive: true })
    for (const f of FOLDERS) await fs.mkdir(path.join(dir, f), { recursive: true })
    await atomicWriteJson(this.instanceFile(id), inst)
  }

  dirOf(id: string): string {
    return this.paths.instanceDir(id)
  }

  async setIcon(id: string, dataUrl: string): Promise<void> {
    const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/i.exec(dataUrl)
    if (!m) throw new Error('INVALID_ICON')
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length > 2 * 1024 * 1024) throw new Error('ICON_TOO_LARGE')
    const inst = await this.get(id)
    inst.icon = dataUrl
    await atomicWriteJson(this.instanceFile(id), inst)
  }
}
