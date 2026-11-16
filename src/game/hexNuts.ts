import { createRng, hash2, range } from '../engine/rng'
import { MELTAN } from '../data/legendPaths'
import type { Enemy, Game } from './types'

/**
 * Meltan's Hex Nuts (`data/legendPaths.ts`): in a solo run of Meltan, fainted
 * foes drop them (Steel types more often, a boss a handful), gathered like
 * candies; the shell banks them as the run goes (`Game.paths.nuts`). Drawn by
 * hash, so the run's rng never moves for them. Kept apart from `pathRun.ts`,
 * which reaches the map events: the pickups and combat import this.
 */

const SALT = 7211

/** How many Hex Nuts a fainted foe drops (`MELTAN`). */
export const nutsOf = (seed: number, e: Pick<Enemy, 'id' | 'types' | 'boss'>) => {
  if (e.boss) return MELTAN.boss
  const odds = e.types.includes('steel') ? MELTAN.steel : MELTAN.drop
  return hash2(seed, e.id, SALT) < odds ? 1 : 0
}

/** A foe fainted (`killEnemy`): in a solo run of Meltan, its Hex Nuts scatter where it fell. */
export const faintNuts = (g: Game, e: Enemy) => {
  if (g.coop !== null || g.player.legend?.id !== 'meltan') return
  const n = nutsOf(g.terrain.seed, e)
  if (n === 0) return
  const rng = createRng(hash2(g.terrain.seed, e.id, SALT + 1) * 0x100000000)
  const spread = n > 1 ? 34 : 10
  for (let i = 0; i < n; i++) {
    g.pickups.push({ id: g.nextId++, x: e.x, y: e.y - 2, vx: range(rng, -spread, spread), vy: range(rng, -spread, -6), attracted: false, age: 0, kind: 'hexNut' })
  }
}

/** A Hex Nut picked up: into the run's count. */
export const collectNut = (g: Game) => {
  g.paths.nuts++
  g.events.push({ kind: 'hexNut' })
}
