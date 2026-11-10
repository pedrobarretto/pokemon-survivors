// The Zona Safári's silhouettes: one bit per pixel of each family's first form,
// standing still and facing the player, cropped to its body. The API sends this
// instead of who's in a bush, so a client knows no more than the shape it
// shows. `npm run safari-shapes` (after adding a family to `src/data/safari.ts`).
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { readPng } from './png.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = JSON.parse(await readFile(join(ROOT, 'src/data/sprites.generated.json'), 'utf8'))
const OUT = join(ROOT, 'src/data/safariShapes.generated.json')

/** Every Safari family's first form, read from the game's own data. */
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const { SAFARI_FAMILIES, safariForm } = await vite.ssrLoadModule('/src/data/safari.ts')
const families = Object.fromEntries(SAFARI_FAMILIES.map((family) => [family, safariForm(family).dex]))
await vite.close()

/** The row of the sheet that faces the player (PMD sheets start facing south). */
const SOUTH_ROW = 0

const shapes = {}
for (const [family, dex] of Object.entries(families)) {
  const { width, rgba } = await readPng(join(ROOT, 'public/assets/pokemon', String(dex), 'Idle.png'))
  const { frameWidth: fw, frameHeight: fh } = MANIFEST[String(dex)].anims.Idle
  const on = (x, y) => rgba[(SOUTH_ROW * fh + y) * width * 4 + x * 4 + 3] > 40
  let [left, right, top, bottom] = [fw, -1, fh, -1]
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++)
      if (on(x, y)) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
  const w = right - left + 1
  const h = bottom - top + 1
  const bytes = Buffer.alloc(Math.ceil((w * h) / 8))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (on(left + x, top + y)) bytes[i >> 3] |= 1 << (i & 7)
    }
  shapes[family] = { w, h, bits: bytes.toString('base64') }
  if (w <= 0) throw new Error(`${family}: empty silhouette`)
}
await writeFile(OUT, `${JSON.stringify(shapes, null, 0)}\n`)
console.log(`${Object.keys(shapes).length} silhouettes in ${OUT}`)
