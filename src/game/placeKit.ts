import { weightedPick } from '../engine/rng'
import type { Ellipse } from '../data/terrain'
import { HIDDEN, hiddenOf, PLACE, PLACES, type PlaceId } from '../data/places'
import { runMods } from './legend'
import { spawnEnemy } from './enemies'
import { placePool, type PlaceInterior, type PlaceNotice } from './place'
import { makeShiny, rollShiny, SHINY_ODDS } from './shiny'
import type { Solid } from './terrain'
import type { Enemy, Game } from './types'
import { shakeScreen } from './effects'

/**
 * What every place's rules share (`cave.ts`, `graveyard.ts`, `sky.ts`, the hidden zones'): news
 * for the shell, the spawner inside, scenery and the loot window.
 */

export const notifyPlace = (g: Game, place: PlaceId, notice: PlaceNotice) => {
  g.events.push({ kind: 'place', place, notice })
}

const at = (e: Ellipse, x: number, y: number): Ellipse => ({ x: e.x + x, y: e.y + y, rx: e.rx, ry: e.ry })

/** A piece of scenery standing at world (x, y) on `feet` (`PLACE_FEET`, `ARENA_FEET`), moved there. */
export const solidAt = (kind: Solid['kind'], feet: readonly Ellipse[], x: number, y: number, variant = 0): Solid => ({
  kind,
  x,
  y,
  variant,
  foot: feet.map((e) => at(e, x, y)),
})

/** Regular (non-boss) wild Pokémon alive in the place. */
const crowd = (g: Game) => {
  let n = 0
  for (const e of g.enemies) if (e.dying < 0 && !e.boss) n++
  return n
}

/**
 * The place's own spawner: its `spawn` rate (times `rate`, and the
 * difficulty's) up to its cap, each one from `placePool` at a spot `spotFor`
 * picks (null skips it). Shinies roll as they do outside.
 */
export const spawnInPlace = (g: Game, inside: PlaceInterior, dt: number, spotFor: (g: Game) => { x: number; y: number } | null, rate = 1, onSpawn?: (e: Enemy) => void) => {
  const def = PLACES[inside.id].spawn
  const more = runMods(g).spawnRate
  inside.spawnBudget += def.rate * rate * more * dt
  if (inside.spawnBudget < 1) return
  let alive = crowd(g)
  const pool = placePool(inside.id, g.time)
  // Hidden zones shine brighter.
  const shiny = SHINY_ODDS.enemy * g.shinyBoost * (hiddenOf(inside.id) ? HIDDEN.shinyBoost : 1)
  while (inside.spawnBudget >= 1) {
    inside.spawnBudget--
    if (alive >= def.max * more) continue
    const spot = spotFor(g)
    if (!spot) continue
    const e = spawnEnemy(g, weightedPick(g.rng, pool), spot.x, spot.y)
    if (rollShiny(g.rng, shiny)) makeShiny(g, e)
    onSpawn?.(e)
    alive++
  }
}

/**
 * The player's HP hit 0 inside a place: instead of the game over they faint
 * and get rescued back to the door (`updatePlaceFall` plays it with the world
 * held still). A held Revive is kept for a real fall.
 */
export const fallInPlace = (g: Game) => {
  const inside = g.place.inside
  if (!inside || inside.fall !== null) return
  inside.fall = PLACE.fallTime
  g.player.hp = 0
  shakeScreen(g, 8)
  notifyPlace(g, inside.id, { kind: 'fall' })
}

/** The place's goal was reached this run. */
export const markCleared = (g: Game, id: PlaceId) => {
  if (!g.place.cleared.includes(id)) g.place.cleared.push(id)
}

/** The goal is reached: the loot flies to the player for `PLACE.lootTime` seconds, then the way out. */
export const startLoot = (g: Game, inside: PlaceInterior) => {
  inside.loot = PLACE.lootTime
  markCleared(g, inside.id)
}
