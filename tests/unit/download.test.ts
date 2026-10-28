import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { downloadFile, sha1File } from '@main/util/download'

describe('download', () => {
  let tmp: string
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-')) })
  afterEach(async () => { await fsp.rm(tmp, { recursive: true, force: true }) })

  it('retries and succeeds on 2nd attempt', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls++
      if (calls === 1) {
        return new Response('boom', { status: 500 })
      }
      return new Response('hello', { status: 200, headers: { 'content-length': '5' } })
    })
    const dest = path.join(tmp, 'out.txt')
    await downloadFile({ urls: 'http://example.com/f', dest, fetch: fetchMock as any })
    const content = await fsp.readFile(dest, 'utf8')
    expect(content).toBe('hello')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deletes .part on checksum mismatch', async () => {
    const fetchMock = vi.fn(async () => new Response('hello', { status: 200, headers: { 'content-length': '5' } }))
    const dest = path.join(tmp, 'out.txt')
    await expect(downloadFile({ urls: 'http://example.com/f', dest, sha1: '0000000000000000000000000000000000000000', fetch: fetchMock as any })).rejects.toThrow()
    expect(fs.existsSync(dest + '.part')).toBe(false)
    expect(fs.existsSync(dest)).toBe(false)
  })

  it('throws PATH_UNSAFE on traversal dest', async () => {
    const dest = `${tmp}${path.sep}..${path.sep}evil.txt`
    await expect(downloadFile({ urls: 'http://example.com/f', dest, fetch: vi.fn() as any })).rejects.toMatchObject({ code: 'PATH_UNSAFE' })
  })

  it('sha1File computes hash', async () => {
    const f = path.join(tmp, 'a.txt')
    await fsp.writeFile(f, 'abc')
    const h = await sha1File(f)
    expect(h).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })
})
