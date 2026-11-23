import { fromStrings, lazy } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TV_FIND } from '../data/seasonOneUnlocks'
import { roomOf } from '../game/room'
import { tvOf } from '../game/seasonOneFinds'
import { featuresNear } from '../game/terrain'
import type { Game } from '../game/types'

/**
 * The old TV on every cottage's table (`game/seasonOneFinds.ts`): dark, but
 * for the run it flickers in, its screen full of static, a bar filling while
 * the player stands there. In co-op a cottage is scenery, so it stays dark.
 */

type Ctx = CanvasRenderingContext2D

const TV_W = 13
const TV_H = 11
/** How far above the table's foot the TV sits. */
const ON_TABLE = 6

/** The set, with the screen's pixels left as `0`. */
const SET = ['...1...1.....', '....1.1......', '.....1.......', '2222222222222', '2000000000232', '2000000000242', '2000000000232', '2000000000242', '2000000000232', '2222222222222', '.22.......22.']

const PALETTE = { 1: '#585048', 2: '#5a3c24', 3: '#a87c50', 4: '#302018' }

/** The set with its screen painted by `pixel`. */
const painted = (pixel: (x: number, y: number) => 'a' | 'b' | 'c') =>
  fromStrings(SET.map((row, y) => row.replace(/0/g, (_, x: number) => pixel(x, y))), { ...PALETTE, a: '#283038', b: '#a8b8c8', c: '#f0f8ff' })

const DARK = lazy(() => painted(() => 'a'))

const STATIC = lazy(() =>
  [0, 1, 2].map((frame) =>
    painted((x, y) => {
      const n = hash2(x, y, frame + 5)
      return n < 0.4 ? 'a' : n < 0.8 ? 'b' : 'c'
    }),
  ),
)

/** Draws each cottage's TV in view, flickering in the run it holds Rotom. */
export const drawOldTvs = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  if (roomOf(g)) return
  const p = g.player
  const flickers = g.finds.tv && g.coop === null
  for (const f of featuresNear(g, p.x, p.y, g.view.w / 2 + 60, g.view.h / 2 + 60)) {
    const tv = tvOf(f)
    if (!tv || !visible(tv.x, tv.y, 30)) continue
    const x = Math.round(tv.x - TV_W / 2)
    const y = Math.round(tv.y - ON_TABLE - TV_H)
    ctx.drawImage(flickers ? STATIC()[Math.floor(t * 14) % 3]! : DARK(), x, y)
    const stood = g.finds.stood
    if (!flickers || stood === null || stood.cell !== f.landmark?.cell) continue
    ctx.fillStyle = '#282028'
    ctx.fillRect(x, y - 5, TV_W, 3)
    ctx.fillStyle = '#f8e858'
    ctx.fillRect(x + 1, y - 4, Math.round((TV_W - 2) * Math.min(1, stood.t / TV_FIND.stand)), 1)
  }
}
