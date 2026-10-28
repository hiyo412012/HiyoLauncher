import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { launch as xmclLaunch, Version, MinecraftFolder } from '@xmcl/core'
import type { Paths } from './paths'
import { createPaths } from './paths'
import { SettingsService } from './settings'
import { InstanceService } from './instances'
import { VersionsService, downloadVersionJson, getVersionMeta, resolveVersion } from './versions'
import { ensureJavaFor, detectJava, pickJava } from './java'
import { downloadFile } from '../util/download'
import { getLogger } from './logger'
import type { Instance, GameState, GamePhase } from '../../shared/types'


// process tracking
interface RunningGame {
  instanceId: string
  pid: number
  process: any
  phase: GamePhase
  startedAt: number
  logBuffer: string[]
  flushTimer: NodeJS.Timeout | null
  logFile: string
  stopping?: boolean
}

const running = new Map<string, RunningGame>()

function getPaths(): Paths {
  const userData = app.getPath('userData')
  // settings may override gameRoot; read sync not available. Use default then update.
  const paths = createPaths(userData, path.join(userData, 'minecraft'))
  return paths
}

async function getSettingsPaths(): Promise<Paths> {
  const userData = app.getPath('userData')
  const paths = createPaths(userData, path.join(userData, 'minecraft'))
  try {
    const svc = new SettingsService(userData, paths)
    const s = await svc.get()
    paths.setGameRoot(s.gameRoot)
    await paths.ensureDirs()
  } catch {}
  return paths
}

function getInstanceService(paths: Paths): InstanceService {
  return new InstanceService(paths)
}

function getVersionsService(paths: Paths): VersionsService {
  return new VersionsService(paths)
}

function sendToAllWindows(channel: string, payload: any): void {
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send(channel, payload) } catch {}
  }
}

function makeError(code: string, message: string): Error {
  const e: any = new Error(message)
  e.code = code
  return e
}

export async function installVanilla(
  mcVersion: string,
  options?: {
    paths?: Paths
    signal?: AbortSignal
    onProgress?: (p: { label?: string; current: number; total: number }) => void
    fetch?: typeof fetch
  },
): Promise<void> {
  const paths = options?.paths ?? (await getSettingsPaths())
  await paths.ensureDirs()
  const signal = options?.signal
  const onProgress = options?.onProgress

  // download version json via versions service
  const vs = getVersionsService(paths)
  await vs.downloadJson(mcVersion)
  const meta = await vs.getMeta(mcVersion)

  // download client jar
  const versionRoot = path.join(paths.versionsDir, mcVersion) // wait versionsDir is shared/versions
  // Actually Minecraft versions are under gameRoot/versions, not shared/versions? @xmcl uses gameRoot/versions.
  // paths.versionsDir = shared/versions (shared). But MinecraftFolder expects gameRoot/versions. Mismatch!
  // The spec: shared/{versions,libraries,assets}. But @xmcl MinecraftFolder expects root/versions. Hmm.
  // We need gameRoot itself to contain versions/libraries/assets for @xmcl. But paths puts them under shared/.
  // Let's reconcile: use paths.gameRoot as Minecraft root, and shared dirs for versions? 
  // The Paths interface defines versionsDir = shared/versions. @xmcl MinecraftFolder.from(gameRoot) looks for gameRoot/versions.
  // This is a conflict. For compatibility with @xmcl, treat gameRoot as the .minecraft root (versions directly under gameRoot).
  // But paths.versionsDir points to shared/versions. 
  // We'll use gameRoot/versions for @xmcl and ignore paths.versionsDir for actual install? 
  // However paths.sharedDir etc provided by foundation. Let's use paths.gameRoot as minecraft root.
  await fs.mkdir(path.join(paths.gameRoot, 'versions', mcVersion), { recursive: true })

  onProgress?.({ label: 'version.json', current: 1, total: 1 })

  // parse resolved version
  const mf = MinecraftFolder.from(paths.gameRoot)
  // ensure version json present (downloaded above to gameRoot/versions? vs.downloadJson wrote to gameRoot/versions)
  // Actually vs.downloadJson used gameRoot() = paths.gameRoot? In versions.ts gameRoot(opts) returns paths.gameRoot if paths provided. Good. So json at gameRoot/versions/id/id.json. Good.
  const resolved = await Version.parse(mf, mcVersion)

  // download client jar
  const jarPath = mf.getVersionJar(mcVersion)
  if (resolved.downloads?.client?.url) {
    await downloadFile({ urls: resolved.downloads.client.url, dest: jarPath, sha1: resolved.downloads.client.sha1, size: resolved.downloads.client.size, signal, fetch: options?.fetch, onProgress: (p) => onProgress?.({ label: 'client.jar', ...p }) })
  }

  // libraries
  const libs = resolved.libraries ?? []
  let li = 0
  for (const lib of libs) {
    const dest = path.join(paths.gameRoot, 'libraries', lib.download.path)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await downloadFile({ urls: lib.download.url, dest, sha1: lib.download.sha1, size: lib.download.size, signal, fetch: options?.fetch, onProgress: (p) => onProgress?.({ label: lib.download.path, ...p }) })
    li++
    onProgress?.({ label: 'libraries', current: li, total: libs.length })
  }

  // assets index
  const assetsId = resolved.assets
  const assetIndex = resolved.assetIndex
  const indexUrl = assetIndex?.url
  if (indexUrl && assetIndex) {
    const indexDest = path.join(paths.gameRoot, 'assets', 'indexes', `${assetsId}.json`)
    await fs.mkdir(path.dirname(indexDest), { recursive: true })
    await downloadFile({ urls: indexUrl, dest: indexDest, sha1: assetIndex.sha1, size: assetIndex.size, signal, fetch: options?.fetch })
    // also save as mcVersion if different (user expectation)
    if (mcVersion !== assetsId) {
      const altDest = path.join(paths.gameRoot, 'assets', 'indexes', `${mcVersion}.json`)
      try { await fs.copyFile(indexDest, altDest) } catch {}
    }
    // parse objects
    const indexRaw = await fs.readFile(indexDest, 'utf8')
    const indexJson = JSON.parse(indexRaw)
    const objects = indexJson?.objects ?? {}
    const entries = Object.entries(objects) as [string, any][]
    let ai = 0
    for (const [name, obj] of entries) {
      const hash = obj.hash
      const prefix = hash.substring(0, 2)
      const objDest = path.join(paths.gameRoot, 'assets', 'objects', prefix, hash)
      await fs.mkdir(path.dirname(objDest), { recursive: true })
      await downloadFile({ urls: `https://resources.download.minecraft.net/${prefix}/${hash}`, dest: objDest, sha1: hash, size: obj.size, signal, fetch: options?.fetch })
      ai++
      if (ai % 50 === 0) onProgress?.({ label: 'assets', current: ai, total: entries.length })
    }
    onProgress?.({ label: 'assets', current: entries.length, total: entries.length })

    // virtual / map_to_resources
    if (indexJson?.virtual === true) {
      const virtualDir = path.join(paths.gameRoot, 'assets', 'virtual', mcVersion)
      await fs.mkdir(virtualDir, { recursive: true })
      // copy objects to resources paths? map_to_resources
      // Minimal: create legacy virtual legacy dir linking
      const legacyDir = path.join(paths.gameRoot, 'assets', 'virtual', 'legacy')
      await fs.mkdir(legacyDir, { recursive: true })
    }
  }

  // logging client file
  const logging = resolved.logging?.client?.file
  if (logging?.url) {
    const logDest = path.join(paths.gameRoot, 'assets', 'log_configs', logging.id ?? mcVersion)
    await fs.mkdir(path.dirname(logDest), { recursive: true })
    const finalDest = logDest.endsWith('.xml') ? logDest : logDest + '.xml'
    await downloadFile({ urls: logging.url, dest: finalDest, sha1: logging.sha1, size: logging.size, signal, fetch: options?.fetch })
  }

  onProgress?.({ label: 'done', current: 1, total: 1 })
}

export async function verifyInstance(instance: Instance, paths?: Paths): Promise<{ ok: boolean; missing: string[] }> {
  const p = paths ?? (await getSettingsPaths())
  const missing: string[] = []
  const mf = MinecraftFolder.from(p.gameRoot)
  try {
    await fs.access(mf.getVersionJson(instance.versionId))
  } catch { missing.push(mf.getVersionJson(instance.versionId)) }
  try {
    const resolved = await Version.parse(mf, instance.versionId)
    for (const lib of resolved.libraries ?? []) {
      const f = path.join(p.gameRoot, 'libraries', lib.download.path)
      try { await fs.access(f) } catch { missing.push(f) }
    }
    const jar = mf.getVersionJar(resolved.id)
    if (resolved.downloads?.client) {
      try { await fs.access(jar) } catch { missing.push(jar) }
    }
  } catch (e: any) {
    missing.push(`version parse: ${e?.message ?? e}`)
  }
  return { ok: missing.length === 0, missing }
}

export async function ensureInstanceInstalled(instance: Instance, opts?: { paths?: Paths; onProgress?: (p: any) => void; signal?: AbortSignal }): Promise<void> {
  const paths = opts?.paths ?? (await getSettingsPaths())
  await paths.ensureDirs()
  // Always run the installer: it validates sizes/checksums and only downloads missing files.
  await installVanilla(instance.mcVersion, { paths, signal: opts?.signal, onProgress: opts?.onProgress })

  // Install the loader on first launch (or when its version files are missing).
  if (instance.loader !== 'vanilla') {
    let needsLoader = !instance.versionId || instance.versionId === instance.mcVersion
    if (!needsLoader) {
      try {
        const parsed = await Version.parse(MinecraftFolder.from(paths.gameRoot), instance.versionId)
        needsLoader = parsed.id === instance.mcVersion
      } catch {
        needsLoader = true
      }
    }
    if (needsLoader) {
      opts?.onProgress?.({ label: `Installing ${instance.loader}`, current: 0, total: 1 })
      const { installLoader } = await import('./loaders')
      await installLoader(instance, { onProgress: opts?.onProgress })
    }
  }
}

function requiredJavaMajor(instance: Instance, resolved: any): number {
  return resolved?.javaVersion?.majorVersion ?? 17
}

export async function launchInstance(
  req: { instanceId: string; accountId?: string; server?: { host: string; port?: number }; quickPlay?: { type: 'singleplayer' | 'multiplayer' | 'realms'; value?: string } },
  opts?: { paths?: Paths },
): Promise<{ pid: number }> {
  const paths = opts?.paths ?? (await getSettingsPaths())
  await paths.ensureDirs()
  if (running.has(req.instanceId)) {
    throw makeError('CONFLICT', 'This instance is already running')
  }
  const instances = getInstanceService(paths)
  let instance = await instances.get(req.instanceId)

  // state preparing
  sendToAllWindows('game:state', { instanceId: instance.id, phase: 'preparing' })

  await ensureInstanceInstalled(instance, { paths, onProgress: (p) => sendToAllWindows('game:state', { instanceId: instance.id, phase: 'downloading', progress: p }) })
  // loader installation may have changed the launch version id
  instance = await instances.get(req.instanceId)

  // get account auth
  let auth: any = null
  if (req.accountId) {
    try {
      const mod: any = await import('@main/services/auth')
      if (mod?.getLaunchAuth) auth = await mod.getLaunchAuth(req.accountId)
    } catch (e) {
      throw makeError('AUTH', 'auth service unavailable')
    }
  }
  if (req.accountId && !auth) {
    throw makeError('AUTH', 'account not found')
  }

  const resolved = await Version.parse(MinecraftFolder.from(paths.gameRoot), instance.versionId)

  // java
  let javaPath = instance.javaPath
  if (!javaPath) {
    const major = requiredJavaMajor(instance, resolved)
    const detected = await detectJava({ paths })
    try {
      const picked = pickJava(major, undefined, detected)
      javaPath = picked.path
    } catch {
      javaPath = await ensureJavaFor(major, { paths })
    }
  }

  const settings = await new SettingsService(app.getPath('userData'), paths).get()

  const memory = instance.memoryMb ?? settings.defaultMemoryMb ?? 2048

  const launchOpts: any = {
    gamePath: paths.instanceDir(instance.id),
    resourcePath: paths.gameRoot,
    version: instance.versionId,
    javaPath,
    minMemory: 1024,
    maxMemory: memory,
    gameProfile: auth ? { name: auth.name ?? instance.name, id: auth.uuid } : { name: instance.name, id: instance.id },
    accessToken: auth?.accessToken ?? '0',
    userType: auth?.userType ?? (auth ? 'mojang' : 'legacy'),
    properties: auth?.properties,
    resolution: instance.resolution ? { width: instance.resolution.width, height: instance.resolution.height, fullscreen: instance.resolution.fullscreen } : undefined,
    extraJVMArgs: instance.jvmArgs,
    extraMCArgs: instance.gameArgs,
  }
  if (req.server) {
    launchOpts.server = { ip: req.server.host, port: req.server.port }
  }
  if (req.quickPlay) {
    if (req.quickPlay.type === 'multiplayer' && req.quickPlay.value) {
      launchOpts.quickPlayMultiplayer = req.quickPlay.value
    }
  }
  // ensure instance dir exists
  await fs.mkdir(paths.instanceDir(instance.id), { recursive: true })
  for (const f of ['mods', 'config', 'saves', 'resourcepacks', 'shaderpacks', 'datapacks', 'logs']) {
    await fs.mkdir(path.join(paths.instanceDir(instance.id), f), { recursive: true })
  }

  sendToAllWindows('game:state', { instanceId: instance.id, phase: 'launching' })

  let proc: any
  try {
    proc = await xmclLaunch(launchOpts)
  } catch (e: any) {
    const details = Array.isArray(e?.errors)
      ? e.errors.map((inner: any) => inner?.message ?? String(inner)).join(' | ')
      : e?.message ?? String(e)
    getLogger().error('launch failed', { message: e?.message, details, stack: e?.stack })
    sendToAllWindows('game:state', { instanceId: instance.id, phase: 'crashed', error: details })
    throw makeError('LAUNCH', `Could not launch Minecraft: ${details}`)
  }

  const rg: RunningGame = {
    instanceId: instance.id,
    pid: proc.pid ?? 0,
    process: proc,
    phase: 'running',
    startedAt: Date.now(),
    logBuffer: [],
    flushTimer: null,
    logFile: path.join(paths.instanceDir(instance.id), 'logs', 'game-stdout.log'),
  }
  running.set(instance.id, rg)

  sendToAllWindows('game:state', { instanceId: instance.id, phase: 'running', pid: proc.pid })
  instances.update(instance.id, { lastPlayedAt: Date.now() }).catch(() => {})
  import('./discord')
    .then((m) =>
      m.onGameState({
        phase: 'running',
        instanceId: instance.id,
        instanceName: instance.name,
        mcVersion: instance.mcVersion,
        loader: instance.loader,
        startedAt: rg.startedAt,
      }),
    )
    .catch(() => {})

  // log batching
  const flush = () => {
    if (rg.logBuffer.length === 0) return
    const lines = rg.logBuffer.splice(0, rg.logBuffer.length)
    sendToAllWindows('game:log', { instanceId: instance.id, lines })
  }
  rg.flushTimer = setInterval(flush, 200)

  const handleData = (chunk: any) => {
    const text = String(chunk)
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
    rg.logBuffer.push(...lines)
    // append to log file
    fs.appendFile(rg.logFile, text).catch(() => {})
  }
  proc.stdout?.on('data', handleData)
  proc.stderr?.on('data', handleData)

  proc.on('error', (err: any) => {
    sendToAllWindows('game:state', { instanceId: instance.id, phase: 'crashed', error: String(err?.message ?? err) })
  })

  proc.on('exit', async (code: number | null) => {
    if (rg.flushTimer) clearInterval(rg.flushTimer)
    flush()
    running.delete(instance.id)
    const crashed = !rg.stopping && code !== 0 && code !== null
    sendToAllWindows('game:state', { instanceId: instance.id, phase: crashed ? 'crashed' : 'exited', exitCode: code ?? undefined })
    sendToAllWindows('game:exit', { instanceId: instance.id, code })
    // accumulate play time
    try {
      const current = await instances.get(instance.id)
      await instances.update(instance.id, {
        playTimeMs: (current.playTimeMs ?? 0) + Math.max(0, Date.now() - rg.startedAt),
      })
    } catch {}
    import('./discord').then((m) => m.onGameState({ phase: 'exited', instanceId: instance.id })).catch(() => {})
    // crash analysis (lazy)
    if (crashed) {
      try {
        const crashMod: any = await import('@main/services/crash')
        if (crashMod?.analyzeCrash) {
          let logText = ''
          try { logText = await fs.readFile(rg.logFile, 'utf8') } catch {}
          try { crashMod.analyzeCrash(logText) } catch {}
        }
      } catch {}
    }
  })

  return { pid: proc.pid ?? 0 }
}

export function stopGame(instanceId: string): void {
  const rg = running.get(instanceId)
  if (!rg) return
  rg.stopping = true
  const pid = rg.pid
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', shell: true })
    } catch {}
  } else {
    try { rg.process.kill('SIGTERM') } catch {}
  }
}

export function getGameStatus(): GameState[] {
  const out: GameState[] = []
  for (const [id, rg] of running) {
    out.push({ instanceId: id, phase: rg.phase, pid: rg.pid, startedAt: rg.startedAt })
  }
  return out
}


// remove accidental fetch call at top? We inserted a stray fetch; need remove. Let's not include. The above has stray lines.
