// The Escavação's treasure shapes: each treasure's art laid over the mine's
// grid at its scale, a cell of the shape wherever the art covers enough of it.
// `npm run dig-shapes` (after adding a treasure to `src/data/digTreasures.ts`
// or changing its art). The drawing and the rules read the same mask, so a
// partly dug shape is the real icon's silhouette.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { readPng } from './png.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/data/digShapes.generated.json')
const CELL = 15
/** How much of a cell (0..1) the art must cover for it to count. */
const COVER = 0.3

const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const { DIG_TREASURES } = await vite.ssrLoadModule('/src/data/digTreasures.ts')
await vite.close()

const shapes = {}
for (const [id, def] of Object.entries(DIG_TREASURES)) {
  const { width: w0, height: h0, rgba } = await readPng(join(ROOT, 'public/assets', `${def.art}.png`))
  const k = def.scale
  const w = w0 * k
  const h = h0 * k
  const cols = Math.ceil(w / CELL)
  const rows = Math.ceil(h / CELL)
  const ox = Math.floor((cols * CELL - w) / 2)
  const oy = Math.floor((rows * CELL - h) / 2)
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rgba[(Math.floor(y / k) * w0 + Math.floor(x / k)) * 4 + 3] > 40
  const cells = []
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < cols; c++) {
      let hit = 0
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (on(c * CELL + x - ox, r * CELL + y - oy)) hit++
      line += hit / CELL ** 2 >= COVER ? '#' : '.'
    }
    cells.push(line)
  }
  if (!cells.some((l) => l.includes('#'))) throw new Error(`${id}: empty shape`)
  shapes[id] = { cols, rows, w, h, ox, oy, cells }
}
await writeFile(OUT, `${JSON.stringify(shapes, null, 0)}\n`)
console.log(`${Object.keys(shapes).length} shapes in ${OUT}`)
