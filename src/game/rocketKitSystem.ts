import { ENEMIES } from '../data/enemies'
import * as dm from '../engine/dmath'
import { burst, shakeScreen } from './effects'
import { recomputeStats } from './leveling'
import { enemiesInView, isAlive } from './queries'
import { behind, coinsAfter, coinsEvolve, copyRole, omenPick, ROCKET_KIT, type RocketKit } from './rocketKitRules'
import { spawnAttack } from './spawn'
import { applyStatus } from './status'
import type { Enemy, Game, Player } from './types'

/**
 * Runs the Rocket Game Corner's prize families on `Player.rocket` (the rules
 * and numbers are `rocketKitRules.ts`). `stepMoves` calls `updateRocketKit`;
 * the coin pickup, `killEnemy` and `pendingEvolution` call the small hooks
 * below. For anyone without the field each is one check, so their runs stay
 * bit-identical.
 */

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

const flare = (g: Game, colors: readonly string[], count = 22) => {
  const p = g.player
  burst(g, p.x, p.y - 14, { colors: [...colors, '#ffffff'], count, speed: 110, ttl: 0.45, size: 2 })
  g.events.push({ kind: 'guard' })
}

/**
 * Ditto Transforms into `foe`: its look, its first type and the stat its
 * kind lends (`rocketKitDeltas`), for `ROCKET_KIT.transform.hold` s.
 */
export const transformInto = (g: Game, foe: Enemy) => {
  const p = g.player
  const kit = p.rocket
  if (kit?.kind !== 'transform') return
  const dex = ENEMIES[foe.kind].dex
  const changed = kit.dex !== dex
  kit.dex = dex
  kit.type = foe.types[0] ?? 'normal'
  kit.role = copyRole(foe)
  kit.left = ROCKET_KIT.transform.hold
  recomputeStats(g)
  if (changed) flare(g, ['#c0a0e0', '#f0d8f8', '#8060b0'], 30)
}

/** Ditto's copy wears off: back to a blob, nothing lent. */
const untransform = (g: Game, kit: Extract<RocketKit, { kind: 'transform' }>) => {
  kit.dex = 0
  kit.left = 0
  recomputeStats(g)
  flare(g, ['#c0a0e0', '#f0d8f8'], 14)
}

/** The doomed foe, if it still stands. */
const doomed = (g: Game, kit: Extract<RocketKit, { kind: 'omen' }>) => (kit.target === 0 ? null : (g.enemies.find((e) => e.id === kit.target && isAlive(e)) ?? null))

/** Absol's Omen: the toughest foe in view is doomed (marked) and the next Omen waits its turn. */
const castOmen = (g: Game, kit: Extract<RocketKit, { kind: 'omen' }>) => {
  const p = g.player
  const reach = ROCKET_KIT.omen.reach * ROCKET_KIT.omen.reach
  const foe = omenPick(enemiesInView(g).filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= reach && e.behavior.kind !== 'avatar'))
  kit.next = ROCKET_KIT.omen.every
  if (!foe) return
  kit.target = foe.id
  const o = ROCKET_KIT.omen
  applyStatus(foe.status, { kind: 'mark', chance: 1, duration: o.duration, power: o.power }, 0, foe.boss, 'razorWind', p.slot)
  burst(g, foe.x, foe.y - foe.radius * 2, { colors: ['#e8e8f0', '#5848a0', '#201838'], count: 10, speed: 40, ttl: 0.5, gravity: -30 })
}

/** Mawile's Deceiver: a bite at the nearest foe behind it (in front too, as a Mega), on its own cadence. */
const deceiverBite = (g: Game) => {
  const p = g.player
  const o = ROCKET_KIT.deceiver
  const front = p.mega.active > 0
  let best: Enemy | null = null
  let bestD = dm.sq(o.reach + 8)
  for (const e of g.enemies) {
    if (!isAlive(e) || e.behavior.kind === 'avatar') continue
    const dx = e.x - p.x
    const dy = e.y - p.y
    const d = dm.sq(dx) + dm.sq(dy) - dm.sq(e.radius)
    if (d < bestD && behind(dx, dy, p.facing.x, p.facing.y, front)) {
      bestD = d
      best = e
    }
  }
  if (!best) return false
  spawnAttack(g, {
    move: 'viseGrip', type: 'steel', visual: 'deceiverBite', x: best.x, y: best.y - best.radius,
    shape: { kind: 'circle', r: 12 }, motion: { kind: 'static' },
    damage: kitPower(p, o.power), knockback: 20, ttl: 0.3, activeUntil: 0.06, flip: best.x < p.x,
    status: { kind: 'slow', chance: 0.5, duration: 0.8, power: 0.4 },
  })
  return true
}

/** Per tick, for the acting player: Ditto's copy wears off, Absol's Omen comes round, Mawile's back jaw bites. */
export const updateRocketKit = (g: Game, dt: number) => {
  const kit = g.player.rocket
  if (!kit) return
  switch (kit.kind) {
    case 'transform':
      if (kit.dex === 0) return
      kit.left -= dt
      if (kit.left <= 0) untransform(g, kit)
      return
    case 'omen':
      kit.next -= dt
      if (kit.target !== 0 && !doomed(g, kit)) kit.target = 0
      if (kit.next <= 0) castOmen(g, kit)
      return
    case 'deceiver':
      kit.bite -= dt
      if (kit.bite <= 0 && deceiverBite(g)) kit.bite = ROCKET_KIT.deceiver.every * g.player.stats.cooldown
      else if (kit.bite <= 0) kit.bite = 0.1
      return
    case 'coins':
  }
}

/** The acting player picked up `amount` ₽: Gimmighoul's line keeps them as coins. */
export const rocketCoin = (g: Game, amount: number) => {
  const kit = g.player.rocket
  if (kit?.kind !== 'coins') return
  kit.coins = coinsAfter(kit.coins, amount)
}

/** Whether Gimmighoul's coins are enough to evolve it now (`pendingEvolution`). */
export const rocketEvolves = (p: Player) => p.rocket?.kind === 'coins' && p.stage === 0 && coinsEvolve(p.rocket.coins)

/** The coins Gimmighoul's line holds (0 for anyone else): what Make It Rain throws. */
export const coinsHeld = (p: Player) => (p.rocket?.kind === 'coins' ? p.rocket.coins : 0)

/** A foe fell to the acting player: an Omen's doomed one takes the foes around it down with it. */
export const rocketKitKill = (g: Game, e: Enemy) => {
  const p = g.player
  const kit = p.rocket
  if (kit?.kind !== 'omen' || kit.target !== e.id) return
  kit.target = 0
  kit.next = Math.min(kit.next, 1)
  const fall = ROCKET_KIT.omen.fall
  spawnAttack(g, {
    move: 'razorWind', type: 'dark', visual: 'omenFall', x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: fall.r * p.stats.area }, motion: { kind: 'static' },
    damage: kitPower(p, fall.power), knockback: 90, ttl: 0.5, activeUntil: 0.08,
  })
  shakeScreen(g, 3)
}
