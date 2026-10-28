import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import type { Paths } from './paths'
import { downloadFile } from '../util/download'
import type { JavaInfo } from '../../shared/types'

export interface JavaOptions {
  paths?: Paths
  fetch?: typeof fetch
  onProgress?: (p: { label?: string; current: number; total: number }) => void
}

function resolvePaths(opts?: JavaOptions): Paths | null {
  return opts?.paths ?? null
}

function gameRoot(opts?: JavaOptions): string {
  return resolvePaths(opts)?.gameRoot ?? path.join(process.cwd(), '.hiyo-game')
}

function runtimeDir(opts?: JavaOptions): string {
  return resolvePaths(opts)?.runtimeDir ?? path.join(gameRoot(opts), 'shared', 'java')
}

export function parseJavaVersion(output: string): { major: number; version: string } | null {
  // java -version prints to stderr
  const m = output.match(/version\s+"([^"]+)"/i)
  if (!m) {
    // try openjdk
    const m2 = output.match(/"([^"]+)"/)
    if (!m2) return null
    return parseVersionString(m2[1])
  }
  return parseVersionString(m[1])
}

export function parseVersionString(v: string): { major: number; version: string } | null {
  const parts = v.split('.')
  let major = 0
  if (parts[0] === '1' && parts.length > 1) {
    major = Number(parts[1])
  } else {
    major = Number(parts[0])
  }
  if (!Number.isFinite(major)) return null
  return { major, version: v }
}

function runJavaVersion(javaPath: string): { major: number; version: string; vendor?: string } | null {
  try {
    const res = spawnSync(javaPath, ['-version'], { encoding: 'utf8', timeout: 10000 })
    const out = (res.stderr || '') + (res.stdout || '')
    const parsed = parseJavaVersion(out)
    if (!parsed) return null
    // vendor detection
    let vendor: string | undefined
    const lower = out.toLowerCase()
    if (lower.includes('temurin')) vendor = 'Temurin'
    else if (lower.includes('adoptium')) vendor = 'Adoptium'
    else if (lower.includes('microsoft')) vendor = 'Microsoft'
    else if (lower.includes('zulu')) vendor = 'Zulu'
    else if (lower.includes('openjdk')) vendor = 'OpenJDK'
    else if (lower.includes('oracle')) vendor = 'Oracle'
    return { major: parsed.major, version: parsed.version, vendor }
  } catch {
    return null
  }
}

function javaBinName(): string {
  return process.platform === 'win32' ? 'java.exe' : 'java'
}

function candidateJavaPaths(base: string): string[] {
  const out: string[] = []
  const bin = path.join(base, 'bin', javaBinName())
  out.push(bin)
  if (process.platform === 'win32') {
    out.push(path.join(base, 'bin', 'javaw.exe'))
  }
  return out
}

function scanDirForJava(dir: string): JavaInfo[] {
  const result: JavaInfo[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const full = path.join(dir, e.name)
      for (const bin of candidateJavaPaths(full)) {
        const info = tryJava(bin)
        if (info) result.push(info)
      }
      // one level deeper
      try {
        const sub = fs.readdirSync(full, { withFileTypes: true })
        for (const s of sub) {
          if (!s.isDirectory()) continue
          const full2 = path.join(full, s.name)
          for (const bin of candidateJavaPaths(full2)) {
            const info = tryJava(bin)
            if (info) result.push(info)
          }
        }
      } catch {}
    }
  } catch {}
  return result
}

function tryJava(javaPath: string): JavaInfo | null {
  try {
    const stat = fs.statSync(javaPath)
    if (!stat.isFile()) return null
  } catch {
    return null
  }
  const parsed = runJavaVersion(javaPath)
  if (!parsed) return null
  return { path: javaPath, major: parsed.major, version: parsed.version, vendor: parsed.vendor }
}

function execWhere(command: string): string[] {
  try {
    const res = spawnSync(command, [], { encoding: 'utf8', shell: true, timeout: 10000 })
    const out = (res.stdout || '') + (res.stderr || '')
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

export async function detectJava(opts?: JavaOptions): Promise<JavaInfo[]> {
  const found: JavaInfo[] = []
  const seen = new Set<string>()

  function add(info: JavaInfo | null) {
    if (!info) return
    if (seen.has(info.path)) return
    seen.add(info.path)
    found.push(info)
  }

  // JAVA_HOME
  const javaHome = process.env.JAVA_HOME || process.env.JDK_HOME
  if (javaHome) {
    for (const bin of candidateJavaPaths(javaHome)) add(tryJava(bin))
  }

  // PATH via where/which
  const whereCmd = process.platform === 'win32' ? 'where java' : 'which -a java'
  for (const line of execWhere(whereCmd)) {
    add(tryJava(line))
  }

  // common dirs
  const commonRoots: string[] = []
  if (process.platform === 'win32') {
    commonRoots.push('C:\\Program Files\\Java')
    commonRoots.push('C:\\Program Files\\Eclipse Adoptium')
    commonRoots.push('C:\\Program Files\\Microsoft')
    commonRoots.push('C:\\Program Files\\Zulu')
    commonRoots.push('C:\\Program Files (x86)\\Java')
  } else if (process.platform === 'darwin') {
    commonRoots.push('/Library/Java/JavaVirtualMachines')
    commonRoots.push('/usr/lib/jvm')
  } else {
    commonRoots.push('/usr/lib/jvm')
    commonRoots.push('/usr/java')
  }
  for (const root of commonRoots) {
    for (const info of scanDirForJava(root)) add(info)
  }

  // runtimeDir
  const rd = runtimeDir(opts)
  for (const info of scanDirForJava(rd)) add(info)

  // also scan runtimeDir direct children bin
  try {
    const entries = fs.readdirSync(rd, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const full = path.join(rd, e.name)
      for (const bin of candidateJavaPaths(full)) add(tryJava(bin))
    }
  } catch {}

  return found
}

export function pickJava(requiredMajor: number, preferredPath?: string, detected?: JavaInfo[]): JavaInfo {
  const list = detected ?? []
  // if preferred provided, try to find
  if (preferredPath) {
    const pref = list.find((j) => j.path === preferredPath)
    if (pref && pref.major >= requiredMajor) return pref
  }
  // exact match
  const exact = list
    .filter((j) => j.major === requiredMajor)
    .sort((a, b) => (a.version > b.version ? -1 : 1))
  if (exact.length) return exact[0]
  if (requiredMajor <= 8) {
    const legacyErr: any = new Error('Java 8 is required for this Minecraft version')
    legacyErr.code = 'JAVA_TOO_OLD'
    throw legacyErr
  }
  // closest capable major (avoid launching old mods on a much newer Java)
  const capable = list
    .filter((j) => j.major >= requiredMajor)
    .sort((a, b) => a.major - b.major || (a.version > b.version ? -1 : 1))
  if (capable.length) return capable[0]
  const err: any = new Error(`Java ${requiredMajor}+ required`)
  err.code = 'JAVA_TOO_OLD'
  throw err
}

export async function pickJavaAsync(requiredMajor: number, preferredPath?: string, opts?: JavaOptions): Promise<JavaInfo> {
  const detected = await detectJava(opts)
  return pickJava(requiredMajor, preferredPath, detected)
}

function platformKey(): string {
  if (process.platform === 'win32') return 'windows-x64'
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'macos-arm64' : 'macos'
  if (process.arch === 'ia32') return 'linux-i386'
  return 'linux'
}

function runtimeKeyFor(major: number): string {
  if (major >= 21) return 'java-runtime-delta'
  if (major >= 17) return 'java-runtime-gamma'
  if (major >= 16) return 'java-runtime-alpha'
  return 'jre-legacy'
}

const JAVA_RUNTIME_MANIFEST_URL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

export async function installJavaRuntime(major: number, opts?: JavaOptions): Promise<string> {
  const fetchImpl = opts?.fetch ?? fetch
  const res = await fetchImpl(JAVA_RUNTIME_MANIFEST_URL)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const all: any = await res.json()
  const pk = platformKey()
  // find platform key possibly different
  let platformData: any = all?.[pk]
  if (!platformData) {
    // try alternatives
    const keys = Object.keys(all ?? {})
    const alt = keys.find((k) => k.includes(process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'))
    platformData = all?.[alt as string]
  }
  const rk = runtimeKeyFor(major)
  let runtimeEntries = platformData?.[rk]
  if (!runtimeEntries || !runtimeEntries.length) {
    // fallback: any runtime
    const allRuntimes = Object.keys(platformData ?? {})
    const fallbackKey = allRuntimes[0]
    runtimeEntries = platformData?.[fallbackKey]
  }
  const entry = runtimeEntries?.[0]
  const manifestUrl = entry?.manifest?.url
  if (!manifestUrl) throw new Error('NO_MANIFEST')
  const mres = await fetchImpl(manifestUrl)
  if (!mres.ok) throw new Error(`HTTP_${mres.status}`)
  const manifest: any = await mres.json()

  const targetDir = path.join(runtimeDir(opts), rk)
  await fsp.mkdir(targetDir, { recursive: true })

  const files = manifest?.files ?? {}
  // sort: directories first
  const entries = Object.entries(files) as [string, any][]
  // create directories
  for (const [rel, info] of entries) {
    if (info?.type === 'directory') {
      await fsp.mkdir(path.join(targetDir, rel), { recursive: true })
    }
  }
  // links
  for (const [rel, info] of entries) {
    if (info?.type === 'link') {
      const target = path.join(targetDir, rel)
      await fsp.mkdir(path.dirname(target), { recursive: true })
      try { await fsp.symlink(info.target, target) } catch {
        // fallback copy if symlink fails
        try { await fsp.cp(path.join(targetDir, info.target), target, { recursive: true }) } catch {}
      }
    }
  }
  // files
  const fileEntries = entries.filter(([, info]) => info?.type === 'file' && info?.downloads?.raw?.url)
  let current = 0
  const total = fileEntries.length
  for (const [rel, info] of fileEntries) {
    const raw = info.downloads.raw
    const dest = path.join(targetDir, rel)
    await fsp.mkdir(path.dirname(dest), { recursive: true })
    await downloadFile({
      urls: raw.url,
      dest,
      sha1: raw.sha1,
      size: raw.size,
      fetch: opts?.fetch,
      onProgress: (p) => {
        if (opts?.onProgress) opts.onProgress({ label: rel, current: current + 1, total })
      },
    })
    if (info.executable && process.platform !== 'win32') {
      try { await fsp.chmod(dest, 0o755) } catch {}
    }
    current++
  }

  // return java path
  const binDir = path.join(targetDir, 'bin')
  if (process.platform === 'win32') {
    const javaw = path.join(binDir, 'javaw.exe')
    try { await fsp.access(javaw); return javaw } catch {}
    return path.join(binDir, 'java.exe')
  }
  const java = path.join(binDir, 'java')
  try { await fsp.chmod(java, 0o755) } catch {}
  return java
}

export async function ensureJavaFor(major: number, opts?: JavaOptions): Promise<string> {
  const detected = await detectJava(opts)
  try {
    const picked = pickJava(major, undefined, detected)
    return picked.path
  } catch (e: any) {
    if (e?.code !== 'JAVA_TOO_OLD') throw e
  }
  // install
  return installJavaRuntime(major, opts)
}

// JavaService class for DI
export class JavaService {
  constructor(private paths: Paths) {}
  async detect(): Promise<JavaInfo[]> { return detectJava({ paths: this.paths }) }
  pick(requiredMajor: number, preferredPath?: string): JavaInfo {
    // sync; caller should detect first; here detect sync not possible. Use async variant instead.
    return pickJava(requiredMajor, preferredPath, [])
  }
  async pickAsync(requiredMajor: number, preferredPath?: string): Promise<JavaInfo> {
    return pickJavaAsync(requiredMajor, preferredPath, { paths: this.paths })
  }
  async ensure(major: number): Promise<string> {
    return ensureJavaFor(major, { paths: this.paths })
  }
  async install(major: number, onProgress?: JavaOptions['onProgress']): Promise<string> {
    return installJavaRuntime(major, { paths: this.paths, onProgress })
  }
}

export { execFileSync }
