import { clamp, lerp, TAU } from '../engine/math'
import { range, weightedPick } from '../engine/rng'
import { query } from '../engine/spatial'
import type { BiomeId, WeatherId } from '../data/biomes'
import {
  BIOME_FLAVOR, HAZARD_HIT, HAZARD_PACE, HAZARD_RULES, MIN_TELEGRAPH, WEATHER_FLAVOR, WORLD_PATTERNS,
  type HazardFlavor, type WorldPatternId,
} from '../data/hazards'
import { RUN_LENGTH, scaling } from '../data/waves'
import { bossReach, spawnHazard } from './bosses'
import { bumpDamage } from './combat'
import { WORLD_HARM } from './harm'
import { DIFFICULTIES, type Difficulty } from './difficulty'
import { finaleAlive } from './spawner'
import { isAirborne } from './traits'
import { weatherHere } from './weather'
import { anchorPlayer, playerWithin } from './players'
import type { Game, Hazard } from './types'
import * as dm from '../engine/dmath'
import { roomOf } from './room'

/**
 * The world's attack clock: `charge` fills by the pace each tick and an attack
 * fires at 1. `fired` counts the attacks this run (the first one is introduced).
 */
export type WorldHazardState = { charge: number; fired: number }

export const createWorldHazards = (): WorldHazardState => ({ charge: 0.5, fired: 0 })

/** How far along the pace's ramp `time` is, 0 at the start to 1 once it's done. */
const rampAt = (difficulty: Difficulty, time: number) => {
  const pace = HAZARD_PACE[difficulty]
  return clamp((time - pace.start) / (pace.ramp * 60), 0, 1)
}

/**
 * Seconds between world attacks at `time`, Infinity before the difficulty's
 * start. Ramps from `every[0]` to `every[1]`, and keeps quickening in endless mode.
 */
export const hazardInterval = (difficulty: Difficulty, time: number, endless = false) => {
  const pace = HAZARD_PACE[difficulty]
  if (time < pace.start) return Infinity
  const base = lerp(pace.every[0], pace.every[1], rampAt(difficulty, time))
  if (!endless) return base
  const past = Math.max(0, time - RUN_LENGTH) / 60
  return base * Math.max(HAZARD_RULES.floor, 1 - past * HAZARD_RULES.endless)
}

/** Seconds a world telegraph shows before it lands on this difficulty. */
export const hazardTelegraph = (difficulty: Difficulty) => Math.max(MIN_TELEGRAPH, HAZARD_PACE[difficulty].telegraph)

/** A strike's damage at `time` (before `hurtPlayer`'s difficulty, weather and armor): a multiple of the minute's contact damage. */
export const hazardDamage = (difficulty: Difficulty, time: number) =>
  HAZARD_HIT.contact * scaling(time, DIFFICULTIES[difficulty].ramp).damage * HAZARD_PACE[difficulty].damage

/** What the world throws: the weather's flavor, or the biome's under clear skies and fog. */
export const hazardFlavor = (weather: WeatherId, biome: BiomeId): HazardFlavor => WEATHER_FLAVOR[weather] ?? BIOME_FLAVOR[biome]

/** How many hazards a pattern drops at `time`, ramping with the pace. */
const countAt = (g: Game, counts: readonly [number, number]) => dm.round(lerp(counts[0], counts[1], rampAt(g.difficulty, g.time)))

/**
 * Pace multiplier right now: 0 inside a room (rift arena, place), before the start, during a
 * boss's entrance and (on Normal) while Mewtwo lives; cut while a boss is in
 * the fight, or an Alpha nearby aims or charges (its red lane must stay readable).
 */
const paceNow = (g: Game) => {
  if (roomOf(g) !== null || g.time < HAZARD_PACE[g.difficulty].start) return 0
  const reach = bossReach(g)
  let fight = false
  for (const e of g.enemies) {
    if (!e.boss || e.dying >= 0) continue
    const near = playerWithin(g, e.x, e.y, reach) !== null
    if (e.alpha) {
      fight ||= near && e.alpha.phase !== 'walk'
      continue
    }
    if (g.now - e.bornAt < HAZARD_RULES.entrance) return 0
    fight ||= near
  }
  const finale = finaleAlive(g) ? HAZARD_PACE[g.difficulty].finale : 1
  return finale * (fight ? HAZARD_RULES.bossFight : 1)
}

const spawn = (g: Game, init: Pick<Hazard, 'kind' | 'visual' | 'x' | 'y' | 'r' | 'damage' | 'armAt' | 'disarmAt' | 'ttl'>) =>
  spawnHazard(g, { ...init, world: true, by: WORLD_HARM })

/** How long a landed strike keeps hurting, as a boss's does. */
const STRIKE_WINDOW = 0.15

const strike = (g: Game, x: number, y: number, r: number, delay: number, visual: Hazard['visual'], damage: number) =>
  spawn(g, { kind: 'strike', visual, x, y, r, damage, armAt: delay, disarmAt: delay + STRIKE_WINDOW, ttl: delay + 0.45 })

const zonesAlive = (g: Game) => {
  let n = 0
  for (const h of g.hazards) if (h.world && h.kind === 'zone') n++
  return n
}

/** Fires one world attack of `pattern` at a player (they take turns, `anchorPlayer`). Exported for the dev console (`ps.hazard`). */
export const fireWorldHazard = (g: Game, pattern: WorldPatternId) => {
  const p = anchorPlayer(g)
  const flavor = hazardFlavor(weatherHere(g), g.biome.id)
  const delay = hazardTelegraph(g.difficulty)
  const damage = hazardDamage(g.difficulty, g.time)
  switch (pattern) {
    case 'volley': {
      const def = WORLD_PATTERNS.volley
      const n = countAt(g, def.count)
      for (let i = 0; i < n; i++) {
        // The first lands right under the player; the rest scatter around them.
        const a = range(g.rng, 0, TAU)
        const d = i === 0 ? 0 : range(g.rng, def.radius, def.spread)
        strike(g, p.x + dm.cos(a) * d, p.y + dm.sin(a) * d * 0.8, def.radius, delay, flavor.strike, damage)
      }
      break
    }
    case 'line': {
      const def = WORLD_PATTERNS.line
      const n = countAt(g, def.count)
      const speed = dm.hypot(p.vx, p.vy)
      // Across the path ahead of a runner; through a player standing still, at any angle.
      const heading = speed > 10 ? dm.atan2(p.vy, p.vx) : range(g.rng, 0, TAU)
      const lead = speed > 10 ? def.lead : 0
      const cx = p.x + p.vx * lead
      const cy = p.y + p.vy * lead
      const ax = -dm.sin(heading)
      const ay = dm.cos(heading)
      const flip = g.rng() < 0.5 ? 1 : -1
      for (let i = 0; i < n; i++) {
        const k = (i - (n - 1) / 2) * def.gap * flip
        strike(g, cx + ax * k, cy + ay * k, def.radius, delay + i * def.sweep, flavor.strike, damage)
      }
      break
    }
    case 'zone': {
      const def = WORLD_PATTERNS.zone
      const n = countAt(g, def.count)
      for (let i = 0; i < n; i++) {
        const a = range(g.rng, 0, TAU)
        const d = i === 0 ? 0 : range(g.rng, def.radius, def.spread)
        spawn(g, {
          kind: 'zone',
          visual: flavor.zone,
          x: p.x + dm.cos(a) * d,
          y: p.y + dm.sin(a) * d * 0.8,
          r: def.radius,
          damage: damage * def.damage,
          armAt: delay,
          disarmAt: delay + def.ttl - 0.3,
          ttl: delay + def.ttl,
        })
      }
      break
    }
  }
  if (g.worldHazards.fired === 0) g.events.push({ kind: 'hazardIntro' })
  g.worldHazards.fired++
}

const PICKS = (Object.keys(WORLD_PATTERNS) as WorldPatternId[]).map((id) => [id, WORLD_PATTERNS[id].weight] as const)
const PICKS_NO_ZONE = PICKS.filter(([id]) => id !== 'zone')

const near: number[] = []

/** A world strike landing hurts the regular foes under it a little (bosses and foes in the air shrug it off). */
const landOnFoes = (g: Game, h: Hazard) => {
  const dmg = HAZARD_HIT.foeHp * scaling(g.time, DIFFICULTIES[g.difficulty].ramp).hp * HAZARD_HIT.foes
  for (const i of query(g.grid, h.x, h.y, h.r + 16, near)) {
    const e = g.enemies[i]
    if (!e || e.boss || e.dying >= 0 || isAirborne(e)) continue
    if (dm.sq(e.x - h.x) + dm.sq(e.y - h.y) >= dm.sq(h.r + e.radius)) continue
    bumpDamage(g, e, dmg, null)
  }
}

/**
 * Runs the world's attacks: fills the clock by the pace (`paceNow`), fires a
 * pattern when it's full, and lands world strikes on the foes under them. Runs
 * before `updateHazards`, which ages them and hurts the player.
 */
export const updateWorldHazards = (g: Game, dt: number) => {
  for (const h of g.hazards) {
    if (h.world && h.kind === 'strike' && h.age < h.armAt && h.age + dt >= h.armAt) landOnFoes(g, h)
  }
  const pace = paceNow(g)
  if (pace <= 0) return
  const state = g.worldHazards
  state.charge += (dt * pace) / hazardInterval(g.difficulty, g.time, g.endless !== null)
  if (state.charge < 1) return
  state.charge -= 1
  fireWorldHazard(g, weightedPick(g.rng, zonesAlive(g) < WORLD_PATTERNS.zone.max ? PICKS : PICKS_NO_ZONE))
}
