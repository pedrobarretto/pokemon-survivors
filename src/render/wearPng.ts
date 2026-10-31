import { unzlibSync } from 'fflate'

/**
 * A small PNG decoder for the wearables' worker (8-bit RGBA, RGB, gray and
 * palette PNGs, not interlaced: what SpriteCollab ships), so it reads a
 * sheet's pixels from its bytes without a canvas (`OffscreenCanvas` is
 * missing on older iPhones) and without the main thread. `scripts/png.mjs`
 * is its Node twin.
 */
export const decodePng = (png: Uint8Array): { w: number; h: number; rgba: Uint8Array } => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let at = 8
  let w = 0
  let h = 0
  let depth = 0
  let color = 0
  let interlace = 0
  let palette: Uint8Array | null = null
  let alphas: Uint8Array | null = null
  const idat: Uint8Array[] = []
  while (at + 8 <= png.length) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(png[at + 4]!, png[at + 5]!, png[at + 6]!, png[at + 7]!)
    const data = png.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      w = view.getUint32(at + 8)
      h = view.getUint32(at + 12)
      depth = data[8]!
      color = data[9]!
      interlace = data[12]!
    } else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') alphas = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    at += 12 + length
  }
  const channels = ({ 6: 4, 2: 3, 4: 2, 3: 1, 0: 1 } as Record<number, number>)[color]
  if (depth !== 8 || interlace !== 0 || !channels) throw new Error(`unsupported PNG (depth ${depth}, color ${color}, interlace ${interlace})`)
  const joined = new Uint8Array(idat.reduce((a, d) => a + d.length, 0))
  let o = 0
  for (const d of idat) {
    joined.set(d, o)
    o += d.length
  }
  const raw = unzlibSync(joined)
  const stride = w * channels
  const rows = new Uint8Array(stride * h)
  // Undo the per-row filters (PNG spec, section 9).
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]!
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x]!
      const a = x >= channels ? rows[y * stride + x - channels]! : 0
      const b = y > 0 ? rows[(y - 1) * stride + x]! : 0
      const c = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels]! : 0
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      rows[y * stride + x] = (cur + [0, a, b, (a + b) >> 1, paeth][filter]!) & 255
    }
  }
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const q = i * 4
    if (color === 6) rgba.set(rows.subarray(q, q + 4), q)
    else if (color === 2) rgba.set([rows[i * 3]!, rows[i * 3 + 1]!, rows[i * 3 + 2]!, 255], q)
    else if (color === 4) rgba.set([rows[i * 2]!, rows[i * 2]!, rows[i * 2]!, rows[i * 2 + 1]!], q)
    else if (color === 3) {
      const k = rows[i]!
      rgba.set([palette![k * 3]!, palette![k * 3 + 1]!, palette![k * 3 + 2]!, alphas?.[k] ?? 255], q)
    } else rgba.set([rows[i]!, rows[i]!, rows[i]!, 255], q)
  }
  return { w, h, rgba }
}
