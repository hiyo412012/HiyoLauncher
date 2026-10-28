import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { parseMrpack } from '@main/services/modpack'

function makeZip(entries: Record<string, string | Uint8Array>) {
  const obj: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(entries)) {
    obj[k] = typeof v === 'string' ? strToU8(v) : (v as Uint8Array)
  }
  return zipSync(obj)
}

describe('mrpack', () => {
  it('parses loader/version/files and overrides', async () => {
    const index = {
      formatVersion: 1,
      game: 'minecraft',
      name: 'Pack',
      versionId: 'v1',
      dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.0' },
      files: [{ path: 'mods/a.jar', hashes: { sha1: 'abc' }, env: { client: 'required' }, downloads: ['https://x'], fileSize: 1 }],
    }
    const zip = makeZip({ 'modrinth.index.json': JSON.stringify(index), 'overrides/config.txt': 'hi' })
    const info: any = await parseMrpack(Buffer.from(zip))
    expect(info.name).toBe('Pack')
    expect(info.mcVersion).toBe('1.21.1')
    expect(info.loader).toBe('fabric')
    expect(info.loaderVersion).toBe('0.16.0')
    expect(info.files.length).toBe(1)
    expect(info.overrides).toContain('overrides/config.txt')
  })

  it('rejects path traversal entry', async () => {
    const index = { formatVersion: 1, game: 'minecraft', name: 'Pack', versionId: 'v1', dependencies: { minecraft: '1.21.1' }, files: [] }
    const zip = makeZip({ 'modrinth.index.json': JSON.stringify(index), '../evil.txt': 'x' })
    await expect(parseMrpack(Buffer.from(zip))).rejects.toThrow()
  })

  it('rejects absolute file path', async () => {
    const index = {
      formatVersion: 1,
      game: 'minecraft',
      name: 'Pack',
      versionId: 'v1',
      dependencies: { minecraft: '1.21.1' },
      files: [{ path: '/abs.jar', hashes: {}, downloads: [], fileSize: 0 }],
    }
    const zip = makeZip({ 'modrinth.index.json': JSON.stringify(index) })
    await expect(parseMrpack(Buffer.from(zip))).rejects.toThrow()
  })

  it('skips unsupported client env (parsed files still present)', async () => {
    const index = {
      formatVersion: 1,
      game: 'minecraft',
      name: 'Pack',
      versionId: 'v1',
      dependencies: { minecraft: '1.21.1' },
      files: [
        { path: 'mods/a.jar', hashes: {}, env: { client: 'unsupported' }, downloads: [], fileSize: 0 },
        { path: 'mods/b.jar', hashes: {}, env: { client: 'required' }, downloads: [], fileSize: 0 },
      ],
    }
    const zip = makeZip({ 'modrinth.index.json': JSON.stringify(index) })
    const info: any = await parseMrpack(Buffer.from(zip))
    expect(info.files.length).toBe(2)
  })
})