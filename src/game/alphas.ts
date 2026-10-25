import { dir8, dirTo, TAU } from '../engine/math'
import { range, weightedPick, type Rng } from '../engine/rng'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { bossWaveAt, RUN_LENGTH, stageIndexAt } from '../data/waves'
import { spawnHazard } from './bosses'
import { hurtPlayer } from './combat'
import { harmBy } from './harm'
import { coopScale } from './coop'
import { COOP } from '../data/coop'
import type { Difficulty } from './difficulty'
import { burst, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import { openTeamPrize, xpFor } from './leveling'
import { dropPickup, dropXp } from './pickups'
import { inView } from './queries'
import { hasTrait, type StagePool } from './roster'
import { isHeld } from './status'
import { actAs, anchorPlayer, nearestPlayer, standing } from './players'
import type { Enemy, Game, Player } from './types'
import * as dm from '../engine/dmath'
import { roomOf } from './room'

/**
 * Alpha Pokémon (as in Legends: Arceus): an oversized, red-eyed member of the
 * stage's horde that roams with it every minute or so from 4:00. It isn't a
 * boss of the schedule: no HP bar slot, it never flees for the next wave and
 * its faint isn't a boss kill. To the combat rules it is one (`boss` set), so
 * it shrugs off knockback, executes and long holds. It walks at the player and
 * every few seconds, when close, aims a charge (a red line on the ground) and
 * dashes along it; on Nightmare the charge ends in a shockwave and it enrages
 * under half HP. Beaten, it drops a burst of EXP, ₽ and the Alpha's prize: a
 * level-up whose cards all come out rare.
 */

/** Knobs shared by every difficulty. */
export const ALPHA = {
  /** Integer draw scale; the hitbox is `bodyOf` × this, like the reaper's. */
  scale: 2,
  /**
   * HP times a regular of its species spawning now (`enemyScale`): `early` up to
   * `ramp[0]` s, growing to `late` by `ramp[1]` s, since builds grow faster than the
   * horde early on (measured: a fixed ×32 took 25–45 s of focused fire at 5:00 and 5–16 s at 10:00).
   */
  hp: { early: 12, late: 32, ramp: [240, 600] as const },
  /** Knockback resistance: knockback is divided by it, so the aura can't hold it back. */
  mass: 400,
  /** Walking pace, times its species'. */
  speed: 1.1,
  /** EXP it bursts into, in levels at the player's level (`xpFor`), on top of the prize. */
  xpLevels: 1,
  /** Seconds after one falls before the next may come. */
  gap: 25,
  /** No new Alpha this close to the finale (s before `RUN_LENGTH`) in the regular run; one still around flees when Mewtwo lands. */
  quiet: 30,
  /** Farther than this (× the screen diagonal) it blinks back to just off the screen's edge. */
  leash: 1.2,
  charge: {
    /** Starts aiming when the player is this close (px) and it's on screen. */
    range: 200,
    /** Seconds the aim line shows before the dash. */
    aim: 0.6,
    /** Dash speed: its walking pace times `speed`, kept within `[min, max]` px/s. */
    speed: 3,
    min: 110,
    max: 190,
    /** The dash runs this far past where the player stood when the aim locked. */
    overshoot: 70,
    /** Seconds it stands, winded, after a dash. */
    recover: 0.6,
    /** Seconds between charges. */
    every: [4, 5] as const,
  },
  /** Nightmare: the dash ends in a shockwave (`radius` px, `delay` s telegraph, contact damage × `damage`). */
  shock: { radius: 44, delay: 0.3, damage: 1.2 },
  /** Nightmare: under `at` of its HP it enrages, charging `cadence` × as often and `speed` × faster. */
  rage: { at: 0.5, cadence: 0.6, speed: 1.2 },
} as const

export type AlphaRules = {
  /** Run time (s) of the first one. */
  from: number
  /** Seconds between two, drawn in this range. */
  every: readonly [number, number]
  /** At most this many at once. */
  alive: number
  /** The dash ends in a shockwave. */
  shock: boolean
  /** Enrages under half HP. */
  rage: boolean
  /** `every` is multiplied by this in endless mode. */
  endless: number
  /** A due Alpha waits while a wave boss is in its first `bossQuiet` s (0: it doesn't wait). */
  bossQuiet: number
  /** Its HP times this, on top of the difficulty's: Nightmare's threat is its charges and numbers, not a longer fight. */
  hp: number
  /** Contact damage, times a regular's. */
  damage: number
  /** The dash's hit (once per dash), times its contact damage. */
  hit: number
}

/**
 * Per difficulty: Nightmare starts earlier, comes more often, two at once, with
 * the shockwave and the rage. Measured with a focused build (Treecko, bot): Normal
 * takes 5–17 s to beat one at 10:00–14:00, Hard 5–16 s; Nightmare took 16–34 s at full HP, hence its `hp`.
 * Normal's hits softer: a casual player who stands still should get hurt, not flattened.
 */
export const ALPHA_RULES = {
  normal: { from: 240, every: [85, 100], alive: 1, shock: false, rage: false, endless: 0.6, bossQuiet: 45, hp: 1, damage: 1.2, hit: 1 },
  hard: { from: 240, every: [75, 90], alive: 1, shock: false, rage: false, endless: 0.6, bossQuiet: 30, hp: 1, damage: 2, hit: 1.4 },
  nightmare: { from: 240, every: [60, 75], alive: 2, shock: true, rage: true, endless: 0.6, bossQuiet: 0, hp: 0.7, damage: 2, hit: 1.6 },
} as const satisfies Record<Difficulty, AlphaRules>

/** The run's Alpha schedule: when the next one is due. */
export type AlphaClock = { next: number }

export const createAlphaClock = (difficulty: Difficulty): AlphaClock => ({ next: ALPHA_RULES[difficulty].from })

/** walk → aim (the line shows) → dash → recover → walk. */
export type AlphaPhase = 'walk' | 'aim' | 'dash' | 'recover'

export type AlphaState = {
  phase: AlphaPhase
  /** Seconds into the phase. */
  t: number
  /** Seconds until it may aim again. */
  cooldown: number
  /** Where the dash starts and its unit direction, locked when the aim starts. */
  ox: number
  oy: number
  dx: number
  dy: number
  /** How far this dash goes (px), and how far it went. */
  length: number
  run: number
  /** This dash already hit the player. */
  hit: boolean
  /** Its walking speed (its `speed` is 0 while it aims, dashes and recovers). */
  pace: number
  enraged: boolean
}

/**
 * The species an Alpha of `pool` may be: the stage's highest tier, behavior
 * traits left out (a giant Voltorb's blast would be the whole fight). Each with its spawn weight.
 */
export const alphaCandidates = (pool: StagePool): StagePool => {
  const plain = pool.filter(([id]) => !hasTrait(id))
  const tierOf = (id: EnemyId) => (ENEMIES[id] as EnemyDef).tier ?? 0
  const top = Math.max(0, ...plain.map(([id]) => tierOf(id)))
  return plain.filter(([id]) => tierOf(id) === top)
}

export const pickAlpha = (rng: Rng, pool: StagePool): EnemyId | null => {
  const open = alphaCandidates(pool)
  return open.length > 0 ? weightedPick(rng, open) : null
}

/** An Alpha's HP multiplier over a regular spawning at `time` (`ALPHA.hp`). */
export const alphaHp = (time: number) => {
  const { early, late, ramp } = ALPHA.hp
  return early + (late - early) * Math.min(1, Math.max(0, (time - ramp[0]) / (ramp[1] - ramp[0])))
}

/** The charge's dash speed (px/s) for a walking `pace`, faster when enraged. */
export const dashSpeed = (pace: number, enraged: boolean) =>
  Math.min(ALPHA.charge.max, Math.max(ALPHA.charge.min, pace * ALPHA.charge.speed)) * (enraged ? ALPHA.rage.speed : 1)

/** Draw scale of an enemy: an Alpha's, or its species' (the reaper's). */
export const drawScale = (e: Enemy) => (e.alpha ? ALPHA.scale : ((ENEMIES[e.kind] as EnemyDef).scale ?? 1))

/** Turns `kind` into an Alpha at (x, y): the director's and the dev console's (`ps.alpha`). */
export const spawnAlpha = (g: Game, kind: EnemyId, x: number, y: number) => {
  const e = spawnEnemy(g, kind, x, y)
  e.boss = true
  // Co-op: an Alpha takes the bosses' scaling instead of the horde's (exactly 1 solo).
  e.hp = e.maxHp = dm.round(e.maxHp * alphaHp(g.time) * ALPHA_RULES[g.difficulty].hp * (coopScale(g, COOP.scale.bossHp) / coopScale(g, COOP.scale.hp)))
  e.damage *= ALPHA_RULES[g.difficulty].damage
  e.mass = ALPHA.mass
  e.radius *= ALPHA.scale
  e.speed *= ALPHA.speed
  // Its EXP comes as the burst `alphaDown` drops.
  e.xp = 0
  e.alpha = {
    phase: 'walk', t: 0, cooldown: range(g.rng, ...ALPHA.charge.every) * 0.5,
    ox: x, oy: y, dx: 1, dy: 0, length: 0, run: 0, hit: false, pace: e.speed, enraged: false,
  }
  shakeScreen(g, 4, e)
  g.events.push({ kind: 'alpha', enemy: kind, moment: 'spawn' })
  return e
}

/** A wave boss in its first `quiet` seconds: a due Alpha waits for it. */
const bossFighting = (g: Game, quiet: number) =>
  quiet > 0 && g.enemies.some((e) => e.boss && !e.alpha && e.dying < 0 && g.now - e.bornAt < quiet && bossWaveAt(e.kind) !== null)

/** Brings an Alpha in, off screen, when one is due and there's room for it. */
const direct = (g: Game) => {
  const rules: AlphaRules = ALPHA_RULES[g.difficulty]
  if (g.time < g.alphas.next || (!g.endless && g.time >= RUN_LENGTH - ALPHA.quiet)) return
  let alive = 0
  for (const e of g.enemies) if (e.alpha && e.dying < 0) alive++
  if (alive >= rules.alive || bossFighting(g, rules.bossQuiet)) return
  const kind = pickAlpha(g.rng, g.roster.stages[stageIndexAt(g.time)] ?? [])
  const wait = range(g.rng, ...rules.every) * (g.endless ? rules.endless : 1)
  g.alphas.next = g.time + wait
  if (!kind) return
  const a = range(g.rng, 0, TAU)
  const d = dm.hypot(g.view.w, g.view.h) / 2 + 24
  const p = anchorPlayer(g)
  spawnAlpha(g, kind, p.x + dm.cos(a) * d, p.y + dm.sin(a) * d)
}

/** Mewtwo landed: an Alpha still around runs off (the last fight stays a duel). */
const flee = (g: Game, e: Enemy) => {
  const p = nearestPlayer(g, e.x, e.y)
  const d = dirTo(p.x, p.y, e.x, e.y)
  e.dying = 0
  e.fled = true
  e.kx = d.x * 260
  e.ky = d.y * 260
  e.dir = dir8(d.x, d.y)
  g.events.push({ kind: 'bossFled', enemy: e.kind })
}

/** Aims a charge at player `p`: the red lane runs through them and a bit past. */
const startAim = (g: Game, e: Enemy, a: AlphaState, p: Player) => {
  const d = dirTo(e.x, e.y, p.x, p.y)
  a.phase = 'aim'
  a.t = 0
  a.ox = e.x
  a.oy = e.y
  a.dx = d.x
  a.dy = d.y
  a.length = dm.hypot(p.x - e.x, p.y - e.y) + ALPHA.charge.overshoot
  e.speed = 0
  e.dir = dir8(d.x, d.y)
  g.events.push({ kind: 'alpha', enemy: e.kind, moment: 'aim' })
}

const recover = (g: Game, e: Enemy, a: AlphaState) => {
  a.phase = 'recover'
  a.t = 0
  if (!ALPHA_RULES[g.difficulty].shock) return
  spawnHazard(g, {
    kind: 'strike', visual: 'slam', x: e.x, y: e.y, r: ALPHA.shock.radius, damage: e.damage * ALPHA.shock.damage,
    armAt: ALPHA.shock.delay, disarmAt: ALPHA.shock.delay + 0.15, ttl: ALPHA.shock.delay + 0.45, by: harmBy(e),
  })
  g.events.push({ kind: 'alpha', enemy: e.kind, moment: 'shock' })
}

/** A charge's step along its lane: the first player it runs into takes the hit (once per charge). */
const dash = (g: Game, e: Enemy, a: AlphaState, dt: number) => {
  const step = Math.min(dashSpeed(a.pace, a.enraged) * dt, a.length - a.run)
  e.x += a.dx * step
  e.y += a.dy * step
  a.run += step
  for (const p of g.players) {
    if (a.hit || !standing(g, p) || !(dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < dm.sq(e.radius + p.radius))) continue
    a.hit = true
    const before = actAs(g, p)
    hurtPlayer(g, e.damage * ALPHA_RULES[g.difficulty].hit, e)
    actAs(g, before)
  }
  if (g.rng() < dt * 20) burst(g, e.x - a.dx * e.radius, e.y, { colors: ['#c8b080', '#a08858'], count: 2, speed: 30, ttl: 0.3, drag: 6 })
  if (a.run >= a.length - 0.01) recover(g, e, a)
}

/** One Alpha's tick: rage, leash, and the charge cycle at the nearest player (a hold cancels a charge in progress). */
const act = (g: Game, e: Enemy, a: AlphaState, dt: number) => {
  const rules: AlphaRules = ALPHA_RULES[g.difficulty]
  const p = nearestPlayer(g, e.x, e.y)
  if (rules.rage && !a.enraged && e.hp < e.maxHp * ALPHA.rage.at) {
    a.enraged = true
    a.pace *= ALPHA.rage.speed
    if (a.phase === 'walk') e.speed = a.pace
    burst(g, e.x, e.y - e.radius, { colors: ['#f83020', '#f8a020', '#ffffff'], count: 40, speed: 150, ttl: 0.6, size: 2, drag: 4 })
    g.events.push({ kind: 'alpha', enemy: e.kind, moment: 'enrage' })
  }
  const dist = dm.hypot(p.x - e.x, p.y - e.y)
  if (a.phase === 'walk' && dist > dm.hypot(g.view.w, g.view.h) * ALPHA.leash) {
    const edge = dm.hypot(g.view.w, g.view.h) / 2 + 24
    e.x = p.x + ((e.x - p.x) / dist) * edge
    e.y = p.y + ((e.y - p.y) / dist) * edge
  }
  const held = e.status.stun > 0 || isHeld(e.status)
  if (held && a.phase !== 'walk') a.phase = 'recover'
  switch (a.phase) {
    case 'walk':
      a.cooldown -= dt
      if (!held && a.cooldown <= 0 && dist < ALPHA.charge.range && inView(g, e.x, e.y, -8)) startAim(g, e, a, p)
      return
    case 'aim':
      a.t += dt
      if (a.t < ALPHA.charge.aim) return
      a.phase = 'dash'
      a.t = 0
      a.run = 0
      a.hit = false
      g.events.push({ kind: 'alpha', enemy: e.kind, moment: 'charge' })
      return
    case 'dash':
      return dash(g, e, a, dt)
    case 'recover':
      a.t += dt
      if (a.t < ALPHA.charge.recover) return
      a.phase = 'walk'
      e.speed = a.pace
      a.cooldown = range(g.rng, ...ALPHA.charge.every) * (a.enraged ? ALPHA.rage.cadence : 1)
  }
}

/**
 * Runs before `updateEnemies` (so a dash's hit lands before the body's
 * contact): brings Alphas in on schedule outside rooms (rift arenas, places) and moves the ones alive.
 */
export const updateAlphas = (g: Game, dt: number) => {
  const arena = roomOf(g) !== null
  if (!arena) direct(g)
  const finale = !g.endless && g.time >= RUN_LENGTH
  for (const e of g.enemies) {
    if (!e.alpha || e.dying >= 0) continue
    if (finale && !arena) flee(g, e)
    else act(g, e, e.alpha, dt)
  }
}

/**
 * An Alpha fainted (`killEnemy`; ₽ come from its boss coin drop): a burst of
 * EXP worth `ALPHA.xpLevels` levels and the prize, and the next one waits at least `ALPHA.gap`.
 */
export const alphaDown = (g: Game, e: Enemy) => {
  const xp = dm.round(xpFor(g.player.level) * ALPHA.xpLevels)
  const candies = 6
  for (let i = 0; i < candies; i++) dropXp(g, e.x + range(g.rng, -14, 14), e.y + range(g.rng, -8, 8), Math.ceil(xp / candies))
  // One prize for the whole team: whoever takes it opens it for everyone (`openAlphaPrize`).
  dropPickup(g, e.x, e.y, 'alphaPrize')
  g.alphas.next = Math.max(g.alphas.next, g.time + ALPHA.gap)
  shakeScreen(g, 6, e)
  burst(g, e.x, e.y - e.radius, { colors: ['#f83020', '#f8d030', '#ffffff'], count: 50, speed: 170, ttl: 0.7, size: 2, drag: 3 })
  g.events.push({ kind: 'alpha', enemy: e.kind, moment: 'down' })
}

/**
 * The Alpha's prize picked up: a prize level-up of rare cards opens at once,
 * for the whole team in co-op (`openTeamPrize`), so nobody crosses the map for
 * an Alpha a teammate beat.
 */
export const openAlphaPrize = (g: Game) => {
  openTeamPrize(g, 'alpha')
  g.events.push({ kind: 'alphaPrize' })
}
