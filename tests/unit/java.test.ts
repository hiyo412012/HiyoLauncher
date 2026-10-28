import { describe, it, expect } from 'vitest'
import { parseJavaVersion, pickJava } from '@main/services/java'

describe('java', () => {
  it('pickJava prefers exact match', () => {
    const list = [
      { path: '/a', major: 8, version: '1.8.0', vendor: 'x' },
      { path: '/b', major: 17, version: '17.0.1', vendor: 'x' },
      { path: '/c', major: 21, version: '21.0.1', vendor: 'x' },
    ] as any
    const picked = pickJava(17, undefined, list)
    expect(picked.path).toBe('/b')
  })

  it('pickJava chooses newest capable when no exact', () => {
    const list = [
      { path: '/a', major: 8, version: '1.8.0', vendor: 'x' },
      { path: '/b', major: 21, version: '21.0.1', vendor: 'x' },
    ] as any
    const picked = pickJava(17, undefined, list)
    expect(picked.path).toBe('/b')
  })

  it('pickJava throws JAVA_TOO_OLD when none capable', () => {
    const list = [{ path: '/a', major: 8, version: '1.8.0', vendor: 'x' }] as any
    try {
      pickJava(17, undefined, list)
      throw new Error('no throw')
    } catch (e: any) {
      expect(e.code).toBe('JAVA_TOO_OLD')
    }
  })

  it('parses Java 8 version output', () => {
    const out = 'openjdk version "1.8.0_402"\nOpenJDK Runtime Environment'
    expect(parseJavaVersion(out)).toEqual({ major: 8, version: '1.8.0_402' })
  })

  it('parses Java 17 and 21 version output', () => {
    expect(parseJavaVersion('openjdk version "17.0.11" 2024-04-16')?.major).toBe(17)
    expect(parseJavaVersion('java version "21.0.12" 2026-07-15 LTS')?.major).toBe(21)
  })

  it('returns null for garbage output', () => {
    expect(parseJavaVersion('not java at all')).toBeNull()
  })
})
