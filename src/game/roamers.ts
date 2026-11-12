import { dir8, dirTo, TAU } from '../engine/math'
import { momentBusy } from './legendMoments'
import { createRng, hash2, range } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { FORCE_PATTERNS, FORCE_PHASE_AT, FORCE_QUIRKS, FORCE_ROAM, FORCE_WEATHER } from '../data/forces'
import { WAVE_LEGEND_SHINY } from '../data/legendBosses'
import { isForceLegend, type ForceId, type RoamerId } from '../data/legends'
import { AZELF_STRIKES, LAKE_QUIRKS, ROAM } from '../data/quests'
import type { BossPattern } from '../data/bosses'
import { throwPattern } from './bosses'
import { burst, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import { nearestPlayer, playerWithin } from './players'
import { riftScale } from './rift'
import { roomOf } from './room'
import { clearSpot } from './terrain'
import type { Enemy, Game, Player } from './types'
import { callWeather } from './weather'
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
 *
 * The Forces of Nature roam the same way (`data/forces.ts`), with rules of
 * their own (`FORCE_ROAM`): each visit brings its weather, the first one a
 * run plays an entrance with its title card (`legendScene.ts`), and they fight
 * back in three phases by the share of HP they have left across runs
 * (`FORCE_PATTERNS`), each moving its own way (`FORCE_QUIRKS`).
 */

export type RoamState = {
  legend: RoamerId
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
  /** A Force's: whether it comes shiny this run (drawn at its first visit), the phase its HP has reached (`FORCE_PHASE_AT`), and the hits it took this visit (Enamorus's Contrary). */
  shiny: boolean
  phase: number
  hits: number
}

/** The moments the shell hears of: sighted, fled (its share banked), a memory wipe, a Force's new phase, or caught. */
export type RoamMoment = 'sighted' | 'fled' | 'wiped' | 'rage' | 'caught'

/** A roamer's rules: the lake trio's (`ROAM`) or the Forces' (`FORCE_ROAM`). */
const rulesOf = (legend: RoamerId) => (isForceLegend(legend) ? FORCE_ROAM : ROAM)

/** A Force's phase (0, 1 or 2) at `left` of its HP. */
export const forcePhase = (left: number) => FORCE_PHASE_AT.filter((at) => left < at).length

export const createRoam = (seed: number, legend: RoamerId, left: number): RoamState => ({
  legend,
  left,
  next: rulesOf(legend).first[0] + hash2(seed, 5, 4421) * (rulesOf(legend).first[1] - rulesOf(legend).first[0]),
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
  shiny: false,
  phase: forcePhase(left),
  hits: 0,
})

/** A draw of the roamer's own (`n` tells them apart), so the run's rng never moves for it. */
const drawOf = (r: RoamState) => createRng(hash2(r.seed, 100 + r.draws++, 4421) * 0x100000000)

const notify = (g: Game, r: RoamState, moment: RoamMoment) => g.events.push({ kind: 'roam', legend: r.legend, moment, left: r.left, phase: r.phase })

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

/** A visit can start: the open map, no boss on it, no scene, no other legend moment under way (a rift on its way, a Tera den, a Sword's duel, the temple waking). */
const canVisit = (g: Game) => roomOf(g) === null && g.bossId === null && g.legendScene === null && !momentBusy(g, 'roam')

const appear = (g: Game, r: RoamState) => {
  const rules = rulesOf(r.legend)
  const rng = drawOf(r)
  const p = nearestPlayer(g, g.player.x, g.player.y)
  const a = range(rng, 0, TAU)
  const d = range(rng, rules.distance[0], rules.distance[1])
  const spot = clearSpot(g, { x: p.x + dm.cos(a) * d, y: p.y + dm.sin(a) * d }, 18)
  const def = ENEMIES[r.legend]
  const e = spawnEnemy(g, r.legend, dm.round(spot.x), dm.round(spot.y), { kind: 'roam' })
  e.maxHp = dm.round(def.hp * riftScale(g.time).hp * rules.hp[g.difficulty])
  e.hp = Math.max(1, dm.round(e.maxHp * r.left))
  e.speed = def.speed
  e.xp = 0
  r.body = e.id
  r.began = r.left
  r.stay = rules.stay
  r.visits++
  r.clock = 0
  r.mood = 0
  r.broken = false
  r.hits = 0
  if (isForceLegend(r.legend)) return arrive(g, r, e, rng)
  burst(g, e.x, e.y - 14, { colors: ['#ffffff', '#f8d048', '#f878b0', '#58a0f8'], count: 30, speed: 110, ttl: 0.6 })
  notify(g, r, 'sighted')
}

/** A Force's colors, for the bursts of its arrival, its rage and its leaving. */
const FORCE_COLORS = {
  tornadus: ['#ffffff', '#b8f0d8', '#78c068', '#d8f8ff'],
  thundurus: ['#ffffff', '#f8e858', '#6898d8', '#c8d8f8'],
  landorus: ['#ffffff', '#f8c870', '#d8a048', '#a87038'],
  enamorus: ['#ffffff', '#f8b8d8', '#f088b8', '#f8e0a0'],
} as const satisfies Record<ForceId, readonly string[]>

/**
 * A Force arrives: its weather rolls in for the visit, and the first visit of
 * a run plays its entrance (the camera's trip, its title card) with the world
 * held, shiny one time in `WAVE_LEGEND_SHINY` as the wave legendaries.
 */
const arrive = (g: Game, r: RoamState, e: Enemy, rng: () => number) => {
  const legend = r.legend
  if (!isForceLegend(legend)) return
  callWeather(g, FORCE_WEATHER[legend], FORCE_ROAM.stay + 3)
  if (r.visits === 1) r.shiny = rng() < WAVE_LEGEND_SHINY
  e.shiny = r.shiny
  r.clock = FORCE_QUIRKS[legend].every * 0.6
  burst(g, e.x, e.y - 14, { colors: [...FORCE_COLORS[legend]], count: 40, speed: 130, ttl: 0.7 })
  if (r.visits === 1 && g.legendScene === null) g.legendScene = { kind: 'entrance', enemy: legend, bossId: e.id, t: 0, capture: null, next: [], then: null }
  notify(g, r, 'sighted')
}

/** The visit ends: it bolts away from the nearest player, fading as it goes (a flash where it stood), and comes back after a gap, unless it was the last. */
const leave = (g: Game, r: RoamState, e: Enemy) => {
  burst(g, e.x, e.y - 14, { colors: ['#ffffff', '#c8c8f0', '#f878b0'], count: 26, speed: 120, ttl: 0.5 })
  const p = nearestPlayer(g, e.x, e.y)
  const away = dirTo(p.x, p.y, e.x, e.y)
  e.dying = 0
  e.fled = true
  e.kx = away.x * 240
  e.ky = away.y * 240
  e.dir = dir8(away.x, away.y)
  r.body = -1
  const rng = drawOf(r)
  const rules = rulesOf(r.legend)
  r.next = g.time + range(rng, rules.gap[0], rules.gap[1])
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

/**
 * A Force's fight on its visit: its phase follows the HP it has left (a new
 * one is a roar, `rage`), and every `every` s it throws the next attack of
 * its phase's list. Landorus stands until its will breaks; Enamorus's
 * Contrary makes its attacks come sooner with every hit it takes.
 */
const force = (g: Game, r: RoamState, e: Enemy, legend: ForceId, dt: number, hurt: boolean) => {
  const q = FORCE_QUIRKS[legend]
  const phase = forcePhase(r.left)
  if (phase > r.phase) {
    r.phase = phase
    r.clock = Math.min(r.clock, 0.8)
    shakeScreen(g, 6, e)
    burst(g, e.x, e.y - 16, { colors: [...FORCE_COLORS[legend]], count: 50, speed: 150, ttl: 0.6, size: 2 })
    notify(g, r, 'rage')
  }
  if (hurt) r.hits++
  if (q.kind === 'stand' && !r.broken && r.began - r.left >= q.will) {
    r.broken = true
    shakeScreen(g, 4, e)
    burst(g, e.x, e.y - 14, { colors: [...FORCE_COLORS[legend]], count: 30, speed: 120, ttl: 0.5 })
  }
  // Landorus with its will broken runs like the others and stops fighting.
  if (q.kind === 'stand' && r.broken) return
  const rush = q.kind === 'orbit' ? 1 + Math.min(q.rush, r.hits * q.contrary) : 1
  r.clock -= dt * rush
  if (r.clock > 0) return
  r.clock = q.every
  const phases: readonly (readonly BossPattern[])[] = FORCE_PATTERNS[legend]
  const list = phases[Math.min(phases.length - 1, r.phase)]!
  const pattern = list[r.mood % list.length]!
  r.mood++
  throwPattern(g, e, pattern, nearestPlayer(g, e.x, e.y))
}

/** Every tick on the open map: brings it in on schedule, keeps its share up to date, plays its quirk and sends it off when its visit is over. */
export const updateRoam = (g: Game, dt: number) => {
  const r = g.quests.roam
  if (!r || r.caught) return
  const rules = rulesOf(r.legend)
  if (r.body < 0) {
    if (r.visits < rules.visits && g.time >= r.next && canVisit(g)) appear(g, r)
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
  if (isForceLegend(r.legend)) force(g, r, e, r.legend, dt, r.left < before)
  else if (r.legend === 'uxie') uxie(g, r, e, r.left < before)
  else if (r.legend === 'mesprit') mesprit(g, r, e, dt)
  else azelf(g, r, e, dt)
  r.left = Math.max(0, e.hp / e.maxHp)
  const away = playerWithin(g, e.x, e.y, rules.escape) === null
  if (r.began - r.left >= rules.perVisit || r.stay <= 0 || away || !canVisit(g)) leave(g, r, e)
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
  if (r && isForceLegend(r.legend) && forceStep(r, e, p, pace, d2, out)) return
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
  const rules = r ? rulesOf(r.legend) : ROAM
  if (d2 < rules.fear * rules.fear) {
    const away = dirTo(p.x, p.y, e.x, e.y)
    const weave = dm.sin(g.now * 1.9 + e.id) * 0.7
    const c = dm.cos(weave)
    const s = dm.sin(weave)
    out.x = (away.x * c - away.y * s) * pace * rules.flee
    out.y = (away.x * s + away.y * c) * pace * rules.flee
    return
  }
  const heading = e.id * 1.7 + dm.sin(g.now * 0.4 + e.id) * 2.4
  out.x = dm.cos(heading) * pace * rules.amble
  out.y = dm.sin(heading) * pace * rules.amble
}

/**
 * A Force's own way of moving (`FORCE_QUIRKS`), or false to run and amble
 * like the lake trio (Tornadus always, Landorus once its will breaks):
 * Thundurus keeps its range, Landorus closes in to fight, Enamorus circles.
 */
const forceStep = (r: RoamState, e: Enemy, p: Player, pace: number, d2: number, out: { x: number; y: number }) => {
  if (!isForceLegend(r.legend)) return false
  const q = FORCE_QUIRKS[r.legend]
  if (q.kind === 'flee' || (q.kind === 'stand' && r.broken)) return false
  const d = Math.sqrt(d2)
  const to = dirTo(e.x, e.y, p.x, p.y)
  if (q.kind === 'orbit') {
    const a = dm.atan2(e.y - p.y, e.x - p.x) + 0.55
    const at = dirTo(e.x, e.y, p.x + dm.cos(a) * q.range, p.y + dm.sin(a) * q.range)
    out.x = at.x * pace * 0.75
    out.y = at.y * pace * 0.75
    return true
  }
  // Thundurus hangs back in its clouds, Landorus presses in to fight.
  const k = d > q.range * 1.15 ? 0.7 : d < q.range * (q.kind === 'hold' ? 0.8 : 0.6) ? -0.6 : 0
  const side = q.kind === 'hold' ? dm.sin(e.id * 0.7 + d * 0.01) * 0.4 : 0
  out.x = (to.x * k - to.y * side) * pace
  out.y = (to.y * k + to.x * side) * pace
  return true
}
