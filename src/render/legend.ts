import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { PLAYABLE } from '../data/hatchlings'
import { playerDex } from '../game/game'
import { legendLook } from '../game/legend'
import type { Game } from '../game/types'
import { STANCE_FORMS } from './specialFx'
import { fitSprites, sprites, type FormKey, type SpeciesSprites } from './sprites'

/**
 * How the Legend mode looks (`game/legend.ts`): a legend wears its form and
 * an aura in its color, is drawn no wider than `LEGEND_BODY` (Lugia's wings
 * would cover a phone's screen) unless that leaves it shorter than
 * `LEGEND_MIN_HEIGHT`, and a boss of its own species is its dark Clone.
 */

type Ctx = CanvasRenderingContext2D

/** The widest body a legend is drawn with, in world px (a Charizard's is 27). */
export const LEGEND_BODY = 48
/**
 * The shortest body a legend is shrunk to, in world px: a wingspan isn't size,
 * so the birds keep their height (Moltres's flames span 79 px over a 36 px body,
 * and fitting that width alone left it the smallest legend).
 */
export const LEGEND_MIN_HEIGHT = 30

/**
 * The acting player's sprites (the shell's own between ticks): a Mega's form,
 * else a legend's (Primal Kyogre, Deoxys's forme), else a stance's
 * (Aegislash's Blade); a legend's fitted to `LEGEND_BODY` and `LEGEND_MIN_HEIGHT`.
 */
export const playerSprites = (g: Game, megaForm?: FormKey): SpeciesSprites => {
  const p = g.player
  const stance = p.special.stance
  const form = megaForm ?? legendLook(g) ?? (stance ? STANCE_FORMS[stance] : undefined)
  const s = sprites(playerDex(g), p.shiny, form)
  return p.legend ? fitSprites(s, LEGEND_BODY, LEGEND_MIN_HEIGHT) : s
}

/** A boss of the player's own species (`isClone`): a dark violet cast and outline. */
export const CLONE_TINT = { color: '#281838', amount: 0.55 } as const
export const CLONE_OUTLINE = '#a050f0'

/**
 * A legend's aura on the ground: a dashed ring in its color turning under its
 * feet, and motes rising off it, more of them with each awakening. `calm`
 * (Flashes: reduced) keeps the ring still and the motes few.
 */
export const drawLegendAura = (ctx: Ctx, g: Game, t: number, calm: boolean) => {
  const p = g.player
  const s = p.legend
  if (!s) return
  const color = PLAYABLE[s.id].color
  const body = playerSprites(g)
  const rx = Math.round(body.bodyW / 2) + 4
  const ry = Math.max(3, Math.round(rx * 0.4))
  const spin = calm ? 0 : t * (1 + s.awakened)
  const dots = 28
  ctx.fillStyle = color
  for (let i = 0; i < dots; i++) {
    if ((i + Math.floor(spin * 4)) % 4 === 0) continue
    const a = (i / dots) * TAU + spin
    ctx.fillRect(Math.round(p.x + Math.cos(a) * rx), Math.round(p.y + 1 + Math.sin(a) * ry), 1, 1)
  }
  // The second awakening adds an outer white ring.
  if (s.awakened >= 2) {
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < dots; i += 2) {
      const a = (i / dots) * TAU - spin * 0.6
      ctx.fillRect(Math.round(p.x + Math.cos(a) * (rx + 4)), Math.round(p.y + 1 + Math.sin(a) * (ry + 2)), 1, 1)
    }
  }
  const motes = calm ? 2 : 3 + s.awakened * 2
  for (let i = 0; i < motes; i++) {
    const k = (t * 0.6 + hash2(i, 7, 3)) % 1
    const x = p.x + (hash2(i, 5, Math.floor(t * 0.6 + hash2(i, 7, 3))) - 0.5) * rx * 2
    ctx.globalAlpha = 1 - k
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : color
    ctx.fillRect(Math.round(x), Math.round(p.y - k * (body.bodyH + 10)), 1, i % 2 === 0 ? 2 : 1)
  }
  ctx.globalAlpha = 1
}

/** The sprites an awakening's scene swaps between (its form's, where it lands in one) and the scale it plays at: big legends at 1×. */
export const awakeningLook = (g: Game, from: number, form: FormKey | undefined) => {
  const before = sprites(from, g.player.shiny, legendLook(g))
  const after = sprites(from, g.player.shiny, form ?? legendLook(g))
  return { before, after, scale: before.bodyW > 40 ? 1 : 2 }
}
