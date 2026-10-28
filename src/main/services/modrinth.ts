import type { MrProject, MrVersion, MrSearchParams, MrSearchResponse } from '../../shared/types'

export type { MrProject, MrVersion, MrDependency } from '../../shared/types'
export type MrSearchResult = MrSearchResponse

const USER_AGENT = 'HiyoLauncher/1.0.0 (github.com/hiyo412012)'
const BASE = 'https://api.modrinth.com/v2'
const TTL = 5 * 60 * 1000

const cache = new Map<string, { exp: number; data: any }>()

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function buildFacets(params: {
  projectType?: string
  loader?: string
  mcVersion?: string
  category?: string
  facets?: string[][]
}): string[][] {
  if (params.facets) return params.facets
  const out: string[][] = []
  if (params.projectType) out.push([`project_type:${params.projectType}`])
  if (params.loader) out.push([`categories:${params.loader}`])
  if (params.mcVersion) out.push([`versions:${params.mcVersion}`])
  if (params.category) out.push([`categories:${params.category}`])
  return out
}

export const buildSearchFacets = buildFacets

function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) sp.set(k, JSON.stringify(v))
    else sp.set(k, String(v))
  }
  return sp.toString()
}

async function fetchJson(url: string): Promise<any> {
  const cached = cache.get(url)
  if (cached && cached.exp > Date.now()) return cached.data

  for (let attempt = 0; attempt <= 3; attempt++) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      })
      clearTimeout(t)
      if (res.status === 429) {
        if (attempt < 3) {
          const ra = res.headers.get('retry-after')
          let wait = 1000
          if (ra) {
            const sec = Number(ra)
            if (!isNaN(sec)) wait = sec * 1000
            else {
              const date = Date.parse(ra)
              if (!isNaN(date)) wait = Math.max(0, date - Date.now())
            }
          }
          await sleep(wait)
          continue
        }
      }
      if (!res.ok) throw new Error(`MODRINTH ${res.status}`)
      const data = await res.json()
      cache.set(url, { exp: Date.now() + TTL, data })
      return data
    } catch (e) {
      clearTimeout(t)
      if (attempt < 3) {
        await sleep(1000 * Math.pow(2, attempt))
        continue
      }
      throw e
    }
  }
  throw new Error('MODRINTH network error')
}

export function sortVersions(versions: MrVersion[]): MrVersion[] {
  const rank: Record<string, number> = { release: 0, beta: 1, alpha: 2 }
  return [...versions].sort((a, b) => {
    const ra = rank[a.versionType] ?? 3
    const rb = rank[b.versionType] ?? 3
    if (ra !== rb) return ra - rb
    return new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime()
  })
}

export const sortProjectVersions = sortVersions

export async function searchProjects(params: MrSearchParams = {}): Promise<MrSearchResult> {
  const facets = buildFacets(params as any)
  const query: Record<string, any> = {
    query: params.query,
    facets: facets.length ? facets : undefined,
    index: params.sort,
    offset: params.offset,
    limit: params.limit,
  }
  const url = `${BASE}/search?${qs(query)}`
  const raw: any = await fetchJson(url)
  return {
    hits: raw?.hits ?? [],
    offset: raw?.offset ?? 0,
    limit: raw?.limit ?? (params.limit ?? 20),
    total_hits: raw?.total_hits ?? 0,
  }
}

function mapProject(raw: any): MrProject {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description ?? '',
    body: raw.body,
    categories: raw.categories ?? [],
    clientSide: raw.client_side ?? 'unknown',
    serverSide: raw.server_side ?? 'unknown',
    projectType: raw.project_type,
    downloads: raw.downloads ?? 0,
    iconUrl: raw.icon_url,
    color: raw.color,
    threadId: raw.thread_id,
    monetizationStatus: raw.monetization_status,
    team: raw.team,
    published: raw.published,
    updated: raw.updated,
    approved: raw.approved,
    followers: raw.followers ?? 0,
    status: raw.status,
    license: raw.license,
    versions: raw.versions,
    gallery: raw.gallery,
  }
}

function mapVersion(raw: any): MrVersion {
  return {
    id: raw.id,
    projectId: raw.project_id,
    name: raw.name,
    versionNumber: raw.version_number,
    changelog: raw.changelog,
    datePublished: raw.date_published,
    downloads: raw.downloads ?? 0,
    versionType: raw.version_type ?? 'release',
    status: raw.status ?? 'listed',
    requestedStatus: raw.requested_status,
    files: (raw.files ?? []).map((f: any) => ({
      hashes: { sha1: f.hashes?.sha1, sha512: f.hashes?.sha512 },
      url: f.url,
      filename: f.filename,
      primary: !!f.primary,
      size: f.size ?? 0,
      fileType: f.file_type,
    })),
    dependencies: (raw.dependencies ?? []).map((d: any) => ({
      versionId: d.version_id ?? undefined,
      projectId: d.project_id ?? undefined,
      dependencyType: d.dependency_type ?? 'required',
    })),
    gameVersions: raw.game_versions ?? [],
    loaders: raw.loaders ?? [],
    featured: !!raw.featured,
  }
}

export async function getProject(idOrSlug: string): Promise<MrProject> {
  return mapProject(await fetchJson(`${BASE}/project/${encodeURIComponent(idOrSlug)}`))
}

export async function getProjectVersions(
  projectId: string,
  opts: { loader?: string; mcVersion?: string } = {},
): Promise<MrVersion[]> {
  const data = await fetchJson(`${BASE}/project/${encodeURIComponent(projectId)}/version`)
  let versions = (data as any[]).map(mapVersion)
  if (opts.loader) {
    versions = versions.filter((v) => !v.loaders.length || v.loaders.includes(opts.loader!))
  }
  if (opts.mcVersion) {
    versions = versions.filter((v) => !v.gameVersions.length || v.gameVersions.includes(opts.mcVersion!))
  }
  return sortVersions(versions)
}

export async function getVersion(id: string): Promise<MrVersion> {
  return mapVersion(await fetchJson(`${BASE}/version/${encodeURIComponent(id)}`))
}

export async function getVersions(ids: string[]): Promise<MrVersion[]> {
  if (!ids.length) return []
  const data = (await fetchJson(`${BASE}/versions?ids=${encodeURIComponent(JSON.stringify(ids))}`)) as any[]
  return data.map(mapVersion)
}