// A small PNG decoder for the asset scripts (8-bit RGBA, RGB, gray and palette
// PNGs, non-interlaced: what SpriteCollab ships), so they read pixels without a
// dependency.
import { readFile } from 'node:fs/promises'
import { deflateSync, inflateSync } from 'node:zlib'

/** Every pixel of `file` as RGBA bytes, row by row. */
export const readPng = async (file) => {
  const png = await readFile(file)
  let at = 8
  let header = null
  let palette = null
  let alphas = null
  const idat = []
  while (at < png.length) {
    const length = png.readUInt32BE(at)
    const type = png.toString('ascii', at + 4, at + 8)
    const data = png.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] }
    if (type === 'PLTE') palette = data
    if (type === 'tRNS') alphas = data
    if (type === 'IDAT') idat.push(data)
    at += 12 + length
  }
  const { width, height, depth, color, interlace } = header
  const channels = { 6: 4, 2: 3, 4: 2, 3: 1, 0: 1 }[color]
  if (depth !== 8 || interlace !== 0 || !channels) throw new Error(`${file}: unsupported PNG (depth ${depth}, color ${color}, interlace ${interlace})`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const rows = Buffer.alloc(stride * height)
  // Undo the per-row filters (PNG spec, section 9).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x]
      const a = x >= channels ? rows[y * stride + x - channels] : 0
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels] : 0
      const p = a + b - c
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      rows[y * stride + x] = (cur + [0, a, b, (a + b) >> 1, paeth][filter]) & 0xff
    }
  }
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    if (color === 6) rgba.set(rows.subarray(o, o + 4), o)
    else if (color === 2) rgba.set([rows[i * 3], rows[i * 3 + 1], rows[i * 3 + 2], 255], o)
    else if (color === 4) rgba.set([rows[i * 2], rows[i * 2], rows[i * 2], rows[i * 2 + 1]], o)
    else if (color === 3) {
      const k = rows[i]
      rgba.set([palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2], alphas?.[k] ?? 255], o)
    } else rgba.set([rows[i], rows[i], rows[i], 255], o)
  }
  return { width, height, rgba }
}

const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc = (buf) => {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/** `rgba` (`w` × `h` RGBA bytes) as a PNG file's bytes, for contact sheets. */
export const writePng = (w, h, rgba) => {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(w, 0)
  header.writeUInt32BE(h, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
