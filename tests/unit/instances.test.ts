import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createPaths } from '@main/services/paths'
import { InstanceService } from '@main/services/instances'

describe('InstanceService', () => {
  let tmp: string
  let svc: InstanceService
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hiyo-inst-'))
    const paths = createPaths(path.join(tmp, 'ud'), path.join(tmp, 'game'))
    await paths.ensureDirs()
    svc = new InstanceService(paths)
  })
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('rejects path traversal name', async () => {
    await expect(svc.create({ name: '../evil', mcVersion: '1.20.1', loader: 'vanilla' } as any)).rejects.toThrow()
  })

  it('rejects duplicate name case-insensitive', async () => {
    await svc.create({ name: 'Foo', mcVersion: '1.20.1', loader: 'vanilla' } as any)
    await expect(svc.create({ name: 'foo', mcVersion: '1.20.1', loader: 'vanilla' } as any)).rejects.toThrow()
  })

  it('creates folder tree', async () => {
    const inst = await svc.create({ name: 'MyInst', mcVersion: '1.20.1', loader: 'vanilla' } as any)
    const dir = svc.dirOf(inst.id)
    for (const f of ['mods', 'config', 'saves', 'resourcepacks', 'shaderpacks', 'datapacks', 'logs']) {
      const st = await fs.stat(path.join(dir, f))
      expect(st.isDirectory()).toBe(true)
    }
  })

  it('clone creates new id', async () => {
    const a = await svc.create({ name: 'A', mcVersion: '1.20.1', loader: 'vanilla' } as any)
    const b = await svc.clone(a.id, 'B')
    expect(b.id).not.toBe(a.id)
    expect(b.name).toBe('B')
  })

  it('remove without deleteFiles keeps folder', async () => {
    const a = await svc.create({ name: 'C', mcVersion: '1.20.1', loader: 'vanilla' } as any)
    const dir = svc.dirOf(a.id)
    await svc.remove(a.id, false)
    const st = await fs.stat(dir)
    expect(st.isDirectory()).toBe(true)
    const list = await svc.list()
    expect(list.find((i) => i.id === a.id)).toBeUndefined()
  })
})
