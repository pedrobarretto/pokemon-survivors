// The players' sheets and their SpriteCollab markers, for the scripts that fit the
// wearables: `npm run rig` (scripts/rig.mjs) measures them, `npm run fit-check`
// (scripts/fit-check.mjs) judges what's drawn on them. SpriteCollab ships an
// `<Anim>-Offsets.png` beside every sheet, with the same frame grid and one
// marker pixel per frame: black where the move comes out of (the mouth: the
// chin facing south, the snout's tip facing east, the back of the head facing
// north), green the body's center, red and blue the hands. They're downloaded
// for the players' species and their forms (`PLAYERS` and `FORMS`) into
// node_modules/.cache/ps-offsets, never committed.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FORMS, PLAYERS, pad } from './dex.mjs'
import { readPng } from './png.mjs'

export const ROOT = new URL('..', import.meta.url).pathname
const SPRITES = join(ROOT, 'public/assets/pokemon')
const CACHE = join(ROOT, 'node_modules/.cache/ps-offsets')
const REMOTE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite'
/** The anims a wearable is drawn on (the rest draw bare). */
export const ANIMS = ['Walk', 'Idle', 'Hurt']

export const manifest = JSON.parse(await readFile(join(ROOT, 'src/data/sprites.generated.json'), 'utf8'))
const exists = (p) => access(p).then(() => true, () => false)

const download = async (url, dest) => {
  if (await exists(dest)) return true
  // A hand-made sheet (`HANDMADE_SHINIES`) has none to fetch: don't wait on GitHub for it.
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!res?.ok) return false
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  return true
}

const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]

/** Every variant a player can be: each species and each of its forms (`FORMS`), by its key and its SpriteCollab folder. */
export const VARIANTS = PLAYERS.flatMap((dex) => [
  { key: String(dex), dex, form: null, path: pad(dex) },
  ...Object.entries(FORMS[dex] ?? {}).map(([form, id]) => ({ key: `${dex}:${form}`, dex, form, path: `${pad(dex)}/${id}` })),
])

/** A variant's sheets in the manifest (`shiny`: its shiny colors'), if the game has them. */
export const sheetsOf = ({ dex, form }, shiny) => {
  const entry = form ? manifest[dex].forms?.[form] : manifest[dex]
  return shiny ? entry?.shiny : entry
}

const cacheDir = ({ key }, shiny) => join(CACHE, `${key.replace(':', '-')}${shiny ? 's' : ''}`)

/**
 * A variant's Walk, Idle and Hurt offsets into the cache (an anim that's a copy of another reads that one's; an anim
 * the variant has no sheet for reads Walk's, as `placeFrame` draws it). False where SpriteCollab has none.
 */
export const fetchOffsets = async (v, shiny) => {
  const variant = sheetsOf(v, shiny)
  const dir = cacheDir(v, shiny)
  // A shiny lives under `0000/0001` (a form's under its own `<id>/0001`).
  const path = shiny ? `${v.path}/${v.form ? '' : '0000/'}0001` : v.path
  await mkdir(dir, { recursive: true })
  if (!(await download(`${REMOTE}/${path}/AnimData.xml`, join(dir, 'AnimData.xml')))) return false
  const xml = await readFile(join(dir, 'AnimData.xml'), 'utf8')
  const copies = Object.fromEntries([...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map(([, body]) => [tag(body, 'Name'), tag(body, 'CopyOf')]))
  const resolve = (name) => (copies[name] ? resolve(copies[name]) : name)
  for (const anim of ANIMS) {
    const sheet = resolve(anim in variant.anims ? anim : 'Walk')
    if (!(await download(`${REMOTE}/${path}/${sheet}-Offsets.png`, join(dir, `${anim}.png`)))) throw new Error(`no ${anim} offsets`)
  }
  return true
}

/** Each frame's mouth (black) and center (green) markers, row by row: `{ mx, my, gx, gy }`. */
const markers = (png, fw, fh, frames) => {
  const rows = []
  for (let row = 0; row < 8; row++) {
    const line = []
    for (let col = 0; col < frames; col++) {
      let mouth = null
      let center = null
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const i = ((row * fh + y) * png.width + col * fw + x) * 4
          if (png.rgba[i + 3] === 0) continue
          const [r, g, b] = png.rgba.subarray(i, i + 3)
          if (r === 0 && g === 0 && b === 0) mouth = [x, y]
          else if (r === 0 && g === 255 && b === 0) center = [x, y]
        }
      }
      if (!mouth || !center) throw new Error(`missing marker at row ${row}, frame ${col}`)
      line.push({ mx: mouth[0], my: mouth[1], gx: center[0], gy: center[1] })
    }
    rows.push(line)
  }
  return rows
}

/**
 * One anim of a variant (normal or shiny): its sheet's pixels, frame size and count, and its markers. Needs its
 * offsets in the cache (`fetchOffsets`); throws when they don't fit the sheet.
 */
export const loadAnim = async (v, shiny, anim) => {
  const variant = sheetsOf(v, shiny)
  const meta = variant.anims[anim] ?? variant.anims.Walk
  const file = variant.anims[anim] ? anim : 'Walk'
  const png = await readPng(join(SPRITES, String(v.dex), v.form ?? '', shiny ? 'shiny' : '', `${file}.png`))
  const off = await readPng(join(cacheDir(v, shiny), `${anim}.png`))
  const fw = meta.frameWidth
  const fh = meta.frameHeight
  const frames = meta.durations.length
  if (off.width !== fw * frames || off.height !== fh * 8) throw new Error(`${anim}: offsets don't match the sheet`)
  if (png.width !== fw * frames || png.height !== fh * 8) throw new Error(`${anim}: sheet doesn't match the manifest`)
  return { png, fw, fh, frames, marks: markers(off, fw, fh, frames) }
}
