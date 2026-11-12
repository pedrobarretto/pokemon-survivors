import { blitCentered, blitEllipse, blitRing, fromStrings, lazy, type PixelSprite } from '../engine/pixelart'
import { dir8, TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import type { RoamerId, SwordId } from '../data/legends'
import { DUEL } from '../data/quests'
import { duelTest } from '../game/duels'
import { roamerBody, roamerShown } from '../game/roamers'
import type { Game } from '../game/types'
import { drawEdgeMarker } from './mapEvents'
import { toIconUrl } from './art'
import { drawPokemon, sprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * The open map's legends on screen (`game/quests.ts`): a Sword waiting behind
 * its golden circle (filling as the player stands in it), the duel's ring with
 * its test's clock and the speed test's leaf marks, a roaming lake legend's
 * halo and gem over it, its mood (Mesprit's hearts
 * and tears, Azelf's will, the gold dust Uxie leaves as it blinks), and the
 * edge arrows that point at them.
 */

const GOLD = '#f8d048'
const PALE = '#fff4c0'

/** The speed test's leaf mark: 1 outline, 2 dark green, 3 green, 4 its veins' light, 5 the stem. */
const LEAF_ROWS = [
  '......1......',
  '.....131.....',
  '....12321....',
  '...1233321...',
  '..123343321..',
  '..123343321..',
  '.12334343321.',
  '.12343434321.',
  '1233334333321',
  '1234334334321',
  '.12333433321.',
  '..122343221..',
  '...1124211...',
  '......1......',
  '.....151.....',
  '.....151.....',
  '......1......',
]
const LEAF = lazy(() => fromStrings(LEAF_ROWS, { 1: '#143c10', 2: '#2c7020', 3: '#58b840', 4: '#c8f088', 5: '#7a5a28' }))

/** The edge arrow's icons: a lake legend's gem, a Sword's blade. */
const GEM = ['..kkk..', '.kwwck.', 'kwwccck', 'kwcccdk', 'kcccddk', '.kcddk.', '..kkk..']
/** Each roamer's gem color (a lake legend's, the one on its head; a Force's, its weather's), and its shade. */
export const LAKE_GEM = {
  uxie: ['#f8d048', '#c09018'], mesprit: ['#f878b0', '#c04880'], azelf: ['#58a0f8', '#2860c0'],
  tornadus: ['#98e0f0', '#3c8aa8'], thundurus: ['#f8e048', '#4868c0'], landorus: ['#f0b050', '#a06020'], enamorus: ['#f8a0c8', '#c05890'],
} as const satisfies Record<RoamerId, readonly [string, string]>
/** A Force's mark instead of a gem: a swirl (wind), a bolt, a sand dune, a heart, in its colors. */
const FORCE_MARK = {
  tornadus: ['..ccc..', '.c...c.', 'c..cc.c', 'c.c..dc', 'c.cdd.c', '.c...d.', '..ddd..'],
  thundurus: ['...cc..', '..cc...', '.cccc..', '...cc..', '..cc...', '.dd....', 'd......'],
  landorus: ['.......', '...c...', '..ccc..', '.ccccc.', 'cccdccc', 'ddddddd', '.......'],
  enamorus: ['.cc.cc.', 'cwcccdc', 'cccccdc', '.ccccd.', '..ccd..', '...d...', '.......'],
} as const
const GEMS = lazy((): Record<RoamerId, PixelSprite> => ({
  uxie: fromStrings(GEM, { c: LAKE_GEM.uxie[0], d: LAKE_GEM.uxie[1], w: '#ffffff', k: '#181020' }),
  mesprit: fromStrings(GEM, { c: LAKE_GEM.mesprit[0], d: LAKE_GEM.mesprit[1], w: '#ffffff', k: '#181020' }),
  azelf: fromStrings(GEM, { c: LAKE_GEM.azelf[0], d: LAKE_GEM.azelf[1], w: '#ffffff', k: '#181020' }),
  tornadus: fromStrings(FORCE_MARK.tornadus, { c: LAKE_GEM.tornadus[0], d: LAKE_GEM.tornadus[1], w: '#ffffff' }),
  thundurus: fromStrings(FORCE_MARK.thundurus, { c: LAKE_GEM.thundurus[0], d: LAKE_GEM.thundurus[1], w: '#ffffff' }),
  landorus: fromStrings(FORCE_MARK.landorus, { c: LAKE_GEM.landorus[0], d: LAKE_GEM.landorus[1], w: '#ffffff' }),
  enamorus: fromStrings(FORCE_MARK.enamorus, { c: LAKE_GEM.enamorus[0], d: LAKE_GEM.enamorus[1], w: '#ffffff' }),
}))
const BLADE = lazy(() => fromStrings(['.....w', '....w.', '...w..', 'y.w...', '.y....', 'y.y...'], { w: '#f0f4ff', y: GOLD }))

/** A sword for the duel card: 1 outline, 2 blade, 3 its edge's light, 4 the guard and grip in the Sword's color, 5 their shade. */
const SWORD_ICON = [
  '.........111',
  '........1231',
  '.......12321',
  '......12321.',
  '.....12321..',
  '.1..12321...',
  '141.1321....',
  '.14111.1....',
  '..1451......',
  '.14551......',
  '141.11......',
  '.1..........',
]
const SWORD_GRIP = { cobalion: ['#78a8f0', '#3060a8'], terrakion: ['#f0a050', '#a05018'], virizion: ['#80d868', '#2a8a34'] } as const satisfies Record<SwordId, readonly [string, string]>

/** The duel card's icons (`ui/quests.ts`): a sword with the Sword's colors on its guard, and a leaf mark stepped on (`lit`) or still waiting. */
export const swordIcon = (sword: SwordId) =>
  toIconUrl(`duel-${sword}`, () => fromStrings(SWORD_ICON, { 1: '#101018', 2: '#d8e0f0', 3: '#ffffff', 4: SWORD_GRIP[sword][0], 5: SWORD_GRIP[sword][1] }))
export const leafIcon = (lit: boolean) =>
  toIconUrl(lit ? 'duel-leaf' : 'duel-leaf-off', () => (lit ? LEAF() : fromStrings(LEAF_ROWS, { 1: '#3a3a30', 2: '#6a6a58', 3: '#8a8a74', 4: '#a8a890', 5: '#5a5a48' })))

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

/** Each Sword's color on the ground (the duel card's, `ui/quests.ts`): its clock's lit arc and its spent part. */
const SWORD_LOOK = {
  cobalion: { lit: '#78a8f0', dim: '#28406c' },
  terrakion: { lit: '#f0a050', dim: '#6c3818' },
  virizion: { lit: '#70d060', dim: '#1c5420' },
} as const satisfies Record<SwordId, { lit: string; dim: string }>

/**
 * The duel's ring: a golden line with a lit band inside it, blades of light
 * standing round it, turning slowly, and the test's clock on it: an arc in the
 * Sword's color that drains clockwise from the north as time runs (`left` of
 * `time` s), twelve hour marks, and for Terrakion's power test a hand
 * sweeping round from the middle.
 */
const drawRing = (ctx: Ctx, x: number, y: number, t: number, sword: SwordId, left: number, time: number) => {
  const r = DUEL.ring
  const look = SWORD_LOOK[sword]
  ctx.globalAlpha = 0.35
  blitRing(ctx, r - 3, 3, '#f8e098', x, y)
  ctx.globalAlpha = 1
  blitRing(ctx, r + 2, 1, '#5a3c08', x, y)
  blitRing(ctx, r, 2, GOLD, x, y)
  // The clock: lit while time is left, dim where it's spent.
  const share = Math.max(0, Math.min(1, left / time))
  const steps = 180
  for (let i = 0; i < steps; i++) {
    const q = i / steps
    const a = -Math.PI / 2 + q * TAU
    ctx.fillStyle = q >= 1 - share ? look.lit : look.dim
    ctx.fillRect(Math.round(x + Math.cos(a) * (r - 5)) - 1, Math.round(y + Math.sin(a) * (r - 5)) - 1, 2, 2)
  }
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * TAU
    const big = i % 3 === 0
    ctx.fillStyle = big ? '#fff4c0' : '#c8a040'
    for (let k = 8; k <= (big ? 13 : 11); k++) ctx.fillRect(Math.round(x + Math.cos(a) * (r - k)), Math.round(y + Math.sin(a) * (r - k)), 1, 1)
  }
  if (duelTest(sword).kind === 'power') {
    // The hand points at where the lit arc ends, from a hub in the middle.
    const a = -Math.PI / 2 + (1 - share) * TAU
    for (let k = 6; k < r - 10; k += 3) {
      ctx.fillStyle = k % 6 === 0 ? look.lit : '#fff4c0'
      ctx.fillRect(Math.round(x + Math.cos(a) * k) - 1, Math.round(y + Math.sin(a) * k) - 1, 2, 2)
    }
    blitEllipse(ctx, 4, 4, '#5a3c08', x, y)
    blitEllipse(ctx, 3, 3, look.lit, x, y)
  }
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

/** A leaf mark waiting to be stepped on: a pool of green light, a shaft of it rising, motes drifting up, the leaf bobbing over pulsing rings. */
const drawLeaf = (ctx: Ctx, x: number, y: number, t: number) => {
  const q = (t * 1.4) % 1
  blitEllipse(ctx, 20, 9, 'rgba(120,232,96,0.28)', x, y)
  blitEllipse(ctx, 13, 6, 'rgba(184,248,128,0.45)', x, y)
  for (let i = 0; i < 2; i++) {
    const k = (q + i * 0.5) % 1
    ctx.globalAlpha = 1 - k
    blitRing(ctx, Math.round(8 + k * 16), 1, i ? '#ffffff' : '#a8f070', x, y)
  }
  ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 6)
  ctx.fillStyle = '#a8f070'
  ctx.fillRect(x - 3, y - 56, 6, 52)
  ctx.fillStyle = '#f0fff0'
  ctx.fillRect(x - 1, y - 52, 2, 46)
  ctx.globalAlpha = 1
  for (let i = 0; i < 7; i++) {
    const k = (t * 0.7 + i / 7) % 1
    ctx.globalAlpha = 1 - k
    ctx.fillStyle = i % 2 ? '#e8f8b0' : '#88d858'
    ctx.fillRect(Math.round(x + (hash2(i, 4, 7) - 0.5) * 22), Math.round(y - 4 - k * 40), 1, 2)
  }
  ctx.globalAlpha = 1
  blitEllipse(ctx, 8, 3, 'rgba(16,40,8,0.4)', x, y)
  blitCentered(ctx, LEAF(), x, y - 14 + Math.round(Math.sin(t * 5) * 1.5))
}

/** Ground layer: the roamer's halo, the waiting circle, the duel's ring and its leaf mark. */
export const drawQuestGround = (ctx: Ctx, g: Game, t: number) => {
  const r = g.quests.roam
  const e = roamerBody(g)
  if (r && e && roamerShown(g)) {
    // A halo of its gem's color breathing under it, so it reads in a crowd.
    const k = (Math.sin(t * 4) + 1) / 2
    const x = Math.round(e.x)
    const y = Math.round(e.y)
    blitEllipse(ctx, Math.round(e.radius * 2 + 6), Math.round(e.radius + 3), 'rgba(255,255,255,0.18)', x, y)
    ctx.globalAlpha = 0.55 + 0.35 * k
    blitRing(ctx, Math.round(e.radius * 1.6 + 5 + k * 2), 1, LAKE_GEM[r.legend][0], x, y)
    ctx.globalAlpha = 1
  }
  const d = g.quests.duel
  if (!d) return
  if (d.stage === 'waiting') drawCircle(ctx, d.x, d.y, d.stand / DUEL.stand, t)
  else if (d.stage === 'dueling') {
    drawRing(ctx, d.x, d.y, t, d.sword, d.left, duelTest(d.sword).time)
    if (d.mark) drawLeaf(ctx, d.mark.x, d.mark.y, t)
  }
}

/** Air layer: the waiting Sword behind its circle, and the roamer's mood over it. */
export const drawQuestAir = (ctx: Ctx, g: Game, t: number) => {
  const d = g.quests.duel
  if (d?.stage === 'waiting') {
    // Asking for them keeps them streaming in (a puff of dust until they land).
    const s = sprites(ENEMIES[d.sword].dex)
    const sx = d.x
    const sy = d.y - 36
    blitEllipse(ctx, Math.max(6, Math.round(s.bodyW * 0.6)), 3, 'rgba(10,8,30,0.4)', sx, sy)
    drawPokemon(ctx, s, 'Idle', dir8(g.player.x - sx, g.player.y - sy), t, sx, sy)
  }
  const r = g.quests.roam
  const e = roamerBody(g)
  if (!r || !e) return
  const top = e.y - e.radius * 2 - 6
  // Its gem, bobbing over it while the player remembers it (`roamerShown`).
  if (roamerShown(g)) blitCentered(ctx, GEMS()[r.legend], Math.round(e.x), Math.round(top - 10 + Math.sin(t * 3) * 1.5))
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
  } else if (r.legend === 'tornadus' || r.legend === 'thundurus' || r.legend === 'landorus' || r.legend === 'enamorus') {
    drawForceAura(ctx, r.legend, e.x, e.y, e.radius, top, t, r.phase, r.broken)
  } else if (r.legend === 'uxie' && g.time < r.hidden) {
    // Gold dust where it blinked to, fading as the player's memory comes back.
    ctx.fillStyle = GOLD
    for (let i = 0; i < 6; i++) {
      if (Math.floor(t * 10 + i) % 2) continue
      ctx.fillRect(Math.round(e.x + (hash2(i, 2, 7) - 0.5) * 24), Math.round(e.y - 10 + (hash2(i, 3, 7) - 0.5) * 20), 1, 1)
    }
  }
}

/**
 * A Force's weather around it, stronger with its phase: Tornadus in a ring of
 * wind and snow, Thundurus under a small storm cloud crackling, Landorus in a
 * swirl of sand (gone once its will breaks), Enamorus with hearts and petals
 * floating up.
 */
const drawForceAura = (ctx: Ctx, legend: 'tornadus' | 'thundurus' | 'landorus' | 'enamorus', x0: number, y0: number, radius: number, top: number, t: number, phase: number, broken: boolean) => {
  const n = 5 + phase * 3
  const x = Math.round(x0)
  const y = Math.round(y0 - radius)
  if (legend === 'tornadus') {
    for (let i = 0; i < n; i++) {
      const q = (i / n) * TAU + t * (3 + phase)
      const rr = radius + 8 + (i % 3) * 3
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#a8e0f0'
      ctx.fillRect(Math.round(x + Math.cos(q) * rr), Math.round(y + Math.sin(q) * rr * 0.5), i % 3 === 0 ? 2 : 1, 1)
    }
  } else if (legend === 'thundurus') {
    const cy = Math.round(top - 4)
    blitEllipse(ctx, 9 + phase, 3, '#383c50', x, cy)
    blitEllipse(ctx, 7 + phase, 2, '#5c6480', x - 1, cy - 1)
    if (Math.floor(t * 7) % 3 === 0) {
      ctx.fillStyle = '#f8e048'
      const bx = x + Math.round((hash2(Math.floor(t * 7), 1, 9) - 0.5) * 12)
      ctx.fillRect(bx, cy + 2, 1, 3)
      ctx.fillRect(bx + 1, cy + 4, 1, 3)
    }
  } else if (legend === 'landorus') {
    if (broken) return
    for (let i = 0; i < n + 2; i++) {
      const q = (i / (n + 2)) * TAU - t * (2 + phase)
      const rr = radius + 6 + ((t * 8 + i * 3) % 6)
      ctx.fillStyle = i % 3 === 0 ? '#f8e0a0' : '#c89848'
      ctx.fillRect(Math.round(x0 + Math.cos(q) * rr), Math.round(y0 - 2 + Math.sin(q) * rr * 0.4), 2, 1)
    }
  } else {
    for (let i = 0; i < n; i++) {
      const q = (t * 0.7 + i / n) % 1
      const hx = Math.round(x0 + (hash2(i, 4, 7) - 0.5) * 26)
      const hy = Math.round(top - q * 18)
      ctx.globalAlpha = 1 - q
      ctx.fillStyle = i % 2 === 0 ? '#f878b0' : '#ffd0e4'
      ctx.fillRect(hx - 1, hy, 1, 1)
      ctx.fillRect(hx + 1, hy, 1, 1)
      ctx.fillRect(hx - 1, hy + 1, 3, 1)
      ctx.fillRect(hx, hy + 2, 1, 1)
    }
    ctx.globalAlpha = 1
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
