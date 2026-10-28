import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import semver from 'semver'
import type { Instance, LoaderVersionSummary } from '../../shared/types'
import { getPaths } from './paths'
import { getInstance, updateInstance } from './instances'
import { installVanilla } from './game'
import { downloadFile } from './download'

function gameRoot(): string {
  return getPaths().gameRoot
}
function versionsDir(): string {
  return getPaths().versionsDir
}
function librariesDir(): string {
  return getPaths().librariesDir
}
function cacheDir(): string {
  return getPaths().cacheDir
}
async function ensureDirs(): Promise<void> {
  await getPaths().ensureDirs()
}

function sortDesc(items: LoaderVersionSummary[]): LoaderVersionSummary[] {
  return items.sort((a, b) => {
    const va = semver.coerce(a.version)?.version || a.version
    const vb = semver.coerce(b.version)?.version || b.version
    const c = semver.compare(va, vb)
    if (c !== 0) return -c
    return 0
  })
}

export async function getLoaderVersions(type: string, mcVersion: string): Promise<LoaderVersionSummary[]> {
  await ensureDirs()
  if (type === 'fabric') {
    const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mcVersion)}`)
    if (!res.ok) return []
    const data: any = await res.json()
    const out: LoaderVersionSummary[] = (data || []).map((e: any) => ({
      loader: 'fabric',
      version: e?.loader?.version,
      stable: !!e?.loader?.stable,
      mcVersions: [mcVersion],
    }))
    return sortDesc(out)
  }
  if (type === 'quilt') {
    const res = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mcVersion)}`)
    if (!res.ok) return []
    const data: any = await res.json()
    const out: LoaderVersionSummary[] = (data || []).map((e: any) => ({
      loader: 'quilt',
      version: e?.loader?.version,
      stable: !!e?.loader?.stable,
      mcVersions: [mcVersion],
    }))
    return sortDesc(out)
  }
  if (type === 'forge') {
    const res = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
    if (!res.ok) return []
    const data: any = await res.json()
    const promos = data?.promos || {}
    const stableMap = new Map<string, boolean>()
    for (const key of Object.keys(promos)) {
      if (!key.startsWith(mcVersion + '-')) continue
      const v = promos[key]
      const stable = key.endsWith('-recommended')
      if (!stableMap.has(v) || stable) stableMap.set(v, stable || stableMap.get(v) || false)
    }
    const out: LoaderVersionSummary[] = [...stableMap.keys()].map((v) => ({
      loader: 'forge',
      version: v,
      stable: stableMap.get(v) ?? false,
      mcVersions: [mcVersion],
    }))
    return sortDesc(out)
  }
  if (type === 'neoforge') {
    if (!semver.gte(mcVersion, '1.20.2')) return []
    const res = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml')
    if (!res.ok) return []
    const xml = await res.text()
    const versions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1])
    const prefix = mcVersion.replace(/^1\./, '')
    const filtered = versions.filter((v) => v.startsWith(prefix + '.'))
    const out: LoaderVersionSummary[] = filtered.map((v) => ({
      loader: 'neoforge',
      version: v,
      stable: true,
      mcVersions: [mcVersion],
    }))
    return sortDesc(out)
  }
  return []
}

function libraryPath(name: string): string {
  const [gav] = name.split('@')
  const parts = gav.split(':')
  const group = parts[0]
  const artifact = parts[1]
  const version = parts[2]
  const classifier = parts[3]
  const ext = name.includes('@') ? name.split('@')[1] : 'jar'
  const fileName = `${artifact}-${version}${classifier ? '-' + classifier : ''}.${ext}`
  return path.join(librariesDir(), group.replace(/\./g, '/'), artifact, version, fileName)
}

async function downloadInstaller(loader: string, mcVersion: string, version: string): Promise<string> {
  let url: string
  let fileName: string
  if (loader === 'forge') {
    fileName = `forge-${mcVersion}-${version}-installer.jar`
    url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${version}/${fileName}`
  } else {
    fileName = `neoforge-${version}-installer.jar`
    url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/${fileName}`
  }
  const dest = path.join(cacheDir(), 'installers', fileName)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await downloadFile({ url, urls: [url], dest })
  return dest
}

async function runInstaller(java: string, jar: string, root: string): Promise<void> {
  // The official Forge/NeoForge installer refuses to run without a launcher profile file.
  const profilesFile = path.join(root, 'launcher_profiles.json')
  try {
    await fs.access(profilesFile)
  } catch {
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(
      profilesFile,
      JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2),
      'utf8',
    )
  }

  return new Promise((resolve, reject) => {
    const child = spawn(java, ['-jar', jar, '--installClient', root], { cwd: root })
    let output = ''
    const capture = (chunk: any) => {
      output += String(chunk)
      if (output.length > 8000) output = output.slice(-8000)
    }
    child.stdout?.on('data', capture)
    child.stderr?.on('data', capture)
    const timer = setTimeout(() => {
      try { child.kill() } catch {}
      reject(new Error(`JAVA: installer timed out\n${output}`))
    }, 10 * 60 * 1000)
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`JAVA: installer exited with ${code}\n${output}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

async function findInstalledVersion(mcVersion: string, loader: string): Promise<string> {
  const dir = versionsDir()
  const entries = await fs.readdir(dir)
  let best: { id: string; mtime: number } | null = null
  for (const e of entries) {
    try {
      const jsonPath = path.join(dir, e, `${e}.json`)
      const raw = await fs.readFile(jsonPath, 'utf8')
      const j = JSON.parse(raw)
      if (j.inheritsFrom !== mcVersion) continue
      const match = loader === 'forge' ? /forge/i.test(e) && !/neoforge/i.test(e) : /neoforge/i.test(e)
      if (!match) continue
      const stat = await fs.stat(jsonPath)
      if (!best || stat.mtimeMs > best.mtime) best = { id: e, mtime: stat.mtimeMs }
    } catch {}
  }
  if (!best) throw new Error('VERSION')
  return best.id
}

export async function installLoader(instance: any, options: any = {}): Promise<string> {
  await ensureDirs()
  await installVanilla(instance.mcVersion, { onProgress: options.onProgress })

  const loader = instance.loader
  if (loader === 'vanilla') {
    await updateInstance(instance.id, { versionId: instance.mcVersion })
    return instance.mcVersion
  }

  if (loader === 'fabric' || loader === 'quilt') {
    const versions = await getLoaderVersions(loader, instance.mcVersion)
    const loaderVersion = instance.loaderVersion || versions[0]?.version
    if (!loaderVersion) throw new Error('VERSION')
    const base =
      loader === 'fabric' ? 'https://meta.fabricmc.net/v2' : 'https://meta.quiltmc.org/v3'
    const profileUrl = `${base}/versions/loader/${encodeURIComponent(instance.mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`
    const res = await fetch(profileUrl)
    if (!res.ok) throw new Error('VERSION')
    const profile: any = await res.json()
    const id = profile.id
    const dir = path.join(versionsDir(), id)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(profile, null, 2))

    const libs = profile.libraries || []
    for (const lib of libs) {
      if (!lib?.name) continue
      const dest = libraryPath(lib.name)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      const [coord, ext = 'jar'] = String(lib.name).split('@')
      const [group, artifact, version, classifier] = coord.split(':')
      const fileName = path.basename(dest)
      const mavenPath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${fileName}`
      let downloadUrl: string
      if (typeof lib.url === 'string' && /\.jar$/i.test(lib.url)) {
        downloadUrl = lib.url
      } else if (typeof lib.url === 'string' && /^https?:\/\//i.test(lib.url)) {
        downloadUrl = (lib.url.endsWith('/') ? lib.url : lib.url + '/') + mavenPath
      } else {
        downloadUrl = `https://repo1.maven.org/maven2/${mavenPath}`
      }
      await downloadFile({ url: downloadUrl, urls: [downloadUrl], dest, sha1: lib.sha1 })
    }

    await updateInstance(instance.id, { versionId: id, loaderVersion })
    return id
  }

  if (loader === 'forge' || loader === 'neoforge') {
    const versions = await getLoaderVersions(loader, instance.mcVersion)
    const loaderVersion = instance.loaderVersion || versions[0]?.version
    if (!loaderVersion) throw new Error('VERSION')
    const installerPath = await downloadInstaller(loader, instance.mcVersion, loaderVersion)
    const java = options.javaPath || 'java'
    await runInstaller(java, installerPath, gameRoot())
    const id = await findInstalledVersion(instance.mcVersion, loader)
    await updateInstance(instance.id, { versionId: id, loaderVersion })
    return id
  }

  throw new Error('VERSION')
}

export function loadedVersionId(instance: any): string {
  return instance.versionId
}
