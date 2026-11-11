import { dirTo, TAU } from '../engine/math'
import { createRng, hash2, range } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import type { LakeId } from '../data/legends'
import { AZELF_STRIKES, LAKE_QUIRKS, ROAM } from '../data/quests'
import { throwPattern } from './bosses'
import { burst, shakeScreen } from './effects'
import { despawnEnemy, spawnEnemy } from './enemies'
import { nearestPlayer, playerWithin } from './players'
import { riftScale } from './rift'
import { roomOf } from './room'
import { clearSpot } from './terrain'
import type { Enemy, Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * The roaming lake trio (`ROAM` in `data/quests.ts`): a run whose seed brings
 * one sees it a few times, each visit a while somewhere near the player. It
 * runs from whoever comes close and flees for good once it has lost a share of
 * its HP in a visit, so it's worn down over several runs: the share left
 * carries over in the save (`Save.roamers`, banked by the shell from the
 * `roam` events), and the run that takes it to 0 catches it (`legendBeaten`).
 * Each has its quirk (`LAKE_QUIRKS`): Uxie blinks away and slips off the
 * minimap, Mesprit swings between joy and sorrow, Azelf stands and fights
 * until its will breaks. Its body is an `Enemy` with `behavior: 'roam'`.
 */

export type RoamState = {
  legend: LakeId
  /** Share of its max HP left: the save's as the run starts, lower with every hit. */
  left: number
  /** Run time of the next visit, and visits so far. */
  next: number
  visits: number
  /** Its body's id while it's on the map (-1 between visits), the share it began the visit with, and seconds left on it. */
  body: number
  began: number
  stay: number
  /** Its quirk's clock (Uxie's next blink, Mesprit's mood, Azelf's next strike) and Mesprit's mood (0 joy, 1 sorrow). */
  clock: number
  mood: number
  /** Run time until which the minimap loses it (Uxie's memory wipe), and whether Azelf's will broke this visit. */
  hidden: number
  broken: boolean
  caught: boolean
  /** Its draws (spots, blinks), from the seed apart from the run's rng. */
  draws: number
  seed: number
}

/** The moments the shell hears of: sighted, fled (its share banked), a memory wipe, or caught. */
export type RoamMoment = 'sighted' | 'fled' | 'wiped' | 'caught'

export const createRoam = (seed: number, legend: LakeId, left: number): RoamState => ({
  legend,
  left,
  next: ROAM.first[0] + hash2(seed, 5, 4421) * (ROAM.first[1] - ROAM.first[0]),
  visits: 0,
  body: -1,
  began: left,
  stay: 0,
  clock: 0,
  mood: 0,
  hidden: 0,
  broken: false,
  caught: false,
  draws: 0,
  seed,
})

/** A draw of the roamer's own (`n` tells them apart), so the run's rng never moves for it. */
const drawOf = (r: RoamState) => createRng(hash2(r.seed, 100 + r.draws++, 4421) * 0x100000000)

const notify = (g: Game, r: RoamState, moment: RoamMoment) => g.events.push({ kind: 'roam', legend: r.legend, moment, left: r.left })

/** The roamer's body on the map, if it's there. */
export const roamerBody = (g: Game) => {
  const r = g.quests.roam
  return r && r.body >= 0 ? (g.enemies.find((e) => e.id === r.body && e.dying < 0) ?? null) : null
}

/** Whether the minimap shows the roamer now: on the map and not wiped from the player's memory (Uxie). */
export const roamerShown = (g: Game) => {
  const r = g.quests.roam
  return r !== null && roamerBody(g) !== null && g.time >= r.hidden
}

/** A visit can start: the open map, no boss on it, no scene, not in endless mode's reaper hunt. */
const canVisit = (g: Game) => roomOf(g) === null && g.bossId === null && g.legendScene === null && g.rift.omen === null && g.rift.portal === null

const appear = (g: Game, r: RoamState) => {
  const rng = drawOf(r)
  const p = nearestPlayer(g, g.player.x, g.player.y)
  const a = range(rng, 0, TAU)
  const d = range(rng, ROAM.distance[0], ROAM.distance[1])
  const spot = clearSpot(g, { x: p.x + dm.cos(a) * d, y: p.y + dm.sin(a) * d }, 18)
  const def = ENEMIES[r.legend]
  const e = spawnEnemy(g, r.legend, dm.round(spot.x), dm.round(spot.y), { kind: 'roam' })
  e.maxHp = dm.round(def.hp * riftScale(g.time).hp * ROAM.hp[g.difficulty])
  e.hp = Math.max(1, dm.round(e.maxHp * r.left))
  e.speed = def.speed
  e.xp = 0
  r.body = e.id
  r.began = r.left
  r.stay = ROAM.stay
  r.visits++
  r.clock = 0
  r.mood = 0
  r.broken = false
  burst(g, e.x, e.y - 14, { colors: ['#ffffff', '#f8d048', '#f878b0', '#58a0f8'], count: 30, speed: 110, ttl: 0.6 })
  notify(g, r, 'sighted')
}

/** The visit ends: it vanishes (a flash where it stood) and comes back after a gap, unless it was the last. */
const leave = (g: Game, r: RoamState, e: Enemy) => {
  burst(g, e.x, e.y - 14, { colors: ['#ffffff', '#c8c8f0', '#f878b0'], count: 26, speed: 120, ttl: 0.5 })
  despawnEnemy(e)
  r.body = -1
  const rng = drawOf(r)
  r.next = g.time + range(rng, ROAM.gap[0], ROAM.gap[1])
  notify(g, r, 'fled')
}

/** Uxie's memory wipe: hit, it blinks away and drops off the minimap for a while. */
const uxie = (g: Game, r: RoamState, e: Enemy, hurt: boolean) => {
  const q = LAKE_QUIRKS.uxie
  if (!hurt || g.time < r.clock) return
  r.clock = g.time + q.every
  const rng = drawOf(r)
  const a = range(rng, 0, TAU)
  const d = range(rng, q.blink[0], q.blink[1])
  burst(g, e.x, e.y - 14, { colors: ['#ffffff', '#f8d048'], count: 18, speed: 90, ttl: 0.4 })
  const spot = clearSpot(g, { x: e.x + dm.cos(a) * d, y: e.y + dm.sin(a) * d }, 18)
  e.x = spot.x
  e.y = spot.y
  r.hidden = g.time + q.forget
  burst(g, e.x, e.y - 14, { colors: ['#ffffff', '#f8d048'], count: 18, speed: 90, ttl: 0.4 })
  notify(g, r, 'wiped')
}

/** Mesprit's emotion: joy and sorrow in turn; in sorrow it heals, never past the share it began the visit with. */
const mesprit = (g: Game, r: RoamState, e: Enemy, dt: number) => {
  const q = LAKE_QUIRKS.mesprit
  r.clock += dt
  if (r.clock >= q.swing) {
    r.clock -= q.swing
    r.mood = 1 - r.mood
    burst(g, e.x, e.y - 18, { colors: r.mood === 0 ? ['#f878b0', '#ffffff'] : ['#78a8f8', '#ffffff'], count: 12, speed: 50, ttl: 0.5, gravity: r.mood === 0 ? -40 : 60 })
  }
  if (r.mood === 1) e.hp = Math.min(e.hp + e.maxHp * q.heal * dt, e.maxHp * r.began)
}

/** Azelf's willpower: it stands and fights until it has lost `will` of its max HP this visit. */
const azelf = (g: Game, r: RoamState, e: Enemy, dt: number) => {
  const q = LAKE_QUIRKS.azelf
  if (r.broken) return
  if (r.began - e.hp / e.maxHp >= q.will) {
    r.broken = true
    shakeScreen(g, 4, e)
    burst(g, e.x, e.y - 14, { colors: ['#58a0f8', '#ffffff', '#f86868'], count: 30, speed: 120, ttl: 0.5 })
    return
  }
  r.clock -= dt
  if (r.clock > 0) return
  r.clock = q.every
  const p = nearestPlayer(g, e.x, e.y)
  const near = dm.sq(p.x - e.x) + dm.sq(p.y - e.y) < q.reach * q.reach
  throwPattern(g, e, AZELF_STRIKES[near ? 1 : 0]!, p)
}

/** Every tick on the open map: brings it in on schedule, keeps its share up to date, plays its quirk and sends it off when its visit is over. */
export const updateRoam = (g: Game, dt: number) => {
  const r = g.quests.roam
  if (!r || r.caught) return
  if (r.body < 0) {
    if (r.visits < ROAM.visits && g.time >= r.next && canVisit(g)) appear(g, r)
    return
  }
  const e = g.enemies.find((k) => k.id === r.body)
  if (!e) {
    r.body = -1
    return
  }
  // Brought down: caught (its capture plays where it fell, `legendBeaten`).
  if (e.dying >= 0) {
    r.left = 0
    r.caught = true
    r.body = -1
    notify(g, r, 'caught')
    return
  }
  const before = r.left
  r.left = Math.max(0, e.hp / e.maxHp)
  r.stay -= dt
  if (r.legend === 'uxie') uxie(g, r, e, r.left < before)
  else if (r.legend === 'mesprit') mesprit(g, r, e, dt)
  else azelf(g, r, e, dt)
  r.left = Math.max(0, e.hp / e.maxHp)
  const away = playerWithin(g, e.x, e.y, ROAM.escape) === null
  if (r.began - r.left >= ROAM.perVisit || r.stay <= 0 || away || !canVisit(g)) leave(g, r, e)
}

/**
 * How a roamer walks this tick (`updateEnemies`, `behavior: 'roam'`), at its
 * `pace`: away from a player who comes close, weaving, or ambling about;
 * Mesprit in joy circles the player instead, and Azelf with its will intact
 * keeps at its reach to fight.
 */
export const roamStep = (g: Game, e: Enemy, p: Player, pace: number, out: { x: number; y: number }) => {
  const r = g.quests.roam
  const d2 = dm.sq(p.x - e.x) + dm.sq(p.y - e.y)
  if (r?.legend === 'mesprit' && r.mood === 0) {
    // Joy: it circles the player, curious, at a slower pace.
    const q = LAKE_QUIRKS.mesprit
    const a = dm.atan2(e.y - p.y, e.x - p.x) + 0.6
    const to = dirTo(e.x, e.y, p.x + dm.cos(a) * q.orbit, p.y + dm.sin(a) * q.orbit)
    out.x = to.x * pace * 0.6
    out.y = to.y * pace * 0.6
    return
  }
  if (r?.legend === 'azelf' && !r.broken) {
    // Will intact: it closes in to its reach and holds there.
    const q = LAKE_QUIRKS.azelf
    const d = Math.sqrt(d2)
    const to = dirTo(e.x, e.y, p.x, p.y)
    const k = d > q.reach ? 0.7 : d < q.reach * 0.6 ? -0.5 : 0
    out.x = to.x * pace * k
    out.y = to.y * pace * k
    return
  }
  if (d2 < ROAM.fear * ROAM.fear) {
    const away = dirTo(p.x, p.y, e.x, e.y)
    const weave = dm.sin(g.now * 1.9 + e.id) * 0.7
    const c = dm.cos(weave)
    const s = dm.sin(weave)
    out.x = (away.x * c - away.y * s) * pace * ROAM.flee
    out.y = (away.x * s + away.y * c) * pace * ROAM.flee
    return
  }
  const heading = e.id * 1.7 + dm.sin(g.now * 0.4 + e.id) * 2.4
  out.x = dm.cos(heading) * pace * ROAM.amble
  out.y = dm.sin(heading) * pace * ROAM.amble
}
