import { dirTo, retain, TAU } from '../engine/math'
import { range, weightedPick } from '../engine/rng'
import type { Circle, Pt } from '../data/arenas'
import { PRETTY_WING_COINS, SKY, type WingId } from '../data/places'
import { burst, floatText } from './effects'
import { recomputeStats } from './leveling'
import { placePool, rollWing, type PlaceInteriorOf } from './place'
import { markCleared, notifyPlace, spawnInPlace } from './placeKit'
import { spawnSwarm } from './spawner'
import { playerTypes } from './terrain'
import { actAs, anchorPlayer, nearestPlayer } from './players'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Above the clouds, where only Flying types can ride the updraft: the team
 * flies free (with a tailwind), only flying Pokémon come, flocks cross the
 * sky, and wings drift on the wind. Each wing picked up raises its taker's
 * stat for the rest of the run (`WINGS`). When the wind calms, the team glides
 * back down.
 */

/** A wing drifting on the wind, in world px. */
export type Wing = { id: number; wing: WingId; x: number; y: number; age: number; attracted: boolean }

export type SkyState = {
  /** Where the wind blows (a unit vector): wings come in upwind and drift across. */
  wind: { x: number; y: number }
  wings: Wing[]
  /** Place age the next wing and the next flock come at. */
  nextWing: number
  nextFlock: number
  /** Wings picked up on this flight. */
  got: number
  warned: boolean
}

type SkyInside = PlaceInteriorOf<'sky'>

/** Whether the acting player's Pokémon flies right now (the updraft only carries Flying types). */
export const isFlyer = (g: Game) => playerTypes(g).includes('flying')

/** Whether every player's Pokémon flies right now: the updraft carries the team only then. Solo, `isFlyer`. */
export const teamFlies = (g: Game) => {
  if (g.players.length === 1) return isFlyer(g)
  const before = g.player
  let all = true
  for (const p of g.players) {
    g.player = p
    if (!isFlyer(g)) all = false
  }
  g.player = before
  return all
}

export const buildSky = (g: Game, _x: number, _y: number) => {
  const a = range(g.rng, 0, TAU)
  const floor: Circle = { kind: 'circle', x: 0, y: 0, r: SKY.radius }
  const state: SkyState = { wind: { x: dm.cos(a), y: dm.sin(a) }, wings: [], nextWing: SKY.wings.first, nextFlock: SKY.flock.first, got: 0, warned: false }
  const start: Pt = [0, 0]
  return { layout: { floor: [floor] }, solids: [], start, state }
}

/** A wing enters upwind, somewhere across the sky's width. */
const releaseWing = (g: Game, inside: SkyInside) => {
  const { wind } = inside.state
  const side = range(g.rng, -0.65, 0.65) * SKY.radius
  inside.state.wings.push({
    id: g.nextId++,
    wing: rollWing(g.rng),
    x: inside.x - wind.x * (SKY.radius + 12) - wind.y * side,
    y: inside.y - wind.y * (SKY.radius + 12) + wind.x * side,
    age: 0,
    attracted: false,
  })
}

/** The acting player picks a wing up: its stat for the rest of their run (or its ₽, the team's). */
const takeWing = (g: Game, inside: SkyInside, w: Wing) => {
  const p = g.player
  if (w.wing === 'prettyWing') {
    const coins = dm.round(PRETTY_WING_COINS * p.stats.greed)
    g.coins += coins
    floatText(g, p.x, p.y - 30, `₽${coins}`, '#f8d030')
  } else {
    p.wings[w.wing] = (p.wings[w.wing] ?? 0) + 1
    recomputeStats(g)
  }
  inside.state.got++
  burst(g, w.x, w.y - 6, { colors: ['#ffffff', '#f8f0c0', '#a8d8f8'], count: 14, speed: 60, ttl: 0.5, gravity: -30 })
  notifyPlace(g, 'sky', { kind: 'wing', wing: w.wing })
}

/** Wings drift with the wind and flutter side to side; the nearest player's magnet pulls them in like any pickup, and they go to whoever they reach. */
const driftWings = (g: Game, inside: SkyInside, dt: number) => {
  const { wind } = inside.state
  for (const w of inside.state.wings) {
    const p = nearestPlayer(g, w.x, w.y)
    const reach = p.radius + SKY.wings.radius
    w.age += dt
    const d2 = dm.sq(w.x - p.x) + dm.sq(w.y - (p.y - 6))
    if (!w.attracted && d2 < dm.sq(p.stats.magnet)) w.attracted = true
    if (w.attracted) {
      const d = dirTo(w.x, w.y, p.x, p.y - 6)
      w.x += d.x * 160 * dt
      w.y += d.y * 160 * dt
    } else {
      const flutter = dm.sin(w.age * 2.6 + w.id) * 14
      w.x += (wind.x * SKY.wings.speed - wind.y * flutter) * dt
      w.y += (wind.y * SKY.wings.speed + wind.x * flutter) * dt
    }
    if (dm.sq(w.x - p.x) + dm.sq(w.y - (p.y - 6)) < reach * reach) {
      const before = actAs(g, p)
      takeWing(g, inside, w)
      actAs(g, before)
      w.age = -1
    }
  }
  // Wings that drifted past the sky's far edge are gone.
  retain(inside.state.wings, (w) => w.age >= 0 && dm.sq(w.x - inside.x) + dm.sq(w.y - inside.y) < dm.sq(SKY.radius + 40))
}

/** Just past a player's screen edge (they take turns, `anchorPlayer`), like the horde outside. */
const ringSpot = (g: Game) => {
  const p = anchorPlayer(g)
  const a = range(g.rng, 0, TAU)
  const d = dm.hypot(g.view.w, g.view.h) / 2 + 12
  return { x: p.x + dm.cos(a) * d, y: p.y + dm.sin(a) * d }
}

/** Every tick in the sky: wings, flocks, the flyers that chase and the calm drawing near. */
export const updateSky = (g: Game, inside: SkyInside, dt: number) => {
  const s = inside.state
  if (!s.warned && inside.left <= 8) {
    s.warned = true
    notifyPlace(g, 'sky', { kind: 'warn' })
  }
  while (inside.age >= s.nextWing) {
    releaseWing(g, inside)
    s.nextWing += SKY.wings.every
  }
  driftWings(g, inside, dt)
  if (inside.age >= s.nextFlock) {
    s.nextFlock += SKY.flock.every
    spawnSwarm(g, weightedPick(g.rng, placePool('sky', g.time)), SKY.flock.count)
    notifyPlace(g, 'sky', { kind: 'flock' })
  }
  spawnInPlace(g, inside, dt, ringSpot)
}

/** The wind calms and the team glides back down: a flight with any wing picked up counts as cleared. */
export const calmSky = (g: Game, inside: SkyInside) => {
  if (inside.state.got > 0) markCleared(g, 'sky')
  notifyPlace(g, 'sky', { kind: 'landed', wings: inside.state.got })
  return 'done' as const
}
