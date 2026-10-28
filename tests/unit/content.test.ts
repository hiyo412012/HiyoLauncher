import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

vi.mock('@main/services/paths', () => {
  const instanceDir = (id: string) => path.join(os.tmpdir(), 'hiyo-content-test', id)
  const gameRoot = () => path.join(os.tmpdir(), 'hiyo-content-test-root')
  return {
    instanceDir,
    gameRoot,
    versionsDir: () => path.join(os.tmpdir(), 'hiyo-content-test-versions'),
    librariesDir: () => path.join(os.tmpdir(), 'hiyo-content-test-libs'),
    cacheDir: () => path.join(os.tmpdir(), 'hiyo-content-test-cache'),
    ensureDirs: async () => {},
    getPaths: () => ({
      instanceDir,
      gameRoot: gameRoot(),
      versionsDir: path.join(os.tmpdir(), 'hiyo-content-test-versions'),
      librariesDir: path.join(os.tmpdir(), 'hiyo-content-test-libs'),
      cacheDir: path.join(os.tmpdir(), 'hiyo-content-test-cache'),
      ensureDirs: async () => {},
    }),
  }
})

vi.mock('@main/services/instances', () => ({
  getInstance: vi.fn(async (id: string) => ({ id, mcVersion: '1.21.1', loader: 'fabric' })),
  updateInstance: vi.fn(async () => ({})),
}))

vi.mock('@main/services/download', () => ({
  downloadFile: vi.fn(async (opts: any) => {
    await fs.mkdir(path.dirname(opts.dest), { recursive: true })
    await fs.writeFile(opts.dest, 'data')
  }),
}))

vi.mock('@main/services/modrinth', () => ({
  getProject: vi.fn(async (id: string) => ({ id, slug: 's', title: 'T', projectType: 'mod' })),
  getProjectVersions: vi.fn(async () => [
    { id: 'v2', projectId: 'p', versionType: 'release', datePublished: '2024-01-02', files: [{ filename: 'mod-2.jar', primary: true, url: 'https://x', hashes: { sha1: 'sha2' }, size: 4 }], dependencies: [], gameVersions: ['1.21.1'], loaders: ['fabric'], versionNumber: '2.0' },
    { id: 'v1', projectId: 'p', versionType: 'release', datePublished: '2024-01-01', files: [{ filename: 'mod-1.jar', primary: true, url: 'https://x', hashes: { sha1: 'sha1' }, size: 4 }], dependencies: [], gameVersions: ['1.21.1'], loaders: ['fabric'], versionNumber: '1.0' },
  ]),
  getVersion: vi.fn(async (id: string) => ({ id, projectId: 'dep', versionType: 'release', datePublished: '2024', files: [{ filename: 'dep.jar', primary: true, url: 'https://x', hashes: { sha1: 'shadep' }, size: 4 }], dependencies: [], gameVersions: ['1.21.1'], loaders: ['fabric'], versionNumber: '1.0' })),
}))

import { isCompatible, resolveDependencies, toggleContent, listContent } from '@main/services/content'

const ROOT = path.join(os.tmpdir(), 'hiyo-content-test')

describe('content', () => {
  beforeEach(async () => {
    await fs.rm(ROOT, { recursive: true, force: true })
  })
  afterEach(async () => {
    await fs.rm(ROOT, { recursive: true, force: true })
  })

  it('incompatible loader rejected', () => {
    const version = { gameVersions: ['1.21.1'], loaders: ['forge'] } as any
    const instance = { mcVersion: '1.21.1', loader: 'fabric' } as any
    expect(isCompatible(version, instance, 'mod')).toBe(false)
  })

  it('compatible passes', () => {
    const version = { gameVersions: ['1.21.1'], loaders: ['fabric'] } as any
    const instance = { mcVersion: '1.21.1', loader: 'fabric' } as any
    expect(isCompatible(version, instance, 'mod')).toBe(true)
  })

  it('dependency dedupe', async () => {
    const version = {
      id: 'root',
      dependencies: [
        { dependencyType: 'required', projectId: 'dep' },
        { dependencyType: 'required', projectId: 'dep' },
      ],
      gameVersions: ['1.21.1'],
      loaders: ['fabric'],
    } as any
    const instance = { mcVersion: '1.21.1', loader: 'fabric' } as any
    const deps = await resolveDependencies(version, 'mod', instance)
    expect(deps.length).toBe(1)
  })

  it('toggle preserves base name via .disabled', async () => {
    const instId = 'i1'
    const modsDir = path.join(ROOT, instId, 'mods')
    await fs.mkdir(modsDir, { recursive: true })
    await fs.writeFile(path.join(modsDir, 'a.jar'), 'x')
    await toggleContent(instId, 'mods/a.jar', false)
    const disabledExists = await fs.stat(path.join(modsDir, 'a.jar.disabled')).then(() => true).catch(() => false)
    expect(disabledExists).toBe(true)
    const enabledExists = await fs.stat(path.join(modsDir, 'a.jar')).then(() => true).catch(() => false)
    expect(enabledExists).toBe(false)

    await toggleContent(instId, 'mods/a.jar', true)
    const enabledAgain = await fs.stat(path.join(modsDir, 'a.jar')).then(() => true).catch(() => false)
    expect(enabledAgain).toBe(true)
  })

  it('listContent reflects disabled', async () => {
    const instId = 'i2'
    const modsDir = path.join(ROOT, instId, 'mods')
    await fs.mkdir(modsDir, { recursive: true })
    await fs.writeFile(path.join(modsDir, 'a.jar.disabled'), 'x')
    const list = await listContent(instId)
    expect(list.some((c) => c.filename === 'a.jar' && c.enabled === false)).toBe(true)
  })
})