import { retain } from '../engine/math'
import { range } from '../engine/rng'
import type { Pt } from '../data/arenas'
import { ENTRANCE_PIECES, entranceFeet, HIDDEN, hiddenOf, type PlaceId } from '../data/places'
import { burst } from './effects'
import { despawnEnemy, spawnEnemy } from './enemies'
import { hiddenDue, luckyXp, pickHidden, rollLucky, rollRare } from './hiddenRules'
import { COIN_VALUES } from './meta'
import { awardEgg, dropCoins, dropPickup } from './pickups'
import type { PlaceEntrance, PlaceInterior } from './place'
import { notifyPlace, solidAt } from './placeKit'
import { makeShiny, rollShiny, SHINY_ODDS } from './shiny'
import { isOpen } from './terrain'
import { anchorPlayer } from './players'
import { DIRECTOR } from './mapEventRules'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Hidden zones on the map and the Pokémon they share (`data/places.ts`,
 * `hidden`). A run that rolled one (`rollHidden`) opens its entrance once,
 * at a clear moment (`hiddenDue`), just past the screen's edge where the
 * player is heading, dressed as scenery with a tell (the grotto's leaves
 * rustle, the boulder's crack glints): no arrow, no toast, nothing on the
 * minimap. Walking up to it finds it ("!"), and standing in its door steps
 * the team in like any place. Inside, lucky Pokémon pop out of the zone's
 * spots (shaking grass, holes), shy and worth far more EXP than the horde,
 * and sometimes the zone's rare dweller shows up for a while.
 */

/** How much clear ground a hidden entrance needs around its door. */
const CLEARANCE = 60
/** How far past the screen's edge (px) it shows up. */
const PAST_EDGE = 40

/** A spot just past the screen's edge ahead of where the player is heading (they'll walk into it), clear of terrain, map events and the rift's portal. */
const hiddenSpot = (g: Game) => {
  const p = anchorPlayer(g)
  const moving = dm.sq(p.vx) + dm.sq(p.vy) > 25
  const heading = moving ? dm.atan2(p.vy, p.vx) : dm.atan2(p.facing.y, p.facing.x)
  for (let i = 0; i < 14; i++) {
    const a = heading + (i === 0 ? 0 : range(g.rng, -1, 1) * Math.min(Math.PI, 0.5 + i * 0.2))
    const dx = dm.cos(a)
    const dy = dm.sin(a)
    const edge = Math.min(Math.abs(dx) > 0.01 ? g.view.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 0.01 ? g.view.h / 2 / Math.abs(dy) : Infinity)
    const x = dm.round(p.x + dx * (edge + PAST_EDGE))
    const y = dm.round(p.y + dy * (edge + PAST_EDGE))
    if (!isOpen(g, x, y - 14, CLEARANCE)) continue
    const crowded = [...g.mapEvents.list, ...(g.rift.portal ? [g.rift.portal] : [])].some((o) => dm.sq(o.x - x) + dm.sq(o.y - y) < dm.sq(DIRECTOR.spacing))
    if (!crowded) return { x, y }
  }
  return null
}

/**
 * Opens hidden zone `id`'s entrance at (x, y), or just ahead of the player;
 * without room it tries again in a few seconds. Unannounced: nothing tells
 * the shell until a player finds it (`revealHidden`).
 */
export const openHidden = (g: Game, id: PlaceId = pickHidden(g.rng, g.biome.id), at?: { x: number; y: number }) => {
  const spot = at ?? hiddenSpot(g)
  if (!spot) {
    g.place.hiddenAt = g.time + 3
    return null
  }
  const { x, y } = spot
  const solids = ENTRANCE_PIECES[id].map(([piece, dx, dy], i) => solidAt(piece, entranceFeet(piece), x + dx, y + dy, piece === 'tree' || piece === 'bush' || piece === 'rock' ? i % 3 : i))
  g.place.entrance = { id, x, y, left: HIDDEN.openTime, charge: 0, open: true, terrain: { solids, lake: null }, hidden: true, foundAt: null }
  g.place.hiddenAt = null
  // Breakables that stood where the entrance now is make room for it.
  const feet = solids.flatMap((s) => s.foot)
  retain(g.props, (pr) => !feet.some((e) => dm.sq((pr.x - e.x) / (e.rx + 8)) + dm.sq((pr.y - e.y) / (e.ry + 8)) < 1))
  return g.place.entrance
}

/** Opens the run's hidden zone once it's due and the coast is clear (`hiddenDue`). True if it opened. */
export const updateHiddenSchedule = (g: Game) => {
  const busy = g.place.inside !== null || g.rift.omen !== null || g.rift.portal !== null || g.rift.arena !== null
  if (!hiddenDue({ time: g.time, at: g.place.hiddenAt, busy, bossAlive: g.bossId !== null, riftAt: g.rift.nextAt })) return false
  return openHidden(g) !== null
}

/** A player close to a hidden entrance not found yet finds it: the "!" over them and its name. */
export const revealHidden = (g: Game, ent: PlaceEntrance) => {
  if (!ent.hidden || ent.foundAt !== null) return
  for (const p of g.players) {
    if (dm.sq(p.x - ent.x) + dm.sq(p.y - ent.y) > dm.sq(HIDDEN.reveal)) continue
    ent.foundAt = g.now
    notifyPlace(g, ent.id, { kind: 'found' })
    return
  }
}

/* ---------------- Inside: the lucky ones and the rare dweller ---------------- */

/**
 * A hidden zone's Pokémon: the spots lucky ones pop out of (room px), the one
 * shaking now (`rustle`, popping out at place age `at`), when the next one
 * starts, how many were caught, and the rare dweller: the place age it shows
 * up at (null: not this visit), its spot, and its id once out.
 */
export type Dwellers = {
  spots: readonly Pt[]
  rustle: { spot: number; at: number } | null
  next: number
  caught: number
  /** Fainted shy ones already counted. */
  counted: Set<number>
  rare: { at: number | null; spot: Pt; id: number | null; shiny: boolean; gone: boolean }
}

/** When spots shake and for how long their Pokémon stay, `leash` px they may stray from their spot (0: they stay in their hole), and their particles. */
export type DwellerRules = { first: number; every: number; warn: number; stay: number; leash: number; rareLeash: number; colors: readonly string[] }

/** At most this many lucky ones out at once. */
const MAX_LUCKY = 3

export const createDwellers = (g: Game, spots: readonly Pt[], rareSpot: Pt, first: number): Dwellers => ({
  spots,
  rustle: null,
  next: first,
  caught: 0,
  counted: new Set(),
  rare: { at: rollRare(g.rng), spot: rareSpot, id: null, shiny: false, gone: false },
})

/** Shiny odds inside a hidden zone. */
const shinyOdds = (g: Game) => SHINY_ODDS.enemy * g.shinyBoost * HIDDEN.shinyBoost

/** A shy one comes out at room spot (sx, sy): its EXP set from `base`, a shiny roll, a puff of the zone's colors. */
const comeOut = (g: Game, inside: PlaceInterior, kind: Enemy['kind'], [sx, sy]: Pt, leash: number, stay: number, base: number, colors: readonly string[]) => {
  const x = inside.x + sx
  const y = inside.y + sy
  const e = spawnEnemy(g, kind, x, y, { kind: 'shy', x, y, leash, until: inside.age + stay })
  e.xp = luckyXp(base, g.time)
  if (rollShiny(g.rng, shinyOdds(g))) makeShiny(g, e)
  burst(g, x, y - 4, { colors, count: 14, speed: 60, ttl: 0.5, gravity: 80 })
  return e
}

/** The rare dweller fell: a Poké Ball, ₽ and an egg roll on top of its EXP. */
const rareDown = (g: Game, inside: PlaceInterior, d: Dwellers, e: Enemy) => {
  dropPickup(g, e.x + 8, e.y, 'pokeball')
  dropCoins(g, e.x, e.y, [COIN_VALUES[2], COIN_VALUES[1]])
  awardEgg(g, 'place', e.x, e.y)
  burst(g, e.x, e.y - 10, { colors: ['#f8f0a8', '#ffffff', '#f8a8d8', '#a8f0c8'], count: 50, speed: 140, ttl: 0.8 })
  g.flash = 0.3
  notifyPlace(g, inside.id, { kind: 'dwellerDown', enemy: e.kind, shiny: d.rare.shiny })
}

/**
 * Every tick in a hidden zone: a spot shakes, then its lucky one pops out;
 * the rare dweller shows up on its moment; shy ones whose time is up duck
 * away unhurt (the rare dweller runs off); the fallen are counted, and the
 * rare dweller pays out.
 */
export const updateDwellers = (g: Game, inside: PlaceInterior, d: Dwellers, rules: DwellerRules) => {
  const def = hiddenOf(inside.id)
  if (!def) return
  let out = 0
  for (const e of g.enemies) {
    if (e.behavior.kind !== 'shy') continue
    if (e.dying >= 0) {
      if (e.hp > 0 || d.counted.has(e.id)) continue
      d.counted.add(e.id)
      if (e.id === d.rare.id) {
        d.rare.gone = true
        rareDown(g, inside, d, e)
      } else d.caught++
      continue
    }
    if (inside.age >= e.behavior.until) {
      burst(g, e.x, e.y - 4, { colors: rules.colors, count: 12, speed: 50, ttl: 0.5, gravity: 80 })
      despawnEnemy(e)
      if (e.id === d.rare.id) {
        d.rare.gone = true
        notifyPlace(g, inside.id, { kind: 'dwellerFled', enemy: e.kind })
      }
      continue
    }
    if (e.id !== d.rare.id) out++
  }
  const rare = d.rare
  if (rare.at !== null && rare.id === null && inside.age >= rare.at) {
    const e = comeOut(g, inside, def.rare, rare.spot, rules.rareLeash, HIDDEN.rare.stay, HIDDEN.rare.xp, ['#f8f0a8', '#ffffff', '#f8a8d8'])
    rare.id = e.id
    rare.shiny = e.shiny
    notifyPlace(g, inside.id, { kind: 'dweller', enemy: e.kind, shiny: e.shiny })
  }
  const r = d.rustle
  if (r && inside.age >= r.at) {
    d.rustle = null
    const [kind, , base] = rollLucky(g.rng, def.lucky)
    comeOut(g, inside, kind, d.spots[r.spot]!, rules.leash, rules.stay, base, rules.colors)
    notifyPlace(g, inside.id, { kind: 'lucky', enemy: kind })
  }
  if (!d.rustle && inside.age >= d.next && out < MAX_LUCKY) {
    d.next = inside.age + rules.every
    d.rustle = { spot: Math.floor(g.rng() * d.spots.length), at: inside.age + rules.warn }
    notifyPlace(g, inside.id, { kind: 'rustle' })
  }
}

/** A random spot on a room's floor of circles (room px), at least `clear` px from the player the spawns take turns on (`anchorPlayer`), or null. */
export const openSpot = (inside: PlaceInterior, circles: readonly { x: number; y: number; r: number }[], clear: number) => (g: Game) => {
  const p = anchorPlayer(g)
  for (let i = 0; i < 4; i++) {
    const c = circles[Math.floor(g.rng() * circles.length)]!
    const a = g.rng() * Math.PI * 2
    const k = Math.sqrt(g.rng()) * (c.r - 10)
    const x = inside.x + c.x + dm.cos(a) * k
    const y = inside.y + c.y + dm.sin(a) * k
    if (dm.sq(x - p.x) + dm.sq(y - p.y) > clear * clear) return { x, y }
  }
  return null
}
