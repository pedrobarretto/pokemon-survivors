// The wearables' head rig: `npm run rig`. Measures every frame of Walk, Idle and
// Hurt of every variant a player can be, in all eight rows, from the frame's
// own pixels and its SpriteCollab markers (scripts/wearSheets.mjs downloads
// them): the hat's seat on the skull, the eyes, the head's span at them, the
// neck and the back (`measure` and `settle` in src/render/wearRig.ts, which
// the game's worker and the fit check share). What the measures get wrong for
// a species is fixed by hand in src/data/wearFits.ts (the dev console's
// `ps.rig()` shows a frame's rig and prints the fix). A variant without
// offsets (or with offsets that don't fit its sheets) is left out, and listed
// at the end: it draws bare.
//
// Output: src/data/wearRig/rig-<chunk>.json, a file per 32 dex numbers
// (`rigChunk`), so a client loads only the chunks of the species it draws. By
// variant (`<dex>`, `<dex>:<form>`, and either with an `s` for a shiny whose
// frames differ), a base64 byte string per anim (`packRig`).
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { runnerImport } from 'vite'
import { ANIMS, ROOT, VARIANTS, fetchOffsets, loadAnim, sheetsOf } from './wearSheets.mjs'

const OUT = join(ROOT, 'src/data/wearRig')
const { module: Rig } = await runnerImport('/src/render/wearRig.ts', { configFile: false, root: ROOT, logLevel: 'error' })
const { rigChunk } = (await runnerImport('/src/render/wearFit.ts', { configFile: false, root: ROOT, logLevel: 'error' })).module

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

/** A variant's rig, normal or shiny, by anim (base64), and its markers (to tell a shiny whose frames differ); null without offsets. */
const fit = async (v, shiny) => {
  if (!(await fetchOffsets(v, shiny))) return null
  const out = {}
  const marks = {}
  let walk = null
  let palette = null
  for (const anim of ANIMS) {
    const s = await loadAnim(v, shiny, anim)
    // The face's colors facing the camera hold from every side (`settle`).
    palette ??= Rig.measure(Rig.frameOf(s.png.rgba, s.png.width, 0, 0, s.fw, s.fh), 0, s.marks[0][0]).palette
    const rows = []
    for (let row = 0; row < 8; row++) {
      const frames = Array.from({ length: s.frames }, (_, col) => ({ f: Rig.frameOf(s.png.rgba, s.png.width, col, row, s.fw, s.fh), marks: s.marks[row][col] }))
      const settled = Rig.settle(row, frames, walk?.[row], palette)
      if (anim === 'Walk') (walk ??= [])[row] = settled.template
      rows.push(settled.rigs)
    }
    out[anim] = b64(Rig.packRig(s.fw, s.fh, rows))
    marks[anim] = JSON.stringify(s.marks)
  }
  return { out, marks }
}

const left = []
const tryFit = (v, shiny) =>
  fit(v, shiny).then(
    (a) => a ?? (left.push(`${v.key}${shiny ? ' (shiny)' : ''}: no offsets on SpriteCollab`), null),
    (error) => (left.push(`${v.key}${shiny ? ' (shiny)' : ''}: ${error.message}`), null),
  )

/** A variant's entries: the normal one, and the shiny only where its frames differ (Dewott's are laid out anew, a few move a marker). */
const entriesOf = async (v) => {
  const normal = await tryFit(v, false)
  if (!normal) return []
  const shiny = sheetsOf(v, true) ? await tryFit(v, true) : null
  const differs = shiny && ANIMS.some((anim) => shiny.marks[anim] !== normal.marks[anim])
  process.stdout.write(`\r${v.key.padEnd(12)}`)
  return differs ? [[v.key, normal.out], [`${v.key}s`, shiny.out]] : [[v.key, normal.out]]
}

const found = []
for (let i = 0; i < VARIANTS.length; i += 8) found.push(...(await Promise.all(VARIANTS.slice(i, i + 8).map(entriesOf))).flat())

const chunks = new Map()
for (const [key, entry] of found) {
  const n = rigChunk(parseInt(key, 10))
  if (!chunks.has(n)) chunks.set(n, {})
  chunks.get(n)[key] = entry
}
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
let total = 0
let zipped = 0
for (const [n, species] of [...chunks].sort(([a], [b]) => a - b)) {
  const json = JSON.stringify({ fields: Rig.RIG_FIELDS, species }) + '\n'
  total += json.length
  zipped += gzipSync(json).length
  await writeFile(join(OUT, `rig-${n}.json`), json)
}
console.log(`\nWrote ${OUT} (${found.length} variants in ${chunks.size} chunks, ${(total / 1024).toFixed(1)} KB, ${(zipped / 1024).toFixed(1)} KB gzipped)`)
if (left.length > 0) console.log(`Left out (drawn bare):\n  ${left.join('\n  ')}`)
