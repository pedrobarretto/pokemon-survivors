// The brand icons (apple-touch-icon, the manifests' icons, the favicons) from the
// game's night logo, `scripts/brand/logo-night-512.png`: a yellow "PS" on a starry
// night, drawn on a 64×64 grid and shipped at 8×. Every icon reads that grid and
// draws whole cells (nearest-neighbour, integer scales), so nothing blurs.
// - The home-screen icons are full bleed and opaque: iOS rounds the corners and
//   Android masks them itself, and iOS draws transparency as black.
// - The maskable one keeps the "PS" and its sparkles inside Android's safe circle
//   (80% of the side); past the logo's edge the sky reflects back and forth across
//   its outer cells, keeping the dither's phase.
// - The favicons: the 48 is the "PS" cut out at 1×, the 32 the whole logo and the
//   16 that cut, shrunk a block of cells at a time, each block taking its most
//   common colour (the letters' colours win a tie). /favicon.ico holds all three.
import { writeFile } from 'node:fs/promises'
import { readPng, writePng } from './png.mjs'

const LOGO = 'scripts/brand/logo-night-512.png'
const GRID = 64

const logo = await readPng(LOGO)
const CELL = logo.width / GRID
/** The logo's cell (gx, gy) as 0xRRGGBB, read from the middle of its block. */
const cellAt = (gx, gy) => {
  const i = ((gy * CELL + (CELL >> 1)) * logo.width + gx * CELL + (CELL >> 1)) * 4
  return (logo.rgba[i] << 16) | (logo.rgba[i + 1] << 8) | logo.rgba[i + 2]
}
// How deep into the sky a cell past the edge reflects: an even span, so a reflection keeps the dither's phase.
const EDGE = 4
/** A cell past the grid's edge, reflected back and forth across that edge's outer `EDGE` cells. */
const fold = (g) => {
  if (g >= 0 && g < GRID) return g
  const t = (g < 0 ? -g : g - (GRID - 1)) % (2 * EDGE)
  const depth = t > EDGE ? 2 * EDGE - t : t
  return g < 0 ? depth : GRID - 1 - depth
}

/** A `size`² image of the grid at `scale` px a cell, centred (`crop` cells in from each side for a cut). */
const paint = (size, scale, crop = 0) => {
  const out = new Uint8Array(size * size * 4)
  const offset = (size - (GRID - 2 * crop) * scale) / 2 - crop * scale
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const c = cellAt(fold(Math.floor((x - offset) / scale)), fold(Math.floor((y - offset) / scale)))
      out.set([c >> 16, (c >> 8) & 255, c & 255, 255], (y * size + x) * 4)
    }
  return out
}

// The letters' yellows, then their outline, then the sparkles: what a shrunk block keeps on a tie.
const KEEP = [0xffcb05, 0xfff27a, 0xe89a00, 0xfff3a0, 0x081030, 0xffffff, 0x9cc8ff]
const rank = (c) => (KEEP.includes(c) ? KEEP.length - KEEP.indexOf(c) : 0)

/** The grid from cell `from` (both axes), `block` cells to a pixel, `size` pixels a side. */
const shrink = (size, from, block) => {
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const count = new Map()
      for (let dy = 0; dy < block; dy++)
        for (let dx = 0; dx < block; dx++) {
          const c = cellAt(from + x * block + dx, from + y * block + dy)
          count.set(c, (count.get(c) ?? 0) + 1)
        }
      const [c] = [...count].sort((a, b) => b[1] - a[1] || rank(b[0]) - rank(a[0]))[0]
      out.set([c >> 16, (c >> 8) & 255, c & 255, 255], (y * size + x) * 4)
    }
  return out
}

// The "PS" spans cells 11–52 across and 19–46 down; a 48-cell cut from cell 8 holds it whole.
const CUT = 8

const ICONS = [
  // 3× is 192: the apple-touch-icon loses two cells of sky on each side.
  { file: 'icons/apple-touch-icon.png', size: 180, art: () => paint(180, 3, 2) },
  { file: 'icons/icon-192.png', size: 192, art: () => paint(192, 3) },
  { file: 'icons/icon-512.png', size: 512, art: () => paint(512, 8) },
  // 6×: the farthest sparkle sits about 30 cells from the middle, 183 px of the safe circle's 205.
  { file: 'icons/icon-maskable-512.png', size: 512, art: () => paint(512, 6) },
  // The favicons: the 32 is also a PNG of its own; the 16 and the 48 live only in favicon.ico.
  { size: 48, art: () => paint(48, 1, CUT) },
  { file: 'icons/favicon-32.png', size: 32, art: () => shrink(32, 0, 2) },
  { size: 16, art: () => shrink(16, CUT, 3) },
]

const pngs = new Map()
for (const { file, size, art } of ICONS) {
  const png = writePng(size, size, art())
  pngs.set(size, png)
  if (!file) continue
  await writeFile(`public/${file}`, png)
  console.log(`public/${file}: ${size}×${size}`)
}

/** An .ico holding PNGs (every browser that asks for /favicon.ico reads them). */
const ico = (images) => {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let at = header.length
  images.forEach(([size, png], i) => {
    const e = 6 + 16 * i
    header[e] = size
    header[e + 1] = size
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(png.length, e + 8)
    header.writeUInt32LE(at, e + 12)
    at += png.length
  })
  return Buffer.concat([header, ...images.map(([, png]) => png)])
}
await writeFile('public/favicon.ico', ico([16, 32, 48].map((s) => [s, pngs.get(s)])))
console.log('public/favicon.ico: 16, 32, 48')
