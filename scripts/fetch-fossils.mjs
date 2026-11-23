// The fossils' item art for the Escavação (src/data/digTreasures.ts) and the
// Underground's Old Amber: the official item sprites (PokeAPI's
// `sprites/items`), trimmed to the art and padded to a square, into
// `public/assets/items/<id>.png`. `npm run fossils`, then `npm run dig-shapes`.
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPng, writePng } from './png.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ITEMS = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items'

/** The game's id for each fossil, and PokeAPI's. */
const FOSSILS = {
  oldAmber: 'old-amber',
  helixFossil: 'helix-fossil',
  domeFossil: 'dome-fossil',
  rootFossil: 'root-fossil',
  clawFossil: 'claw-fossil',
  skullFossil: 'skull-fossil',
  armorFossil: 'armor-fossil',
  plumeFossil: 'plume-fossil',
  jawFossil: 'jaw-fossil',
  sailFossil: 'sail-fossil',
  fossilizedBird: 'fossilized-bird',
  fossilizedFish: 'fossilized-fish',
  fossilizedDrake: 'fossilized-drake',
  fossilizedDino: 'fossilized-dino',
}

/** The art's opaque box, padded to a square around its center. */
const trimmed = ({ width, height, rgba }) => {
  let [x0, y0, x1, y1] = [width, height, -1, -1]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  if (x1 < 0) throw new Error('empty art')
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const size = Math.max(w, h)
  const ox = Math.floor((size - w) / 2)
  const oy = Math.floor((size - h) / 2)
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < h; y++) out.set(rgba.subarray(((y0 + y) * width + x0) * 4, ((y0 + y) * width + x0 + w) * 4), ((oy + y) * size + ox) * 4)
  return { size, out }
}

const tmp = join(tmpdir(), 'ps-fossils')
await mkdir(tmp, { recursive: true })
for (const [id, name] of Object.entries(FOSSILS)) {
  const res = await fetch(`${ITEMS}/${name}.png`)
  if (!res.ok) throw new Error(`${name}: ${res.status}`)
  const file = join(tmp, `${name}.png`)
  await writeFile(file, Buffer.from(await res.arrayBuffer()))
  const { size, out } = trimmed(await readPng(file))
  await writeFile(join(ROOT, 'public/assets/items', `${id}.png`), writePng(size, size, out))
  console.log(`${id}: ${size}×${size}`)
}
