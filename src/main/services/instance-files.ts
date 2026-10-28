import fs from 'node:fs/promises'
import path from 'node:path'
import { assertSafeSegment, PathUnsafeError } from '../util/path-safety'
import type { InstanceFileEntry } from '../../shared/types'

export const MANAGED_DIRS = ['mods', 'resourcepacks', 'shaderpacks', 'datapacks'] as const

export class FileOpError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'FileOpError'
  }
}

export function normalizeRelative(input: string | undefined | null): string {
  if (!input) return ''
  if (input === '/' || input === '\\') return ''
  if (input.includes('\0')) throw new PathUnsafeError('NUL in path')
  const replaced = input.replace(/\\/g, '/')
  if (replaced.startsWith('/')) throw new PathUnsafeError('absolute path')
  const segments = replaced.split('/').filter((part) => part.length > 0 && part !== '.')
  for (const segment of segments) assertSafeSegment(segment)
  return segments.join('/')
}

export function resolveInstancePath(root: string, relative?: string | null): string {
  const normalized = normalizeRelative(relative)
  const rootResolved = path.resolve(root)
  const resolved = path.resolve(rootResolved, normalized)
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new PathUnsafeError('escapes instance root')
  }
  return resolved
}

export function isManagedRelative(relative: string | undefined | null): boolean {
  const normalized = normalizeRelative(relative)
  if (!normalized) return false
  const [first] = normalized.split('/')
  return (MANAGED_DIRS as readonly string[]).includes(first)
}

export function assertWritableRelative(relative: string): string {
  const normalized = normalizeRelative(relative)
  if (!normalized) throw new FileOpError('INSTANCE_ROOT', 'Cannot modify the instance root')
  if (normalized === 'instance.json') throw new FileOpError('PROTECTED', 'instance.json is protected')
  if (isManagedRelative(normalized)) {
    throw new FileOpError('MANAGED_CONTENT', 'Manage this folder from the Content tab')
  }
  return normalized
}

export async function assertRealInside(root: string, target: string): Promise<void> {
  const rootReal = await fs.realpath(root)
  let targetReal: string
  try {
    targetReal = await fs.realpath(target)
  } catch {
    // New paths do not exist yet; resolve through their existing parent.
    const parent = path.dirname(target)
    let parentReal: string
    try {
      parentReal = await fs.realpath(parent)
    } catch {
      parentReal = path.resolve(parent)
    }
    targetReal = path.join(parentReal, path.basename(target))
  }
  if (targetReal !== rootReal && !targetReal.startsWith(rootReal + path.sep)) {
    throw new PathUnsafeError('escapes instance root')
  }
}

function sortEntries(a: InstanceFileEntry, b: InstanceFileEntry): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
}

export async function listDirectory(root: string, relative?: string): Promise<InstanceFileEntry[]> {
  const normalized = normalizeRelative(relative)
  const dir = resolveInstancePath(root, normalized)
  await assertRealInside(root, dir)
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const entries: InstanceFileEntry[] = []
  for (const dirent of dirents) {
    if (dirent.isSymbolicLink()) continue
    const childRelative = normalized ? `${normalized}/${dirent.name}` : dirent.name
    const full = resolveInstancePath(root, childRelative)
    let stat
    try {
      stat = await fs.stat(full)
    } catch {
      continue
    }
    if (!stat.isDirectory() && !stat.isFile()) continue
    entries.push({
      name: dirent.name,
      path: childRelative,
      isDirectory: stat.isDirectory(),
      size: stat.isDirectory() ? 0 : stat.size,
      modifiedAt: stat.mtimeMs,
      managed: isManagedRelative(childRelative),
    })
  }
  return entries.sort(sortEntries)
}

function splitName(name: string): { base: string; ext: string } {
  const ext = path.extname(name)
  return { base: ext ? name.slice(0, -ext.length) : name, ext }
}

export async function uniqueTargetName(dir: string, name: string): Promise<string> {
  const { base, ext } = splitName(name)
  let candidate = name
  let index = 1
  while (true) {
    let exists = false
    try {
      await fs.lstat(path.join(dir, candidate))
      exists = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (!exists) return candidate
    candidate = `${base} (${index++})${ext}`
  }
}

export async function importFiles(
  root: string,
  relative: string,
  sources: string[],
): Promise<InstanceFileEntry[]> {
  // The instance root is allowed as an import destination even though other writes are not.
  const normalized = relative ? assertWritableRelative(relative) : ''
  const destination = resolveInstancePath(root, normalized)
  await assertRealInside(root, destination)
  const stat = await fs.stat(destination)
  if (!stat.isDirectory()) throw new FileOpError('NOT_DIRECTORY', 'Destination is not a directory')

  const imported: InstanceFileEntry[] = []
  for (const source of sources) {
    const sourceStat = await fs.stat(source)
    if (!sourceStat.isFile()) continue
    const baseName = path.basename(source)
    assertSafeSegment(baseName)
    const targetName = await uniqueTargetName(destination, baseName)
    const target = resolveInstancePath(root, normalized ? `${normalized}/${targetName}` : targetName)
    const temp = `${target}.tmp-${process.pid}`
    try {
      await fs.copyFile(source, temp)
      await fs.rename(temp, target)
    } catch (error) {
      await fs.rm(temp, { force: true }).catch(() => {})
      throw error
    }
    imported.push({
      name: targetName,
      path: normalized ? `${normalized}/${targetName}` : targetName,
      isDirectory: false,
      size: sourceStat.size,
      modifiedAt: Date.now(),
      managed: false,
    })
  }
  return imported
}

export async function renameEntry(root: string, relative: string, newName: string): Promise<string> {
  const normalized = assertWritableRelative(relative)
  assertSafeSegment(newName)
  const source = resolveInstancePath(root, normalized)
  await assertRealInside(root, source)
  const parent = path.posix.dirname(normalized)
  const targetRelative = parent === '.' ? newName : `${parent}/${newName}`
  const target = resolveInstancePath(root, targetRelative)
  try {
    await fs.lstat(target)
    throw new FileOpError('CONFLICT', 'A file with that name already exists')
  } catch (error) {
    if (error instanceof FileOpError) throw error
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await fs.rename(source, target)
  return targetRelative
}

export async function trashEntry(
  root: string,
  relative: string,
  trash: (fullPath: string) => Promise<void>,
): Promise<void> {
  const normalized = assertWritableRelative(relative)
  const target = resolveInstancePath(root, normalized)
  await assertRealInside(root, target)
  await fs.access(target)
  await trash(target)
}
