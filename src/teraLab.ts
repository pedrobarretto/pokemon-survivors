import { TERA_TYPES, type TeraType } from './data/tera'
import type { Dir8 } from './engine/math'
import { context2d, createCanvas } from './engine/pixelart'
import { crownSprite, crystalOf, drawGlint, drawTwinkles, TERA_RAMPS } from './render/teraArt'
import { drawCrystalPokemon } from './render/teraFx'
import { loadSpecies, type SpeciesSprites } from './render/sprites'
import type { CrownSize } from './render/teraCrowns'
import { headSeat, loadWearables } from './render/wearables'

/**
 * Dev: Terastal's gallery (`ps.tera('lab')`), for eyeballing the art and the
 * PR's pictures; never in a build's player paths. `mode: 'crowns'` lays the
 * 19 crowns out as one sheet (both cuts), `'worn'` puts them on Pokémon (`cut` forces a size) (crystal, crowned
 * on the head rig) in five directions and a few walking frames, and the
 * default shows the crowns over a few Pokémon in crystal next to their own colors.
 */

const SPECIES = [448, 25, 6, 445, 282, 1024] as const

const SHOWN: readonly TeraType[] = ['water', 'fire', 'grass', 'dragon', 'fairy', 'stellar']

type LabOpts = { scale?: number; species?: readonly number[]; types?: readonly TeraType[]; glint?: number; dpr?: number; mode?: 'crowns' | 'worn'; cut?: CrownSize }

/** Puts a pixel canvas on the page at `k` times, over everything; a click takes it off. */
const show = (canvas: HTMLCanvasElement, k: number, dpr?: number) => {
  const big = createCanvas(canvas.width * k, canvas.height * k)
  const b = context2d(big)
  b.imageSmoothingEnabled = false
  b.drawImage(canvas, 0, 0, big.width, big.height)
  big.id = 'tera-lab'
  Object.assign(big.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999', imageRendering: 'pixelated', width: `${big.width / (dpr ?? devicePixelRatio)}px` })
  big.addEventListener('click', () => big.remove())
  document.body.append(big)
  return { w: canvas.width, h: canvas.height }
}

/** The 19 crowns in a grid, each on a tile in its type's dark: the full cut above, the small one (`SMALL_CROWNS`) under it. */
const crownSheet = (k: number, dpr?: number) => {
  const cols = 7
  const cw = 30
  const ch = 46
  const canvas = createCanvas(cols * cw + 4, Math.ceil(TERA_TYPES.length / cols) * ch + 4)
  const ctx = context2d(canvas)
  ctx.fillStyle = '#141024'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  TERA_TYPES.forEach((t, i) => {
    const x = 2 + (i % cols) * cw
    const y = 2 + Math.floor(i / cols) * ch
    ctx.fillStyle = TERA_RAMPS[t].o
    ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2)
    const c = crownSprite(t)
    ctx.drawImage(c, x + Math.floor((cw - c.width) / 2), y + 24 - c.height)
    const small = crownSprite(t, 'small')
    ctx.drawImage(small, x + Math.floor((cw - small.width) / 2), y + ch - 4 - small.height)
    ctx.fillStyle = TERA_RAMPS[t][3]
    ctx.fillRect(x + 4, y + 26, cw - 8, 1)
  })
  return show(canvas, k, dpr)
}

/** Waits (up to ~4 s) for the wearables' engine and each species' rig chunk, so the crowns sit on their heads. */
const rigsReady = async (sprites: readonly SpeciesSprites[]) => {
  await loadWearables()
  for (let i = 0; i < 40; i++) {
    if (sprites.every((s) => headSeat(s, 'Walk', 0, 0) !== null)) return
    await new Promise((r) => setTimeout(r, 100))
  }
}

/** Pokémon in crystal under their crowns, seated on the head rig: five directions, then the walk's frames facing south-east. */
const wornSheet = async (species: readonly number[], types: readonly TeraType[], k: number, dpr?: number, cut?: CrownSize) => {
  const loaded = (await Promise.all(species.map((dex) => loadSpecies(dex, false, undefined, 'now').catch(() => null)))).filter((s): s is SpeciesSprites => s !== null)
  await rigsReady(loaded)
  const cell = 52
  const dirs: Dir8[] = [0, 1, 2, 3, 4]
  const steps = 4
  const canvas = createCanvas((dirs.length + steps) * cell + 6, loaded.length * cell + 4)
  const ctx = context2d(canvas)
  ctx.fillStyle = '#3c6c34'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#2c5428'
  ctx.fillRect(dirs.length * cell + 2, 0, 2, canvas.height)
  loaded.forEach((s, row) => {
    const type = types[row % types.length]!
    const feet = 2 + row * cell + cell - 8
    dirs.forEach((dir, i) => drawCrystalPokemon(ctx, s, type, 'Walk', dir, 0, 2 + i * cell + cell / 2, feet, {}, 1, true, cut))
    const walk = s.anims.Walk
    const total = walk.durations.reduce((a, b) => a + b, 0) / 60
    for (let f = 0; f < steps; f++) drawCrystalPokemon(ctx, s, type, 'Walk', 1, (total * f) / steps + 0.001, 6 + (dirs.length + f) * cell + cell / 2, feet, {}, 1, true, cut)
  })
  return show(canvas, k, dpr)
}

export const openTeraLab = async (opts: LabOpts = {}) => {
  document.getElementById('tera-lab')?.remove()
  const k = opts.scale ?? 4
  const species = opts.species ?? SPECIES
  const types = opts.types ?? SHOWN
  if (opts.mode === 'crowns') return crownSheet(k, opts.dpr)
  if (opts.mode === 'worn') return wornSheet(species, types, k, opts.dpr, opts.cut)
  const loaded = await Promise.all(species.map((dex) => loadSpecies(dex, false, undefined, 'now').catch(() => null)))
  const crownW = 24
  const perRow = 10
  const crownH = 22
  const top = crownH * 2 + 6
  const cell = 48
  const w = Math.max(perRow * crownW, (types.length + 1) * cell) + 8
  const h = top + species.length * cell + 8
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  ctx.fillStyle = '#1c2030'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#3c6c34'
  ctx.fillRect(0, top, w, h - top)
  TERA_TYPES.forEach((t, i) => {
    const c = crownSprite(t)
    const col = i % perRow
    const row = Math.floor(i / perRow)
    ctx.drawImage(c, 4 + col * crownW + Math.floor((crownW - c.width) / 2), 3 + row * crownH + Math.floor((crownH - c.height) / 2))
  })
  loaded.forEach((s, row) => {
    if (!s) return
    const sheet = s.anims.Idle
    const y = top + row * cell
    ctx.drawImage(sheet.img, 0, 0, sheet.fw, sheet.fh, 4 + Math.floor((cell - sheet.fw) / 2), y + Math.floor((cell - sheet.fh) / 2), sheet.fw, sheet.fh)
    types.forEach((t, i) => {
      const f = crystalOf(sheet, 0, 0, t)
      if (!f) return
      const x = 4 + (i + 1) * cell + Math.floor((cell - sheet.fw) / 2)
      const fy = y + Math.floor((cell - sheet.fh) / 2)
      ctx.drawImage(f.canvas, x, fy)
      if (opts.glint !== undefined) drawGlint(ctx, f, x, fy, 1, opts.glint)
      drawTwinkles(ctx, f, x, fy, 1, 0.4 + i)
    })
  })
  return show(canvas, k, opts.dpr)
}
