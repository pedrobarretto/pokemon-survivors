import { VERSUS } from '../data/versus'
import type { Rect } from '../data/versusMaps'
import { mapOf } from './versusRules'
import { inPlay } from './players'
import type { SpecialState } from './special'
import type { Game, Player } from './types'
import type { VersusSeat } from './versus'
import * as dm from '../engine/dmath'

/**
 * The Arena's tall grass (the map's `grass`): a Pokémon standing in a patch is
 * hidden from the rival team (`VersusSeat.hidden`): their moves don't aim at
 * it (`unseen` in `versusRules.ts`; a hitbox that reaches it still lands) and
 * their bots don't see it. Its own moves hold while it's in the grass (the
 * special still works), so the grass is for ambushes and escapes, not for
 * shooting from cover. A rival close by or in the same patch sees it, and so
 * does everyone for a moment after a hit (dealt or taken) or its special.
 */

/** The patch of `grass` (a map's) that (x, y) stands in (feet), or -1. */
export const patchAt = (grass: readonly Rect[], x: number, y: number) => {
  for (let i = 0; i < grass.length; i++) {
    const r = grass[i]!
    if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return i
  }
  return -1
}

/** Whether `p` stands in tall grass this tick (its moves hold). False outside Versus. */
export const inGrass = (p: Player) => p.versus !== undefined && p.versus.grass >= 0

/** Shows `v` to everyone for `VERSUS.grass.reveal` seconds. */
export const reveal = (v: VersusSeat) => {
  v.reveal = VERSUS.grass.reveal
  v.hidden = false
}

/** Whether `s`, which had `cooldown` before this tick, was used in it (or is still going: charging, releasing, chaining). */
export const usedSpecial = (s: SpecialState, cooldown: number) => s.charge > 0 || s.active > 0 || s.chaining || s.cooldown > cooldown

/** Whether a rival in play sees `p`, in grass: in the same patch, or within `VERSUS.grass.near` px. */
const spotted = (g: Game, p: Player, v: VersusSeat) => {
  const near = VERSUS.grass.near * VERSUS.grass.near
  for (const q of g.players) {
    const w = q.versus
    if (!w || w.team === v.team || !inPlay(q)) continue
    if (w.grass === v.grass || dm.sq(q.x - p.x) + dm.sq(q.y - p.y) < near) return true
  }
  return false
}

/**
 * Who stands in the grass this tick and who is hidden there, after everyone
 * moved and before the moves cast: a Pokémon out of play is in none.
 */
export const updateGrass = (g: Game, dt: number) => {
  if (!g.versus) return
  const grass = mapOf(g.versus).grass
  for (const p of g.players) {
    const v = p.versus
    if (!v) continue
    v.reveal = Math.max(0, v.reveal - dt)
    v.grass = inPlay(p) ? patchAt(grass, p.x, p.y) : -1
  }
  for (const p of g.players) {
    const v = p.versus
    if (!v) continue
    v.hidden = v.grass >= 0 && v.reveal <= 0 && !spotted(g, p, v)
  }
}
