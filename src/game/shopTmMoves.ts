import { dirTo, fromAngle } from '../engine/math'
import { ownAttack } from './players'
import { chance } from '../engine/rng'
import * as dm from '../engine/dmath'
import { DROP_TABLES, rollDrop } from '../data/consumables'
import { dropItem } from './consumables'
import { burst } from './effects'
import type { DamageBonus } from './kitRules'
import { guard, sweep } from './moveKit'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { dropCoins } from './pickups'
import { nearestEnemy } from './queries'
import { SHOP_TM_MOVES_2 } from './shopTmMoves2'
import { spawnAttack } from './spawn'
import type { Attack, Enemy, Game } from './types'

/**
 * The shop-exclusive TMs: moves sold only on the Kecleon Shop's TM shelf
 * (`game/tmShelf.ts`), never by a boss, a tutor or a learnset. Once owned, a
 * TM armed before a run is what its first TM disc teaches (`tms.ts`). Two of
 * them touch the run's economy: Pay Day knocks ₽ loose from the foes it hits
 * (up to `PAY_DAY.cap` coins a run) and Thief steals an Alpha's or a boss's
 * held item once each. Protect is a short bubble nothing gets through, and
 * Hyper Beam a huge beam with a long recharge. Like the boss TMs they never
 * evolve and grow through forks. The second batch (Rain Dance, Sunny Day,
 * Swords Dance, Drain Punch, Thunder Wave, Fly) lives in `shopTmMoves2.ts`
 * and is spread into this table. Spread at the end of `MOVES`; art in
 * `render/shopTmFx.ts` and `render/shopTmFx2.ts`.
 *
 * Like `tmMoves.ts`, this module must not import `moves.ts` at runtime: it is
 * evaluated while `MOVES` is built.
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

/* ---------------- Tuning (the renderer reads some) ---------------- */

/**
 * Pay Day: the coins' reach and spread, and the ₽ a hit may knock loose: a
 * `coin` of ₽10 with `chance` (plus the cast's status chance), at most `cap`
 * coins a run, so it tips a run instead of paying for it.
 */
export const PAY_DAY = { reach: 210, spread: 0.32, r: 5, coin: 10, chance: 0.06, cap: 120 } as const
/** Thief: its reach, the claw's size and timing, and the odds a hit on an Alpha or a boss steals its held item (once per foe). */
export const THIEF = { reach: 120, r: 13, close: 0.08, steal: 0.35, coin: 50 } as const
/** Protect: the bubble's radius (× area) and how often it shoves what touches it. */
export const PROTECT = { r: 17, hitInterval: 0.25 } as const
/** Hyper Beam: the charge before it fires, its reach and build, and the recharge the player stands through. */
export const HYPER_BEAM = { charge: 0.4, length: 240, segments: 20, r: 11, recharge: 0.3, spread: 0.3, hitInterval: 0.12 } as const

/** Thief hits bosses and Alphas harder: it goes for what they hold. */
const THIEF_BONUS: readonly DamageBonus[] = [{ when: 'boss', mult: 1.3 }]

/* ---------------- Casts ---------------- */

/** Coins fly in a fan at the nearest foe; the cast's coin luck rides on each hitbox (`memo`). */
const payDay = (g: Game, s: CastStats) => {
  const p = g.player
  const luck = PAY_DAY.chance + s.statusChance
  fan(aimAngle(g, PAY_DAY.reach), s.amount, PAY_DAY.spread).forEach((angle, i) => {
    const v = fromAngle(angle, s.speed)
    spawnAttack(g, {
      ...look('payDay', 'normal', 'payDay'), x: p.x, y: p.y - 10,
      shape: { kind: 'circle', r: PAY_DAY.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.1, age: -i * 0.04, memo: luck,
    })
  })
  cast(g, 'payDay')
}

/** A coin hit may knock ₽ loose, while the run's Pay Day purse (`TmState.coins`) has room. */
const payDayHit = (g: Game, a: Attack, e: Enemy) => {
  if (g.player.tm.coins >= PAY_DAY.cap || !chance(g.rng, a.memo)) return
  g.player.tm.coins++
  dropCoins(g, e.x, e.y - 4, [PAY_DAY.coin])
  burst(g, e.x, e.y - e.radius, { colors: ['#fff8c0', '#f8d030', '#c89010'], count: 6, speed: 60, ttl: 0.35, gravity: 120 })
}

/** Up to `count` targets in reach: Alphas and bosses first (what Thief is after), then the nearest. */
const thiefTargets = (g: Game, count: number) => {
  const p = g.player
  const taken = new Set<number>()
  const out: Enemy[] = []
  const reach2 = THIEF.reach * THIEF.reach
  for (const e of g.enemies) {
    if (out.length >= count) break
    if (e.boss && e.hp > 0 && e.dying < 0 && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= reach2) {
      out.push(e)
      taken.add(e.id)
    }
  }
  while (out.length < count) {
    const e = nearestEnemy(g, p.x, p.y, THIEF.reach, taken)
    if (!e) break
    taken.add(e.id)
    out.push(e)
  }
  return out
}

/** A shadow claw snaps at the foes in reach, Alphas and bosses first. */
const thief = (g: Game, s: CastStats) => {
  const targets = thiefTargets(g, s.amount)
  targets.forEach((e, i) => {
    spawnAttack(g, {
      ...look('thief', 'dark', 'thief'), x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: THIEF.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, bonus: THIEF_BONUS,
      activeFrom: THIEF.close, activeUntil: THIEF.close + 0.04, ttl: 0.4, age: -i * 0.07, flip: i % 2 === 1,
    })
  })
  if (targets.length > 0) cast(g, 'thief')
}

/** A hit on an Alpha or a boss may steal its held item, once per foe: a run item and a ₽50 coin tumble out. */
const thiefHit = (g: Game, _a: Attack, e: Enemy) => {
  if (!e.boss || g.player.tm.stolen.has(e.id) || !chance(g.rng, THIEF.steal)) return
  g.player.tm.stolen.add(e.id)
  dropItem(g, e.x + 8, e.y, rollDrop(DROP_TABLES.itemBall, g.time, g.rng))
  dropCoins(g, e.x - 6, e.y, [THIEF.coin])
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8d030', '#705898', '#383048'], count: 22, speed: 120, ttl: 0.5, size: 2, gravity: 80 })
  g.events.push({ kind: 'stolen' })
}

/**
 * A bubble closes around you for `duration` s: nothing gets through (every
 * hit is negated, `onGuard` reopens the guard until the bubble pops), and it
 * shoves what touches it. It fails while another move's protection stands
 * or just fell (`wardOpens`).
 */
const protect = (g: Game, s: CastStats) => {
  const p = g.player
  // Another move's protection stands or just fell: it fails, as Protect used twice in a row does.
  if (!guard(g, 'protect', s.duration)) return
  spawnAttack(g, {
    ...look('protect', 'normal', 'protect'), x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: PROTECT.r * s.area }, motion: { kind: 'follow', ox: 0, oy: -8 },
    damage: s.damage, knockback: s.knockback, hitInterval: PROTECT.hitInterval, ttl: s.duration,
  })
  cast(g, 'protect')
}

/** The bubble took a hit: it holds, the guard stays up for what's left of it. */
const protectHolds = (g: Game) => {
  const bubble = g.attacks.find((a) => ownAttack(g, a) && a.move === 'protect' && a.visual === 'protect' && a.age < a.ttl)
  if (bubble) guard(g, 'protect', bubble.ttl - bubble.age)
}

/**
 * Hyper Beam charges for `HYPER_BEAM.charge` s, then a huge beam blasts the
 * way of the nearest foe, hitting everything on the line several times; the
 * player stands still through the recharge (`rooted`).
 */
const hyperBeam = (g: Game, s: CastStats) => {
  const p = g.player
  const l = look('hyperBeam', 'normal', 'hyperBeam')
  const angle = aimAngle(g, 260)
  spawnAttack(g, {
    ...look('hyperBeam', 'normal', 'hyperCharge'), x: p.x, y: p.y - 8, shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: -8 },
    damage: 0, ttl: HYPER_BEAM.charge, activeFrom: Infinity, memo: angle,
  })
  for (const a of fan(angle, s.amount, HYPER_BEAM.spread)) {
    const from = g.attacks.length
    sweep(g, s, l, { from: a, arc: 0, time: s.duration, length: HYPER_BEAM.length * s.area, segments: HYPER_BEAM.segments, r: HYPER_BEAM.r, hitInterval: HYPER_BEAM.hitInterval })
    for (let i = from; i < g.attacks.length; i++) g.attacks[i]!.age = -HYPER_BEAM.charge
    // The beam's tip carries the impact flare.
    g.attacks[g.attacks.length - 1]!.flip = true
  }
  p.rooted = Math.max(p.rooted, HYPER_BEAM.charge + HYPER_BEAM.recharge)
  cast(g, 'hyperBeam')
}

/* ---------------- Table ---------------- */

export const SHOP_TM_MOVES = {
  payDay: {
    name: 'Pay Day',
    type: 'normal',
    base: stats({ damage: 9, cooldown: 1.1, amount: 3, speed: 230, pierce: 1, knockback: 40 }),
    // The status chance is Pay Day's coin luck (`PAY_DAY.chance` plus it); the forks raise it.
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { statusChance: 0.03, damage: 2 }, mods: ['burstOnKill'] }, { stats: { amount: 2, damage: -2 }, mods: ['split'] }] },
      { cooldown: -0.15 },
      { damage: 4 },
      { fork: [{ stats: { amount: 2 }, mods: ['echo'] }, { stats: { damage: 4, statusChance: 0.02 }, mods: ['bounce'] }] },
      { amount: 1, damage: 3 },
    ],
    fire: (g, s) => payDay(g, s),
    onHit: (g, a, e) => payDayHit(g, a, e),
  },

  thief: {
    name: 'Thief',
    type: 'dark',
    tags: ['slice'],
    base: stats({ damage: 22, cooldown: 1.2, amount: 1, knockback: 60 }),
    upgrades: [
      { damage: 5 },
      { amount: 1 },
      { fork: [{ stats: { amount: 1 }, mods: ['arc'] }, { stats: { damage: 4 }, mods: ['drain'] }] },
      { cooldown: -0.15 },
      { damage: 6 },
      { fork: [{ stats: { damage: 6 }, mods: ['hunter'] }, { stats: { area: 0.3 }, mods: ['burstOnKill'] }] },
      { amount: 1, damage: 5 },
    ],
    fire: (g, s) => thief(g, s),
    onHit: (g, a, e) => thiefHit(g, a, e),
  },

  protect: {
    name: 'Protect',
    type: 'normal',
    base: stats({ damage: 6, cooldown: 12, duration: 1, knockback: 170 }),
    upgrades: [
      { duration: 0.2 },
      { cooldown: -1 },
      { fork: [{ stats: { damage: 8 }, mods: ['burstOnKill'] }, { stats: { duration: 0.3 }, mods: ['echo'] }] },
      { duration: 0.2 },
      { cooldown: -1 },
      { fork: [{ stats: { damage: 6 }, mods: ['drain'] }, { stats: { cooldown: -1.5, area: 0.2 }, mods: ['arc'] }] },
      { duration: 0.3, cooldown: -1 },
    ],
    fire: (g, s) => protect(g, s),
    onGuard: (g) => protectHolds(g),
  },

  hyperBeam: {
    name: 'Hyper Beam',
    type: 'normal',
    base: stats({ damage: 34, cooldown: 9, amount: 1, duration: 0.5, knockback: 90 }),
    upgrades: [
      { damage: 8 },
      { cooldown: -0.8 },
      { fork: [{ stats: { damage: 12 }, mods: ['burstOnKill'] }, { stats: { area: 0.25 }, mods: ['trail'] }] },
      { damage: 10 },
      { cooldown: -0.8 },
      { fork: [{ stats: { damage: 10 }, mods: ['hunter'] }, { stats: { amount: 1, damage: -6 }, mods: ['arc'] }] },
      { damage: 14, area: 0.15 },
    ],
    fire: (g, s) => hyperBeam(g, s),
  },

  ...SHOP_TM_MOVES_2,
} as const satisfies Record<string, MoveDef>

export type ShopTmMoveId = keyof typeof SHOP_TM_MOVES

/** Every shop-exclusive TM, in table order. */
export const shopTmMoveIds = () => Object.keys(SHOP_TM_MOVES) as ShopTmMoveId[]

/** Whether a move is a shop-exclusive TM (it never evolves, and only the TM shelf sells it). */
export const isShopTmMove = (id: MoveId) => Object.hasOwn(SHOP_TM_MOVES, id)
