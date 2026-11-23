import { blitCentered, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import type { StatDelta } from '../game/stats'
import { innateAbility, innateEffects } from '../game/legend'
import type { Game, Player } from '../game/types'
import { art } from './art'
import { band, px, type Ctx } from './legendaryFx'

/**
 * Beast Boost on screen (the Ultra Beasts' innate, `data/legends.ts`): each
 * stack it gains plays a short burst on the beast, as in the games: an aura
 * ring in the color of the stat it raises and arrows rising off it; the last
 * stack (the cap) a bigger one with Ultra Space's prism sparks. Read from each
 * player's own stacks as they're drawn, so a teammate's beast shows it too and
 * nothing goes through the simulation. Losing stacks plays nothing; the HUD's
 * ability chip counts them.
 */

/** How long a stack's burst plays, and the cap's, in seconds of the drawing clock. */
const BURST = 0.8
const CAP_BURST = 1.2

/** The stat-up colors: Attack red, Defense gold, Speed sky blue, HP green (an unknown stat in Ultra violet). */
const statColor = (stats: StatDelta) =>
  stats.might ? '#f86040' : stats.armor ? '#f8b830' : stats.speed ? '#48c8f8' : stats.maxHp ? '#58e078' : '#b878f8'

const PRISM = ['#f8a0d0', '#f8e098', '#a8f0c8', '#98d8f8', '#c8a8f8'] as const

/** The rising arrow, by color: `1` its edge, `2` its body, `3` its light. */
const arrows = new Map<string, PixelSprite>()
const arrowArt = (color: string) => {
  let a = arrows.get(color)
  if (!a) arrows.set(color, (a = art(['...1...', '..131..', '.12321.', '1222221', '..121..', '..131..', '..121..', '..111..'], { 1: color, 2: color, 3: '#ffffff' }, '#181020')))
  return a
}

/** What each beast's Beast Boost raises: its color, null for a Pokémon without it. */
const boostOf = (p: Player) => {
  if (innateAbility(p.starter) !== 'beastBoost') return null
  const e = innateEffects(p.starter).find((x) => x.kind === 'onKill')
  return e?.kind === 'onKill' ? { color: statColor(e.stats), max: e.max } : null
}

/** Each player's stacks as last drawn, and when its last burst began. */
const seen = new WeakMap<Player, { stacks: number; at: number; cap: boolean }>()

/** Over a beast (`drawPlayerAir`, `g` that player's copy of the game), `top` its head's height: the burst of a stack it just gained. */
export const drawBeastBoost = (ctx: Ctx, g: Game, t: number, top: number) => {
  const p = g.player
  const boost = boostOf(p)
  if (!boost) return
  const stacks = Math.floor(p.ability.stacks)
  const last = seen.get(p)
  // First sight (a run starting, a co-op snapshot swapping the player in) only takes the count.
  if (!last) return void seen.set(p, { stacks, at: -Infinity, cap: false })
  if (stacks > last.stacks) Object.assign(last, { at: t, cap: stacks >= boost.max })
  last.stacks = stacks
  const age = t - last.at
  const span = last.cap ? CAP_BURST : BURST
  if (age < 0 || age >= span) return
  const k = age / span
  const mid = Math.round((p.y + top) / 2)
  // The aura: a ring bursting out of the body, a second close behind it at the cap.
  ctx.globalAlpha = 1 - k
  band(ctx, p.x, mid, p.radius + 4 + k * 18, 2, boost.color, 0.7)
  if (last.cap) band(ctx, p.x, mid, p.radius + 2 + k * 30, 1, '#ffffff', 0.7)
  // Light streaks rising up the body.
  for (let i = 0; i < 6; i++) {
    const x = p.x + ((i / 5) * 2 - 1) * (p.radius + 3)
    const rise = ((k * 1.6 + i * 0.27) % 1) * (p.y - top + 6)
    px(ctx, x, p.y - rise, i % 2 ? '#ffffff' : boost.color, 1, 3)
  }
  ctx.globalAlpha = 1
  // The stat-up arrows: three rising off it one after the other, fading as they clear its head.
  const arrow = arrowArt(boost.color)
  for (let i = 0; i < 3; i++) {
    const a = (age - i * 0.1) / (span * 0.75)
    if (a < 0 || a >= 1) continue
    ctx.globalAlpha = a < 0.6 ? 1 : 1 - (a - 0.6) / 0.4
    blitCentered(ctx, arrow, p.x + (i - 1) * 10, Math.round(p.y - 4 - a * (p.y - top + 14)))
  }
  // The cap: Ultra Space's prism sparks thrown all round.
  if (last.cap) {
    ctx.globalAlpha = 1 - k
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU + 0.3
      px(ctx, p.x + Math.cos(ang) * (8 + k * 28) - 1, mid + Math.sin(ang) * (8 + k * 20) - 1, PRISM[i % PRISM.length]!, 2, 2)
    }
  }
  ctx.globalAlpha = 1
}
