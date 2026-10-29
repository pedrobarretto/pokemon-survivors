import type { ArenaLook, WearableSlot } from '../data/arenaCosmetics'
import { STARTERS } from '../data/starters'
import { VERSUS_PICKS } from '../data/versus'
import { ART_DIRS, WEAR_FITS, type ArtDirName, type Nudge, type SpeciesFit } from '../data/wearFits'
import { isWearableId, WEARABLE_IDS, WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { createCanvas, context2d } from '../engine/pixelart'
import { lookOf, setArenaLooks } from '../render/arenaLooks'
import { drawPokemon, loadSpecies, type AnimName, type SpeciesSprites } from '../render/sprites'
import { artDir, isMirrored } from '../render/wearFit'
import { drawWearables, loadWearables, refitWearables, wearMisses } from '../render/wearables'

/**
 * Dev only (`ps.wear`, loaded on demand from `main.ts`): wearing the Arena's
 * wearables in a match, a fitting gallery that nudges them per species and
 * prints `WEAR_FITS` (`data/wearFits.ts`) back, and contact sheets for PRs.
 */

/** The seats of the running Arena match, from the shell. */
export type WearShell = { seat: () => number | null; seats: () => number }

/** Every species the Arena draws: each pick's whole line. */
const ROSTER = VERSUS_PICKS.flatMap((id) => STARTERS[id].line.map((stage) => ({ dex: stage.dex, name: stage.name })))
const nameOf = (dex: number) => ROSTER.find((r) => r.dex === dex)?.name ?? `#${dex}`

const setSeat = (shell: WearShell, seat: number, look: ArenaLook) =>
  setArenaLooks(Array.from({ length: Math.max(shell.seats(), seat + 1) }, (_, i) => (i === seat ? look : lookOf(i))))

const pickOf = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!

/** A random look: each slot filled half the time. */
const randomLook = (): ArenaLook => {
  const look: ArenaLook = {}
  for (const slot of ['head', 'face', 'neck', 'back'] as const) if (Math.random() < 0.6) look[slot] = pickOf(WEARABLE_IDS.filter((id) => WEARABLES[id].slot === slot))
  return look
}

/* ---------------- WEAR_FITS edits ---------------- */

const fitFor = (dex: number): SpeciesFit => (WEAR_FITS[dex] ??= {})

/** Moves a slot's pivot for one art direction (in that direction's own px: a west-facing row's x is flipped into its east twin's). */
const nudge = (dex: number, slot: WearableSlot, dir: Dir8, dx: number, dy: number, all: boolean) => {
  const fit = fitFor(dex)
  const nudges = (fit.nudge ??= {})
  const was = nudges[slot]
  const per: Partial<Record<ArtDirName, Nudge>> = Array.isArray(was) ? Object.fromEntries(ART_DIRS.map((d) => [d, was as Nudge])) : { ...(was as Partial<Record<ArtDirName, Nudge>> | undefined) }
  const fx = isMirrored(dir) ? -dx : dx
  for (const d of all ? ART_DIRS : [ART_DIRS[artDir(dir)]]) {
    const [x, y] = per[d] ?? [0, 0]
    per[d] = [x + fx, y + dy]
  }
  for (const d of ART_DIRS) if (per[d]?.[0] === 0 && per[d]?.[1] === 0) delete per[d]
  if (Object.keys(per).length === 0) delete nudges[slot]
  else nudges[slot] = per
  refitWearables()
}

const resize = (dex: number, slot: WearableSlot, by: number) => {
  const fit = fitFor(dex)
  const now = fit.size?.[slot] ?? 1
  fit.size = { ...fit.size, [slot]: Math.max(0, Math.min(2, now + by)) as 0 | 1 | 2 }
  refitWearables()
}

const toggleNo = (dex: number, what: WearableSlot | WearableId) => {
  const fit = fitFor(dex)
  const no = new Set(fit.no ?? [])
  if (no.has(what)) no.delete(what)
  else no.add(what)
  fit.no = [...no]
  if (fit.no.length === 0) delete fit.no
  refitWearables()
}

/** `WEAR_FITS` as the source of `data/wearFits.ts` would write it. */
export const fitsSource = () => {
  const lines = Object.entries(WEAR_FITS)
    .filter(([, fit]) => fit && (fit.nudge || fit.size || fit.no))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([dex, fit]) => `  ${dex}: ${JSON.stringify(fit).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ')}, // ${nameOf(Number(dex))}`)
  return `export const WEAR_FITS: Partial<Record<number, SpeciesFit>> = {\n${lines.join('\n')}\n}`
}

/* ---------------- Drawing a grid of wearers ---------------- */

const CELL_W = 56
const CELL_H = 60

/** The seconds into `anim` where its frame `frame` shows. */
const secondsAt = (s: SpeciesSprites, anim: AnimName, frame: number) => {
  const d = s.anims[anim === 'Fly' ? 'Walk' : anim].durations
  let ticks = 0
  for (let i = 0; i < Math.min(frame, d.length - 1); i++) ticks += d[i]!
  return (ticks + 0.5) / 60
}

/** One cell: a checker, then the look behind the sprite, the sprite and the look over it. */
const drawCell = (ctx: CanvasRenderingContext2D, s: SpeciesSprites, look: ArenaLook, anim: AnimName, dir: Dir8, t: number, cx: number, cy: number, k: number, clock: number) => {
  ctx.fillStyle = '#e4e8dc'
  ctx.fillRect(cx, cy, CELL_W * k, CELL_H * k)
  const x = cx + (CELL_W / 2) * k
  const y = cy + (CELL_H - 12) * k
  ctx.fillStyle = 'rgba(16,40,16,0.18)'
  ctx.fillRect(x - 6 * k, y + k, 12 * k, 2 * k)
  drawWearables(ctx, s, look, anim, dir, t, x, y, 'behind', { scale: k, clock })
  drawPokemon(ctx, s, anim, dir, t, x, y, { scale: k })
  drawWearables(ctx, s, look, anim, dir, t, x, y, 'front', { scale: k, clock })
}

const DIRS: readonly Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7]

/**
 * A contact sheet for PRs: every species of `dexes` in all eight directions
 * wearing `look`, one row each, labeled; resolves to a PNG data URL once the
 * art has rendered (it renders a few per frame, `render/wearEngine.ts`).
 */
export const contactSheet = async (look: ArenaLook, dexes: readonly number[], opts: { scale?: number; anim?: AnimName; frame?: number; title?: string; dirs?: readonly Dir8[] } = {}) => {
  await loadWearables()
  const k = opts.scale ?? 3
  const anim = opts.anim ?? 'Walk'
  const list = await Promise.all(dexes.map((dex) => loadSpecies(dex, false, undefined, 'now')))
  const label = 14
  const top = opts.title ? 22 : 0
  const dirs = opts.dirs ?? DIRS
  const canvas = createCanvas(CELL_W * k * dirs.length + 120, top + list.length * (CELL_H * k + label))
  const ctx = context2d(canvas)
  const paint = () => {
    ctx.fillStyle = '#1c1c24'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (opts.title) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 15px monospace'
      ctx.fillText(opts.title, 8, 16)
    }
    list.forEach((s, row) => {
      const y = top + row * (CELL_H * k + label)
      ctx.fillStyle = '#c8c8d0'
      ctx.font = '12px monospace'
      ctx.fillText(nameOf(s.dex), 8, y + 11)
      dirs.forEach((dir, col) => drawCell(ctx, s, look, anim, dir, secondsAt(s, anim, opts.frame ?? 0), 120 + col * CELL_W * k, y + label, k, 0))
    })
  }
  // The art renders in the background: paint until a whole paint found all of it.
  wearMisses()
  for (let i = 0; i < 400; i++) {
    paint()
    if (wearMisses() === 0) break
    await new Promise((r) => setTimeout(r, 25))
  }
  return canvas.toDataURL('image/png')
}

/** The whole catalog on one species facing `dir`, nine items a row, labeled by id; resolves to a PNG data URL. */
export const catalogSheet = async (dex: number, dir: Dir8, scale = 3) => {
  await loadWearables()
  const s = await loadSpecies(dex, false, undefined, 'now')
  const cols = 9
  const label = 14
  const rows = Math.ceil(WEARABLE_IDS.length / cols)
  const canvas = createCanvas(cols * CELL_W * scale, rows * (CELL_H * scale + label))
  const ctx = context2d(canvas)
  const paint = () => {
    ctx.fillStyle = '#1c1c24'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    WEARABLE_IDS.forEach((id, i) => {
      const x = (i % cols) * CELL_W * scale
      const y = Math.floor(i / cols) * (CELL_H * scale + label)
      ctx.fillStyle = '#c8c8d0'
      ctx.font = '12px monospace'
      ctx.fillText(`${id} · ${WEARABLES[id].rarity}`, x + 4, y + 11)
      drawCell(ctx, s, { [WEARABLES[id].slot]: id }, 'Walk', dir, secondsAt(s, 'Walk', 0), x, y + label, scale, 0)
    })
  }
  wearMisses()
  for (let i = 0; i < 400; i++) {
    paint()
    if (wearMisses() === 0) break
    await new Promise((r) => setTimeout(r, 25))
  }
  return canvas.toDataURL('image/png')
}

/* ---------------- The fitting gallery ---------------- */

let gallery: { close: () => void } | null = null

/**
 * The fitting gallery: the roster wearing one item, six species a page, all
 * eight directions, walking or idle. Click a cell to pick it, then: arrows
 * nudge the item's slot for that direction (shift: every direction), `[` and
 * `]` change its size class, `x` leaves the slot off the species and `n`
 * just this item, `w` walks or idles, PageUp and PageDown turn the page, Tab
 * the next item, `p` prints `WEAR_FITS` (and copies it), Esc closes.
 */
const openGallery = async (first: WearableId, dexes?: readonly number[]) => {
  gallery?.close()
  await loadWearables()
  const species = dexes ? dexes.map((dex) => ({ dex, name: nameOf(dex) })) : ROSTER
  const sprites = new Map<number, SpeciesSprites>()
  const load = (dex: number) => {
    if (!sprites.has(dex)) void loadSpecies(dex, false, undefined, 'now').then((s) => sprites.set(dex, s))
  }
  let item = first
  let anim: AnimName = 'Walk'
  let page = 0
  const perPage = 6
  let picked: { dex: number; dir: Dir8 } | null = null
  const k = 3
  const root = document.createElement('div')
  root.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#16161c;color:#eee;font:12px monospace;overflow:auto;padding:8px'
  const bar = document.createElement('div')
  const canvas = createCanvas(CELL_W * k * 8 + 120, perPage * CELL_H * k)
  canvas.style.cssText = 'display:block;image-rendering:pixelated;margin-top:6px;cursor:crosshair'
  root.append(bar, canvas)
  document.body.append(root)
  const ctx = context2d(canvas)
  const shown = () => species.slice(page * perPage, page * perPage + perPage)
  const status = () => {
    const slot = WEARABLES[item].slot
    const fit = picked ? WEAR_FITS[picked.dex] : undefined
    bar.textContent =
      `${item} (${slot}) · ${anim} · page ${page + 1}/${Math.ceil(species.length / perPage)}` +
      (picked ? ` · ${nameOf(picked.dex)} ${ART_DIRS[artDir(picked.dir)]}${isMirrored(picked.dir) ? ' (mirrored)' : ''} ${JSON.stringify(fit ?? {})}` : ' · click a cell') +
      ' — arrows nudge (shift: all dirs) · [ ] size · x slot off · n item off · w walk/idle · PgUp/PgDn · Tab item · p print · Esc'
  }
  let raf = 0
  const frame = (now: number) => {
    const t = now / 1000
    ctx.fillStyle = '#16161c'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    shown().forEach(({ dex }, row) => {
      load(dex)
      const s = sprites.get(dex)
      ctx.fillStyle = '#c8c8d0'
      ctx.fillText(nameOf(dex), 6, row * CELL_H * k + 14)
      if (!s) return
      DIRS.forEach((dir, col) => {
        const cx = 120 + col * CELL_W * k
        const cy = row * CELL_H * k
        drawCell(ctx, s, { [WEARABLES[item].slot]: item }, anim, dir, t, cx, cy, k, t)
        if (picked?.dex === dex && picked.dir === dir) {
          ctx.strokeStyle = '#f8d030'
          ctx.lineWidth = 2
          ctx.strokeRect(cx + 1, cy + 1, CELL_W * k - 2, CELL_H * k - 2)
        }
      })
    })
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect()
    const col = Math.floor((e.clientX - r.left - 120) / (CELL_W * k))
    const row = Math.floor((e.clientY - r.top) / (CELL_H * k))
    const s = shown()[row]
    if (s && col >= 0 && col < 8) picked = { dex: s.dex, dir: col as Dir8 }
    status()
  })
  const ids = WEARABLE_IDS
  const onKey = (e: KeyboardEvent) => {
    const slot = WEARABLES[item].slot
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (step && picked) nudge(picked.dex, slot, picked.dir, step[0]!, step[1]!, e.shiftKey)
    else if (e.key === '[' && picked) resize(picked.dex, slot, -1)
    else if (e.key === ']' && picked) resize(picked.dex, slot, 1)
    else if (e.key === 'x' && picked) toggleNo(picked.dex, slot)
    else if (e.key === 'n' && picked) toggleNo(picked.dex, item)
    else if (e.key === 'w') anim = anim === 'Walk' ? 'Idle' : 'Walk'
    else if (e.key === 'PageDown') page = Math.min(page + 1, Math.ceil(species.length / perPage) - 1)
    else if (e.key === 'PageUp') page = Math.max(page - 1, 0)
    else if (e.key === 'Tab') item = ids[(ids.indexOf(item) + (e.shiftKey ? ids.length - 1 : 1)) % ids.length]!
    else if (e.key === 'p') {
      const source = fitsSource()
      console.log(source)
      void navigator.clipboard?.writeText(source).catch(() => {})
    } else if (e.key === 'Escape') gallery?.close()
    else return
    e.preventDefault()
    e.stopPropagation()
    status()
  }
  window.addEventListener('keydown', onKey, true)
  status()
  gallery = {
    close: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey, true)
      root.remove()
      gallery = null
    },
  }
  return `fitting ${first}: click a cell, then the keys in the bar`
}

/* ---------------- ps.wear ---------------- */

/**
 * `ps.wear('topHat')` puts an item on the running Arena match's local player
 * (`ps.wear('topHat', 3)` on seat 3), `ps.wear('look', { head: 'crown', back:
 * 'cape' })` a whole look, `ps.wear('bots')` a random look on every seat,
 * `ps.wear('off')` takes the local player's off; `ps.wear('fit', 'topHat')`
 * opens the fitting gallery (`openGallery`; a list of dex numbers after the
 * item fits only those), `ps.wear('table')` prints `WEAR_FITS` as edited and
 * `ps.wear('sheet', look, dexes, opts?)` resolves a contact sheet's PNG data URL (`ps.wear('catalog', dex, dir)`: every item on one species).
 */
export const devWear = async (shell: WearShell, cmd?: string, arg?: unknown, more?: unknown, extra?: unknown) => {
  const seat = typeof arg === 'number' ? arg : shell.seat()
  if (cmd === 'fit') return openGallery(isWearableId(arg) ? arg : 'topHat', Array.isArray(more) ? more.filter((d): d is number => typeof d === 'number') : undefined)
  if (cmd === 'table') return fitsSource()
  if (cmd === 'catalog') return catalogSheet(typeof arg === 'number' ? arg : 4, (typeof more === 'number' ? more : 1) as Dir8)
  if (cmd === 'sheet') return contactSheet((arg ?? {}) as ArenaLook, Array.isArray(more) ? more : [4, 7, 1, 255, 393, 9], (extra ?? {}) as Parameters<typeof contactSheet>[2])
  if (cmd === 'bots') {
    const n = shell.seats()
    setArenaLooks(Array.from({ length: n }, (_, i) => (i === shell.seat() ? lookOf(i) : randomLook())))
    return Array.from({ length: n }, (_, i) => lookOf(i))
  }
  if (seat === null) return 'ps.wear: start an Arena match first (ps.versus())'
  if (cmd === 'off') return setSeat(shell, seat, {}), {}
  if (cmd === 'look' && typeof arg === 'object' && arg) return setSeat(shell, shell.seat() ?? 0, arg as ArenaLook), lookOf(shell.seat() ?? 0)
  if (isWearableId(cmd)) {
    const look = { ...lookOf(seat), [WEARABLES[cmd].slot]: cmd }
    setSeat(shell, seat, look)
    return look
  }
  const bySlot = Object.fromEntries((['head', 'face', 'neck', 'back'] as const).map((slot) => [slot, WEARABLE_IDS.filter((id) => WEARABLES[id].slot === slot)]))
  return { usage: "ps.wear(id, seat?) · ('look', look) · ('bots') · ('off') · ('fit', id, dexes?) · ('table') · ('sheet', look, dexes, opts?)", ...bySlot }
}
