import type { Rng } from '../engine/rng'
import { BAG_ITEMS } from './bag'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/** Odds per roll: each regular spawn (about eight shinies in a 15-min run), and the starter once per run. */
export const SHINY_ODDS = { enemy: 1 / 450, player: 1 / 64 } as const

/**
 * How much likelier a run's wild shinies are: each Shiny Charm rank adds a
 * third (1/450 → 1/225 at rank 3) and a Lure doubles it.
 */
export const shinyBoost = (charm: number, lure: boolean) => (1 + charm / 3) * (lure ? BAG_ITEMS.lure.effect.shinyOdds : 1)

/** Shiny elites are tankier and worth a lot more EXP (plus a Poké Ball on defeat). */
export const SHINY_BUFF = { hp: 8, xp: 10 } as const

export const rollShiny = (rng: Rng, odds: number) => rng() < odds

/** Stats of an enemy promoted to a shiny elite. */
export const shinyStats = ({ maxHp, xp }: Pick<Enemy, 'maxHp' | 'xp'>) => ({
  hp: dm.round(maxHp * SHINY_BUFF.hp),
  xp: Math.max(1, xp) * SHINY_BUFF.xp,
})

/** Turns a freshly spawned enemy into a shiny elite and announces it. */
export const makeShiny = (g: Game, e: Enemy) => {
  const { hp, xp } = shinyStats(e)
  e.shiny = true
  e.hp = e.maxHp = hp
  e.xp = xp
  e.bornAt = g.now
  g.events.push({ kind: 'shiny', enemy: e.kind })
}
