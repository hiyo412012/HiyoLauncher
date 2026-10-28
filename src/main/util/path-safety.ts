import path from 'node:path'

const RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
])

export class PathUnsafeError extends Error {
  code = 'PATH_UNSAFE' as const
  constructor(message: string) {
    super(message)
    this.name = 'PathUnsafeError'
  }
}

export function assertSafeSegment(name: string): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new PathUnsafeError('empty segment')
  }
  if (name.includes('\u0000')) throw new PathUnsafeError('NUL in segment')
  if (name === '.' || name === '..') throw new PathUnsafeError('dot segment')
  if (path.isAbsolute(name)) throw new PathUnsafeError('absolute segment')
  if (/^[a-zA-Z]:/.test(name)) throw new PathUnsafeError('drive letter')
  if (name.includes('/') || name.includes('\\')) throw new PathUnsafeError('separator in segment')
  if (name.includes('..')) throw new PathUnsafeError('traversal')
  const trimmed = name.trimEnd()
  if (trimmed !== name && name.endsWith(' ')) throw new PathUnsafeError('trailing space')
  if (name.endsWith('.')) throw new PathUnsafeError('trailing dot')
  const base = name.split('.')[0].toUpperCase()
  if (RESERVED.has(base)) throw new PathUnsafeError('reserved name')
}

export function resolveInside(root: string, ...segments: string[]): string {
  for (const s of segments) assertSafeSegment(s)
  const resolved = path.resolve(root, ...segments)
  const rootResolved = path.resolve(root)
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new PathUnsafeError('escapes root')
  }
  return resolved
}
