import { describe, it, expect } from 'vitest'
import { parseNbt, serializeNbt } from '@main/services/nbt'

describe('nbt', () => {
  it('round-trips a servers.dat document', () => {
    const value = {
      servers: [
        { name: 'Vanilla', ip: 'play.example.net', acceptTextures: 1 },
        { name: 'Modded', ip: 'modded.example.net:25566', acceptTextures: 0, icon: 'data:image/png;base64,AAA' },
      ],
    }
    const buffer = serializeNbt('', value)
    const parsed = parseNbt(buffer)
    expect(parsed.type).toBe(10)
    expect(parsed.value.servers).toHaveLength(2)
    expect(parsed.value.servers[0]).toMatchObject({ name: 'Vanilla', ip: 'play.example.net' })
    expect(parsed.value.servers[1].icon).toBe('data:image/png;base64,AAA')
    expect(parsed.value.servers[1].acceptTextures).toBe(0)
  })

  it('round-trips primitive tags', () => {
    const value = {
      byte: 1,
      short: 1234,
      int: 7654321,
      long: 9007199254740993n,
      float: 1.5,
      double: 2.25,
      text: 'Xin chào',
      list: ['a', 'b', 'c'],
      ints: [1, 2, 3],
    }
    const parsed = parseNbt(serializeNbt('root', value))
    expect(parsed.name).toBe('root')
    expect(parsed.value.text).toBe('Xin chào')
    expect(parsed.value.list).toEqual(['a', 'b', 'c'])
    expect(parsed.value.ints).toEqual([1, 2, 3])
    expect(parsed.value.long).toBe(9007199254740993n)
  })

  it('rejects truncated data', () => {
    const buffer = serializeNbt('', { servers: [{ name: 'x', ip: 'y' }] })
    expect(() => parseNbt(buffer.subarray(0, buffer.length - 4))).toThrow()
  })
})
