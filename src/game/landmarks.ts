import { lerp } from '../engine/math'
import { hash2 } from '../engine/rng'
import { coopLocked } from '../data/coop'
import { DROP_TABLES, rollDrop } from '../data/consumables'
import { LANDMARK, LANDMARK_LOOT, SNORLAX, TRUCK, TUNNEL, type LandmarkId, type LandmarkLoot, type TreasureLandmark } from '../data/landmarks'
import { alphaHp, spawnAlpha } from './alphas'
import { dropItem } from './consumables'
import { burst } from './effects'
import { COIN_VALUES } from './meta'
import { awardEgg, dropCoins, dropPickup, dropXp } from './pickups'
import { roomOf } from './room'
import { featuresNear, rebuildCell, type Landmark } from './terrain'
import type { Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * The map's landmarks at play (`data/landmarks.ts`; `game/terrain.ts` places
 * them): coming close names one on screen, standing at a treasure for a moment
 * opens it (once: a looted cell stays looted when the map rebuilds it) and
 * standing in a tunnel's mouth takes the player under the ridge and out of the
 * other mouth, the horde losing track of them meanwhile. The games' nods
 * open the same way and do their own thing: the Snorlax wakes and fights, the
 * Pokémon Center heals, the truck keeps its rumor (Mew, once in a long while)
 * and MissingNo. duplicates the item it gives. They wait while the player is
 * in a room (a rift arena, a place).
 */

/**
 * Something the shell shows or plays: a landmark named, a treasure opened
 * (`loot`; the Center's heal and the truck's empty search too), the Snorlax
 * woken, Mew seen under the truck, the way into and out of a tunnel.
 */
export type LandmarkMoment = 'spot' | 'loot' | 'wake' | 'mew' | 'tunnelIn' | 'tunnelOut'

/** The world's side of the landmarks: what was looted and named, and how many treasures were opened. */
export type LandmarkState = {
  /** Cells whose treasure was taken, and when (`g.now`): the art plays what happens then (the balloon's take-off, Mew's flight). */
  looted: Map<number, number>
  /** Cells whose landmark was already named on screen. */
  seen: Set<number>
  /** Treasures opened this run. */
  opened: number
  /** Trucks Mew showed up from (`mewUnder`): the art plays its flight, the run's tally counts them. */
  mew: Set<number>
}

/** A player's side of the landmarks (`Player.landmark`): the treasure they're opening, the tunnel they're stepping into or walking. */
export type PlayerLandmarks = {
  /** The treasure being opened (its cell) and for how long the player has stood at it. */
  opening: { cell: number; t: number } | null
  /** The tunnel mouth being stepped into (its cell, 0 west or 1 east) and for how long. */
  entering: { cell: number; mouth: number; t: number } | null
  /** Under a ridge: from where to where (world px), seconds along and the tunnel's cell. */
  transit: { x0: number; y0: number; x1: number; y1: number; t: number; cell: number } | null
  /** The mouth the player came out of: it doesn't take them back until they step out of it. */
  lock: { cell: number; mouth: number } | null
}

export const createLandmarkState = (): LandmarkState => ({ looted: new Map(), seen: new Set(), opened: 0, mew: new Set() })

export const createPlayerLandmarks = (): PlayerLandmarks => ({ opening: null, entering: null, transit: null, lock: null })

const notify = (g: Game, landmark: LandmarkId, moment: LandmarkMoment) => g.events.push({ kind: 'landmark', landmark, moment })

const SPARKLE = ['#ffffff', '#f8e070', '#f8c040', '#a8e0ff'] as const
const DUST = ['#a89c90', '#7c7068', '#d8d0c0'] as const

const PINK = ['#ffffff', '#f8b8e0', '#f088c8', '#ffd8f0'] as const
const SNORE = ['#ffffff', '#c8e0e8', '#f8f0c0'] as const
const GLITCH = ['#000000', '#ffffff', '#f80000', '#00f8f8', '#f8f800'] as const

/** Exp. Candy worth `levels` of the acting player's level (at least 5), in a handful of candies. */
const candies = (g: Game, x: number, y: number, levels: number) => {
  const total = Math.max(5, dm.round(g.player.xpNext * levels))
  for (let i = 0; i < 6; i++) dropXp(g, x, y - 6, Math.ceil(total / 6))
}

/**
 * Whether Mew is under this truck: the rumor's odds (`LANDMARK_LOOT.truck.rumor`),
 * drawn once per truck from the run's terrain seed (no rng: the same truck
 * always tells the same story, and the art can ask too).
 */
export const mewUnder = (g: Game, lm: Landmark) => hash2(lm.cell, 151, g.terrain.seed) < LANDMARK_LOOT.truck.rumor

/** The HP share of a 5:00 boss Snorlax the woken one has at `time` (`SNORLAX.hp`). */
export const wokenHp = (time: number) => {
  const { early, late, ramp } = SNORLAX.hp
  return early + (late - early) * Math.min(1, Math.max(0, (time - ramp[0]) / (ramp[1] - ramp[0])))
}

/**
 * The Snorlax across the path wakes: it leaves its spot (the cell is built
 * again without it, the way open) and fights as an Alpha, its HP a share of
 * the 5:00 boss's (`wokenHp`), its hits softer, and it yawns a moment first.
 */
const wake = (g: Game, lm: Landmark, x: number, y: number) => {
  rebuildCell(g, lm.cell)
  const e = spawnAlpha(g, 'snorlax', x, y)
  // An Alpha's HP scales a regular's; this one is a share of the boss's instead.
  e.hp = e.maxHp = Math.max(1, dm.round((e.maxHp / alphaHp(g.time)) * wokenHp(g.time)))
  e.damage *= SNORLAX.damage
  e.status.stun = SNORLAX.yawn
  g.player.iframes = Math.max(g.player.iframes, SNORLAX.yawn)
  burst(g, x, y - 20, { colors: SNORE, count: 20, speed: 60, ttl: 0.7, gravity: -20 })
}

/** Mew shows from under the truck: a pink shimmer, a Rare Candy left behind (`TRUCK.gift`), and it's gone. */
const sightMew = (g: Game, lm: Landmark, x: number, y: number) => {
  g.landmarks.mew.add(lm.cell)
  dropItem(g, x, y - 4, TRUCK.gift)
  burst(g, x, y - 6, { colors: PINK, count: 40, speed: 110, ttl: 0.9, gravity: -30 })
}

/**
 * The acting player opens a landmark's treasure where it stands (`LANDMARK_LOOT`):
 * ₽, item rolls (MissingNo.'s twice), berries, Exp. Candy (sized to their
 * level) and maybe an egg; the Pokémon Center's heal, the Snorlax's waking
 * and the truck's rumor.
 */
const openTreasure = (g: Game, lm: Landmark & { id: TreasureLandmark }, x: number, y: number) => {
  const loot: LandmarkLoot = LANDMARK_LOOT[lm.id]
  const s = g.landmarks
  s.looted.set(lm.cell, g.now)
  s.opened++
  g.player.landmark.opening = null
  if (loot.coins > 0) dropCoins(g, x, y - 4, Array.from({ length: loot.coins + Math.floor(g.time / 300) }, () => COIN_VALUES[1]))
  const copies = loot.copies ?? 1
  for (const table of loot.drops) {
    const drop = rollDrop(DROP_TABLES[table], g.time, g.rng)
    for (let i = 0; i < copies; i++) dropItem(g, x - (copies - 1) * 7 + i * 14, y - 4, drop)
  }
  if (loot.berries) for (let i = 0; i < loot.berries; i++) dropPickup(g, x - 6 + i * 12, y + 6, 'berry')
  if (loot.xp) candies(g, x, y, loot.xp)
  if (loot.egg) awardEgg(g, 'chest', x, y)
  if (loot.heal) g.player.hp = Math.max(g.player.hp, g.player.stats.maxHp * loot.heal)
  let moment: LandmarkMoment = 'loot'
  if (loot.wakes) {
    wake(g, lm, x, y)
    moment = 'wake'
  } else if (loot.rumor !== undefined) {
    if (mewUnder(g, lm)) {
      sightMew(g, lm, x, y)
      moment = 'mew'
    } else burst(g, x, y - 4, { colors: DUST, count: 10, speed: 40, ttl: 0.4 })
  } else burst(g, x, y - 8, { colors: loot.copies ? GLITCH : SPARKLE, count: 26, speed: 90, ttl: 0.6, gravity: 60 })
  notify(g, lm.id, moment)
}

/** Seconds standing at a landmark's treasure to open it. */
export const openTimeOf = (id: TreasureLandmark) => {
  const loot: LandmarkLoot = LANDMARK_LOOT[id]
  return loot.open ?? LANDMARK.openTime
}

const isTreasure = (lm: Landmark): lm is Landmark & { id: TreasureLandmark } => lm.id in LANDMARK_LOOT

/** Names the landmarks the acting player comes close to, opens the treasure they stand at and steps them into a tunnel's mouth. Scenery only in co-op (`COOP_LOCKS`). */
export const updateLandmarks = (g: Game, dt: number) => {
  if (coopLocked(g, 'landmarks')) return
  const p = g.player
  const w = g.landmarks
  const s = p.landmark
  if (s.transit || roomOf(g)) return
  let opening = false
  let entering = false
  const near = LANDMARK.treasureRadius + p.radius * 0.5
  for (const f of featuresNear(g, p.x, p.y, LANDMARK.spotRadius)) {
    const lm = f.landmark
    if (!lm) continue
    if (!w.seen.has(lm.cell) && dm.sq(lm.x - p.x) + dm.sq(lm.y - p.y) < dm.sq(LANDMARK.spotRadius)) {
      w.seen.add(lm.cell)
      notify(g, lm.id, 'spot')
    }
    const chest = lm.treasure
    if (chest && isTreasure(lm) && !w.looted.has(lm.cell) && dm.sq(chest.x - p.x) + dm.sq(chest.y - p.y) < near * near) {
      opening = true
      if (s.opening?.cell === lm.cell) s.opening.t += dt
      else s.opening = { cell: lm.cell, t: dt }
      if (s.opening.t >= openTimeOf(lm.id)) {
        openTreasure(g, lm, chest.x, chest.y)
        // A woken Snorlax rebuilt the cell, and whatever opened may have looked around: start afresh next tick.
        return
      }
    }
    for (let i = 0; i < lm.mouths.length; i++) {
      const m = lm.mouths[i]!
      const inMouth = dm.sq(m.x - p.x) + dm.sq(m.y - p.y) < dm.sq(TUNNEL.mouth + p.radius * 0.5)
      const locked = s.lock?.cell === lm.cell && s.lock.mouth === i
      if (locked && !inMouth) s.lock = null
      if (!inMouth || locked) continue
      entering = true
      if (s.entering?.cell === lm.cell && s.entering.mouth === i) s.entering.t += dt
      else s.entering = { cell: lm.cell, mouth: i, t: dt }
      if (s.entering.t < TUNNEL.enterTime) continue
      const out = lm.mouths[1 - i]!
      s.entering = null
      s.lock = { cell: lm.cell, mouth: 1 - i }
      s.transit = { x0: p.x, y0: p.y, x1: out.x, y1: out.y + TUNNEL.exitStep, t: 0, cell: lm.cell }
      burst(g, p.x, p.y - 6, { colors: DUST, count: 12, speed: 50, ttl: 0.4 })
      notify(g, 'tunnel', 'tunnelIn')
      return
    }
  }
  if (!opening) s.opening = null
  if (!entering) s.entering = null
}

/**
 * Carries the acting player under a ridge (eased, out of sight and out of
 * reach) and lets them out of the far mouth. True while it does, so their
 * own walking waits.
 */
export const updateTunnel = (g: Game, dt: number) => {
  const p = g.player
  const tr = p.landmark.transit
  if (!tr) return false
  tr.t += dt
  const k = Math.min(1, tr.t / TUNNEL.travel)
  const e = k * k * (3 - 2 * k)
  p.x = lerp(tr.x0, tr.x1, e)
  p.y = lerp(tr.y0, tr.y1, e)
  p.vx = 0
  p.vy = 0
  p.iframes = Math.max(p.iframes, 0.6)
  if (k < 1) return true
  p.landmark.transit = null
  burst(g, p.x, p.y - 6, { colors: DUST, count: 14, speed: 60, ttl: 0.45 })
  notify(g, 'tunnel', 'tunnelOut')
  return true
}

/** Whether player `p` (the acting one) is under a ridge right now (out of sight: foes lose track, the sprite hides). */
export const underground = (g: Game, p: Player = g.player) => p.landmark.transit !== null
