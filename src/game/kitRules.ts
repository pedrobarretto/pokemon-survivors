import * as dm from '../engine/dmath'
import type { MoveId, MoveStats } from './moves'
import { isAfflicted } from './status'
import { isAirborne } from './traits'
import type { Enemy, OwnedMove, Player } from './types'

/**
 * Pure rules of the move kit (`moveKit.ts` documents how moves use them):
 * conditional damage bonuses, execute, drain, per-move stacks, player
 * readings, seed jumps, the one-manual-move rule and the ward rule. No game state is touched
 * here, so each rule is tested on its own (`kitRules.test.ts`).
 */

/* ---------------- Conditional bonus ---------------- */

/** What a hit's target must be for `DamageBonus` to apply. */
export type BonusWhen =
  | 'afflicted' | 'poisoned' | 'burned' | 'paralyzed' | 'asleep' | 'frozen' | 'marked'
  /** Slowed (chilled) or frozen: Frost Breath's crits. */
  | 'chilled'
  /** Under `LOW_HP` of its max HP. */
  | 'lowHp'
  /** Flying type, or a leaper mid-jump. */
  | 'flying'
  | 'elite' | 'boss'

/** ×`mult` damage on hits against foes matching `when`. Several bonuses multiply. `stamp`: a branch's mod put it there (Hunter, Cruel; `stampMods`), so it's added once. */
export type DamageBonus = { when: BonusWhen; mult: number; stamp?: 'hunter' | 'cruel' }

export const NO_BONUS: readonly DamageBonus[] = []

/** HP fraction under which a foe counts as `lowHp`. */
export const LOW_HP = 0.5

export const bonusApplies = (when: BonusWhen, e: Enemy): boolean => {
  const st = e.status
  switch (when) {
    case 'afflicted': return isAfflicted(st)
    case 'poisoned': return st.poison.time > 0
    case 'burned': return st.burn.time > 0
    case 'paralyzed': return st.paralysis.time > 0
    case 'asleep': return st.sleep.time > 0
    case 'frozen': return st.freeze.time > 0
    case 'marked': return st.mark.time > 0
    case 'chilled': return st.slow.time > 0 || st.freeze.time > 0
    case 'lowHp': return e.hp < e.maxHp * LOW_HP
    case 'flying': return e.types.includes('flying') || isAirborne(e)
    case 'elite': return e.elite
    case 'boss': return e.boss
  }
}

/** Product of the bonuses that apply to `e` (exactly 1 when none does, so plain hits keep their numbers). */
export const bonusMult = (bonus: readonly DamageBonus[], e: Enemy) => {
  let mult = 1
  for (const b of bonus) if (bonusApplies(b.when, e)) mult *= b.mult
  return mult
}

/* ---------------- Execute ---------------- */

/** Whether a foe left at `hp` faints outright to a hit with `execute`: a regular foe at or under that share of its max HP. Bosses never. */
export const executes = (execute: number, hp: number, maxHp: number, boss: boolean) =>
  execute > 0 && !boss && hp > 0 && hp <= maxHp * execute

/* ---------------- Drain ---------------- */

/**
 * Drain heals from a budget that refills at `DRAIN_RATE` of max HP per second
 * and holds at most one second of it, so a fast multi-hit move can't outheal a
 * horde. The difficulty's healing multiplier applies after (`healPlayer`).
 */
export const DRAIN_RATE = 0.04

/** The budget `elapsed` seconds after it was at `left`, for a player with `maxHp`. */
export const drainRefill = (left: number, elapsed: number, maxHp: number) => {
  const cap = maxHp * DRAIN_RATE
  return Math.min(cap, left + elapsed * cap)
}

/** HP a hit of `damage` drains at `fraction`, within the budget `left`. */
export const drainAmount = (damage: number, fraction: number, left: number) => Math.max(0, Math.min(damage * fraction, left))

/* ---------------- Per-move stacks ---------------- */

/** Things that move a move's stacks (`OwnedMove.stacks`). */
export type StackEvent = 'hit' | 'cast' | 'hurt' | 'still' | 'move'

/**
 * How a move's stacks change. `grow`: a hit by the move, a cast, the player
 * getting hurt, or each full second standing still adds `by` (default 1), up
 * to `max`. `reset`: casting (the stacks are spent), getting hurt or walking
 * clears them. A reset wins over a grow on the same event.
 */
export type StackRule = { grow: Exclude<StackEvent, 'move'>; max: number; by?: number; reset?: Exclude<StackEvent, 'hit' | 'still'> }

export const nextStacks = (rule: StackRule, stacks: number, event: StackEvent) =>
  event === rule.reset ? 0 : event === rule.grow ? Math.min(rule.max, stacks + (rule.by ?? 1)) : stacks

export const stacksOf = (owned: OwnedMove) => owned.stacks ?? 0

/**
 * Whether the move took `branch` (0 the first, 1 the second) at the fork on its
 * step to `level` (`OwnedMove.path`): how a move reads a branch that changes
 * its own behavior rather than adding a mod.
 */
export const took = (owned: OwnedMove, level: number, branch: 0 | 1) =>
  owned.level >= level && (((owned.path ?? 0) >> (level - 2)) & 1) === branch

/* ---------------- Player readings (cast-time scaling) ---------------- */

export const hpFraction = (p: Player) => (p.stats.maxHp > 0 ? p.hp / p.stats.maxHp : 0)

/** Px walked since the move last fired (`OwnedMove.walkedAt`, stamped by `updateMoves`). */
export const walkedSince = (owned: OwnedMove, p: Player) => p.walked - (owned.walkedAt ?? p.walked)

/**
 * `1 + k × reading`, capped at `max`: the usual shape of a cast-time scale,
 * e.g. `scaleBy(1 - hpFraction(p), 1.5, 2)` for "up to ×2 damage at low HP".
 */
export const scaleBy = (reading: number, k: number, max = Infinity) => Math.min(max, 1 + k * Math.max(0, reading))

/* ---------------- Seed jumps ---------------- */

/** A fainting seeded foe passes the seed to this many neighbors within `SEED_REACH`, at ×`SEED_DECAY` power. */
export const SEED_JUMPS = 2
export const SEED_REACH = 80
export const SEED_DECAY = 0.8
/** Seconds a jumped seed lasts at least. */
export const SEED_MIN_TIME = 2

type Foe = { id: number; x: number; y: number; dying: number }

/**
 * Up to `count` living foes within `reach` of `from`, nearest first (ties to
 * the lower id, the same on every engine), skipping `from` itself and those
 * `skip` rejects.
 */
export const nearestFoes = <T extends Foe>(foes: readonly T[], from: T, count: number, reach: number, skip: (e: T) => boolean): T[] => {
  const out: T[] = []
  while (out.length < count) {
    let best: T | null = null
    let bestD = reach * reach
    for (const e of foes) {
      if (e === from || e.dying >= 0 || out.includes(e) || skip(e)) continue
      const d = dm.sq(e.x - from.x) + dm.sq(e.y - from.y)
      if (d > bestD || (d === bestD && best && e.id > best.id)) continue
      best = e
      bestD = d
    }
    if (!best) break
    out.push(best)
  }
  return out
}

/* ---------------- Loadout ---------------- */

/** At most one manual move in the loadout: a manual `id` can only be learned when none of `owned` is manual. */
export const learnable = (owned: readonly MoveId[], id: MoveId, manual: (id: MoveId) => boolean) =>
  !manual(id) || !owned.some(manual)

/* ---------------- Immunity windows ---------------- */

/** The cooldown multiplier past which reductions count for half (`softCooldown`). */
export const COOLDOWN_SOFT = 0.7

/** The cooldown multiplier a move sees: full down to `COOLDOWN_SOFT`, half as much past it, so stacking cooldown cuts stops paying as much. */
export const softCooldown = (multiplier: number) =>
  multiplier >= COOLDOWN_SOFT ? multiplier : COOLDOWN_SOFT - (COOLDOWN_SOFT - multiplier) * 0.5

/** Seconds after one move's immunity window (a guard, a burrow) closes before a different move can open one. */
export const WARD_GAP = 0.75

/** The most of its own cycle a burrowing move's immunity may cover: the time under plus the i-frames after it. */
export const BURROW_SHARE = 0.5

/**
 * Seconds a burrow (Fly, Dig) lasts: its `duration`, cut so that it and the
 * i-frames `after` it cover at most `BURROW_SHARE` of the move's `cooldown`.
 * Without the cut, Light Clay and cooldown cuts chain one landing's i-frames
 * into the next takeoff and the player is never hit. A burrowing move keeps a
 * `minCooldown` of at least `after / BURROW_SHARE`, so some time under is left.
 */
export const burrowTime = (duration: number, cooldown: number, after: number) =>
  Math.max(0, Math.min(duration, cooldown * BURROW_SHARE - after))

/**
 * The most of its cooldown a renewing guard (Protect's bubble, Needle Arm's
 * quills: every hit is negated while it stands) may last. Without it, items on
 * duration (Light Clay) and cooldown (Quick Claw) stacked past the point where
 * the window outlasts the cooldown, and the player was never hit again.
 */
export const GUARD_UPTIME = 0.4

/** Seconds a renewing guard stands: its `duration`, held to `GUARD_UPTIME` of its `cooldown`. */
export const guardSpan = (duration: number, cooldown: number) => Math.min(duration, cooldown * GUARD_UPTIME)

/** What a move's protection is timed from: its `duration`, cut by its `cooldown`. */
type WardStats = Pick<MoveStats, 'duration' | 'cooldown'>

/** A renewing guard's `ward` (`MoveDef`): the seconds it stands for a cast's stats (`guardSpan`). */
export const guardWard = (s: WardStats) => guardSpan(s.duration, s.cooldown)

/** A burrowing move's `ward` (`MoveDef`), its i-frames `after` it: the seconds it stays out of reach for a cast's stats (`burrowTime`). */
export const burrowWard = (after: number) => (s: WardStats) => burrowTime(s.duration, s.cooldown, after)

/** The player's last immunity window: the move that held it and the last time it stood, on the never-paused clock (`g.now`). */
export type Ward = { move: MoveId; at: number }

/**
 * Whether `move` may open an immunity window at `now`. Protections from
 * different moves don't chain, like Protect failing when used twice in a row:
 * another move waits until `WARD_GAP` s after the window closed (`holder` is
 * the move whose window is open right now, if any). The move holding the
 * window may always renew it (Protect's bubble, an echo).
 */
export const wardOpens = (ward: Ward | null, holder: MoveId | null, move: MoveId, now: number) =>
  holder !== null ? holder === move : ward === null || ward.move === move || now - ward.at >= WARD_GAP
