import { blitCentered, blitEllipse, blitRing, fromStrings, lazy, type PixelSprite } from '../engine/pixelart'
import { dir8, TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import type { LakeId } from '../data/legends'
import { DUEL } from '../data/quests'
import { roamerBody, roamerShown } from '../game/roamers'
import type { Game } from '../game/types'
import { drawEdgeMarker } from './mapEvents'
import { drawPokemon, loadedSprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * The open map's legends on screen (`game/quests.ts`): a Sword waiting behind
 * its golden circle (filling as the player stands in it), the duel's ring and
 * the speed test's leaf marks, a roaming lake legend's mood (Mesprit's hearts
 * and tears, Azelf's will, the gold dust Uxie leaves as it blinks), and the
 * edge arrows that point at them.
 */

const GOLD = '#f8d048'
const PALE = '#fff4c0'

/** The speed test's leaf mark: 1 dark green, 2 green, 3 light, 4 vein. */
const LEAF = lazy(() =>
  fromStrings(
    ['....111....', '...12221...', '..1223321..', '.122343221.', '12234443221', '.122343221.', '..1223321..', '...12221...', '....111....', '.....1.....'],
    { 1: '#205818', 2: '#48a838', 3: '#88d858', 4: '#e8f8b0' },
  ),
)

/** The edge arrow's icons: a lake legend's gem, a Sword's blade. */
const GEM = ['.ccc.', 'cwwcc', 'cwccc', 'ccccc', '.ccc.']
const GEMS = lazy((): Record<LakeId, PixelSprite> => ({
  uxie: fromStrings(GEM, { c: '#f8d048', w: '#ffffff' }),
  mesprit: fromStrings(GEM, { c: '#f878b0', w: '#ffffff' }),
  azelf: fromStrings(GEM, { c: '#58a0f8', w: '#ffffff' }),
}))
const BLADE = lazy(() => fromStrings(['.....w', '....w.', '...w..', 'y.w...', '.y....', 'y.y...'], { w: '#f0f4ff', y: GOLD }))

/** The waiting Sword's circle: a golden ring breathing on the ground, filling clockwise as the player stands in it. */
const drawCircle = (ctx: Ctx, x: number, y: number, fill: number, t: number) => {
  const r = DUEL.circle
  blitEllipse(ctx, r, r, 'rgba(248,208,72,0.16)', x, y)
  blitRing(ctx, r + 1, 1, '#6a4808', x, y)
  blitRing(ctx, r, 1, Math.floor(t * 3) % 2 ? GOLD : '#d8a828', x, y)
  for (let i = 0; i < 64; i++) {
    if (i / 64 >= fill) break
    const a = (i / 64) * TAU - Math.PI / 2
    ctx.fillStyle = PALE
    ctx.fillRect(Math.round(x + Math.cos(a) * (r - 2)) - 1, Math.round(y + Math.sin(a) * (r - 2)) - 1, 2, 2)
  }
  blitCentered(ctx, BLADE(), x, y - 1 + Math.round(Math.sin(t * 4) * 1))
}

/** The duel's ring: a golden line with a lit band inside it, blades of light standing round it, turning slowly. */
const drawRing = (ctx: Ctx, x: number, y: number, t: number) => {
  const r = DUEL.ring
  ctx.globalAlpha = 0.35
  blitRing(ctx, r - 3, 3, '#f8e098', x, y)
  ctx.globalAlpha = 1
  blitRing(ctx, r + 2, 1, '#5a3c08', x, y)
  blitRing(ctx, r, 2, GOLD, x, y)
  for (let i = 0; i < 90; i++) {
    if ((i + Math.floor(t * 12)) % 9 !== 0) continue
    const a = (i / 90) * TAU + t * 0.15
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y + Math.sin(a) * r) - 1, 2, 2)
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + t * 0.15
    const bx = Math.round(x + Math.cos(a) * r)
    const by = Math.round(y + Math.sin(a) * r)
    blitEllipse(ctx, 4, 2, 'rgba(16,12,8,0.35)', bx, by)
    blitCentered(ctx, BLADE(), bx, by - 6)
  }
}

/** A leaf mark waiting to be stepped on: bobbing over a pulsing ring. */
const drawLeaf = (ctx: Ctx, x: number, y: number, t: number) => {
  const q = (t * 1.6) % 1
  ctx.globalAlpha = 1 - q
  blitRing(ctx, Math.round(6 + q * 10), 1, '#a8f070', x, y)
  ctx.globalAlpha = 1
  blitEllipse(ctx, 7, 3, 'rgba(16,40,8,0.35)', x, y)
  blitCentered(ctx, LEAF(), x, y - 8 + Math.round(Math.sin(t * 5) * 1.5))
}

/** Ground layer: the waiting circle, the duel's ring and its leaf mark. */
export const drawQuestGround = (ctx: Ctx, g: Game, t: number) => {
  const d = g.quests.duel
  if (!d) return
  if (d.stage === 'waiting') drawCircle(ctx, d.x, d.y, d.stand / DUEL.stand, t)
  else if (d.stage === 'dueling') {
    drawRing(ctx, d.x, d.y, t)
    if (d.mark) drawLeaf(ctx, d.mark.x, d.mark.y, t)
  }
}

/** Air layer: the waiting Sword behind its circle, and the roamer's mood over it. */
export const drawQuestAir = (ctx: Ctx, g: Game, t: number) => {
  const d = g.quests.duel
  if (d?.stage === 'waiting') {
    const s = loadedSprites(ENEMIES[d.sword].dex)
    if (s) {
      const sx = d.x
      const sy = d.y - 36
      blitEllipse(ctx, Math.max(6, Math.round(s.bodyW * 0.6)), 3, 'rgba(10,8,30,0.4)', sx, sy)
      drawPokemon(ctx, s, 'Idle', dir8(g.player.x - sx, g.player.y - sy), t, sx, sy)
    }
  }
  const r = g.quests.roam
  const e = roamerBody(g)
  if (!r || !e) return
  const top = e.y - e.radius * 2 - 6
  if (r.legend === 'mesprit') {
    // Joy floats hearts up; sorrow drops tears.
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.8 + i / 4) % 1
      const x = Math.round(e.x + (hash2(i, 1, 7) - 0.5) * 18)
      if (r.mood === 0) {
        const y = Math.round(top - q * 14)
        ctx.globalAlpha = 1 - q
        ctx.fillStyle = '#f878b0'
        ctx.fillRect(x - 1, y, 1, 1)
        ctx.fillRect(x + 1, y, 1, 1)
        ctx.fillRect(x - 1, y + 1, 3, 1)
        ctx.fillRect(x, y + 2, 1, 1)
      } else {
        const y = Math.round(top + 8 + q * 16)
        ctx.globalAlpha = 1 - q
        ctx.fillStyle = '#78a8f8'
        ctx.fillRect(x, y, 1, 2)
        ctx.fillRect(x - 1, y + 1, 3, 1)
      }
    }
    ctx.globalAlpha = 1
  } else if (r.legend === 'azelf' && !r.broken) {
    // Its will: a blue aura breathing around it.
    const k = (Math.sin(t * 5) + 1) / 2
    ctx.globalAlpha = 0.5 + k * 0.4
    blitRing(ctx, Math.round(e.radius + 6 + k * 3), 1, '#58a0f8', Math.round(e.x), Math.round(e.y - e.radius))
    ctx.globalAlpha = 1
  } else if (r.legend === 'uxie' && g.time < r.hidden) {
    // Gold dust where it blinked to, fading as the player's memory comes back.
    ctx.fillStyle = GOLD
    for (let i = 0; i < 6; i++) {
      if (Math.floor(t * 10 + i) % 2) continue
      ctx.fillRect(Math.round(e.x + (hash2(i, 2, 7) - 0.5) * 24), Math.round(e.y - 10 + (hash2(i, 3, 7) - 0.5) * 20), 1, 1)
    }
  }
}

/** Screen layer: an edge arrow at the waiting Sword and at the roamer while the player remembers where it is. */
export const drawQuestMarkers = (ctx: Ctx, g: Game, t: number) => {
  const d = g.quests.duel
  if (d?.stage === 'waiting') drawEdgeMarker(ctx, g, t, d.x, d.y, BLADE(), 4, 7)
  const r = g.quests.roam
  const e = roamerBody(g)
  if (r && e && roamerShown(g)) drawEdgeMarker(ctx, g, t, e.x, e.y, GEMS()[r.legend], 4, 11)
}
