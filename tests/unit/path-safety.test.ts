import { describe, it, expect } from 'vitest'
import * as ps from '@main/util/path-safety'
import path from 'node:path'

describe('path-safety', () => {
  it('accepts safe segment', () => {
    expect(() => ps.assertSafeSegment('foo')).not.toThrow()
  })
  it('rejects traversal', () => {
    expect(() => ps.assertSafeSegment('..')).toThrow()
    expect(() => ps.assertSafeSegment('../evil')).toThrow()
  })
  it('rejects absolute/drive', () => {
    expect(() => ps.assertSafeSegment('/abs')).toThrow()
    expect(() => ps.assertSafeSegment('C:\\x')).toThrow()
  })
  it('rejects reserved names', () => {
    expect(() => ps.assertSafeSegment('CON')).toThrow()
    expect(() => ps.assertSafeSegment('com1')).toThrow()
  })
  it('rejects trailing dot/space', () => {
    expect(() => ps.assertSafeSegment('foo.')).toThrow()
    expect(() => ps.assertSafeSegment('foo ')).toThrow()
  })
  it('resolveInside blocks escape', () => {
    const root = 'C:\\root'
    expect(() => ps.resolveInside(root, '..', 'evil')).toThrow()
    const ok = ps.resolveInside(root, 'a', 'b')
    expect(ok.startsWith(path.resolve(root))).toBe(true)
  })
})
