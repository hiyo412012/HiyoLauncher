import fs from 'node:fs/promises'
import net from 'node:net'
import dns from 'node:dns/promises'
import path from 'node:path'
import type { ServerEntry, ServerStatus } from '../../shared/types'
import { getPaths } from './paths'
import { readNbtFile, writeNbtFile } from './nbt'

export const DEFAULT_PROTOCOL = 769

export function encodeVarInt(value: number): Buffer {
  let v = value >>> 0
  const bytes: number[] = []
  do {
    let byte = v & 0x7f
    v >>>= 7
    if (v !== 0) byte |= 0x80
    bytes.push(byte)
  } while (v !== 0)
  return Buffer.from(bytes)
}

export function readVarInt(buffer: Buffer, offset = 0): { value: number; size: number } {
  let value = 0
  let size = 0
  let byte = 0
  do {
    if (offset + size >= buffer.length) throw new Error('VarInt: end of buffer')
    if (size >= 5) throw new Error('VarInt: too long')
    byte = buffer[offset + size]
    value |= (byte & 0x7f) << (7 * size)
    size++
  } while ((byte & 0x80) !== 0)
  return { value: value >>> 0, size }
}

function encodeString(value: string): Buffer {
  const data = Buffer.from(value, 'utf8')
  return Buffer.concat([encodeVarInt(data.length), data])
}

function packet(payload: Buffer): Buffer {
  return Buffer.concat([encodeVarInt(payload.length), payload])
}

export function buildHandshake(host: string, port: number, protocol = DEFAULT_PROTOCOL): Buffer {
  const hostBuf = encodeString(host)
  const portBuf = Buffer.alloc(2)
  portBuf.writeUInt16BE(port, 0)
  const payload = Buffer.concat([
    encodeVarInt(0x00),
    encodeVarInt(protocol),
    hostBuf,
    portBuf,
    encodeVarInt(1),
  ])
  return packet(payload)
}

export function buildStatusRequest(): Buffer {
  return packet(Buffer.from([0x00]))
}

function flattenMotd(value: any): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  let out = ''
  if (typeof value.text === 'string') out += value.text
  if (Array.isArray(value.extra)) out += value.extra.map(flattenMotd).join('')
  if (typeof value.translate === 'string' && !out) out += value.translate
  return out
}

function stripColors(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, '')
}

function splitHost(host: string, port?: number): { host: string; port: number } {
  const trimmed = host.trim()
  const match = /^\[(.+)\](?::(\d+))?$/.exec(trimmed)
  if (match) return { host: match[1], port: port ?? Number(match[2] ?? 25565) }
  const ipv4 = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/.exec(trimmed)
  if (ipv4) return { host: ipv4[1], port: port ?? Number(ipv4[2] ?? 25565) }
  const colon = trimmed.lastIndexOf(':')
  if (colon > 0) {
    const maybePort = Number(trimmed.slice(colon + 1))
    if (Number.isInteger(maybePort) && maybePort > 0 && maybePort < 65536) {
      return { host: trimmed.slice(0, colon), port: port ?? maybePort }
    }
  }
  return { host: trimmed, port: port ?? 25565 }
}

async function resolveSrv(host: string, port: number): Promise<{ host: string; port: number }> {
  if (port !== 25565) return { host, port }
  if (net.isIP(host)) return { host, port }
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${host}`)
    if (records.length) {
      const sorted = records.sort((a, b) => a.priority - b.priority || b.weight - a.weight)
      return { host: sorted[0].name, port: sorted[0].port }
    }
  } catch {
    // no SRV record
  }
  return { host, port }
}

interface PingResult {
  json: any
  latency: number
}

function readStatus(socket: net.Socket, startedAt: number): Promise<PingResult> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0)
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out'))
    }, 4000)

    const cleanup = () => {
      clearTimeout(timer)
      socket.removeAllListeners('data')
      socket.removeAllListeners('error')
      socket.removeAllListeners('close')
    }

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])
      try {
        const lengthInfo = readVarInt(buffer)
        const total = lengthInfo.size + lengthInfo.value
        if (buffer.length < total) return
        let offset = lengthInfo.size
        const packetId = readVarInt(buffer, offset)
        if (packetId.value !== 0x00) throw new Error('Unexpected packet id')
        offset += packetId.size
        const jsonLength = readVarInt(buffer, offset)
        offset += jsonLength.size
        const text = buffer.subarray(offset, offset + jsonLength.value).toString('utf8')
        const json = JSON.parse(text)
        cleanup()
        resolve({ json, latency: Date.now() - startedAt })
      } catch (e) {
        if (buffer.length > 2 * 1024 * 1024) {
          cleanup()
          reject(new Error('Response too large'))
        }
      }
    }

    socket.on('data', onData)
    socket.once('error', (e) => {
      cleanup()
      reject(e)
    })
    socket.once('close', () => {
      cleanup()
      reject(new Error('Connection closed'))
    })
  })
}

export async function pingServer(entry: { host: string; port?: number }): Promise<ServerStatus> {
  const started = Date.now()
  let target = splitHost(entry.host, entry.port)
  target = await resolveSrv(target.host, target.port)

  return await new Promise<ServerStatus>((resolve) => {
    const socket = net.createConnection({ host: target.host, port: target.port })
    const fail = (message: string) => {
      try {
        socket.destroy()
      } catch {}
      resolve({ online: false, error: message, latency: Date.now() - started })
    }

    const timer = setTimeout(() => fail('Timed out'), 5000)
    socket.once('connect', () => {
      socket.write(buildHandshake(entry.host, target.port))
      socket.write(buildStatusRequest())
    })
    socket.once('error', (e: any) => {
      clearTimeout(timer)
      fail(e?.code ?? e?.message ?? 'Connection failed')
    })
    readStatus(socket, started)
      .then(({ json, latency }) => {
        clearTimeout(timer)
        const players = json?.players ?? {}
        resolve({
          online: true,
          players: players.online ?? 0,
          max: players.max ?? 0,
          version: json?.version?.name,
          motd: stripColors(flattenMotd(json?.description)).trim(),
          latency,
          icon: typeof json?.favicon === 'string' ? json.favicon : undefined,
        })
        socket.destroy()
      })
      .catch((e) => {
        clearTimeout(timer)
        fail(e?.message ?? 'No response')
      })
  })
}

interface ServersDatEntry {
  name?: string
  ip?: string
  icon?: string
  acceptTextures?: number
}

function serversFile(): string {
  return path.join(getPaths().gameRoot, 'servers.dat')
}

export async function listServers(): Promise<ServerEntry[]> {
  try {
    const parsed = await readNbtFile(serversFile())
    const list = parsed?.value?.servers
    if (!Array.isArray(list)) return []
    return list
      .map((s: ServersDatEntry) => ({
        name: String(s?.name ?? ''),
        ip: String(s?.ip ?? ''),
        icon: typeof s?.icon === 'string' && s.icon.length > 0 ? s.icon : undefined,
      }))
      .filter((s: ServerEntry) => s.ip.length > 0)
  } catch {
    return []
  }
}

export async function addServer(entry: ServerEntry): Promise<ServerEntry[]> {
  const name = entry.name.trim().slice(0, 64)
  const ip = entry.ip.trim()
  if (!name) {
    const e: any = new Error('Server name is required')
    e.code = 'VALIDATION'
    throw e
  }
  if (!ip) {
    const e: any = new Error('Server address is required')
    e.code = 'VALIDATION'
    throw e
  }
  const target = splitHost(ip)
  if (target.port < 1 || target.port > 65535) {
    const e: any = new Error('Invalid port')
    e.code = 'VALIDATION'
    throw e
  }

  const existing = await readRawServers()
  if (existing.some((s) => s.ip === ip)) {
    const e: any = new Error('That server is already in the list')
    e.code = 'CONFLICT'
    throw e
  }
  existing.push({ name, ip, acceptTextures: 1 })
  await writeRawServers(existing)
  return listServers()
}

export async function removeServer(index: number): Promise<void> {
  const existing = await readRawServers()
  if (index < 0 || index >= existing.length) {
    const e: any = new Error('Server not found')
    e.code = 'NOT_FOUND'
    throw e
  }
  existing.splice(index, 1)
  await writeRawServers(existing)
}

async function readRawServers(): Promise<ServersDatEntry[]> {
  try {
    const parsed = await readNbtFile(serversFile())
    const list = parsed?.value?.servers
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function writeRawServers(servers: ServersDatEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(serversFile()), { recursive: true })
  await writeNbtFile(serversFile(), '', {
    servers: servers.map((s) => ({
      name: String(s.name ?? ''),
      ip: String(s.ip ?? ''),
      ...(typeof s.icon === 'string' && s.icon ? { icon: s.icon } : {}),
      acceptTextures: Number(s.acceptTextures ?? 1),
    })),
  })
}
