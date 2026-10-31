import { ART_DIRS, WEAR_FITS, type ArtDirName, type FitKey, type Nudge, type RigFix } from '../data/wearFits'
import { isWearableId, WEARABLE_IDS, WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { createCanvas, context2d } from '../engine/pixelart'
import type { SpeciesSprites } from '../render/sprites'
import { artDir, isMirrored, rigKey, type RigAnim } from '../render/wearFit'
import { loadWearables, refitWearables, rigOfSprites } from '../render/wearables'
import { NONE } from '../render/wearRig'
import { drawCell, fitFor, fitKeyOf, fitLine, fitsSource, loadVariant, nameOf, parseVariant, ROSTER, type Variant } from './wearFitting'

/**
 * Dev only (`ps.rig`, loaded on demand from `main.ts`): a variant's frame
 * upscaled with its head rig drawn over it (`render/wearRig.ts`: the seat in
 * red, the eyes in cyan, the neck in orange, the back in green, the pixels
 * drawn over any hat in magenta) beside it dressed in an item, to correct the
 * rig by hand: what's set becomes a fix in `WEAR_FITS` (`data/wearFits.ts`,
 * per art direction, `RigFix`), live, and `p` prints the variant's line.
 *
 * Keys: `1` seat, `2` eyes, `3` neck, `4` back, `5` paint over-hat pixels
 * (the mode a click and the arrows act on: a click puts the point there,
 * arrows move it a pixel, shift for every direction at once); `[` `]` the
 * seat's width, `0` no eyes here (again: back to the found ones), `a` the
 * anim, `,` `.` the frame, `d` `D` the direction, `i` `I` the item, `n` `N`
 * the next or last Pokémon, `p` prints the variant's entry (and copies it),
 * `P` the whole table, Esc closes.
 */

type Mode = 'seat' | 'eyes' | 'neck' | 'back' | 'over'
const MODES: readonly Mode[] = ['seat', 'eyes', 'neck', 'back', 'over']

let tool: { close: () => void } | null = null

/** This direction's fix (or `all`'s), made if it isn't there yet. */
const fixFor = (key: FitKey, dir: Dir8, all: boolean): RigFix => {
  const fit = fitFor(key)
  const name: ArtDirName | 'all' = all ? 'all' : ART_DIRS[artDir(dir)]!
  const rig = (fit.rig ??= {})
  return (rig[name] ??= {})
}

/** Drops empty fixes so a printed entry stays as small as it can be. */
const tidy = (key: FitKey) => {
  const fit = WEAR_FITS[key]
  if (!fit?.rig) return
  for (const [name, fix] of Object.entries(fit.rig)) {
    if (!fix) continue
    for (const k of Object.keys(fix) as (keyof RigFix)[]) {
      const v = fix[k]
      if (v === undefined || (Array.isArray(v) && (v.length === 0 || v.every((n) => n === 0)))) delete fix[k]
    }
    if (Object.keys(fix).length === 0) delete fit.rig[name as ArtDirName]
  }
  if (Object.keys(fit.rig).length === 0) delete fit.rig
}

const add = (v: readonly number[] | undefined, dx: number, dy: number, dw = 0): readonly [number, number, number] => [(v?.[0] ?? 0) + dx, (v?.[1] ?? 0) + dy, (v?.[2] ?? 0) + dw]

/** Opens the tool on `variant` (a dex or `'<dex>[:<form>][s]'`, the first player by default). */
export const openRig = async (variant?: unknown, opts: { dir?: Dir8; item?: WearableId; anim?: RigAnim } = {}) => {
  tool?.close()
  await loadWearables()
  const list: readonly Variant[] = ROSTER
  let v: Variant = parseVariant(variant) ?? list[0]!
  let dir: Dir8 = opts.dir ?? 0
  let anim: RigAnim = opts.anim ?? 'Walk'
  let frame = 0
  let item: WearableId = opts.item && isWearableId(opts.item) ? opts.item : 'topHat'
  let mode: Mode = 'seat'
  let sprites: SpeciesSprites | null = null
  const load = () => {
    sprites = null
    void loadVariant(v).then((s) => (sprites = s), () => undefined)
  }
  load()
  const Z = 10
  const root = document.createElement('div')
  root.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#16161c;color:#eee;font:12px monospace;overflow:auto;padding:8px'
  const bar = document.createElement('div')
  bar.style.whiteSpace = 'pre-wrap'
  const main = createCanvas(64 * Z, 64 * Z)
  main.style.cssText = 'image-rendering:pixelated;cursor:crosshair;margin-top:6px;vertical-align:top'
  const side = createCanvas(56 * 4, 60 * 4)
  side.style.cssText = 'image-rendering:pixelated;margin:6px 0 0 8px;vertical-align:top'
  root.append(bar, main, side)
  document.body.append(root)
  const mctx = context2d(main)
  const sctx = context2d(side)
  const scratch = createCanvas(1, 1)
  const key = () => fitKeyOf(v)
  const edit = (fn: (fix: RigFix) => void, all: boolean) => {
    fn(fixFor(key(), dir, all))
    tidy(key())
    refitWearables()
  }
  /** A screen-space move (px, right and down) for this direction, as a fix stores it (mirrored rows flipped). */
  const mx = (dx: number) => (isMirrored(dir) ? -dx : dx)
  const rigNow = () => {
    const s = sprites
    const w = s ? rigOfSprites(s) : null
    if (!s || !w) return null
    const r = w.rig[anim]
    return { s, w, r, f: r.rows[dir]![Math.min(frame, r.frames - 1)]!, frames: r.frames }
  }
  const move = (dx: number, dy: number, all: boolean) =>
    edit((fix) => {
      if (mode === 'seat') fix.seat = add(fix.seat, mx(dx), dy)
      else if (mode === 'eyes') fix.eyes = add(fix.eyes === 'none' ? undefined : fix.eyes, mx(dx), dy).slice(0, 2) as unknown as Nudge
      else if (mode === 'neck') fix.neck = add(fix.neck, mx(dx), dy).slice(0, 2) as unknown as Nudge
      else if (mode === 'back') fix.back = add(fix.back, mx(dx), dy).slice(0, 2) as unknown as Nudge
    }, all)
  const status = () => {
    const now = rigNow()
    const fix = WEAR_FITS[key()]
    bar.textContent =
      `${nameOf(v)} (${rigKey(v.dex, v.form, v.shiny)}) · ${anim} f${frame}/${now ? now.frames - 1 : '?'} · ${ART_DIRS[artDir(dir)]}${isMirrored(dir) ? ' (mirrored)' : ''} · item ${item} · mode ${mode}\n` +
      (now ? `seat ${now.f.seatX},${now.f.seatY} w${now.f.seatW} · eyes ${now.f.e1x === NONE ? 'none' : `${now.f.e1x},${now.f.e1y} ${now.f.e2x},${now.f.e2y}`} · neck ${now.f.neckX},${now.f.neckY} w${now.f.neckW} · back ${now.f.backX},${now.f.backY} · size ${JSON.stringify(now.w.size)}\n` : 'loading…\n') +
      `fix ${JSON.stringify(fix ?? {})}\n` +
      '1 seat · 2 eyes · 3 neck · 4 back · 5 over-hat pixels · click/arrows (shift: all dirs) · [ ] seat width · 0 no eyes · a anim · , . frame · d D dir · i I item · n N Pokémon · p print · P table · Esc'
  }
  let raf = 0
  const paint = (t: number) => {
    mctx.fillStyle = '#16161c'
    mctx.fillRect(0, 0, main.width, main.height)
    const now = rigNow()
    if (now) {
      const sheet = now.s.anims[anim]
      const { fw, fh } = now.r
      if (main.width !== fw * Z || main.height !== fh * Z) [main.width, main.height] = [fw * Z, fh * Z]
      scratch.width = fw
      scratch.height = fh
      const c = context2d(scratch)
      c.clearRect(0, 0, fw, fh)
      c.drawImage(sheet.img, Math.min(frame, now.frames - 1) * fw, dir * fh, fw, fh, 0, 0, fw, fh)
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        mctx.fillStyle = (x + y) & 1 ? '#3a3a44' : '#44444e'
        mctx.fillRect(x * Z, y * Z, Z, Z)
      }
      mctx.imageSmoothingEnabled = false
      mctx.drawImage(scratch, 0, 0, fw * Z, fh * Z)
      const r = now.f
      const line = (x0: number, x1: number, y: number, color: string) => {
        mctx.fillStyle = color
        mctx.fillRect(x0 * Z, y * Z - 1, (x1 - x0 + 1) * Z, 3)
      }
      line(r.seatX - (r.seatW >> 1), r.seatX + ((r.seatW - 1) >> 1), r.seatY, '#ff3030')
      mctx.fillStyle = '#ff3030'
      mctx.fillRect(r.seatX * Z + Z / 2 - 2, r.seatY * Z + 2, 4, 4)
      if (r.e1x !== NONE) {
        mctx.strokeStyle = '#00ffff'
        mctx.lineWidth = 2
        mctx.strokeRect(r.eyeX0 * Z, r.eyeY0 * Z, (r.eyeX1 - r.eyeX0 + 1) * Z, (r.eyeY1 - r.eyeY0 + 1) * Z)
        mctx.fillStyle = '#00ffff'
        for (const [x, y] of [[r.e1x, r.e1y], [r.e2x, r.e2y]] as const) mctx.fillRect(x * Z + Z / 2 - 2, y * Z + Z / 2 - 2, 4, 4)
        line(r.faceL, r.faceR, r.e1y + 1, 'rgba(80,140,255,0.6)')
      }
      line(r.neckX - (r.neckW >> 1), r.neckX + ((r.neckW - 1) >> 1), r.neckY + 1, '#ff9020')
      mctx.fillStyle = '#30ff60'
      mctx.fillRect(r.backX * Z + Z / 2 - 1, r.backY * Z, 2, Z)
      mctx.fillRect(r.backX * Z, r.backY * Z + Z / 2 - 1, Z, 2)
      mctx.strokeStyle = '#ff40ff'
      for (const [dx, dy] of now.w.over[dir] ?? []) mctx.strokeRect((r.seatX + dx) * Z + 1, (r.seatY + dy) * Z + 1, Z - 2, Z - 2)
      // The dressed preview, live.
      drawCell(sctx, now.s, { [WEARABLES[item].slot]: item }, anim, dir, t / 1000, 0, 0, 4, t / 1000)
    }
    raf = requestAnimationFrame(paint)
  }
  raf = requestAnimationFrame(paint)
  main.addEventListener('pointerdown', (e) => {
    const now = rigNow()
    if (!now) return
    const rect = main.getBoundingClientRect()
    const px = Math.floor(((e.clientX - rect.left) / rect.width) * now.r.fw)
    const py = Math.floor(((e.clientY - rect.top) / rect.height) * now.r.fh)
    const r = now.f
    const all = e.shiftKey
    if (mode === 'seat') move(px - r.seatX, py - r.seatY, all)
    else if (mode === 'eyes') {
      if (r.e1x === NONE)
        edit((fix) => {
          // No eyes found: each click puts one, from the seat (a third starts over).
          const at = fix.eyesAt && fix.eyesAt.length < 2 ? fix.eyesAt : []
          fix.eyesAt = [...at, [mx(px - r.seatX), py - r.seatY]]
          delete fix.eyes
        }, all)
      else move(px - Math.round((r.e1x + r.e2x) / 2), py - Math.round((r.e1y + r.e2y) / 2), all)
    } else if (mode === 'neck') move(px - r.neckX, py - r.neckY, all)
    else if (mode === 'back') move(px - r.backX, py - r.backY, all)
    else
      edit((fix) => {
        const p: Nudge = [mx(px - r.seatX), py - r.seatY]
        const over = fix.over ?? []
        fix.over = over.some(([x, y]) => x === p[0] && y === p[1]) ? over.filter(([x, y]) => x !== p[0] || y !== p[1]) : [...over, p]
      }, all)
    status()
  })
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    const now = rigNow()
    const at = list.findIndex((x) => x.dex === v.dex && x.form === v.form)
    if (step && mode !== 'over') move(step[0]!, step[1]!, e.shiftKey)
    else if (/^[1-5]$/.test(e.key)) mode = MODES[Number(e.key) - 1]!
    else if (e.key === '[' || e.key === ']') edit((fix) => (fix.seat = add(fix.seat, 0, 0, e.key === '[' ? -1 : 1)), e.shiftKey)
    else if (e.key === '0') edit((fix) => (fix.eyes = fix.eyes === 'none' ? undefined : 'none'), e.shiftKey)
    else if (e.key === 'a') anim = anim === 'Walk' ? 'Idle' : anim === 'Idle' ? 'Hurt' : 'Walk'
    else if (e.key === ',' || e.key === '.') frame = Math.max(0, Math.min((now?.frames ?? 1) - 1, frame + (e.key === ',' ? -1 : 1)))
    else if (e.key === 'd' || e.key === 'D') dir = ((dir + (e.key === 'd' ? 1 : 7)) % 8) as Dir8
    else if (e.key === 'i' || e.key === 'I') item = WEARABLE_IDS[(WEARABLE_IDS.indexOf(item) + (e.key === 'i' ? 1 : WEARABLE_IDS.length - 1)) % WEARABLE_IDS.length]!
    else if (e.key === 'n' || e.key === 'N') {
      v = list[(at + (e.key === 'n' ? 1 : list.length - 1)) % list.length]!
      frame = 0
      load()
    } else if (e.key === 'p') {
      const line = fitLine(key())
      console.log(line)
      void navigator.clipboard?.writeText(line).catch(() => {})
    } else if (e.key === 'P') {
      const source = fitsSource()
      console.log(source)
      void navigator.clipboard?.writeText(source).catch(() => {})
    } else if (e.key === 'Escape') tool?.close()
    else return
    e.preventDefault()
    e.stopPropagation()
    status()
  }
  window.addEventListener('keydown', onKey, true)
  const ticker = setInterval(status, 500)
  status()
  tool = {
    close: () => {
      cancelAnimationFrame(raf)
      clearInterval(ticker)
      window.removeEventListener('keydown', onKey, true)
      root.remove()
      tool = null
    },
  }
  return `rig: ${nameOf(v)}: click to set, keys in the bar`
}
