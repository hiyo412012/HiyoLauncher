import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export const TAG = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12,
} as const

export type NbtTagType = (typeof TAG)[keyof typeof TAG]

class Reader {
  private offset = 0
  constructor(private buffer: Buffer) {}

  get remaining(): number {
    return this.buffer.length - this.offset
  }

  byte(): number {
    this.ensure(1)
    return this.buffer.readInt8(this.offset++)
  }

  ubyte(): number {
    this.ensure(1)
    return this.buffer.readUInt8(this.offset++)
  }

  short(): number {
    this.ensure(2)
    const v = this.buffer.readInt16BE(this.offset)
    this.offset += 2
    return v
  }

  ushort(): number {
    this.ensure(2)
    const v = this.buffer.readUInt16BE(this.offset)
    this.offset += 2
    return v
  }

  int(): number {
    this.ensure(4)
    const v = this.buffer.readInt32BE(this.offset)
    this.offset += 4
    return v
  }

  long(): bigint {
    this.ensure(8)
    const v = this.buffer.readBigInt64BE(this.offset)
    this.offset += 8
    return v
  }

  float(): number {
    this.ensure(4)
    const v = this.buffer.readFloatBE(this.offset)
    this.offset += 4
    return v
  }

  double(): number {
    this.ensure(8)
    const v = this.buffer.readDoubleBE(this.offset)
    this.offset += 8
    return v
  }

  bytes(length: number): Buffer {
    this.ensure(length)
    const v = this.buffer.subarray(this.offset, this.offset + length)
    this.offset += length
    return v
  }

  string(): string {
    const length = this.ushort()
    return this.bytes(length).toString('utf8')
  }

  private ensure(n: number): void {
    if (this.offset + n > this.buffer.length) throw new Error('NBT: unexpected end of data')
  }
}

export function parseNbtPayload(reader: Reader, type: number): any {
  switch (type) {
    case TAG.Byte:
      return reader.byte()
    case TAG.Short:
      return reader.short()
    case TAG.Int:
      return reader.int()
    case TAG.Long:
      return reader.long()
    case TAG.Float:
      return reader.float()
    case TAG.Double:
      return reader.double()
    case TAG.ByteArray: {
      const length = reader.int()
      if (length < 0 || length > 64 * 1024 * 1024) throw new Error('NBT: invalid byte array length')
      return reader.bytes(length)
    }
    case TAG.String:
      return reader.string()
    case TAG.List: {
      const elementType = reader.ubyte()
      const length = reader.int()
      if (length < 0 || length > 10_000_000) throw new Error('NBT: invalid list length')
      const out: any[] = []
      for (let i = 0; i < length; i++) out.push(parseNbtPayload(reader, elementType))
      return out
    }
    case TAG.Compound: {
      const out: Record<string, any> = {}
      while (true) {
        const childType = reader.ubyte()
        if (childType === TAG.End) break
        const name = reader.string()
        out[name] = parseNbtPayload(reader, childType)
      }
      return out
    }
    case TAG.IntArray: {
      const length = reader.int()
      if (length < 0 || length > 10_000_000) throw new Error('NBT: invalid int array length')
      const out: number[] = []
      for (let i = 0; i < length; i++) out.push(reader.int())
      return out
    }
    case TAG.LongArray: {
      const length = reader.int()
      if (length < 0 || length > 10_000_000) throw new Error('NBT: invalid long array length')
      const out: bigint[] = []
      for (let i = 0; i < length; i++) out.push(reader.long())
      return out
    }
    default:
      throw new Error(`NBT: unknown tag type ${type}`)
  }
}

export function parseNbt(buffer: Buffer): { name: string; type: number; value: any } {
  const reader = new Reader(buffer)
  const type = reader.ubyte()
  if (type === TAG.End) return { name: '', type, value: undefined }
  const name = reader.string()
  const value = parseNbtPayload(reader, type)
  return { name, type, value }
}

function encodeString(value: string): Buffer {
  const data = Buffer.from(value, 'utf8')
  if (data.length > 0xffff) throw new Error('NBT: string too long')
  const head = Buffer.alloc(2)
  head.writeUInt16BE(data.length, 0)
  return Buffer.concat([head, data])
}

function inferListType(values: any[]): number {
  if (!values.length) return TAG.End
  const first = values[0]
  if (Buffer.isBuffer(first)) return TAG.ByteArray
  if (typeof first === 'string') return TAG.String
  if (typeof first === 'number') return Number.isInteger(first) ? TAG.Int : TAG.Float
  if (typeof first === 'bigint') return TAG.Long
  if (Array.isArray(first)) return TAG.List
  if (first && typeof first === 'object') return TAG.Compound
  return TAG.End
}

export function encodeNbtPayload(value: any, type: number): Buffer {
  switch (type) {
    case TAG.Byte: {
      const b = Buffer.alloc(1)
      b.writeInt8(Number(value) & 0xff, 0)
      return b
    }
    case TAG.Short: {
      const b = Buffer.alloc(2)
      b.writeInt16BE(Number(value), 0)
      return b
    }
    case TAG.Int: {
      const b = Buffer.alloc(4)
      b.writeInt32BE(Number(value), 0)
      return b
    }
    case TAG.Long: {
      const b = Buffer.alloc(8)
      b.writeBigInt64BE(BigInt(value), 0)
      return b
    }
    case TAG.Float: {
      const b = Buffer.alloc(4)
      b.writeFloatBE(Number(value), 0)
      return b
    }
    case TAG.Double: {
      const b = Buffer.alloc(8)
      b.writeDoubleBE(Number(value), 0)
      return b
    }
    case TAG.ByteArray: {
      const data = Buffer.isBuffer(value) ? value : Buffer.from(value)
      const head = Buffer.alloc(4)
      head.writeInt32BE(data.length, 0)
      return Buffer.concat([head, data])
    }
    case TAG.String:
      return encodeString(String(value))
    case TAG.List: {
      const values = (value ?? []) as any[]
      const elementType = inferListType(values)
      const head = Buffer.alloc(5)
      head.writeUInt8(elementType, 0)
      head.writeInt32BE(values.length, 1)
      const parts = values.map((v) => encodeNbtPayload(v, elementType))
      return Buffer.concat([head, ...parts])
    }
    case TAG.Compound: {
      const parts: Buffer[] = []
      for (const [key, child] of Object.entries(value ?? {})) {
        const childType = inferTagType(child)
        parts.push(Buffer.from([childType]), encodeString(key), encodeNbtPayload(child, childType))
      }
      parts.push(Buffer.from([TAG.End]))
      return Buffer.concat(parts)
    }
    case TAG.IntArray: {
      const values = (value ?? []) as number[]
      const head = Buffer.alloc(4)
      head.writeInt32BE(values.length, 0)
      const parts = values.map((v) => {
        const b = Buffer.alloc(4)
        b.writeInt32BE(v, 0)
        return b
      })
      return Buffer.concat([head, ...parts])
    }
    case TAG.LongArray: {
      const values = (value ?? []) as bigint[]
      const head = Buffer.alloc(4)
      head.writeInt32BE(values.length, 0)
      const parts = values.map((v) => {
        const b = Buffer.alloc(8)
        b.writeBigInt64BE(BigInt(v), 0)
        return b
      })
      return Buffer.concat([head, ...parts])
    }
    default:
      throw new Error(`NBT: cannot encode tag type ${type}`)
  }
}

export function inferTagType(value: any): number {
  if (typeof value === 'string') return TAG.String
  if (typeof value === 'boolean') return TAG.Byte
  if (typeof value === 'bigint') return TAG.Long
  if (typeof value === 'number') return Number.isInteger(value) ? TAG.Int : TAG.Double
  if (Buffer.isBuffer(value)) return TAG.ByteArray
  if (Array.isArray(value)) return TAG.List
  if (value && typeof value === 'object') return TAG.Compound
  return TAG.String
}

export function serializeNbt(name: string, value: any): Buffer {
  const type = inferTagType(value)
  return Buffer.concat([Buffer.from([type]), encodeString(name), encodeNbtPayload(value, type)])
}

async function readGzip(file: string): Promise<Buffer> {
  const raw = await fs.readFile(file)
  // Some third-party launchers write uncompressed servers.dat.
  const isGzip = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b
  return isGzip ? gunzip(raw) : raw
}

export async function readNbtFile(file: string): Promise<{ name: string; type: number; value: any }> {
  return parseNbt(await readGzip(file))
}

export async function writeNbtFile(file: string, name: string, value: any): Promise<void> {
  const compressed = await gzip(serializeNbt(name, value))
  await fs.mkdir(requireDir(file), { recursive: true })
  await fs.writeFile(file, compressed)
}

function requireDir(file: string): string {
  const idx = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'))
  return idx > 0 ? file.slice(0, idx) : '.'
}
