import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0)
  return Buffer.concat([len, name, data, crc])
}
function writePng(path, width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(path, png)
  return png.length
}

const W = 64
const H = 64
const rgba = Buffer.alloc(W * H * 4)
function set(x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  rgba[i] = r
  rgba[i + 1] = g
  rgba[i + 2] = b
  rgba[i + 3] = a
}
function fill(x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, color)
}
function clear(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, [0, 0, 0, 0])
}

const TEAL = [42, 140, 158]
const TEAL_DARK = [22, 74, 86]
const TEAL_LIGHT = [111, 214, 228]
const SKIN = [232, 201, 160]
const SKIN_DARK = [198, 160, 120]
const EYE = [24, 42, 48]
const HAIR = [18, 52, 62]

// Base: every UV island gets a colour so no face is transparent.
fill(0, 0, 63, 63, TEAL)
// Head (base + hat layer)
fill(0, 0, 31, 15, HAIR)
fill(8, 8, 15, 15, SKIN) // front face
fill(8, 11, 15, 13, SKIN_DARK)
fill(9, 11, 10, 12, EYE)
fill(13, 11, 14, 12, EYE)
fill(11, 14, 12, 14, [160, 110, 100])
// Body front/back
fill(16, 16, 39, 31, TEAL_DARK)
fill(20, 20, 27, 31, TEAL_LIGHT)
fill(20, 20, 27, 22, [230, 247, 249])
// Arms
fill(40, 16, 55, 31, TEAL)
fill(44, 20, 47, 31, TEAL_LIGHT)
fill(48, 20, 51, 31, TEAL_LIGHT)
// Legs
fill(0, 16, 15, 31, TEAL_DARK)
fill(4, 20, 7, 31, [28, 98, 112])
fill(8, 20, 11, 31, [28, 98, 112])
// Opaque overlay layers (keeps the model visible on all clients).
fill(32, 0, 63, 15, HAIR)
fill(32, 16, 63, 31, TEAL_DARK)
fill(0, 32, 63, 47, TEAL_DARK)
fill(0, 48, 63, 63, TEAL_DARK)
// Reveal the face through the hat overlay (front face is at 40,8-47,15).
clear(40, 8, 47, 15)

const bytes = writePng('src/renderer/src/assets/default-skin.png', W, H, rgba)
console.log('default-skin.png bytes', bytes)
