// The wearables' fit check: `npm run fit-check`. Draws every worn item on every
// variant a player can be, in the five art directions, on the first frame of
// Walk and Idle (`--frames all`: every frame of Walk, Idle and Hurt), and judges
// each from masks (`src/render/wearCheck.ts`: an eye covered, a hat floating or
// sunk, glasses off the eyes or off the head, a scarf off the neck, a cape hung
// at head height, an item mostly cut away). The frame's own measures
// (`src/render/wearRig.ts`) are the truth; the renderer is the game's
// (`src/render/wearDress.ts` through `wearCheckAdapter.ts`), run here in Node.
//
// Writes .fit-check/<renderer>/: report.json (every failure, and counts by
// rule, item, variant and direction), summary.txt, and contact sheets of the
// failures only (fails-<n>.png, at 3×). Options: --only 25,6:megaX (variants),
// --items crown,cape, --frames all, --renderer <name> (an adapter module in
// src/render: wearCheckAdapter.ts by default), --sheets <max cells> (default 600),
// --jobs <n> (processes, by default most of the machine's cores: each takes a
// share of the variants, `--shard k/n`, and the first process merges them).
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { runnerImport } from 'vite'
import { writePng } from './png.mjs'
import { ANIMS, ROOT, VARIANTS, fetchOffsets, loadAnim } from './wearSheets.mjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const renderer = opt('renderer', 'wearCheckAdapter')
const only = opt('only', null)?.split(',')
const allFrames = opt('frames', 'first') === 'all'
const maxCells = Number(opt('sheets', '600'))
const shard = opt('shard', null)?.split('/').map(Number) ?? null
const jobs = shard ? 1 : Math.max(1, Number(opt('jobs', String(Math.max(1, Math.min(10, cpus().length - 2))))))

const load = async (path) => (await runnerImport(path, { configFile: false, root: ROOT, logLevel: 'error' })).module
const Rig = await load('/src/render/wearRig.ts')
const Check = await load('/src/render/wearCheck.ts')
const { adapter } = await load(`/src/render/${renderer}.ts`)
const { WEARABLE_IDS, WEARABLES } = await load('/src/data/wearables.ts')
const items = opt('items', null)?.split(',') ?? WEARABLE_IDS
const readChunk = (n) => {
  try {
    return JSON.parse(readFileSync(join(ROOT, `src/data/wearRig/rig-${n}.json`), 'utf8'))
  } catch {
    return null
  }
}
adapter.init?.(readChunk)
const OUT = join(ROOT, '.fit-check', adapter.name)

const DIRS = ['S', 'SE', 'E', 'NE', 'N']
const variants = VARIANTS.filter((v, i) => (!only || only.includes(v.key)) && (!shard || i % shard[1] === shard[0]))
const started = Date.now()

/** The report and summary from every failure found (a shard's or the whole run's). */
const writeReport = async ({ checks, failed, excluded, failures, noEyes, skipped }) => {
  const tally = (key) => {
    const m = new Map()
    for (const f of failures) for (const k of key(f)) m.set(k, (m.get(k) ?? 0) + 1)
    return Object.fromEntries([...m].sort((a, b) => b[1] - a[1]))
  }
  const report = {
    renderer: adapter.name,
    frames: allFrames ? 'all' : 'first',
    checks,
    failed,
    excluded,
    byRule: tally((f) => f.fails.map((x) => x.rule)),
    byItem: tally((f) => [f.item]),
    byDir: tally((f) => [f.dir]),
    byVariant: tally((f) => [f.variant]),
    noEyes,
    skipped,
    failures,
  }
  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  const lines = [
    `fit check (${adapter.name}, ${allFrames ? 'every frame' : 'first frames'}): ${checks} checks, ${failed} failing (${((failed / Math.max(1, checks)) * 100).toFixed(1)}%), ${excluded} left off by WEAR_FITS`,
    `by rule: ${Object.entries(report.byRule).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `by direction: ${Object.entries(report.byDir).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `by item: ${Object.entries(report.byItem).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    // Sorted again: a dex is an integer key, which an object keeps in numeric order.
    `worst variants: ${Object.entries(report.byVariant).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `no eyes found (first frame, S/SE/E): ${noEyes.length}${noEyes.length ? ` — ${noEyes.slice(0, 60).join(', ')}` : ''}`,
    `skipped: ${skipped.length ? skipped.join(', ') : 'none'}`,
    `${((Date.now() - started) / 1000).toFixed(0)} s; sheets in ${OUT}`,
  ]
  await writeFile(join(OUT, 'summary.txt'), lines.join('\n') + '\n')
  console.log(`\n${lines.join('\n')}`)
}

// Many processes: each checks its share, this one merges what they found.
if (jobs > 1) {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const rest = args.filter((a, i) => a !== '--jobs' && args[i - 1] !== '--jobs')
  await Promise.all(
    Array.from({ length: jobs }, (_, k) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [new URL(import.meta.url).pathname, ...rest, '--shard', `${k}/${jobs}`], { stdio: ['ignore', 'ignore', 'inherit'] })
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`shard ${k} exited ${code}`))))
      }),
    ),
  )
  const parts = await Promise.all(Array.from({ length: jobs }, async (_, k) => JSON.parse(await readFile(join(OUT, `part-${k}.json`), 'utf8'))))
  const sum = (key) => parts.reduce((a, p) => a + p[key], 0)
  const all = (key) => parts.flatMap((p) => p[key])
  await writeReport({ checks: sum('checks'), failed: sum('failed'), excluded: sum('excluded'), failures: all('failures'), noEyes: all('noEyes'), skipped: all('skipped') })
  for (let k = 0; k < jobs; k++) await rm(join(OUT, `part-${k}.json`))
  process.exit(0)
}

const failures = []
const noEyes = []
const skipped = []
const cells = []
let checks = 0
let failed = 0
let excluded = 0

for (const v of variants) {
  if (!(await fetchOffsets(v, false).catch(() => false)) || !(await adapter.wearer(v.key))) {
    skipped.push(v.key)
    continue
  }
  const anims = allFrames ? ANIMS : ['Walk', 'Idle']
  let palette = null
  for (const anim of anims) {
    let sheet
    try {
      sheet = await loadAnim(v, false, anim)
    } catch (e) {
      skipped.push(`${v.key} ${anim}: ${e.message}`)
      continue
    }
    palette ??= Rig.measure(Rig.frameOf(sheet.png.rgba, sheet.png.width, 0, 0, sheet.fw, sheet.fh), 0, sheet.marks[0][0]).palette
    for (let row = 0; row < 5; row++) {
      for (let frame = 0; frame < (allFrames ? sheet.frames : 1); frame++) {
        const f = Rig.frameOf(sheet.png.rgba, sheet.png.width, frame, row, sheet.fw, sheet.fh)
        const marks = sheet.marks[row][frame]
        const measured = Rig.measure(f, row, marks, { palette })
        const truth = adapter.fixTruth ? adapter.fixTruth(v.key, row, measured, f.w) : measured
        if (row <= 2 && truth.eyes.length === 0 && frame === 0) noEyes.push(`${v.key} ${anim} ${DIRS[row]}`)
        for (const id of items) {
          if (!adapter.wears(v.key, id)) {
            excluded++
            continue
          }
          const worn = adapter.wear(v.key, id, anim, row, frame, f, truth)
          if (!worn || worn === 'hidden') continue
          checks++
          const fails = Check.judge(f, truth, row, WEARABLES[id].slot, id, worn, marks.my)
          if (fails.length === 0) continue
          failed++
          failures.push({ variant: v.key, item: id, anim, dir: DIRS[row], frame, fails })
          if (cells.length < maxCells / (shard?.[1] ?? 1)) cells.push({ label: `${v.key} ${id} ${DIRS[row]}${frame ? ` f${frame}` : ''} ${fails.map((x) => x.rule).join(' ')}`, worn, f, truth, marks })
        }
      }
    }
  }
  if (!shard) process.stdout.write(`\r${v.key.padEnd(10)} ${checks} checks, ${failed} failing`)
}

/* ---------------- Contact sheets of the failures ---------------- */

// A 3×5 font for the labels.
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111',
  6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', a: '010101111101101', b: '110101110101110',
  c: '011100100100011', d: '110101101101110', e: '111100110100111', f: '111100110100100', g: '011100101101011', h: '101101111101101',
  i: '111010010010111', j: '001001001101010', k: '101101110101101', l: '100100100100111', m: '101111111101101', n: '110101101101101',
  o: '010101101101010', p: '110101110100100', q: '010101101110011', r: '110101110101101', s: '011100010001110', t: '111010010010010',
  u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101', y: '101101010010010', z: '111001010100111',
  ':': '000010000010000', '-': '000000111000000', ' ': '000000000000000',
}
const K = 4
const CELL = { w: 44, h: 44 }
const COLS = 8
const PER = 48
if (!shard) await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
for (let page = 0; page * PER < cells.length; page++) {
  const list = cells.slice(page * PER, page * PER + PER)
  const W = COLS * (CELL.w * K + 4)
  const H = Math.ceil(list.length / COLS) * (CELL.h * K + 16)
  const img = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) img.set([22, 22, 28, 255], i * 4)
  const put = (X, Y, c) => {
    if (X >= 0 && Y >= 0 && X < W && Y < H) img.set(c, (Y * W + X) * 4)
  }
  list.forEach(({ label, worn, truth, f }, n) => {
    const ox = (n % COLS) * (CELL.w * K + 4)
    const oy = Math.floor(n / COLS) * (CELL.h * K + 16)
    let tx = ox + 2
    for (const ch of label.toLowerCase().slice(0, 44)) {
      const g = GLYPHS[ch] ?? GLYPHS[' ']
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') put(tx + i, oy + 3 + j, [230, 230, 230, 255])
      tx += 4
    }
    // Centered on the seat, cropped to the cell.
    const cx = truth.rig.seatX - CELL.w / 2
    const cy = truth.rig.seatY - Math.round(CELL.h * 0.35)
    const eyes = new Set(truth.eyePx)
    for (let j = 0; j < CELL.h; j++) {
      for (let i = 0; i < CELL.w; i++) {
        const x = cx + i
        const y = cy + j
        const bi = x - worn.x0
        const bj = y - worn.y0
        let c = (x + y) & 1 ? [58, 58, 66, 255] : [68, 68, 76, 255]
        if (bi >= 0 && bj >= 0 && bi < worn.w && bj < worn.h && worn.rgba[(bj * worn.w + bi) * 4 + 3]) c = [...worn.rgba.subarray((bj * worn.w + bi) * 4, (bj * worn.w + bi) * 4 + 3), 255]
        const eye = x >= 0 && y >= 0 && x < f.w && y < f.h && eyes.has(y * f.w + x)
        for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) put(ox + i * K + dx, oy + 12 + j * K + dy, eye && (dx === 0 || dy === 0) ? [0, 255, 255, 255] : c)
      }
    }
  })
  await writeFile(join(OUT, `fails-${shard ? `${shard[0]}-` : ''}${page}.png`), writePng(W, H, img))
}

/* ---------------- Report ---------------- */

if (shard) await writeFile(join(OUT, `part-${shard[0]}.json`), JSON.stringify({ checks, failed, excluded, failures, noEyes, skipped }))
else await writeReport({ checks, failed, excluded, failures, noEyes, skipped })
