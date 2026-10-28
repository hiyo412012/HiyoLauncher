import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildFacets, sortVersions, searchProjects } from '@main/services/modrinth'

describe('modrinth', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn()
  })

  it('facet construction', () => {
    const facets = buildFacets({ projectType: 'mod', loader: 'fabric', mcVersion: '1.21.1', category: 'optimization' })
    expect(facets).toEqual([
      ['project_type:mod'],
      ['categories:fabric'],
      ['versions:1.21.1'],
      ['categories:optimization'],
    ])
  })

  it('skips empty', () => {
    expect(buildFacets({})).toEqual([])
  })

  it('version sorting', () => {
    const versions = [
      { versionType: 'beta', datePublished: '2024-01-01', id: 'b' },
      { versionType: 'release', datePublished: '2023-01-01', id: 'r1' },
      { versionType: 'release', datePublished: '2024-02-02', id: 'r2' },
      { versionType: 'alpha', datePublished: '2024-03-03', id: 'a' },
    ] as any
    const sorted = sortVersions(versions)
    expect(sorted.map((v: any) => v.id)).toEqual(['r2', 'r1', 'b', 'a'])
  })

  it('429 retry with Retry-After', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hits: [], offset: 0, limit: 0, total_hits: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    global.fetch = fetchMock as any
    const res = await searchProjects({ query: 'sodium' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((res as any).total_hits).toBe(0)
  })
})