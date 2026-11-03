import { retain, TAU } from '../engine/math'
import { range } from '../engine/rng'
import { ENTRANCE_PIECES, entranceFeet, PLACE, PLACES, type PlaceDef, type PlaceId } from '../data/places'
import { DIRECTOR } from './mapEventRules'
import { chargePortal } from './rift'
import { revealHidden, updateHiddenSchedule } from './hidden'
import { entranceShown, nextPlaceAt, pickPlace, placeDue } from './place'
import { enterPlace } from './placeInterior'
import { notifyPlace, solidAt } from './placeKit'
import { teamFlies } from './sky'
import { isOpen } from './terrain'
import { anchorPlayer } from './players'
import { coopLocked } from '../data/coop'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The map side of places: every few minutes an entrance shows up just past
 * the screen's edge (a cave mouth in a rocky hill, a graveyard's gate, an
 * updraft between standing stones), with an arrow pointing at it. It stands
 * like any terrain and stays open for a while; standing in its door for
 * `PLACE.enterTime` steps the team in. Once used or closed it stays where it
 * is until it's off every screen. A hidden zone's entrance (`hidden.ts`)
 * shares the slot: it opens unannounced and says nothing until found.
 */

/** How much clear ground an entrance needs around its door. */
const CLEARANCE = 72

/** A spot just past a player's screen edge (`anchorPlayer`) with room for an entrance: clear of terrain, map events and the rift's portal. */
const entranceSpot = (g: Game) => {
  const p = anchorPlayer(g)
  const d = dm.hypot(g.view.w, g.view.h) / 2 + 70
  for (let i = 0; i < 12; i++) {
    const a = range(g.rng, 0, TAU)
    const x = dm.round(p.x + dm.cos(a) * d)
    const y = dm.round(p.y + dm.sin(a) * d)
    if (!isOpen(g, x, y - 16, CLEARANCE)) continue
    const crowded = [...g.mapEvents.list, ...(g.rift.portal ? [g.rift.portal] : [])].some((o) => dm.sq(o.x - x) + dm.sq(o.y - y) < dm.sq(DIRECTOR.spacing))
    if (!crowded) return { x, y }
  }
  return null
}

/** Opens place `id`'s entrance at (x, y), or at a free spot past the screen's edge; tries again shortly if there's none. */
export const openEntrance = (g: Game, id: PlaceId = pickPlace(g.rng, { offered: g.place.offered, biome: g.biome.id, flyer: teamFlies(g) }), at?: { x: number; y: number }) => {
  const spot = at ?? entranceSpot(g)
  if (!spot) {
    g.place.nextAt = g.time + 3
    return null
  }
  const { x, y } = spot
  const solids = ENTRANCE_PIECES[id].map(([piece, dx, dy], i) => solidAt(piece, entranceFeet(piece), x + dx, y + dy, i))
  g.place.entrance = { id, x, y, left: PLACE.openTime, charge: 0, open: true, terrain: { solids, lake: null }, hidden: false, foundAt: null }
  g.place.offered.push(id)
  g.place.nextAt = nextPlaceAt(g.place.nextAt, g.time, g.rng)
  // Breakables that stood where the entrance now is make room for it.
  const feet = solids.flatMap((s) => s.foot)
  retain(g.props, (pr) => !feet.some((e) => dm.sq((pr.x - e.x) / (e.rx + 8)) + dm.sq((pr.y - e.y) / (e.ry + 8)) < 1))
  notifyPlace(g, id, { kind: 'open' })
  return g.place.entrance
}

/**
 * Opens entrances on schedule (and the run's hidden zone, `updateHiddenSchedule`),
 * closes them when their time is up, drops them once out of everyone's sight
 * and steps the team in. None in co-op (`COOP_LOCKS`).
 */
export const updatePlaceEntrance = (g: Game, dt: number) => {
  if (coopLocked(g, 'places')) return
  const s = g.place
  const ent = s.entrance
  if (!ent) {
    const busy = s.inside !== null || g.rift.omen !== null || g.rift.portal !== null || g.rift.arena !== null
    if (placeDue({ time: g.time, nextAt: s.nextAt, busy, bossAlive: g.bossId !== null, endless: g.endless !== null })) openEntrance(g)
    else updateHiddenSchedule(g)
    return
  }
  // It waits on the map while the team is inside (or in a rift).
  if (s.inside || g.rift.arena) return
  if (ent.open) {
    revealHidden(g, ent)
    ent.left -= dt
    if (ent.left <= 0) {
      ent.open = false
      // A hidden one nobody found just goes, as quietly as it came.
      if (entranceShown(ent)) notifyPlace(g, ent.id, { kind: 'sealed' })
    }
  }
  if (!ent.open) {
    let away = true
    for (const p of g.players) away &&= Math.abs(ent.x - p.x) > g.view.w / 2 + 110 || Math.abs(ent.y - p.y) > g.view.h / 2 + 130
    if (away) s.entrance = null
    return
  }
  const def: PlaceDef = PLACES[ent.id]
  let inside = false
  for (const p of g.players) inside ||= dm.sq(p.x - ent.x) + dm.sq(p.y - ent.y) < dm.sq(def.door + p.radius * 0.5)
  // Only a team of flyers rides the updraft.
  if (inside && def.flyers && !teamFlies(g)) {
    // Told once per visit to the door.
    if (ent.charge >= 0) notifyPlace(g, ent.id, { kind: 'blocked' })
    ent.charge = -1
    return
  }
  ent.charge = chargePortal(Math.max(0, ent.charge), inside, dt)
  if (ent.charge < PLACE.enterTime) return
  ent.open = false
  ent.charge = 0
  enterPlace(g, ent.id, ent.x, ent.y)
}
