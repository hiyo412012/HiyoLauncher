import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerOptions {
  file: string
  maxBytes?: number
  maxFiles?: number
}

const REDACT_KEYS = /token|secret|authorization|refresh_token|password/i

export function redact(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return value.replace(/(token|secret|authorization|refresh_token|password)(\s*[:=]\s*)([^\s,}]+)/gi, '$1$2[REDACTED]')
  }
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value === 'object') {
    const out: any = {}
    for (const k of Object.keys(value)) {
      if (REDACT_KEYS.test(k)) out[k] = '[REDACTED]'
      else out[k] = redact(value[k])
    }
    return out
  }
  return value
}

export class Logger {
  private file: string
  private maxBytes: number
  private emitter = new EventEmitter()
  constructor(opts: LoggerOptions) {
    this.file = opts.file
    this.maxBytes = opts.maxBytes ?? 2 * 1024 * 1024
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
  }

  get stream(): EventEmitter { return this.emitter }

  private rotateIfNeeded() {
    try {
      const stat = fs.statSync(this.file)
      if (stat.size >= this.maxBytes) {
        const rotated = this.file.replace(/\.log$/, '.1.log')
        try { fs.renameSync(this.file, rotated) } catch {}
      }
    } catch {}
  }

  log(level: LogLevel, message: string, meta?: any): void {
    this.rotateIfNeeded()
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(meta !== undefined ? { meta: redact(meta) } : {}),
    }
    const line = JSON.stringify(entry) + '\n'
    try { fs.appendFileSync(this.file, line) } catch {}
    this.emitter.emit('line', line)
    this.emitter.emit(level, entry)
  }

  debug(m: string, meta?: any) { this.log('debug', m, meta) }
  info(m: string, meta?: any) { this.log('info', m, meta) }
  warn(m: string, meta?: any) { this.log('warn', m, meta) }
  error(m: string, meta?: any) { this.log('error', m, meta) }
}

export function createLogger(file: string): Logger {
  return new Logger({ file })
}

let activeLogger: Logger | null = null

export function setActiveLogger(logger: Logger): void {
  activeLogger = logger
}

export function getLogger(): Logger {
  if (!activeLogger) {
    // Never throw from logging: fall back to an in-memory no-op-ish logger.
    activeLogger = createLogger('hiyolauncher.log')
  }
  return activeLogger
}
