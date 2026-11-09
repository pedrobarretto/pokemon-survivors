import { dir8, TAU, type Dir8 } from '../engine/math'
import { createRng, hash2 } from '../engine/rng'
import { CASTFORM_FIND, TV_FIND, type FindId } from '../data/seasonOneUnlocks'
import { burst, shakeScreen } from './effects'
import { DIRECTOR, spawnSpot } from './mapEventRules'
import type { MapEventDef, MapEventKind } from './mapEvents'
import { playerWithin } from './players'
import { touches } from './props'
import { rollFind } from './seasonOneUnlocks'
import { clearSpot, featuresNear, type Feature } from './terrain'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Temporada 1's map encounters: the old TV in a cottage that lets Rotom out,
 * and the Castform that comes out with the weather. Each run's seed decides
 * whether it brings them (`rollFind`), at most once each, and the player may
 * ignore both. Solo only, on the open map: a cottage is scenery in co-op
 * (`COOP_LOCKS`), and an Arena match, the Dojo and a room never get here.
 * A success is a `seasonFind` event; the shell banks it and the family comes
 * as a game-made gift (`seasonGifts`).
 */

/** Something the shell shows: the encounter made, or Castform coming and going. */
export type FindMoment = 'found' | 'sighted' | 'gone'

/** A run's encounters: `tv` while the TV still flickers (and where it's being stood at), `castform` while it's still to come. */
export type SeasonFinds = { tv: boolean; stood: { cell: number; t: number } | null; castform: boolean }

export const createSeasonFinds = (seed: number): SeasonFinds => ({ tv: rollFind(seed, 'rotom'), stood: null, castform: rollFind(seed, 'castform') })

/** The state of a wandering Castform on the map: the heading's phase and which way it faces. */
export type CastformEvent = { seed: number; dir: Dir8 }

const notify = (g: Game, find: FindId, moment: FindMoment) => g.events.push({ kind: 'seasonFind', find, moment })

/** Where a cottage's old TV stands: on its table. Null for any other feature. */
export const tvOf = (f: Feature) => (f.landmark?.id === 'cottage' ? (f.solids.find((s) => s.kind === 'table') ?? null) : null)

/** The acting player standing at this run's flickering TV long enough lets Rotom out. */
const updateTv = (g: Game, dt: number) => {
  const s = g.finds
  if (!s.tv) return
  const p = g.player
  const reach = TV_FIND.radius + p.radius
  for (const f of featuresNear(g, p.x, p.y, reach + 60)) {
    const tv = tvOf(f)
    const cell = f.landmark?.cell
    if (!tv || cell === undefined || dm.sq(tv.x - p.x) + dm.sq(tv.y - p.y) >= reach * reach) continue
    s.stood = s.stood?.cell === cell ? { cell, t: s.stood.t + dt } : { cell, t: dt }
    if (s.stood.t < TV_FIND.stand) return
    s.tv = false
    s.stood = null
    burst(g, tv.x, tv.y - 14, { colors: ['#f8e858', '#ffffff', '#f88838', '#78c0f8'], count: 40, speed: 130, ttl: 0.7 })
    shakeScreen(g, 3, tv)
    notify(g, 'rotom', 'found')
    return
  }
  s.stood = null
}

/** Places a map event: `spawnMapEvent`, handed in as `directMissions` gets it, since `mapEvents.ts` imports this module. */
type Spawn = (g: Game, kind: MapEventKind, x: number, y: number) => unknown

const SALT = 6197

/** A draw of its own for the Castform's spot and heading (`n` tells them apart), so a run it visits keeps the same world: the run's rng never moves for it. */
const ownRng = (g: Game, n: number) => createRng(hash2(g.terrain.seed, n, SALT) * 0x100000000)

/** Brings the run's Castform out once a weather spell has been on for a while (a crowded spot tries again the next second). */
const directCastform = (g: Game, spawn: Spawn) => {
  if (!g.finds.castform || g.time < CASTFORM_FIND.from || g.weather.id === 'clear' || g.time - g.weather.since < CASTFORM_FIND.delay) return
  const p = g.player
  const spot = spawnSpot(ownRng(g, Math.floor(g.time)), p.x, p.y, CASTFORM_FIND.distance, g.mapEvents.list, DIRECTOR.spacing)
  if (!spot) return
  g.finds.castform = false
  const open = clearSpot(g, spot, 18)
  spawn(g, 'castform', dm.round(open.x), dm.round(open.y))
}

/** Every tick on the open map, solo. */
export const updateSeasonFinds = (g: Game, dt: number, spawn: Spawn) => {
  if (g.coop !== null) return
  updateTv(g, dt)
  directCastform(g, spawn)
}

/** The wandering Castform as a map event: placed by `directCastform` alone (its weight is 0), it floats over anything until a touch or a hit, or its time runs out. */
export const CASTFORM_EVENT: MapEventDef<'castform'> = {
  spawn: { from: CASTFORM_FIND.from, weight: () => 0, max: 1, lifetime: CASTFORM_FIND.lifetime, distance: CASTFORM_FIND.distance },
  marker: true,
  create: (g) => ({ seed: ownRng(g, -1)() * TAU, dir: 0 }),
  enter: (g) => notify(g, 'castform', 'sighted'),
  update: (g, ev, dt) => {
    const s = ev.state
    const heading = s.seed + dm.sin(ev.age * 0.7 + s.seed) * 2
    const dx = dm.cos(heading)
    const dy = dm.sin(heading)
    ev.x += dx * CASTFORM_FIND.speed * dt
    ev.y += dy * CASTFORM_FIND.speed * dt
    s.dir = dir8(dx, dy)
    const y = ev.y - CASTFORM_FIND.radius
    const hit = g.attacks.some((a) => a.age >= a.activeFrom && a.age <= a.activeUntil && a.age >= 0 && touches(a, ev.x, y, CASTFORM_FIND.radius))
    if (!hit && playerWithin(g, ev.x, ev.y, CASTFORM_FIND.radius, true) === null) return
    burst(g, ev.x, y, { colors: ['#ffffff', '#c8e0f8', '#f8d030', '#78c0f8'], count: 36, speed: 110, ttl: 0.7, gravity: -40 })
    notify(g, 'castform', 'found')
    ev.gone = 0
  },
  expire: (g, ev) => {
    burst(g, ev.x, ev.y - CASTFORM_FIND.radius, { colors: ['#ffffff', '#e8e8f0', '#c8c8d8'], count: 18, speed: 70, ttl: 0.5 })
    notify(g, 'castform', 'gone')
  },
}
