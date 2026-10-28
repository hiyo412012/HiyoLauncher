import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { JsonStore, mergeDeep } from '@main/services/store'

describe('JsonStore', () => {
  let tmp: string
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hiyo-store-'))
  })
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('writes and reads', async () => {
    const store = new JsonStore(path.join(tmp, 's.json'))
    await store.write({ a: 1 })
    const v = await store.read({ a: 0 })
    expect(v).toEqual({ a: 1 })
  })

  it('init writes defaults when missing', async () => {
    const store = new JsonStore(path.join(tmp, 's.json'))
    const v = await store.init({ a: 0 })
    expect(v).toEqual({ a: 0 })
    const v2 = await store.read({ a: 9 })
    expect(v2).toEqual({ a: 0 })
  })

  it('falls back to .bak on corrupt primary', async () => {
    const file = path.join(tmp, 's.json')
    const store = new JsonStore(file)
    await store.write({ a: 5 })
    // corrupt primary
    await fs.writeFile(file, '{bad json', 'utf8')
    const v = await store.read({ a: 0 })
    expect(v).toEqual({ a: 5 })
  })

  it('mergeDeep merges objects arrays replace', () => {
    const base: any = { a: { b: 1, c: 2 }, arr: [1, 2] }
    const out = mergeDeep(base, { a: { b: 9 }, arr: [3] })
    expect(out).toEqual({ a: { b: 9, c: 2 }, arr: [3] })
  })
})
