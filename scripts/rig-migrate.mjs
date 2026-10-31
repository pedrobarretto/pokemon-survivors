// Moves the hand fixes of src/data/wearFits.ts onto a new rig: `npm run rig:migrate -- --from <git ref>`.
// After `npm run rig` changes how the rig reads a head (src/data/wearRig/), a
// fix made against the old rig would land elsewhere. For each direction a
// fix touches, this keeps what its author saw on the direction's Walk frames
// (each fixed field moved by the median of its moves across them, so a frame
// the old rig misread doesn't drag the rest): the fixed fields (the seat and
// its width, eyes moved or put, a neck, a back, the pixels over a hat) land
// where they did on the old rig, and what wasn't fixed takes the new rig's
// reading. A `size.head` is kept against the skull's new width.
// Rewrites the `rig:` and `size:` of the lines it changes, prints them, and
// `--dry` prints only.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runnerImport } from 'vite'

const ROOT = new URL('..', import.meta.url).pathname
const args = process.argv.slice(2)
const from = args[args.indexOf('--from') + 1]
if (!args.includes('--from') || !from) throw new Error('usage: npm run rig:migrate -- --from <git ref of the old rig> [--dry]')
const dry = args.includes('--dry')

const load = async (p) => (await runnerImport(p, { configFile: false, root: ROOT, logLevel: 'error' })).module
const Rig = await load('/src/render/wearRig.ts')
const Fit = await load('/src/render/wearFit.ts')
const { WEAR_FITS, ART_DIRS } = await load('/src/data/wearFits.ts')

const DIR = 'src/data/wearRig'
const files = readdirSync(join(ROOT, DIR))
const species = (read) => Object.assign({}, ...files.map((f) => read(f)?.species ?? {}))
const now = species((f) => JSON.parse(readFileSync(join(ROOT, DIR, f), 'utf8')))
const old = species((f) => {
  try {
    return JSON.parse(execFileSync('git', ['show', `${from}:${DIR}/${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }))
  } catch {
    return null
  }
})
const walk = (entry, row) => Rig.unpackRig(Uint8Array.from(Buffer.from(entry.Walk, 'base64'))).rows[row]
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[s.length >> 1] : 0
}
/** The median, frame by frame, of `fn` over two rigs of a row's frames (the old and the new, as many). */
const across = (as, bs, fn) => {
  const vs = as.flatMap((a, f) => fn(a, bs[Math.min(f, bs.length - 1)], f) ?? [])
  return vs.length ? vs[0].map((_, i) => median(vs.map((v) => v[i]))) : null
}

const NONE = Rig.NONE
const add = (v, d) => [v?.[0] ?? 0, v?.[1] ?? 0, ...(d.length > 2 ? [v?.[2] ?? 0] : [])].map((n, i) => n + (d[i] ?? 0))
const clean = (v) => (v && v.every((n) => n === 0) ? undefined : v)

/** The fit moved onto the new rig (see the header), and whether anything changed. */
const migrate = (key, fit) => {
  const entryNew = now[key]
  const entryOld = old[key]
  if (!entryNew || !entryOld || !fit.rig) return null
  const rig = structuredClone(fit.rig)
  let changed = false
  ART_DIRS.forEach((name, row) => {
    const fix = Fit.fixOf(fit, row)
    if (!fix) return
    const as = walk(entryOld, row)
    const bs = walk(entryNew, row)
    const own = (rig[name] ??= {})
    const set = (k, v) => {
      const c = clean(v)
      if (JSON.stringify(c) === JSON.stringify(own[k])) return
      changed = true
      if (c === undefined) delete own[k]
      else own[k] = c
    }
    if (fix.seat) {
      const v = add(own.seat, across(as, bs, (a, b) => [[a.seatX - b.seatX, a.seatY - b.seatY, a.seatW - b.seatW]]))
      set('seat', v[2] === 0 ? v.slice(0, 2) : v)
    }
    // Where the seat lands after this direction's fix, old and new: what's put from it stays where it was.
    const fixed = Fit.fixOf({ rig }, row)
    const ds = across(as, bs, (a, b) => {
      const [p, q] = [Fit.fixFrame(a, fix), Fit.fixFrame(b, fixed)]
      return [[p.seatX - q.seatX, p.seatY - q.seatY]]
    })
    if (Array.isArray(fix.eyes)) {
      const de = across(as, bs, (a, b) => (a.e1x !== NONE && b.e1x !== NONE ? [[a.e1x - b.e1x, a.e1y - b.e1y]] : null))
      if (de) set('eyes', add(fix.eyes, de))
      else {
        // The new rig sees no eyes here: put them, from the seat, where the old one's moved ones were.
        const at = across(as, bs, (a, b) => {
          const [p, q] = [Fit.fixFrame(a, fix), Fit.fixFrame(b, fixed)]
          return p.e1x === NONE ? null : [[p.e1x - q.seatX, p.e1y - q.seatY, p.e2x - q.seatX, p.e2y - q.seatY]]
        })
        if (at) {
          set('eyesAt', at[0] === at[2] && at[1] === at[3] ? [[at[0], at[1]]] : [[at[0], at[1]], [at[2], at[3]]])
          delete own.eyes
        }
      }
    } else if (fix.eyesAt?.length && fix.eyes !== 'none') set('eyesAt', fix.eyesAt.map(([x, y]) => [x + ds[0], y + ds[1]]))
    if (fix.neck) set('neck', add(own.neck, across(as, bs, (a, b) => [[a.neckX - b.neckX, a.neckY - b.neckY]])))
    if (fix.back) set('back', add(own.back, across(as, bs, (a, b) => [[a.backX - b.backX, a.backY - b.backY]])))
    if (fix.over?.length && (ds[0] || ds[1])) set('over', fix.over.map(([x, y]) => [x + ds[0], y + ds[1]]))
    if (Object.keys(own).length === 0) delete rig[name]
  })
  let size = fit.size
  if (fit.size?.head) {
    const d = across(walk(entryOld, 0), walk(entryNew, 0), (a, b) => [[a.seatW - b.seatW]])[0]
    if (d) {
      size = { ...fit.size, head: fit.size.head + d }
      changed = true
    }
  }
  return changed ? { rig, size } : null
}

/** A value as `data/wearFits.ts` writes it: single quotes, keys bare where they can be. */
const lit = (v) => {
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`
  if (v && typeof v === 'object') {
    const order = ['all', ...ART_DIRS, 'Walk', 'Idle', 'Hurt', 'seat', 'eyes', 'eyesAt', 'left', 'right', 'neck', 'back', 'over', 'head', 'face', 'neck', 'back']
    const keys = Object.keys(v).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b))
    return keys.length ? `{ ${keys.map((k) => `${/^\w+$/.test(k) ? k : `'${k}'`}: ${lit(v[k])}`).join(', ')} }` : '{}'
  }
  return typeof v === 'string' ? `'${v}'` : String(v)
}

/** The `{ ... }` after `name: ` on a line, by its braces. */
const span = (line, name) => {
  const at = line.indexOf(`${name}: {`)
  if (at < 0) return null
  let depth = 0
  for (let i = at + name.length + 2; i < line.length; i++) {
    if (line[i] === '{') depth++
    else if (line[i] === '}' && --depth === 0) return [at + name.length + 2, i + 1]
  }
  return null
}

const path = join(ROOT, 'src/data/wearFits.ts')
const lines = readFileSync(path, 'utf8').split('\n')
const done = []
for (const [key, fit] of Object.entries(WEAR_FITS)) {
  const m = fit && migrate(key, fit)
  if (!m) continue
  const head = /^\d+$/.test(key) ? `  ${key}: {` : `  '${key}': {`
  const i = lines.findIndex((l) => l.startsWith(head))
  if (i < 0) throw new Error(`no line for ${key}`)
  let line = lines[i]
  for (const [name, value] of [['rig', m.rig], ['size', m.size === fit.size ? null : m.size]]) {
    const s = span(line, name)
    if (!s || !value) continue
    line = Object.keys(value).length ? line.slice(0, s[0]) + lit(value) + line.slice(s[1]) : line.slice(0, s[0] - name.length - 2) + line.slice(s[1] + 2)
  }
  done.push(`${key}\n  was ${lines[i].split(' // ')[0].trim()}\n  now ${line.split(' // ')[0].trim()}`)
  lines[i] = line
}
if (!dry) writeFileSync(path, lines.join('\n'))
console.log(done.join('\n') || 'nothing to move')
console.log(`\n${done.length} entries ${dry ? 'would move' : 'moved'} onto the new rig (from ${from})`)
