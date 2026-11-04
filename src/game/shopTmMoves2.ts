import { dirTo, fromAngle, TAU } from '../engine/math'
import { ownAttack } from './players'
import * as dm from '../engine/dmath'
import { burst, shakeScreen } from './effects'
import { burrowTime } from './kitRules'
import { burrow, took } from './moveKit'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import type { StatusSpec } from './status'
import type { Game, OwnedMove } from './types'
import { callWeather } from './weather'

/**
 * The shop-exclusive TMs, second batch (the first is `shopTmMoves.ts`, which
 * spreads this table into `SHOP_TM_MOVES`): sold only on the Kecleon Shop's
 * TM shelf, never evolving, growing through forks at Lv 4 and 7.
 *
 * - Rain Dance and Sunny Day call their weather over the run's for
 *   `duration` s (`callWeather`: the scheduled sky comes back after), and
 *   while it lasts raindrops or sunbeams fall on the foes around you
 *   (`shopTmSystem.ts` ticks them). Rain boosts Water ×1.5 and weakens Fire;
 *   the sun the other way round, foes' attacks included.
 * - Swords Dance stacks might for a few seconds, a stack a dance.
 * - Drain Punch heals a share of its damage (the kit's drain).
 * - Thunder Wave paralyzes a cone for `duration` s.
 * - Fly takes off (invulnerable, lost to the foes: the kit's burrow) and
 *   slams down where it lands.
 *
 * Like `tmMoves.ts`, this module must not import `moves.ts` at runtime: it is
 * evaluated while `MOVES` is built. Art in `render/shopTmFx2.ts`.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else the way the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, reach)
  const d = e ? dirTo(p.x, p.y, e.x, e.y - e.radius, p.facing) : p.facing
  return dm.atan2(d.y, d.x)
}

const fan = (center: number, count: number, step: number) => Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step)

/* ---------------- Tuning (the renderer and the system read some) ---------------- */

/**
 * Rain Dance and Sunny Day: every `every` s of their weather, `amount`
 * raindrops or sunbeams fall on random foes within `reach` of the player,
 * `fall` s after a warning ring, each a splash of `r` (× area).
 */
export const WEATHER_CALL = { every: 0.9, reach: 150, fall: 0.35, r: 13, linger: 0.3 } as const
/** Rain Dance's Soothing Rain: max HP healed per second while its rain falls on the player. */
export const RAIN_DANCE = { heal: 0.008 } as const
/** Sunny Day's sun-lit ring around the player (× area): Scorching Sun burns the foes in it, every beat of the sun. */
export const SUNNY_DAY = { ring: 56, burn: { kind: 'burn', chance: 1, duration: 2.5, power: 0.3 } } as const satisfies { ring: number; burn: StatusSpec }
/** Swords Dance: might per stack, the stacks it holds (`more` on Sharper Blades), and its whirling swords. */
export const SWORDS_DANCE = { might: 0.08, max: 3, more: 2, radius: 24, spin: 7, r: 7, ttl: 0.75, hitInterval: 0.25 } as const
/** Drain Punch: its reach, the fist's size, and the share of the damage it heals (plus the cast's status chance, which the forks raise). */
export const DRAIN_PUNCH = { reach: 64, ahead: 16, r: 13, share: 0.35, spread: 0.7, ttl: 0.26, active: 0.1 } as const
/** Thunder Wave: the wave's front (`circles` + amount sparks in a cone `cone` + `widen` × amount wide, radians), how far it runs, its aim. */
export const THUNDER_WAVE = { reach: 220, circles: 4, cone: 0.32, widen: 0.1, r: 11, ttl: 0.6 } as const
/** Fly: how high the player rises, the slam's radius (× area) and the i-frames after landing. */
export const FLY = { lift: 34, slam: 38, grow: 0.12, iframes: 0.35 } as const

/* ---------------- Pure rules ---------------- */

/** Swords Dance's stacks after a dance: one more while the last dance's buff still holds (up to `cap`), else a fresh one. */
export const danceStacks = (stacks: number, holding: boolean, cap: number) => (holding ? Math.min(cap, stacks + 1) : 1)

/** How many stacks Swords Dance holds: Sharper Blades (its Lv 4 first branch) adds `SWORDS_DANCE.more`. */
export const danceCap = (owned: OwnedMove) => SWORDS_DANCE.max + (took(owned, 4, 0) ? SWORDS_DANCE.more : 0)

/** Drain Punch's share of the damage healed: the base plus the cast's status chance (More Lifesteal raises it). */
export const punchDrain = (s: Pick<CastStats, 'statusChance'>) => DRAIN_PUNCH.share + s.statusChance

/** Thunder Wave's paralysis: always lands, and lasts the cast's `duration` (Lingering Static stretches it; bosses shrug off most of it, `STATUS_RULES`). */
export const waveParalysis = (s: Pick<CastStats, 'status' | 'duration'>): StatusSpec | null => s.status && { ...s.status, chance: 1, duration: s.duration }

/* ---------------- Casts ---------------- */

/**
 * Calls the move's weather for `duration` s (unless an omen holds the sky or
 * the player is in a room) and leaves a marker on the player while it lasts:
 * `shopTmSystem.ts` drops its raindrops or sunbeams every `WEATHER_CALL.every`
 * s. Casting again while one runs renews it instead of stacking a second.
 */
const callSky = (g: Game, s: CastStats, l: Look, weather: 'rain' | 'sun') => {
  const p = g.player
  callWeather(g, weather, s.duration)
  // The marker's radius is the sun-lit ring's (Scorching Sun burns in it; the renderer draws it).
  const r = SUNNY_DAY.ring * s.area
  const running = g.attacks.find((a) => ownAttack(g, a) && a.visual === l.visual && a.move === l.move && a.age < a.ttl)
  if (running) {
    running.ttl = running.age + s.duration
    running.shape = { kind: 'circle', r }
  } else {
    spawnAttack(g, {
      ...l, x: p.x, y: p.y, shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: 0, oy: 0 },
      damage: 0, ttl: s.duration, activeFrom: Infinity, mod: null,
    })
  }
  const colors = weather === 'rain' ? ['#ffffff', '#a8c8f8', '#6890f0'] : ['#ffffff', '#fff3a0', '#f8b030']
  burst(g, p.x, p.y - 14, { colors, count: 18, speed: 90, ttl: 0.5, gravity: weather === 'rain' ? 160 : -60 })
  cast(g, l.move)
}

/**
 * Swords whirl around the player and the dance adds a stack of might (one
 * more while the last one's buff holds, up to `danceCap`), for `duration` s.
 */
const swordsDance = (g: Game, s: CastStats, owned: OwnedMove) => {
  const p = g.player
  const holding = p.moveBuffs.some((b) => b.move === 'swordsDance')
  const stacks = danceStacks(owned.stacks ?? 0, holding, danceCap(owned))
  owned.stacks = stacks
  addMoveBuff(g, 'swordsDance', s.duration, { might: stacks * SWORDS_DANCE.might })
  const start = g.now * 3
  for (let i = 0; i < s.amount; i++) {
    const angle = start + (i / s.amount) * TAU
    const radius = SWORDS_DANCE.radius * s.area
    spawnAttack(g, {
      ...look('swordsDance', 'normal', 'swordsDance'), x: p.x + dm.cos(angle) * radius, y: p.y - 8 + dm.sin(angle) * radius,
      shape: { kind: 'circle', r: SWORDS_DANCE.r * s.area }, motion: { kind: 'orbit', angle, spin: SWORDS_DANCE.spin, radius },
      damage: s.damage, knockback: s.knockback, hitInterval: SWORDS_DANCE.hitInterval, ttl: SWORDS_DANCE.ttl,
    })
  }
  burst(g, p.x, p.y - 16, { colors: ['#ffffff', '#d8d8f0', '#f85858'], count: 8 + stacks * 2, speed: 80, ttl: 0.35 })
  cast(g, 'swordsDance')
}

/** A glowing fist jabs at the nearest foe (a fan of them with more), each healing `punchDrain` of what it deals. */
const drainPunch = (g: Game, s: CastStats) => {
  const p = g.player
  const drain = punchDrain(s)
  fan(aimAngle(g, DRAIN_PUNCH.reach), s.amount, DRAIN_PUNCH.spread).forEach((angle, i) => {
    const off = fromAngle(angle, DRAIN_PUNCH.ahead * s.area)
    spawnAttack(g, {
      ...look('drainPunch', 'fighting', 'drainPunch'), x: p.x + off.x, y: p.y - 8 + off.y,
      shape: { kind: 'circle', r: DRAIN_PUNCH.r * s.area }, motion: { kind: 'follow', ox: off.x, oy: off.y - 8 },
      damage: s.damage, knockback: s.knockback, drain, ttl: DRAIN_PUNCH.ttl, activeUntil: DRAIN_PUNCH.active, age: -i * 0.08, memo: angle,
    })
  })
  cast(g, 'drainPunch')
}

/** A cone of static rolls out toward the nearest foe, paralyzing everything it washes over (`waveParalysis`). */
const thunderWave = (g: Game, s: CastStats) => {
  const p = g.player
  const count = THUNDER_WAVE.circles + s.amount
  const cone = THUNDER_WAVE.cone + THUNDER_WAVE.widen * (s.amount - 1)
  const hits = new Map<number, number>()
  const status = waveParalysis(s)
  const speed = s.speed
  fan(aimAngle(g, THUNDER_WAVE.reach), count, (2 * cone) / Math.max(1, count - 1)).forEach((angle) => {
    const v = fromAngle(angle, speed)
    spawnAttack(g, {
      ...look('thunderWave', 'electric', 'thunderWave'), x: p.x + v.x * 0.04, y: p.y - 8 + v.y * 0.04,
      shape: { kind: 'circle', r: THUNDER_WAVE.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback, status, hits, ttl: THUNDER_WAVE.ttl, memo: angle,
    })
  })
  cast(g, 'thunderWave')
}

/**
 * Takes off for `duration` s (at most half its cycle with the landing's
 * i-frames, `burrowTime`): invulnerable and lost to the foes (the kit's
 * burrow), still steering, then `flySlam` where it lands. A player already
 * out of reach (Dig), or whose last protection from another move just fell
 * (`wardOpens`), stays put.
 */
const fly = (g: Game, s: CastStats) => {
  const p = g.player
  const aloft = burrowTime(s.duration, s.cooldown, FLY.iframes)
  if (p.hidden || !burrow(g, 'fly', aloft)) return
  spawnAttack(g, {
    ...look('fly', 'flying', 'flyLift'), x: p.x, y: p.y, shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: 0 },
    damage: 0, ttl: aloft, activeFrom: Infinity, mod: null,
  })
  burst(g, p.x, p.y - 4, { colors: ['#ffffff', '#d8e0f0', '#a8b8d0'], count: 14, speed: 100, ttl: 0.4, gravity: -40 })
  cast(g, 'fly')
}

/** Fly lands: a shockwave ring where the player came down. */
const flySlam = (g: Game, s: CastStats) => {
  const p = g.player
  const r = FLY.slam * s.area
  spawnAttack(g, {
    ...look('fly', 'flying', 'flySlam'), x: p.x, y: p.y,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, ttl: 0.4, grow: (r - 8) / FLY.grow, activeUntil: FLY.grow,
  })
  p.iframes = Math.max(p.iframes, FLY.iframes)
  burst(g, p.x, p.y - 2, { colors: ['#ffffff', '#c8d0e0', '#a08060'], count: 22, speed: 140, ttl: 0.45, gravity: 200, size: 2 })
  shakeScreen(g, 4)
  g.events.push({ kind: 'quake' })
}

/* ---------------- Table ---------------- */

export const SHOP_TM_MOVES_2 = {
  rainDance: {
    name: 'Rain Dance',
    type: 'water',
    // `duration` is the rain's length; `amount` the drops each beat.
    base: stats({ damage: 10, cooldown: 60, amount: 2, duration: 40, knockback: 20 }),
    upgrades: [
      { damage: 2 },
      { duration: 5 },
      { fork: [{ stats: { duration: 15, amount: 1 }, mods: ['arc'] }, { stats: { damage: 1 }, mods: ['drain'] }] },
      { cooldown: -8 },
      { damage: 3 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { area: 0.4 }, mods: ['trail'] }] },
      { amount: 1, damage: 2 },
    ],
    fire: (g, s) => callSky(g, s, look('rainDance', 'water', 'rainDance'), 'rain'),
  },

  sunnyDay: {
    name: 'Sunny Day',
    type: 'fire',
    base: stats({ damage: 10, cooldown: 60, amount: 2, duration: 40, knockback: 20 }),
    upgrades: [
      { damage: 2 },
      { duration: 5 },
      { fork: [{ stats: { duration: 15, amount: 1 }, mods: ['trail'] }, { stats: { damage: 1 }, mods: ['cruel'] }] },
      { cooldown: -8 },
      { damage: 3 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.4 }, mods: ['burstOnKill'] }] },
      { amount: 1, damage: 2 },
    ],
    fire: (g, s) => callSky(g, s, look('sunnyDay', 'fire', 'sunnyDay'), 'sun'),
  },

  swordsDance: {
    name: 'Swords Dance',
    type: 'normal',
    tags: ['slice'],
    // `amount` is the swords whirling; `duration` how long a dance's might holds.
    base: stats({ damage: 6, cooldown: 7, amount: 3, duration: 5, knockback: 50 }),
    upgrades: [
      { cooldown: -1 },
      { duration: 1.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['twin'] }, { stats: { duration: 3 }, mods: ['hunter'] }] },
      { cooldown: -0.5 },
      { damage: 3 },
      { fork: [{ stats: { amount: 2 }, mods: ['burstOnKill'] }, { stats: { duration: 2, damage: 2 }, mods: ['drain'] }] },
      { damage: 3, amount: 1 },
    ],
    fire: (g, s, owned) => swordsDance(g, s, owned),
  },

  drainPunch: {
    name: 'Drain Punch',
    type: 'fighting',
    tags: ['punch'],
    // The status chance is the share it heals on top of `DRAIN_PUNCH.share`.
    base: stats({ damage: 20, cooldown: 0.9, amount: 1, knockback: 70 }),
    upgrades: [
      { damage: 4 },
      { cooldown: -0.1 },
      { fork: [{ stats: { area: 0.4, amount: 1 }, mods: ['echo'] }, { stats: { statusChance: 0.2 }, mods: ['execute'] }] },
      { damage: 5 },
      { cooldown: -0.1 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { statusChance: 0.1, damage: 3 }, mods: ['hunter'] }] },
      { damage: 6, area: 0.15 },
    ],
    fire: (g, s) => drainPunch(g, s),
  },

  thunderWave: {
    name: 'Thunder Wave',
    type: 'electric',
    // `duration` is the paralysis' length (`waveParalysis`); `amount` widens the cone.
    status: { kind: 'paralysis', chance: 1, duration: 2, power: 0 },
    base: stats({ damage: 5, cooldown: 3.2, amount: 1, speed: 230, duration: 2 }),
    upgrades: [
      { cooldown: -0.3 },
      { damage: 3 },
      { fork: [{ stats: { amount: 2 }, mods: ['arc'] }, { stats: { duration: 1.5 }, mods: ['cruel'] }] },
      { cooldown: -0.3 },
      { damage: 3 },
      { fork: [{ stats: { amount: 2, area: 0.2 }, mods: ['echo'] }, { stats: { duration: 1, damage: 4 }, mods: ['hunter'] }] },
      { duration: 0.5, damage: 3 },
    ],
    fire: (g, s) => thunderWave(g, s),
  },

  fly: {
    name: 'Fly',
    type: 'flying',
    // `duration` is the time aloft (cut by `burrowTime`).
    base: stats({ damage: 30, cooldown: 7, duration: 0.9, knockback: 160 }),
    minCooldown: 2,
    upgrades: [
      { damage: 6 },
      { cooldown: -0.7 },
      { fork: [{ stats: { area: 0.35, damage: 6 }, mods: ['burstOnKill'] }, { stats: { cooldown: -1.5 }, mods: ['trail'] }] },
      { damage: 8 },
      { cooldown: -0.7 },
      { fork: [{ stats: { damage: 10, area: 0.15 }, mods: ['hunter'] }, { stats: { cooldown: -1 }, mods: ['arc'] }] },
      { damage: 10 },
    ],
    fire: (g, s) => fly(g, s),
    emerge: (g, s) => flySlam(g, s),
  },
} as const satisfies Record<string, MoveDef>

export type ShopTmMove2Id = keyof typeof SHOP_TM_MOVES_2
