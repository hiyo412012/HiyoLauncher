import fs from 'node:fs/promises'
import path from 'node:path'
import type { CrashAnalysis, CrashCause, LogFileInfo } from '../../shared/types'
import { getPaths } from './paths'
import { listInstances } from './instances'

interface Pattern {
  id: string
  regex: RegExp
  title: string
  tip: string
  severity: CrashCause['severity']
}

const PATTERNS: Pattern[] = [
  {
    id: 'out-of-memory',
    regex: /java\.lang\.OutOfMemoryError|GL_OUT_OF_MEMORY|insufficient memory/i,
    title: 'Out of memory',
    tip: 'Increase the instance memory in Instance → Settings, close other apps, or remove heavy mods/texture packs.',
    severity: 'fatal',
  },
  {
    id: 'java-too-old',
    regex: /UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime/i,
    title: 'Wrong Java version',
    tip: 'This Minecraft version needs a newer Java. Pick or install the recommended Java in Settings → Game.',
    severity: 'error',
  },
  {
    id: 'missing-dependency',
    regex: /Missing or unsupported mandatory dependencies|MissingDependencyException|requires .* which is missing/i,
    title: 'Missing mod dependency',
    tip: 'A mod needs another mod that is not installed. Add the missing dependency (Modrinth shows required dependencies).',
    severity: 'error',
  },
  {
    id: 'duplicate-mods',
    regex: /Duplicate mods found|duplicate mod|Found duplicate mod/i,
    title: 'Duplicate mod',
    tip: 'Two files provide the same mod. Remove the older duplicate from the Mods tab.',
    severity: 'error',
  },
  {
    id: 'mod-conflict',
    regex: /NoSuchMethodError|NoSuchFieldError|NoClassDefFoundError|ClassNotFoundException|Incompatible mod set/i,
    title: 'Mod conflict or version mismatch',
    tip: 'A mod was built for a different Minecraft/loader version. Check that every mod matches this instance version.',
    severity: 'error',
  },
  {
    id: 'graphics',
    regex: /GLFW error|OpenGL error|Pixel format not accelerated|GL_INVALID|Failed to create window|WGL/i,
    title: 'Graphics driver problem',
    tip: 'Update your GPU driver, disable overlays (Discord/GeForce), or try a different renderer (Iris/Sodium).',
    severity: 'error',
  },
  {
    id: 'native-crash',
    regex: /EXCEPTION_ACCESS_VIOLATION|A fatal error has been detected by the Java Runtime|SIGSEGV|hs_err_pid/i,
    title: 'Native crash',
    tip: 'Often caused by a graphics driver or a native mod. Update drivers, remove recently added mods, and check the crash report.',
    severity: 'fatal',
  },
  {
    id: 'world-corrupt',
    regex: /Region file.*is missing|Chunk file.*corrupt|world.*corrupt|Failed to load world/i,
    title: 'World data problem',
    tip: 'Restore a world backup or remove the damaged region file. Keep backups of important worlds.',
    severity: 'error',
  },
  {
    id: 'access-denied',
    regex: /AccessDeniedException|Permission denied|EBUSY|being used by another process/i,
    title: 'File access problem',
    tip: 'Close other launchers/Minecraft instances, or move the game folder outside a protected directory (e.g. Program Files).',
    severity: 'error',
  },
  {
    id: 'auth-offline',
    regex: /Invalid session|Failed to verify username|Authentication servers are down/i,
    title: 'Session rejected',
    tip: 'Offline accounts cannot join online-mode servers. For Microsoft accounts, sign in again from the account switcher.',
    severity: 'warning',
  },
]

export function analyzeCrash(text: string): CrashAnalysis {
  const causes: CrashCause[] = []
  const seen = new Set<string>()
  for (const pattern of PATTERNS) {
    if (seen.has(pattern.id)) continue
    if (pattern.regex.test(text)) {
      seen.add(pattern.id)
      causes.push({
        id: pattern.id,
        title: pattern.title,
        tip: pattern.tip,
        severity: pattern.severity,
      })
      if (causes.length >= 6) break
    }
  }

  const summary = summarize(text, causes)
  return { summary, causes }
}

function summarize(text: string, causes: CrashCause[]): string {
  const lines = text.split(/\r?\n/)
  const fatal = lines.find((l) => /A fatal error has been detected by the Java Runtime/i.test(l))
  if (fatal) return fatal.trim().slice(0, 300)
  const exception = lines.find((l) => /(?:java\.lang\.|net\.minecraft\.|cpw\.mods\.)[\w.$]*Exception|Error:/.test(l))
  if (exception) return exception.trim().slice(0, 300)
  if (causes.length) return causes[0].title
  const exit = lines.find((l) => /exit code|crash report|Exception/i.test(l))
  return (exit ?? 'The game exited unexpectedly.').trim().slice(0, 300)
}

function safeRoots(): string[] {
  const paths = getPaths()
  return [
    paths.userData,
    paths.gameRoot,
    paths.instancesDir,
    paths.logsDir,
  ].map((p) => path.resolve(p))
}

export function assertLogPath(file: string): string {
  const resolved = path.resolve(file)
  const roots = safeRoots()
  if (!roots.some((root) => resolved === root || resolved.startsWith(root + path.sep))) {
    const e: any = new Error('Log path is outside the launcher data directory')
    e.code = 'PATH_UNSAFE'
    throw e
  }
  return resolved
}

export async function listLogs(instanceId?: string): Promise<LogFileInfo[]> {
  const paths = getPaths()
  const out: LogFileInfo[] = []

  const addFile = async (file: string, owner?: string) => {
    try {
      const stat = await fs.stat(file)
      if (!stat.isFile()) return
      out.push({ path: file, instanceId: owner, size: stat.size, modifiedAt: stat.mtimeMs })
    } catch {}
  }

  const addInstance = async (id: string) => {
    const root = paths.instanceDir(id)
    await addFile(path.join(root, 'logs', 'latest.log'), id)
    await addFile(path.join(root, 'logs', 'game-stdout.log'), id)
    const crashDir = path.join(root, 'crash-reports')
    try {
      const entries = await fs.readdir(crashDir)
      for (const name of entries.filter((n) => n.endsWith('.txt'))) {
        await addFile(path.join(crashDir, name), id)
      }
    } catch {}
  }

  if (instanceId) {
    await addInstance(instanceId)
  } else {
    await addFile(path.join(paths.logsDir, 'main.log'))
    const instances = await listInstances()
    for (const instance of instances) await addInstance(instance.id)
  }

  return out.sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 100)
}

export async function readLog(file: string, lines = 500): Promise<string> {
  const safe = assertLogPath(file)
  const raw = await fs.readFile(safe, 'utf8')
  if (lines <= 0) return raw
  const all = raw.split(/\r?\n/)
  return all.slice(Math.max(0, all.length - lines)).join('\n')
}

export async function analyzeLogFile(file: string): Promise<CrashAnalysis> {
  const text = await readLog(file, 5000)
  return analyzeCrash(text)
}

export async function exportLog(file: string): Promise<string> {
  return readLog(file, 5000)
}

/** Watches a log file and calls `onChunk` with appended text. */
export async function tailLog(
  instanceId: string,
  onChunk: (chunk: string) => void,
): Promise<() => void> {
  const file = path.join(getPaths().instanceDir(instanceId), 'logs', 'latest.log')
  let offset = 0
  try {
    const stat = await fs.stat(file)
    offset = stat.size
  } catch {}

  const timer = setInterval(async () => {
    try {
      const stat = await fs.stat(file)
      if (stat.size < offset) offset = 0
      if (stat.size === offset) return
      const handle = await fs.open(file, 'r')
      try {
        const length = stat.size - offset
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, offset)
        offset = stat.size
        onChunk(buffer.toString('utf8'))
      } finally {
        await handle.close()
      }
    } catch {}
  }, 500)

  return () => clearInterval(timer)
}
