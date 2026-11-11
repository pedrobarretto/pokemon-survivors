import { TERA_TYPES, type TeraType } from './data/tera'
import { context2d, createCanvas } from './engine/pixelart'
import { crownSprite, crystalOf, drawGlint, drawTwinkles, TERA_RAMPS } from './render/teraArt'
import { loadSpecies } from './render/sprites'

/**
 * Dev: Terastal's gallery (`ps.tera('lab')`), every crown side by side and a
 * few Pokémon in crystal next to their own colors, at whole-number scales on a
 * dark and a grass background. For eyeballing the art and the PR's pictures;
 * never in a build's player paths.
 */

const SPECIES = [448, 25, 6, 445, 282, 1024] as const

const SHOWN: readonly TeraType[] = ['water', 'fire', 'grass', 'dragon', 'fairy', 'stellar']

export const openTeraLab = async (opts: { scale?: number; species?: readonly number[]; types?: readonly TeraType[]; glint?: number; dpr?: number } = {}) => {
  document.getElementById('tera-lab')?.remove()
  const k = opts.scale ?? 4
  const species = opts.species ?? SPECIES
  const types = opts.types ?? SHOWN
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
      const c = crownSprite(t)
      ctx.drawImage(c, x + Math.floor((sheet.fw - c.width) / 2), fy + f.top - c.height - 1)
    })
  })
  const big = createCanvas(w * k, h * k)
  const b = context2d(big)
  b.drawImage(canvas, 0, 0, w * k, h * k)
  big.id = 'tera-lab'
  Object.assign(big.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999', imageRendering: 'pixelated', width: `${w * k / (opts.dpr ?? devicePixelRatio)}px` })
  big.addEventListener('click', () => big.remove())
  document.body.append(big)
  return { w, h, ramps: Object.keys(TERA_RAMPS).length }
}
