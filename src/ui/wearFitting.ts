import { BRANCHES } from '../data/branches'
import type { Look, WearableSlot } from '../data/cosmetics'
import { PLAYABLE } from '../data/hatchlings'
import manifest from '../data/sprites.generated.json'
import { ART_DIRS, WEAR_FITS, type FitKey, type SpeciesFit } from '../data/wearFits'
import { isWearableId, WEARABLE_IDS, WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { createCanvas, context2d } from '../engine/pixelart'
import { lookOf, setLooks } from '../render/looks'
import { formOf, loadSpecies, type AnimName, type Form, type SpeciesSprites } from '../render/sprites'
import { artDir, isMirrored, rigKey } from '../render/wearFit'
import { drawDressed, holdWearables, loadWearables, refitWearables, wearMisses } from '../render/wearables'

/**
 * Dev only (`ps.wear`, loaded on demand from `main.ts`): wearing the
 * wearables in a run or a match, a gallery of every player wearing an item
 * (which leaves items off species and prints `WEAR_FITS`, `data/wearFits.ts`,
 * back; the rig's fixes are `ps.rig`'s, `ui/rigTool.ts`), and contact sheets for PRs.
 */

/** The seats of the running game (a run, a match), from the shell: this player's (null: none runs) and how many. */
export type WearShell = { seat: () => number | null; seats: () => number }

/** A variant the fitting tools draw: a species or one of its forms with sheets, in its normal or shiny colors. */
export type Variant = { dex: number; form?: Form; shiny: boolean }

const keyOf = (v: Variant) => rigKey(v.dex, v.form, v.shiny)
/** A variant's `WEAR_FITS` key: a shiny's own (`'<dex>s'`), which its normal colors' covers until it's made. */
export const fitKeyOf = (v: Variant): FitKey => {
  const base = v.form ? `${v.dex}:${v.form}` : `${v.dex}`
  return v.shiny ? (`${base}s` as FitKey) : v.form ? (base as FitKey) : v.dex
}

/** The forms with sheets of a species (Megas, Primal Reversion, Deoxys' formes, Aegislash's blade). */
const formsOf = (dex: number) => Object.keys((manifest as Record<string, { forms?: object }>)[dex]?.forms ?? {}).flatMap((key) => formOf(dex, key) ?? [])

/** Every Pokémon a player can be (`npm run rig` fits them): each playable line with its branches, then their forms. */
export const ROSTER = ((): readonly (Variant & { name: string })[] => {
  const species = new Map<number, string>()
  for (const [id, p] of Object.entries(PLAYABLE)) {
    for (const stage of p.line) species.set(stage.dex, stage.name)
    for (const b of Object.values(BRANCHES)) if (b.line === id) species.set(b.dex, b.name)
  }
  const all = [...species].map(([dex, name]) => ({ dex, shiny: false, name }))
  return [...all, ...all.flatMap(({ dex, name }) => formsOf(dex).map((form) => ({ dex, form, shiny: false, name: `${name} (${form})` })))]
})()

export const nameOf = (v: Variant) => {
  const name = ROSTER.find((r) => r.dex === v.dex && r.form === v.form)?.name ?? keyOf(v)
  return v.shiny ? `${name} ★` : name
}

/** A variant from the console: a dex (`6`), or `'<dex>[:<form>][s]'` as `rigKey` writes them (`'6:megaX'`, `'502s'`). */
export const parseVariant = (v: unknown): Variant | null => {
  if (typeof v === 'number') return { dex: v, shiny: false }
  const m = typeof v === 'string' ? /^(\d+)(?::([a-zA-Z]+?))?(s?)$/.exec(v) : null
  if (!m) return null
  const dex = Number(m[1])
  const form = formOf(dex, m[2])
  if (m[2] !== undefined && !form) return null
  return { dex, ...(form && { form }), shiny: m[3] === 's' }
}

const variantsOf = (list: readonly unknown[]) => list.flatMap((v) => parseVariant(v) ?? [])

export const loadVariant = (v: Variant) => loadSpecies(v.dex, v.shiny, v.form, 'now')

const setSeat = (shell: WearShell, seat: number, look: Look) =>
  setLooks(Array.from({ length: Math.max(shell.seats(), seat + 1) }, (_, i) => (i === seat ? look : lookOf(i))))

const pickOf = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!

/** A random look: each slot filled half the time. */
const randomLook = (): Look => {
  const look: Look = {}
  for (const slot of ['head', 'face', 'neck', 'back'] as const) if (Math.random() < 0.6) look[slot] = pickOf(WEARABLE_IDS.filter((id) => WEARABLES[id].slot === slot))
  return look
}

/* ---------------- WEAR_FITS edits ---------------- */

export const fitFor = (key: FitKey): SpeciesFit => (WEAR_FITS[key] ??= {})

const toggleNo = (key: FitKey, what: WearableSlot | WearableId) => {
  const fit = fitFor(key)
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
    .filter(([, fit]) => fit && (fit.rig || fit.size || fit.no))
    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10) || a.length - b.length || a.localeCompare(b))
    .map(([key]) => fitLine(/^\d+$/.test(key) ? Number(key) : (key as FitKey)))
  return `export const WEAR_FITS: Partial<Record<FitKey, SpeciesFit>> = {\n${lines.join('\n')}\n}`
}

/** One `WEAR_FITS` entry as its line of `data/wearFits.ts` (its comment names the Pokémon; the reason is yours to add). */
export const fitLine = (key: FitKey) => {
  const v = parseVariant(key)
  return `  ${typeof key === 'number' ? key : `'${key}'`}: ${JSON.stringify(WEAR_FITS[key] ?? {}).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ')}, // ${v ? nameOf(v) : key}`
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

/**
 * Paints until a whole paint found every dressed row (they dress in the
 * background, a few at a time), keeping them all meanwhile (`holdWearables`:
 * a sheet draws more rows than the game keeps), and resolves to the PNG.
 */
const paintAll = async (paint: () => void, canvas: HTMLCanvasElement) => {
  holdWearables(true)
  try {
    wearMisses()
    for (let i = 0; i < 400; i++) {
      paint()
      if (wearMisses() === 0) break
      await new Promise((r) => setTimeout(r, 25))
    }
    return canvas.toDataURL('image/png')
  } finally {
    holdWearables(false)
  }
}

/** One cell: a checker, then the Pokémon dressed in the look. */
export const drawCell = (ctx: CanvasRenderingContext2D, s: SpeciesSprites, look: Look, anim: AnimName, dir: Dir8, t: number, cx: number, cy: number, k: number, clock: number) => {
  ctx.fillStyle = '#e4e8dc'
  ctx.fillRect(cx, cy, CELL_W * k, CELL_H * k)
  const x = cx + (CELL_W / 2) * k
  const y = cy + (CELL_H - 12) * k
  ctx.fillStyle = 'rgba(16,40,16,0.18)'
  ctx.fillRect(x - 6 * k, y + k, 12 * k, 2 * k)
  drawDressed(ctx, s, look, anim, dir, t, x, y, { scale: k, clock })
}

const DIRS: readonly Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7]

/**
 * A contact sheet for PRs: every variant of `dexes` (dex numbers, or
 * `'<dex>[:<form>][s]'`: `'6:megaX'`, `'502s'`) in all eight directions (or
 * `dirs`) wearing `look`, one row each (or `cols` side by side), labeled;
 * resolves to a PNG data URL once the art has rendered (it renders a few per
 * frame, `render/wearEngine.ts`, and each species' anchors load on its first draw).
 */
export const contactSheet = async (
  look: Look,
  dexes: readonly unknown[],
  opts: { scale?: number; anim?: AnimName; frame?: number; title?: string; dirs?: readonly Dir8[]; cols?: number } = {},
) => {
  await loadWearables()
  const k = opts.scale ?? 3
  const anim = opts.anim ?? 'Walk'
  // A variant whose sheets won't load (Mega Darkrai behind its community goal) is left off the sheet.
  const loaded = await Promise.all(variantsOf(dexes).map((v) => loadVariant(v).then((s) => ({ v, s }), () => null)))
  const rows = loaded.flatMap((r) => r ?? [])
  const label = 14
  const top = opts.title ? 22 : 0
  const dirs = opts.dirs ?? DIRS
  const cols = Math.max(1, opts.cols ?? 1)
  const blockW = CELL_W * k * dirs.length + 120
  const canvas = createCanvas(blockW * cols, top + Math.ceil(rows.length / cols) * (CELL_H * k + label))
  const ctx = context2d(canvas)
  const paint = () => {
    ctx.fillStyle = '#1c1c24'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (opts.title) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 15px monospace'
      ctx.fillText(opts.title, 8, 16)
    }
    rows.forEach(({ v, s }, i) => {
      const x = (i % cols) * blockW
      const y = top + Math.floor(i / cols) * (CELL_H * k + label)
      ctx.fillStyle = '#c8c8d0'
      ctx.font = '12px monospace'
      ctx.fillText(nameOf(v), x + 8, y + 11)
      dirs.forEach((dir, col) => drawCell(ctx, s, look, anim, dir, secondsAt(s, anim, opts.frame ?? 0), x + 120 + col * CELL_W * k, y + label, k, 0))
    })
  }
  // The art renders in the background: paint until a whole paint found all of it.
  return paintAll(paint, canvas)
}

/** The whole catalog on one variant (as `contactSheet` takes them) facing `dir`, bare first and then every item, nine a row, labeled by id; resolves to a PNG data URL. */
export const catalogSheet = async (variant: Variant, dir: Dir8, scale = 3) => {
  await loadWearables()
  const s = await loadVariant(variant)
  const cols = 9
  const label = 14
  const cells = [null, ...WEARABLE_IDS] as const
  const rows = Math.ceil(cells.length / cols)
  const canvas = createCanvas(cols * CELL_W * scale, rows * (CELL_H * scale + label))
  const ctx = context2d(canvas)
  const paint = () => {
    ctx.fillStyle = '#1c1c24'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    cells.forEach((id, i) => {
      const x = (i % cols) * CELL_W * scale
      const y = Math.floor(i / cols) * (CELL_H * scale + label)
      ctx.fillStyle = '#c8c8d0'
      ctx.font = `${Math.min(12, 4 + scale * 3)}px monospace`
      ctx.fillText(id ? (scale >= 3 ? `${id} · ${WEARABLES[id].rarity}` : id) : nameOf(variant), x + 2, y + 11)
      drawCell(ctx, s, id ? { [WEARABLES[id].slot]: id } : {}, 'Walk', dir, secondsAt(s, 'Walk', 0), x, y + label, scale, 0)
    })
  }
  return paintAll(paint, canvas)
}

/* ---------------- The fitting gallery ---------------- */

let gallery: { close: () => void } | null = null

/**
 * The fitting gallery: every Pokémon a player can be (or `dexes`, as
 * `contactSheet` takes them) wearing one item, six a page, all eight
 * directions, walking or idle. Click a cell to pick it, then: `r` opens the
 * rig tool on it (`ps.rig`, which fixes the seat, the eyes and the rest),
 * `x` leaves the slot off the species and `n` just this item, `w` walks or
 * idles, PageUp and PageDown turn the page, Tab the next item, `p` prints
 * `WEAR_FITS` (and copies it), Esc closes.
 */
const openGallery = async (first: WearableId, dexes?: readonly unknown[]) => {
  gallery?.close()
  await loadWearables()
  const species: readonly Variant[] = dexes ? variantsOf(dexes) : ROSTER
  const sprites = new Map<string, SpeciesSprites>()
  const load = (v: Variant) => {
    if (!sprites.has(keyOf(v))) void loadVariant(v).then((s) => sprites.set(keyOf(v), s))
  }
  let item = first
  let anim: AnimName = 'Walk'
  let page = 0
  const perPage = 6
  let picked: { variant: Variant; dir: Dir8 } | null = null
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
    const fit = picked ? WEAR_FITS[fitKeyOf(picked.variant)] : undefined
    bar.textContent =
      `${item} (${slot}) · ${anim} · page ${page + 1}/${Math.ceil(species.length / perPage)}` +
      (picked ? ` · ${nameOf(picked.variant)} ${ART_DIRS[artDir(picked.dir)]}${isMirrored(picked.dir) ? ' (mirrored)' : ''} ${JSON.stringify(fit ?? {})}` : ' · click a cell') +
      ' — r rig tool · x slot off · n item off · w walk/idle · PgUp/PgDn · Tab item · p print · Esc'
  }
  let raf = 0
  const frame = (now: number) => {
    const t = now / 1000
    ctx.fillStyle = '#16161c'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    shown().forEach((v, row) => {
      load(v)
      const s = sprites.get(keyOf(v))
      ctx.fillStyle = '#c8c8d0'
      ctx.fillText(nameOf(v), 6, row * CELL_H * k + 14)
      if (!s) return
      DIRS.forEach((dir, col) => {
        const cx = 120 + col * CELL_W * k
        const cy = row * CELL_H * k
        drawCell(ctx, s, { [WEARABLES[item].slot]: item }, anim, dir, t, cx, cy, k, t)
        if (picked?.variant === v && picked.dir === dir) {
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
    if (s && col >= 0 && col < 8) picked = { variant: s, dir: col as Dir8 }
    status()
  })
  const ids = WEARABLE_IDS
  const onKey = (e: KeyboardEvent) => {
    const slot = WEARABLES[item].slot
    if (e.key === 'r' && picked) {
      const { variant, dir } = picked
      gallery?.close()
      void import('./rigTool').then((m) => m.openRig(keyOf(variant), { dir, item }))
    } else if (e.key === 'x' && picked) toggleNo(fitKeyOf(picked.variant), slot)
    else if (e.key === 'n' && picked) toggleNo(fitKeyOf(picked.variant), item)
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
 * `ps.wear('topHat')` puts an item on the running game's local player (a run, a match)
 * (`ps.wear('topHat', 3)` on seat 3), `ps.wear('look', { head: 'crown', back:
 * 'cape' })` a whole look, `ps.wear('bots')` a random look on every seat,
 * `ps.wear('off')` takes the local player's off; `ps.wear('fit', 'topHat')`
 * opens the fitting gallery (`openGallery`; a list of dex numbers or
 * `'<dex>[:<form>][s]'` after the item fits only those: `[4, '6:megaX']`),
 * `ps.wear('table')` prints `WEAR_FITS` as edited and `ps.wear('sheet', look,
 * dexes, opts?)` resolves a contact sheet's PNG data URL (`ps.wear('catalog',
 * dex, dir, scale?)`: every item on one species, bare first).
 */
export const devWear = async (shell: WearShell, cmd?: string, arg?: unknown, more?: unknown, extra?: unknown) => {
  const seat = typeof arg === 'number' ? arg : shell.seat()
  if (cmd === 'fit') return openGallery(isWearableId(arg) ? arg : 'topHat', Array.isArray(more) ? more : undefined)
  if (cmd === 'table') return fitsSource()
  if (cmd === 'catalog') return catalogSheet(parseVariant(arg) ?? { dex: 4, shiny: false }, (typeof more === 'number' ? more : 1) as Dir8, typeof extra === 'number' ? extra : 3)
  if (cmd === 'sheet') return contactSheet((arg ?? {}) as Look, Array.isArray(more) ? more : [4, 7, 1, 255, 393, 9], (extra ?? {}) as Parameters<typeof contactSheet>[2])
  if (cmd === 'bots') {
    const n = shell.seats()
    setLooks(Array.from({ length: n }, (_, i) => (i === shell.seat() ? lookOf(i) : randomLook())))
    return Array.from({ length: n }, (_, i) => lookOf(i))
  }
  if (seat === null) return "ps.wear: start a run or a match first (ps.startRun('charmander'), ps.versus())"
  if (cmd === 'off') return setSeat(shell, seat, {}), {}
  if (cmd === 'look' && typeof arg === 'object' && arg) return setSeat(shell, shell.seat() ?? 0, arg as Look), lookOf(shell.seat() ?? 0)
  if (isWearableId(cmd)) {
    const look = { ...lookOf(seat), [WEARABLES[cmd].slot]: cmd }
    setSeat(shell, seat, look)
    return look
  }
  const bySlot = Object.fromEntries((['head', 'face', 'neck', 'back'] as const).map((slot) => [slot, WEARABLE_IDS.filter((id) => WEARABLES[id].slot === slot)]))
  return { usage: "ps.wear(id, seat?) · ('look', look) · ('bots') · ('off') · ('fit', id, dexes?) · ('table') · ('sheet', look, dexes, opts?)", ...bySlot }
}
