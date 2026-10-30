// Fits the wearables (src/render/wearables.ts) to every Pokémon a player can
// be: `npm run anchors`. SpriteCollab ships an `<Anim>-Offsets.png` beside every
// sheet, with the same frame grid and one marker pixel per frame: black where
// the move comes out of (the mouth: the chin facing south, the snout's tip
// facing east, the back of the head facing north), green the body's center,
// red and blue the hands. This downloads them for the players' species and
// their forms (`PLAYERS` and `FORMS`, cached in node_modules/.cache, never
// committed), keeps each frame's mouth and center, and measures each
// direction's head, eyes, neck and back once from the sprite's own pixels
// around them (the first Walk frame), relative to those markers, as the points
// each kind of wearable turns around (`render/wearModels.ts`): the top of the
// head's axis (hats), the head's center at the eyes' height (face), the neck's
// axis (neck) and the body's at the shoulders (back). What the measures get
// wrong for a species (a leaf, a crest, a bulb on top of the head) is fixed by
// hand in src/data/wearFits.ts (the dev console's `ps.wear('fit')` prints it).
// A variant without offsets (or with offsets that don't fit its sheets) is
// left out, and listed at the end: it draws bare.
//
// Output: src/data/wearAnchors/anchors-<chunk>.json, a file per 32 dex numbers
// (`anchorChunk`), so a client loads only the chunks of the species it draws.
// By variant (`<dex>`, `<dex>:<form>`, and either with an `s` for a shiny
// whose frames differ), each a few base64 byte strings:
//   dirs: 8 directions × GEOMETRY bytes (signed values + 128)
//   Walk, Idle, Hurt: frame width, height and count, then for each direction
//     and frame the mouth's x, y and the center's x, y.
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FORMS, PLAYERS, pad } from './dex.mjs'
import { readPng } from './png.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const SPRITES = join(ROOT, 'public/assets/pokemon')
const CACHE = join(ROOT, 'node_modules/.cache/ps-offsets')
const OUT = join(ROOT, 'src/data/wearAnchors')
const REMOTE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite'
const ANIMS = ['Walk', 'Idle', 'Hurt']
/** The bytes of one direction's measures, in this order (`render/wearFit.ts` reads them): head, face and neck from the mouth, back and feet from the center. */
const GEOMETRY = ['headX', 'headY', 'headW', 'faceX', 'faceY', 'neckX', 'neckY', 'neckW', 'backX', 'backY', 'bodyW', 'feetY']
/** How far down the camera looks at the sprites (degrees): `PITCH` in src/render/wearArt.ts, which renders the wearables from the same angle. */
const PITCH = 22
const SIN_PITCH = Math.sin((PITCH * Math.PI) / 180)
/** The file a species' anchors go in: `anchorChunk` in src/render/wearFit.ts, which loads them. */
const anchorChunk = (dex) => Math.floor(dex / 32)

const manifest = JSON.parse(await readFile(join(ROOT, 'src/data/sprites.generated.json'), 'utf8'))
const exists = (p) => access(p).then(() => true, () => false)

const download = async (url, dest) => {
  if (await exists(dest)) return true
  const res = await fetch(url)
  if (!res.ok) return false
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  return true
}

const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]

/**
 * A variant's Walk, Idle and Hurt offsets into the cache (an anim that's a copy of another reads that one's; an anim
 * the variant has no sheet for, `has`, reads Walk's, as `placeFrame` draws it). False where SpriteCollab has none.
 */
const fetchOffsets = async (path, has, dir) => {
  await mkdir(dir, { recursive: true })
  if (!(await download(`${REMOTE}/${path}/AnimData.xml`, join(dir, 'AnimData.xml')))) return false
  const xml = await readFile(join(dir, 'AnimData.xml'), 'utf8')
  const copies = Object.fromEntries([...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map(([, body]) => [tag(body, 'Name'), tag(body, 'CopyOf')]))
  const resolve = (name) => (copies[name] ? resolve(copies[name]) : name)
  for (const anim of ANIMS) {
    const sheet = resolve(has(anim) ? anim : 'Walk')
    if (!(await download(`${REMOTE}/${path}/${sheet}-Offsets.png`, join(dir, `${anim}.png`)))) throw new Error(`no ${anim} offsets`)
  }
  return true
}

/** Each frame's mouth (black) and center (green) markers, direction by direction. */
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
      line.push([...mouth, ...center])
    }
    rows.push(line)
  }
  return rows
}

/** Which way a row faces: +1 right, -1 left, 0 straight down or up. Rows 3 to 5 face away. */
const FACE = [0, 1, 1, 1, 0, -1, -1, -1]
const away = (row) => row >= 3 && row <= 5
/** The front-facing row whose head a facing-away row shares (its height): north takes south's, and so on. */
const FRONT_OF = { 3: 1, 4: 0, 5: 7 }

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * One direction's measures from the first frame of the Walk sheet (`png`), around its markers. The head:
 * from the mouth up, the rows the head's outline spans, until they narrow to under half the widest
 * (a leaf, a crest or an ear tip above the dome) or end; the crown is the last of them. The eyes: the
 * row with the most interior dark or white pixels in the head's lower two thirds (eyes are outlined
 * and lit in PMD art). The neck just under the chin (facing away: as far below the crown as the
 * front's head is tall), the back a row below it, inset from the body's back edge.
 */
const measure = (png, fw, fh, row, [mx, my, gx, gy], front) => {
  const at = (x, y) => (row * fh + y) * png.width + x
  const solid = (x, y) => x >= 0 && y >= 0 && x < fw && y < fh && png.rgba[at(x, y) * 4 + 3] > 0
  const lum = (x, y) => {
    const i = at(x, y) * 4
    return 0.3 * png.rgba[i] + 0.59 * png.rgba[i + 1] + 0.11 * png.rgba[i + 2]
  }
  const span = (x, y) => {
    if (!solid(x, y)) return null
    let l = x
    let r = x
    while (solid(l - 1, y)) l--
    while (solid(r + 1, y)) r++
    return [l, r]
  }
  const s = FACE[row]
  const y0 = away(row) ? my : my - 1
  // Facing sideways the mouth is the snout's tip: the head's axis is halfway back to its far edge.
  let ax = mx
  if (s !== 0) {
    const sp = span(mx - s, Math.max(0, my - 2)) ?? span(mx, my)
    if (sp) ax = Math.round((mx + (s > 0 ? Math.max(sp[0], mx - 9) : Math.min(sp[1], mx + 9))) / 2)
  }
  let widest = 0
  let dome = [ax, ax]
  let crown = y0
  const spans = []
  for (let y = y0; y >= 0; y--) {
    const sp = span(ax, y) ?? span(ax - 1, y) ?? span(ax + 1, y)
    if (!sp) break
    const w = sp[1] - sp[0] + 1
    if (widest >= 5 && w * 2 < widest) break
    if (w >= widest) [widest, dome] = [w, sp]
    spans.push([y, sp])
    crown = y
    ax = clamp(ax, sp[0] + 1, sp[1] - 1)
  }
  // The head's width where a hat sits: the widest of the dome's top 60% (lower down, cheeks, arms or
  // wings can join the head's rows), never more than half again the head's height.
  const tall = y0 - crown + 1
  let headW = 0
  for (const [y, sp] of spans) if (y - crown <= tall * 0.6) headW = Math.max(headW, sp[1] - sp[0] + 1)
  headW = clamp(Math.min(headW, Math.round(tall * 1.5)), 7, 24)
  // Eyes (only drawn on facing the camera or sideways).
  let eye = null
  if (!away(row)) {
    const count = new Map()
    // The lower two thirds of the head: a leaf, a bulb or a crest's own markings sit above the eyes.
    for (let y = Math.max(crown + 1, Math.round(crown + (y0 - crown) * 0.35)); y < my; y++) {
      for (let x = dome[0]; x <= dome[1]; x++) {
        if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) continue
        const l = lum(x, y)
        if (l >= 70 && l <= 225) continue
        const e = count.get(y) ?? { n: 0, front: x }
        e.n++
        e.front = s > 0 ? Math.max(e.front, x) : Math.min(e.front, x)
        count.set(y, e)
      }
    }
    for (const [y, e] of count) if (!eye || e.n > eye.n) eye = { y, ...e }
  }
  const eyeY = eye ? eye.y : crown + Math.round((y0 - crown) * 0.55)
  // How much of the row's turn shows its side (sin) and its front or back (cos) to the camera.
  const side = [0, 0.71, 1, 0.71, 0, 0.71, 1, 0.71][row]
  const facing = [1, 0.71, 0, 0.71, 1, 0.71, 0, 0.71][row]
  // The face's pivot is the head's center at the eyes' height: the eyes sit on its front, which faces
  // the camera as much as the row does, and the camera looks down (`PITCH`), so the center is that much higher.
  const headR = headW / 2
  const faceY = away(row) ? crown + Math.round(headR) : eyeY - Math.round(headR * SIN_PITCH * facing)
  const headH = away(row) && front ? front.mouthY - front.crownY : my - crown
  // The neck: its front just under the chin (facing away, its back, as far below the crown as the front's head
  // is tall); the pivot is the neck's axis behind that surface.
  const throatX = away(row) ? ax : mx - s * Math.round(headW * 0.3)
  const throatY = away(row) ? crown + headH + 1 : my + 1
  const throat = span(throatX, throatY)
  const neckW = clamp(throat ? throat[1] - throat[0] + 1 : headW, Math.round(headW * 0.45), Math.round(headW * 0.7))
  const neckR = neckW / 2
  const neckX = away(row) ? throatX : throatX - s * Math.round(neckR * side)
  const neckY = throatY - Math.round(neckR * SIN_PITCH * facing)
  // The back: the body's axis (the center marker's column) a row below the neck; the body's width there.
  const backX = gx
  const backY = neckY + 1
  const body = span(gx, Math.max(throatY + 1, 0)) ?? span(gx, gy)
  const bodyW = body ? body[1] - body[0] + 1 : headW
  let feet = fh - 1
  while (feet > 0 && ![...Array(fw).keys()].some((x) => solid(x, feet))) feet--
  return {
    mouthY: my,
    crownY: crown,
    bytes: [ax - mx, crown - my, headW, ax - mx, faceY - my, neckX - mx, neckY - my, neckW, backX - gx, backY - gy, bodyW, feet - gy],
  }
}

const signed = (values) =>
  values.map((v) => {
    if (!Number.isInteger(v) || v < -128 || v > 127) throw new Error(`measure out of range: ${v}`)
    return v + 128
  })

const b64 = (bytes) => Buffer.from(Uint8Array.from(bytes)).toString('base64')

/** Every variant a player can be: each species and each of its forms (`FORMS`), by its key and its SpriteCollab folder. */
const VARIANTS = PLAYERS.flatMap((dex) => [
  { key: String(dex), dex, form: null, path: pad(dex) },
  ...Object.entries(FORMS[dex] ?? {}).map(([form, id]) => ({ key: `${dex}:${form}`, dex, form, path: `${pad(dex)}/${id}` })),
])

/** A variant's sheets in the manifest (`shiny`: its shiny colors'), if the game has them. */
const sheetsOf = ({ dex, form }, shiny) => {
  const entry = form ? manifest[dex].forms?.[form] : manifest[dex]
  return shiny ? entry?.shiny : entry
}

/** A variant's anchors, normal or shiny: its sheets' markers and its directions' measures; null where SpriteCollab has no offsets for it. */
const fit = async ({ key, dex, form, path }, shiny) => {
  const variant = sheetsOf({ dex, form }, shiny)
  const dir = join(CACHE, `${key.replace(':', '-')}${shiny ? 's' : ''}`)
  // A shiny lives under `0000/0001` (a form's under its own `<id>/0001`).
  const remote = shiny ? `${path}/${form ? '' : '0000/'}0001` : path
  if (!(await fetchOffsets(remote, (anim) => anim in variant.anims, dir))) return null
  const anims = {}
  for (const anim of ANIMS) {
    const meta = variant.anims[anim] ?? variant.anims.Walk
    const png = await readPng(join(dir, `${anim}.png`))
    const frames = meta.durations.length
    if (png.width !== meta.frameWidth * frames || png.height !== meta.frameHeight * 8) throw new Error(`${anim}: offsets don't match the sheet`)
    anims[anim] = { fw: meta.frameWidth, fh: meta.frameHeight, frames, marks: markers(png, meta.frameWidth, meta.frameHeight, frames) }
  }
  const walk = anims.Walk
  const sheet = await readPng(join(SPRITES, String(dex), form ?? '', shiny ? 'shiny' : '', 'Walk.png'))
  const measured = []
  for (const row of [0, 1, 2, 6, 7, 3, 4, 5]) measured[row] = measure(sheet, walk.fw, walk.fh, row, walk.marks[row][0], measured[FRONT_OF[row]])
  return {
    dirs: b64(measured.flatMap((m) => signed(m.bytes))),
    ...Object.fromEntries(ANIMS.map((anim) => [anim, b64([anims[anim].fw, anims[anim].fh, anims[anim].frames, ...anims[anim].marks.flat(2)])])),
  }
}

/**
 * Variants left out (no offsets, or offsets that don't fit the sheets), with why: they draw bare. A shiny left out
 * (a hand-made one, `HANDMADE_SHINIES`) wears its normal colors' anchors: its sheets are theirs, recolored.
 */
const left = []
const tryFit = (v, shiny) =>
  fit(v, shiny).then(
    (a) => (a ? a : (left.push(`${v.key}${shiny ? ' (shiny)' : ''}: no offsets on SpriteCollab`), null)),
    (error) => (left.push(`${v.key}${shiny ? ' (shiny)' : ''}: ${error.message}`), null),
  )

/** A variant's entries: the normal one, and the shiny only where its frames differ (Dewott's are laid out anew, a few move a marker). */
const entriesOf = async (v) => {
  const normal = await tryFit(v, false)
  if (!normal) return []
  const shiny = sheetsOf(v, true) ? await tryFit(v, true) : null
  const differs = shiny && ANIMS.some((anim) => shiny[anim] !== normal[anim])
  console.log(`${v.key}: ${ANIMS.map((a) => `${a} ${normal[a].length}`).join(', ')}${differs ? ' +shiny' : ''}`)
  return differs ? [[v.key, normal], [`${v.key}s`, shiny]] : [[v.key, normal]]
}

// A few variants at a time (each is a handful of small downloads), written in `VARIANTS`' order.
const found = []
for (let i = 0; i < VARIANTS.length; i += 8) found.push(...(await Promise.all(VARIANTS.slice(i, i + 8).map(entriesOf))).flat())

// One file per chunk of the dex (`anchorChunk`): a client loads only the chunks of the species it draws.
const chunks = new Map()
for (const [key, entry] of found) {
  const n = anchorChunk(parseInt(key, 10))
  if (!chunks.has(n)) chunks.set(n, {})
  chunks.get(n)[key] = entry
}
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
let total = 0
for (const [n, species] of [...chunks].sort(([a], [b]) => a - b)) {
  const json = JSON.stringify({ pitch: PITCH, geometry: GEOMETRY, species }) + '\n'
  total += json.length
  await writeFile(join(OUT, `anchors-${n}.json`), json)
  console.log(`chunk ${n}: ${Object.keys(species).length} variants, ${(json.length / 1024).toFixed(1)} KB`)
}
console.log(`Wrote ${OUT} (${found.length} variants in ${chunks.size} chunks, ${(total / 1024).toFixed(1)} KB)`)
if (left.length > 0) console.log(`Left out (drawn bare):\n  ${left.join('\n  ')}`)
