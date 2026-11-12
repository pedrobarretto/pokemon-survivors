import type { BranchId } from '../data/branches'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { coreOpen, fighterBranch, fighterScore, KIT_H, plusCharged, powderOf, puffDue, atStage, type GaKitHook } from './gaHookRules'
import { recomputeStats } from './leveling'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { DamageSource, Enemy, Game, Player, Visual } from './types'
import type { PokeType } from '../data/types'
import * as dm from '../engine/dmath'

/**
 * Runs the hook families' mechanics on `Player.kitH` (the rules and numbers
 * are `gaHookRules.ts`). `stepPlayer` calls `updateKitH`, `hurtPlayer` and
 * `killEnemy` the small hooks below, and `advancePhase` asks `ruledBranch`
 * where Tyrogue goes; for anyone without a kit each is one check, so their
 * runs stay bit-identical. Plusle's and Minun's co-op link is `coop.ts`'s.
 */

type Kit<K extends GaKitHook['kind']> = Extract<GaKitHook, { kind: K }>

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

const flare = (g: Game, colors: readonly string[], count = 18) => {
  const p = g.player
  burst(g, p.x, p.y - 12, { colors: [...colors, '#ffffff'], count, speed: 110, ttl: 0.42, size: 2 })
}

/** A ring of `r` px around the player that grows out in `time` s and hits once (a burst, a pulse). */
const ringOut = (g: Game, move: DamageSource, type: PokeType, visual: Visual, r: number, time: number, damage: number, knockback: number) => {
  const p = g.player
  return spawnAttack(g, {
    move, type, visual, x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' }, grow: (r - 6) / time,
    damage, knockback, ttl: time + 0.12, activeUntil: time, mod: null,
  })
}

/**
 * Scatterbug's line: a puff of scales every few steps, lingering where it fell
 * (Scatterbug's and Spewpa's slow, Vivillon's three powders in turn); Spewpa
 * hardens standing still.
 */
const stepScales = (g: Game, kit: Kit<'scales'>, dt: number) => {
  const p = g.player
  const S = KIT_H.scales
  kit.still = p.walked === kit.at ? kit.still + dt : 0
  kit.at = p.walked
  const hard = p.stage === 1 && kit.still >= S.settle
  if (hard !== kit.hard) {
    kit.hard = hard
    recomputeStats(g)
    if (hard) flare(g, ['#88a058', '#c8d890'], 8)
  }
  if (!puffDue(p.walked, kit.walked, p.stage)) return
  kit.walked = p.walked
  const powder = powderOf(p.stage, kit.puffs)
  spawnAttack(g, {
    move: 'bugBuzz', type: 'bug', visual: 'hookPowder', x: p.x, y: p.y - 3,
    shape: { kind: 'circle', r: atStage(S.r, p.stage) * p.stats.area }, motion: { kind: 'static' },
    damage: kitPower(p, atStage(S.power, p.stage)), hitInterval: S.every, ttl: atStage(S.life, p.stage), status: powder,
    // The look's powder: 0 the slow, 1..3 Vivillon's Poison Powder, Stun Spore and Sleep Powder.
    tier: p.stage >= 2 ? 1 + (kit.puffs % 3) : 0, memo: kit.puffs, mod: null,
  })
  kit.puffs++
}

/** Shields Down: the shell breaks into the Core below half HP, throwing its shards, and closes again once healed. */
const stepShields = (g: Game, kit: Kit<'shields'>) => {
  const p = g.player
  const core = coreOpen(kit.core, p.hp, p.stats.maxHp)
  if (core === kit.core) return
  const S = KIT_H.shields
  kit.core = core
  p.iframes = Math.max(p.iframes, S.iframes)
  recomputeStats(g)
  if (core) {
    ringOut(g, 'powerGem', 'rock', 'hookShell', S.shards.r * p.stats.area, 0.22, kitPower(p, S.shards.power), S.shards.knockback)
    burst(g, p.x, p.y - 10, { colors: ['#8a6038', '#b88858', '#e0c090', '#ffffff'], count: 26, speed: 150, ttl: 0.5, size: 2 })
    shakeScreen(g, 4)
    g.events.push({ kind: 'quake' })
    return
  }
  flare(g, ['#8a6038', '#b88858', '#e0c090'], 16)
  g.events.push({ kind: 'guard' })
}

/** Tyrogue's line: the build's starting point on the first tick, and Hitmonchan's Counter recharging. */
const stepFighter = (g: Game, kit: Kit<'fighter'>, dt: number) => {
  const p = g.player
  if (!kit.base) kit.base = { might: p.stats.might, armor: p.stats.armor }
  if (kit.counter > 0) kit.counter = Math.max(0, kit.counter - dt)
}

/** Plusle's burst: a ring of sparks that may paralyze, and a moment faster. */
const plusBurst = (g: Game, kit: Kit<'plus'>) => {
  const p = g.player
  const P = KIT_H.plus
  const ring = ringOut(g, 'voltSwitch', 'electric', 'hookBurst', P.r * p.stats.area, 0.24, kitPower(p, P.power), 70)
  ring.status = P.paralysis
  kit.surge = P.surge
  recomputeStats(g)
  flare(g, ['#f8e060', '#e85048'], 22)
  g.events.push({ kind: 'cast', move: 'voltSwitch' })
}

/** Minun's pulse: weakens and slows the foes around and heals it a little. */
const minusPulse = (g: Game) => {
  const p = g.player
  const M = KIT_H.minus
  const ring = ringOut(g, 'eerieImpulse', 'electric', 'hookPulse', M.r * p.stats.area, 0.3, kitPower(p, M.power), 20)
  ring.status = M.weaken
  const slow = ringOut(g, 'eerieImpulse', 'electric', 'hookHit', M.r * p.stats.area, 0.3, 0, 0)
  slow.status = M.slow
  const healed = healPlayer(g, p.stats.maxHp * M.heal)
  if (healed > 0) floatText(g, p.x, p.y - 28, `+${dm.round(healed)}`, '#68e868', true)
}

/** Per tick, for the acting player: puffs fall, the shell breaks or closes, charges and pulses come round. */
export const updateKitH = (g: Game, dt: number) => {
  const p = g.player
  const kit = p.kitH
  if (!kit) return
  switch (kit.kind) {
    case 'scales': return stepScales(g, kit, dt)
    case 'shields': return stepShields(g, kit)
    case 'fighter': return stepFighter(g, kit, dt)
    case 'plus':
      if (kit.surge <= 0) return
      kit.surge -= dt
      if (kit.surge > 0) return
      kit.surge = 0
      return recomputeStats(g)
    case 'minus':
      kit.next -= dt
      if (kit.next > 0) return
      kit.next += KIT_H.minus.every
      return minusPulse(g)
    default:
  }
}

/** A hit landed on the acting player (HP already taken): Hitmonchan's Counter punches back at the nearest foe. */
export const kitHHurt = (g: Game, from?: Enemy) => {
  const p = g.player
  const kit = p.kitH
  if (kit?.kind !== 'fighter' || p.branch !== 'hitmonchan' || kit.counter > 0 || p.hp <= 0) return
  const C = KIT_H.fighter.chan.counter
  const e = from && from.dying < 0 ? from : nearestEnemy(g, p.x, p.y, C.reach)
  if (!e) return
  kit.counter = C.cooldown
  spawnAttack(g, {
    move: 'fakeOut', type: 'fighting', visual: 'hookCounter', x: e.x, y: e.y - e.radius / 2,
    shape: { kind: 'circle', r: C.r * p.stats.area }, motion: { kind: 'static' }, from: { x: p.x, y: p.y - 10 },
    damage: kitPower(p, C.power), knockback: C.knockback, ttl: 0.24, activeUntil: 0.06, mod: null, flip: e.x < p.x,
  })
}

/** A foe fell to the acting player: Plusle's charge. */
export const kitHKill = (g: Game) => {
  const kit = g.player.kitH
  if (kit?.kind !== 'plus') return
  const next = plusCharged(kit.charge)
  kit.charge = next.charge
  if (next.burst) plusBurst(g, kit)
}

/** Where the acting player's evolution goes when its family decides it alone (Tyrogue, by the build), else null. */
export const ruledBranch = (g: Game): BranchId | null => {
  const p = g.player
  const kit = p.kitH
  if (p.starter !== 'tyrogue' || kit?.kind !== 'fighter') return null
  return fighterBranch(fighterScore(kit.base ?? p.stats, p.stats))
}

/** Tyrogue's build right now, for the shell's meter and its evolution's words (null for anyone else). */
export const fighterNow = (p: Player) => {
  const kit = p.kitH
  if (kit?.kind !== 'fighter') return null
  const score = fighterScore(kit.base ?? p.stats, p.stats)
  return { ...score, branch: fighterBranch(score) }
}
