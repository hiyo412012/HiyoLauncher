import { describe, it, expect } from 'vitest'
import { analyzeCrash } from '@main/services/crash'

describe('crash analyzer', () => {
  it('detects out of memory', () => {
    const result = analyzeCrash('java.lang.OutOfMemoryError: Java heap space')
    expect(result.causes.map((c) => c.id)).toContain('out-of-memory')
    expect(result.causes[0].severity).toBe('fatal')
  })

  it('detects a wrong Java version', () => {
    const result = analyzeCrash(
      'java.lang.UnsupportedClassVersionError: net/minecraft/client/main/Main has been compiled by a more recent version of the Java Runtime',
    )
    expect(result.causes.map((c) => c.id)).toContain('java-too-old')
  })

  it('detects missing and duplicate mods', () => {
    const missing = analyzeCrash(
      'Missing or unsupported mandatory dependencies:\n\tmod requires fabric-api',
    )
    expect(missing.causes.map((c) => c.id)).toContain('missing-dependency')
    const duplicate = analyzeCrash('Duplicate mods found for mod id: sodium')
    expect(duplicate.causes.map((c) => c.id)).toContain('duplicate-mods')
  })

  it('detects native crashes and graphics errors', () => {
    const native = analyzeCrash(
      'A fatal error has been detected by the Java Runtime Environment:\nEXCEPTION_ACCESS_VIOLATION',
    )
    expect(native.causes.map((c) => c.id)).toContain('native-crash')
    const glfw = analyzeCrash('GLFW error 65542: WGL: The driver does not appear to support OpenGL')
    expect(glfw.causes.map((c) => c.id)).toContain('graphics')
  })

  it('deduplicates causes and caps the list', () => {
    const text = [
      'java.lang.OutOfMemoryError',
      'OutOfMemoryError again',
      'UnsupportedClassVersionError',
      'NoSuchMethodError',
      'GLFW error',
      'EXCEPTION_ACCESS_VIOLATION',
      'Duplicate mods',
      'Missing or unsupported mandatory dependencies',
    ].join('\n')
    const result = analyzeCrash(text)
    expect(result.causes.length).toBeLessThanOrEqual(6)
    expect(new Set(result.causes.map((c) => c.id)).size).toBe(result.causes.length)
  })
})
