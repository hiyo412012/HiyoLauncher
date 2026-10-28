import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { writeNbtFile } from '@main/services/nbt'
import {
  normalizeRelative,
  resolveInstancePath,
  isManagedRelative,
  listDirectory,
  importFiles,
  renameEntry,
  trashEntry,
} from '@main/services/instance-files'
import { listScreenshots, screenshotPath } from '@main/services/screenshots'
import {
  listWorlds,
  readWorldMeta,
  renameWorld,
  createWorldBackup,
  listWorldBackups,
  restoreWorldBackup,
  removeWorldBackup,
} from '@main/services/worlds'

describe('instance paths', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'hiyo-ws-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('normalizes windows separators and keeps nested paths', () => {
    expect(normalizeRelative('mods\\foo.jar')).toBe('mods/foo.jar')
    expect(normalizeRelative('/')).toBe('')
    expect(normalizeRelative(undefined)).toBe('')
  })

  it('rejects traversal and absolute paths', () => {
    expect(() => resolveInstancePath(root, '../evil')).toThrow()
    expect(() => resolveInstancePath(root, 'mods/../../evil')).toThrow()
    expect(() => normalizeRelative('C:/evil')).toThrow()
    expect(() => normalizeRelative('/etc/passwd')).toThrow()
  })

  it('marks managed content folders', () => {
    expect(isManagedRelative('mods')).toBe(true)
    expect(isManagedRelative('mods/foo.jar')).toBe(true)
    expect(isManagedRelative('resourcepacks')).toBe(true)
    expect(isManagedRelative('config')).toBe(false)
    expect(isManagedRelative('saves/world')).toBe(false)
  })

  it('lists directories first and flags managed folders', async () => {
    await fs.mkdir(path.join(root, 'mods'), { recursive: true })
    await fs.mkdir(path.join(root, 'config'), { recursive: true })
    await fs.writeFile(path.join(root, 'notes.txt'), 'hello')

    const entries = await listDirectory(root)
    expect(entries.map((e) => e.name)).toEqual(['config', 'mods', 'notes.txt'])
    expect(entries.find((e) => e.name === 'mods')?.managed).toBe(true)
    expect(entries.find((e) => e.name === 'config')?.managed).toBe(false)
    expect(entries.find((e) => e.name === 'notes.txt')?.size).toBe(5)
  })

  it('rejects symlinked paths that escape the instance root', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'hiyo-outside-'))
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret')
    try {
      await fs.symlink(outside, path.join(root, 'link'), 'dir')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        await fs.rm(outside, { recursive: true, force: true })
        return
      }
      throw error
    }
    await expect(listDirectory(root, 'link')).rejects.toThrow()
    await fs.rm(outside, { recursive: true, force: true })
  })

  it('imports files with conflict-safe names', async () => {
    const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hiyo-src-'))
    const source = path.join(sourceDir, 'cool.jar')
    await fs.writeFile(source, 'jar')

    const first = await importFiles(root, '', [source])
    const second = await importFiles(root, '', [source])
    expect(first[0].name).toBe('cool.jar')
    expect(second[0].name).toBe('cool (1).jar')
    expect(await fs.readFile(path.join(root, 'cool (1).jar'), 'utf8')).toBe('jar')

    await fs.rm(sourceDir, { recursive: true, force: true })
  })

  it('rejects renaming or trashing managed content', async () => {
    await fs.mkdir(path.join(root, 'mods'), { recursive: true })
    await fs.writeFile(path.join(root, 'mods', 'a.jar'), 'x')
    await expect(renameEntry(root, 'mods/a.jar', 'b.jar')).rejects.toMatchObject({ code: 'MANAGED_CONTENT' })
    await expect(trashEntry(root, 'mods/a.jar', async () => {})).rejects.toMatchObject({ code: 'MANAGED_CONTENT' })
  })

  it('renames files and refuses to overwrite', async () => {
    await fs.writeFile(path.join(root, 'a.txt'), 'a')
    await fs.writeFile(path.join(root, 'b.txt'), 'b')
    await expect(renameEntry(root, 'a.txt', 'b.txt')).rejects.toMatchObject({ code: 'CONFLICT' })
    const next = await renameEntry(root, 'a.txt', 'c.txt')
    expect(next).toBe('c.txt')
    expect(await fs.readFile(path.join(root, 'c.txt'), 'utf8')).toBe('a')
  })

  it('trashes writable entries through the injected trash function', async () => {
    await fs.writeFile(path.join(root, 'a.txt'), 'a')
    const trashed: string[] = []
    await trashEntry(root, 'a.txt', async (p) => {
      trashed.push(p)
    })
    expect(trashed).toEqual([path.join(root, 'a.txt')])
  })

  it('lists only image screenshots, newest first', async () => {
    await fs.mkdir(path.join(root, 'screenshots'), { recursive: true })
    await fs.writeFile(path.join(root, 'screenshots', 'old.png'), 'png')
    await fs.writeFile(path.join(root, 'screenshots', 'new.jpg'), 'jpg')
    await fs.writeFile(path.join(root, 'screenshots', 'notes.txt'), 'nope')
    const old = new Date('2020-01-01T00:00:00Z')
    const recent = new Date('2024-01-01T00:00:00Z')
    await fs.utimes(path.join(root, 'screenshots', 'old.png'), old, old)
    await fs.utimes(path.join(root, 'screenshots', 'new.jpg'), recent, recent)

    const shots = await listScreenshots(root)
    expect(shots.map((s) => s.file)).toEqual(['new.jpg', 'old.png'])
    expect(() => screenshotPath(root, '../instance.json')).toThrow()
    expect(() => screenshotPath(root, 'notes.txt')).toThrow()
  })
})

describe('worlds', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'hiyo-world-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  async function makeWorld(folder: string, name: string, lastPlayed: number) {
    const dir = path.join(root, 'saves', folder)
    await fs.mkdir(path.join(dir, 'region'), { recursive: true })
    await fs.writeFile(path.join(dir, 'level.dat'), '')
    await writeNbtFile(path.join(dir, 'level.dat'), '', {
      Data: {
        LevelName: name,
        LastPlayed: BigInt(lastPlayed),
        GameType: 1,
        hardcore: 1,
        Version: { Name: '1.21.1' },
      },
    })
    await fs.writeFile(path.join(dir, 'region', 'r.0.0.mca'), Buffer.alloc(8))
    return dir
  }

  it('reads level metadata', async () => {
    const dir = await makeWorld('MyWorld', 'My World', 1700000000000)
    const meta = await readWorldMeta(dir)
    expect(meta.name).toBe('My World')
    expect(meta.gameMode).toBe('creative')
    expect(meta.hardcore).toBe(true)
    expect(meta.version).toBe('1.21.1')
    expect(meta.lastPlayedAt).toBe(1700000000000)
    expect(meta.sizeBytes).toBeGreaterThan(0)
  })

  it('lists worlds sorted by last played', async () => {
    await makeWorld('Older', 'Older', 1000)
    await makeWorld('Newer', 'Newer', 2000)
    const worlds = await listWorlds(root)
    expect(worlds.map((w) => w.folder)).toEqual(['Newer', 'Older'])
  })

  it('renames a world through level.dat', async () => {
    await makeWorld('MyWorld', 'Old Name', 1000)
    await renameWorld(root, 'MyWorld', 'New Name')
    const meta = await readWorldMeta(path.join(root, 'saves', 'MyWorld'))
    expect(meta.name).toBe('New Name')
  })

  it('creates, lists and restores backups', async () => {
    const dir = await makeWorld('MyWorld', 'My World', 1000)
    const backup = await createWorldBackup(root, 'MyWorld')
    expect(backup.world).toBe('MyWorld')
    expect(backup.file.endsWith('.zip')).toBe(true)

    const backups = await listWorldBackups(root)
    expect(backups.map((b) => b.file)).toContain(backup.file)

    await fs.writeFile(path.join(dir, 'region', 'new.mca'), 'new data')
    await restoreWorldBackup(root, backup.file)
    const names = await fs.readdir(path.join(root, 'saves', 'MyWorld', 'region'))
    expect(names).toEqual(['r.0.0.mca'])
    expect(await fs.readFile(path.join(root, 'saves', 'MyWorld', 'level.dat'))).not.toHaveLength(0)
  })

  it('moves backups to the trash', async () => {
    await makeWorld('MyWorld', 'My World', 1000)
    const backup = await createWorldBackup(root, 'MyWorld')
    const trashed: string[] = []
    await removeWorldBackup(root, backup.file, async (target) => {
      trashed.push(target)
    })
    expect(trashed).toEqual([backup.file])
    await expect(
      removeWorldBackup(root, path.join(root, 'saves', 'MyWorld'), async () => {}),
    ).rejects.toThrow()
  })

  it('rejects zip-slip entries during restore', async () => {
    await fs.mkdir(path.join(root, 'backups', 'worlds'), { recursive: true })
    const evil = path.join(root, 'backups', 'worlds', 'Evil-20260101-000000.zip')
    const data = zipSync({ '../evil.txt': strToU8('pwned') })
    await fs.writeFile(evil, Buffer.from(data))
    await expect(restoreWorldBackup(root, evil)).rejects.toThrow()
    await expect(fs.stat(path.join(root, 'evil.txt'))).rejects.toThrow()
  })

  it('rejects backups that are not Minecraft worlds', async () => {
    await fs.mkdir(path.join(root, 'backups', 'worlds'), { recursive: true })
    const bad = path.join(root, 'backups', 'worlds', 'Bad-20260101-000001.zip')
    await fs.writeFile(bad, Buffer.from(zipSync({ 'readme.txt': strToU8('not a world') })))
    await expect(restoreWorldBackup(root, bad)).rejects.toThrow('INVALID_WORLD_BACKUP')
    await expect(fs.stat(path.join(root, 'saves', 'Bad'))).rejects.toThrow()
  })
})
