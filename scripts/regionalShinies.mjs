// Shinies SpriteCollab doesn't have yet for two regional forms a player can be
// (`HANDMADE_SPECIES_SHINIES` in scripts/dex.mjs): `node scripts/regionalShinies.mjs`
// writes palette swaps of each one's own sheets (Walk, Idle, Hurt and the portrait)
// to `public/assets/pokemon/<dex>/shiny/`, then `node scripts/fetch-assets.mjs <dex>`
// lists them in the manifest. Each swap follows the official shiny of the form's
// evolution, whose sheets SpriteCollab has: Perrserker's gray fur turns gold, Galarian
// Darmanitan's blues turn green and its teal ice blue. Drop an entry once
// SpriteCollab publishes the real one.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readPng, writePng } from './png.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'public/assets/pokemon')

/** Normal color → shiny color, exact matches; every other color stays. */
const SWAPS = {
  // Galarian Meowth: the tan-gray coat goes gold, as Perrserker's does; its iron hair and coin stay.
  10161: { '#c7af9f': '#e8c890', '#9f8f87': '#c89a60', '#775f4f': '#9a6a38' },
  // Galarian Darumaka: the blue rims go green and the teal icicles blue, as Galarian Darmanitan's do.
  10176: { '#3c63ae': '#34a84b', '#7daee9': '#98f078', '#4da5a2': '#2f7fc0', '#5ebcb9': '#4a96d8', '#9ad6d6': '#9ccaf0', '#719ea4': '#4a78a8' },
}

const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

const swap = async (from, to, map) => {
  const { width, height, rgba } = await readPng(from)
  const out = new Uint8Array(rgba)
  for (let i = 0; i < out.length; i += 4) {
    const to = map[hex(out[i], out[i + 1], out[i + 2])]
    if (!to || out[i + 3] === 0) continue
    out[i] = parseInt(to.slice(1, 3), 16)
    out[i + 1] = parseInt(to.slice(3, 5), 16)
    out[i + 2] = parseInt(to.slice(5, 7), 16)
  }
  await writeFile(to, writePng(width, height, out))
}

for (const [dex, map] of Object.entries(SWAPS)) {
  const dir = join(OUT, dex)
  await mkdir(join(dir, 'shiny'), { recursive: true })
  for (const name of ['Walk', 'Idle', 'Hurt', 'portrait']) await swap(join(dir, `${name}.png`), join(dir, 'shiny', `${name}.png`), map)
  console.log(`#${dex}: shiny palette swap`)
}
