// The app icons (apple-touch-icon, the manifests' icons) from Charmander's
// SpriteCollab portrait: full bleed, opaque, nearest-neighbour only. The home
// screen rounds the corners itself (iOS) or masks the icon (Android's maskable),
// so no frame, margin or transparency goes in: iOS draws transparency as black,
// and a baked frame reads as a dark ring inside its rounded tile.
// The art keeps whole pixels at an integer scale and stands on the bottom edge
// (Charmander's body runs off it); the sky above repeats the portrait's top row,
// which is sky only, and each side repeats its outer two columns, keeping the
// dither's phase.
import { writeFile } from 'node:fs/promises'
import { readPng, writePng } from './png.mjs'

const PORTRAIT = 'public/assets/pokemon/4/portrait.png'

// `scale` px per portrait pixel. The maskable one keeps the head inside Android's
// safe zone (the middle circle, 80% of the side), only the body running past it.
const ICONS = [
  { file: 'apple-touch-icon.png', size: 180, scale: 4 },
  { file: 'icon-192.png', size: 192, scale: 4 },
  { file: 'icon-512.png', size: 512, scale: 12 },
  { file: 'icon-maskable-512.png', size: 512, scale: 8 },
]

const { width, height, rgba } = await readPng(PORTRAIT)

/** A column past the portrait's side, folded onto that side's last two so a dither keeps its phase. */
const fold = (x) => (x < 0 ? ((x % 2) + 2) % 2 : x >= width ? width - 2 + (x % 2) : x)

for (const { file, size, scale } of ICONS) {
  const out = new Uint8Array(size * size * 4)
  const left = (size - width * scale) / 2
  const top = size - height * scale
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = fold(Math.floor((x - left) / scale))
      const sy = Math.max(0, Math.floor((y - top) / scale))
      const from = (sy * width + sx) * 4
      out.set([rgba[from], rgba[from + 1], rgba[from + 2], 255], (y * size + x) * 4)
    }
  await writeFile(`public/icons/${file}`, writePng(size, size, out))
  console.log(`public/icons/${file}: ${size}×${size}, ${scale}× art`)
}
