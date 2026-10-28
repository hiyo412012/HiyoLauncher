import fs from 'node:fs/promises'
import path from 'node:path'
import { assertSafeSegment } from '../util/path-safety'
import { readNbtFile, writeNbtFile } from './nbt'
import { assertRealInside, resolveInstancePath } from './instance-files'
import { extractZip, zipDirectory } from './zip'
import type { WorldBackup, WorldSummary } from '../../shared/types'

const BACKUP_DIR = path.join('backups', 'worlds')
const BACKUP_NAME = /^(.*)-(\d{8}-\d{6})(?:-\d+)?\.zip$/
const GAME_MODES: Record<number, WorldSummary['gameMode']> = {
  0: 'survival',
  1: 'creative',
  2: 'adventure',
  3: 'spectator',
}

function stamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

export async function directorySize(dir: string): Promise<number> {
  let total = 0
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += await directorySize(full)
    } else if (entry.isFile()) {
      try {
        total += (await fs.stat(full)).size
      } catch {
        // Ignore files removed during the scan.
      }
    }
  }
  return total
}

export async function readWorldMeta(worldDir: string): Promise<WorldSummary> {
  const folder = path.basename(worldDir)
  const summary: WorldSummary = {
    folder,
    name: folder,
    hardcore: false,
    sizeBytes: await directorySize(worldDir),
  }

  try {
    const parsed = await readNbtFile(path.join(worldDir, 'level.dat'))
    const data = parsed.value?.Data ?? parsed.value ?? {}
    if (typeof data.LevelName === 'string' && data.LevelName.trim()) summary.name = data.LevelName
    const lastPlayed = Number(data.LastPlayed)
    if (Number.isFinite(lastPlayed) && lastPlayed > 0) summary.lastPlayedAt = lastPlayed
    const gameType = Number(data.GameType)
    if (gameType in GAME_MODES) summary.gameMode = GAME_MODES[gameType]
    summary.hardcore = Number(data.hardcore ?? 0) === 1
    const versionName = data.Version?.Name ?? data.Version?.Id
    if (typeof versionName === 'string') summary.version = versionName
  } catch {
    // A damaged or missing level.dat still leaves the world folder usable.
  }

  return summary
}

export async function listWorlds(root: string): Promise<WorldSummary[]> {
  const saves = resolveInstancePath(root, 'saves')
  let entries
  try {
    entries = await fs.readdir(saves, { withFileTypes: true })
  } catch {
    return []
  }
  const worlds: WorldSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    worlds.push(await readWorldMeta(path.join(saves, entry.name)))
  }
  return worlds.sort((a, b) => {
    const delta = (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)
    return delta !== 0 ? delta : a.name.localeCompare(b.name)
  })
}

export async function renameWorld(root: string, folder: string, name: string): Promise<void> {
  assertSafeSegment(folder)
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 64) throw new Error('INVALID_WORLD_NAME')
  const worldDir = resolveInstancePath(root, `saves/${folder}`)
  await assertRealInside(root, worldDir)
  const levelDat = path.join(worldDir, 'level.dat')
  const parsed = await readNbtFile(levelDat)
  const value = parsed.value?.Data ? parsed.value : { Data: parsed.value ?? {} }
  value.Data.LevelName = trimmed
  const temp = `${levelDat}.tmp-${process.pid}`
  await writeNbtFile(temp, parsed.name, value)
  await fs.rename(temp, levelDat)
}

async function uniqueBackupFile(root: string, world: string): Promise<string> {
  const dir = resolveInstancePath(root, BACKUP_DIR)
  await fs.mkdir(dir, { recursive: true })
  const base = `${world}-${stamp()}`
  let candidate = path.join(dir, `${base}.zip`)
  let index = 1
  while (true) {
    try {
      await fs.access(candidate)
      candidate = path.join(dir, `${base}-${index++}.zip`)
    } catch {
      return candidate
    }
  }
}

export async function createWorldBackup(
  root: string,
  folder: string,
  onProgress?: (current: number, total: number) => void,
): Promise<WorldBackup> {
  assertSafeSegment(folder)
  const worldDir = resolveInstancePath(root, `saves/${folder}`)
  const stat = await fs.stat(worldDir)
  if (!stat.isDirectory()) throw new Error('WORLD_NOT_FOUND')
  const file = await uniqueBackupFile(root, folder)
  await zipDirectory(worldDir, file, onProgress)
  const saved = await fs.stat(file)
  return { file, world: folder, createdAt: saved.mtimeMs, sizeBytes: saved.size }
}

export async function listWorldBackups(root: string): Promise<WorldBackup[]> {
  const dir = resolveInstancePath(root, BACKUP_DIR)
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const backups: WorldBackup[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const match = BACKUP_NAME.exec(entry.name)
    if (!match) continue
    try {
      const stat = await fs.stat(path.join(dir, entry.name))
      backups.push({
        file: path.join(dir, entry.name),
        world: match[1],
        createdAt: stat.mtimeMs,
        sizeBytes: stat.size,
      })
    } catch {
      // Skip files that disappear while listing.
    }
  }
  return backups.sort((a, b) => b.createdAt - a.createdAt)
}

export async function removeWorldBackup(
  root: string,
  backupFile: string,
  trash: (fullPath: string) => Promise<void>,
): Promise<void> {
  const backupDir = path.resolve(root, BACKUP_DIR)
  const resolved = path.resolve(backupFile)
  if (!resolved.startsWith(backupDir + path.sep)) throw new Error('INVALID_BACKUP_PATH')
  if (!BACKUP_NAME.test(path.basename(resolved))) throw new Error('INVALID_BACKUP_NAME')
  await fs.access(resolved)
  await trash(resolved)
}

export async function restoreWorldBackup(
  root: string,
  backupFile: string,
  onProgress?: (current: number) => void,
): Promise<void> {
  const backupDir = path.resolve(root, BACKUP_DIR)
  const resolved = path.resolve(backupFile)
  if (!resolved.startsWith(backupDir + path.sep)) throw new Error('INVALID_BACKUP_PATH')
  const match = BACKUP_NAME.exec(path.basename(resolved))
  if (!match) throw new Error('INVALID_BACKUP_NAME')
  const world = match[1]
  assertSafeSegment(world)

  const saves = resolveInstancePath(root, 'saves')
  await fs.mkdir(saves, { recursive: true })
  const target = path.join(saves, world)
  const temp = path.join(backupDir, `.restore-${world}-${Date.now()}`)
  const displaced = path.join(backupDir, `.old-${world}-${Date.now()}`)

  await fs.rm(temp, { recursive: true, force: true })
  try {
    await extractZip(resolved, temp, onProgress)
    const extracted = await fs.readdir(temp)
    if (extracted.length === 0) throw new Error('EMPTY_BACKUP')
    try {
      await fs.access(path.join(temp, 'level.dat'))
    } catch {
      throw new Error('INVALID_WORLD_BACKUP')
    }

    let hadExisting = false
    try {
      await fs.access(target)
      hadExisting = true
    } catch {
      hadExisting = false
    }

    if (hadExisting) {
      await createWorldBackup(root, world)
      await fs.rename(target, displaced)
    }

    try {
      await fs.rename(temp, target)
    } catch (error) {
      if (hadExisting) {
        await fs.rename(displaced, target).catch(() => {})
      }
      throw error
    }
    if (hadExisting) await fs.rm(displaced, { recursive: true, force: true })
  } finally {
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {})
  }
}
