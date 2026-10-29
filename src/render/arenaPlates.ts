import { effectIn, type PlateEmblem, type PlateStyle } from '../data/arenaEffects'
import { canvasCache, fromStrings } from '../engine/pixelart'
import { lookOf } from './arenaLooks'

/**
 * The Arena's name plates (`plate` in `data/arenaEffects.ts`): the box behind
 * a Pokémon's name tag (`render/team.ts`) and the frame of its HP bar
 * (`render/draw.ts`), in the plate's colors, with its emblem left of them.
 * The text keeps its team's color, so a plate never hides whose side it's on.
 */

type Ctx = CanvasRenderingContext2D

/** The emblems, 5×5: `1` and `2` the plate's inks, `3` its light, `0` near black. */
const EMBLEMS: Record<PlateEmblem, readonly string[]> = {
  bolt: ['...12', '..12.', '.1222', '..21.', '.21..'],
  leaf: ['...11', '.1121', '12221', '1221.', '1....'],
  drop: ['..1..', '.121.', '.121.', '12221', '.111.'],
  flame: ['..1..', '.121.', '1121.', '12221', '.111.'],
  star: ['..1..', '..1..', '11211', '.111.', '.1.1.'],
  master: ['.111.', '13131', '00200', '22222', '.222.'],
}

const emblems = canvasCache<string, HTMLCanvasElement>()

const emblemOf = (style: PlateStyle) => {
  const key = `${style.emblem}:${style.ink[0]}:${style.ink[1]}`
  let made = emblems.get(key)
  if (!made) emblems.set(key, (made = fromStrings(EMBLEMS[style.emblem], { 1: style.ink[0], 2: style.ink[1], 3: style.light, 0: '#181818' })))
  return made
}

/** The plate `slot`'s look wears, or null. */
export const plateOf = (slot: number): PlateStyle | null => effectIn('plate', lookOf(slot).plate)?.plate ?? null

/** Room a plate's emblem takes left of the name (px). */
export const PLATE_EMBLEM_W = 7

/** A legendary plate's light runs around its border (`master`): the border px lit at `t`. */
const shimmer = (style: PlateStyle, t: number, around: number) => (style.emblem === 'master' ? Math.floor(t * 40) % around : -1)

/**
 * The box behind a name tag `w`×7 centered at (x, y), the emblem on its left:
 * fill, a 1 px border with its corners cut, the light along its top. Returns
 * where the tag's middle goes now (right of the emblem).
 */
export const drawPlateTag = (ctx: Ctx, style: PlateStyle, x: number, y: number, w: number, t: number) => {
  const width = w + PLATE_EMBLEM_W + 3
  const x0 = Math.round(x - width / 2)
  const y0 = Math.round(y - 5)
  const h = 10
  ctx.fillStyle = style.edge
  ctx.fillRect(x0 + 1, y0, width - 2, h)
  ctx.fillRect(x0, y0 + 1, width, h - 2)
  ctx.fillStyle = style.fill
  ctx.fillRect(x0 + 1, y0 + 1, width - 2, h - 2)
  ctx.fillStyle = style.light
  ctx.fillRect(x0 + 2, y0 + 1, width - 4, 1)
  const lit = shimmer(style, t, width)
  if (lit >= 0) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x0 + lit, y0, 2, 1)
    ctx.fillRect(x0 + width - 1 - lit, y0 + h - 1, 2, 1)
  }
  ctx.drawImage(emblemOf(style), x0 + 2, y0 + 3)
  return x0 + PLATE_EMBLEM_W + 1 + w / 2
}

/**
 * The frame of an HP bar `w` px long at (x, y) (its 2 px fill's top left),
 * in the plate's colors, with the emblem on its left. The caller fills the
 * bar over it.
 */
export const drawPlateBar = (ctx: Ctx, style: PlateStyle, x: number, y: number, w: number, t: number) => {
  ctx.fillStyle = style.edge
  ctx.fillRect(x - 1, y - 1, w + 2, 4)
  ctx.fillStyle = style.fill
  ctx.fillRect(x, y, w, 2)
  const lit = shimmer(style, t, w + 2)
  if (lit >= 0) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 1 + lit, y - 1, 1, 1)
  }
  ctx.drawImage(emblemOf(style), x - 7, y - 2)
}
