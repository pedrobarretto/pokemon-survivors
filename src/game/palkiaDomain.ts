import type { Pt } from '../data/arenas'
import { GATES, HALL, PALKIA_DOMAIN } from '../data/domains/palkia'
import type { DomainHooks } from './domainHooks'
import { arenaPoint, type DomainState } from './domain'
import { composePlan } from './domainRules'
import { burst, shakeScreen } from './effects'
import { offstage } from './bosses'
import { nearestPlayer, standing } from './players'
import type { RiftArena } from './rift'
import { footOf } from './terrain'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Palkia's Folded Space (`data/domains/palkia.ts`), what its data can't say.
 *
 * Crossing: the gaps between the pearl slabs are crossed only through the
 * twin portals (`GATES`): stepping into a gate's near mouth comes out across
 * the gap. Every `TWIST.every` s space twists (warned `warn` s before): for
 * `length` s each mouth throws the player back to where they last landed (the
 * first one, to the start) instead. A player coming out of a portal must step
 * off its mouth before another takes them.
 *
 * Battle, from the second phase: space wraps (the hall's east and west edges
 * join for the players and for Palkia's shots), and Palkia swaps places with
 * the player down a tether it warns of (`SWAP`). In the last phase (Origin
 * Forme) space folds in now and then: the hall's walls close in from east and
 * west, hold, and open again (`SQUEEZE`).
 */

/** The crossing's twist: when the first comes (crossing age), how often, the warning and how long it lasts, in seconds. */
export const TWIST = { first: 6, every: 7.5, warn: 1.2, length: 2.8 } as const

/** A portal mouth's reach (px around it a player is taken), and how far a player must step off a mouth they came out of before another takes them. */
export const MOUTH = { reach: 12, clear: 20 } as const

/** The swap: seconds into each phase it starts, then between swaps (the last phase's quicker), and the tether's warning. */
export const SWAP = { first: 5, every: [11, 8.5], warn: 1.4 } as const

/** The Origin Forme's fold: seconds into its phase it starts, between folds, the walls' warning, closing, holding and opening times, and how far each wall comes in (px). */
export const SQUEEZE = { first: 7, every: 13, warn: 1.5, close: 1, hold: 3.6, open: 1, depth: 64 } as const

/** The phase (from 0) space starts wrapping and swapping in, and the one it folds in. */
const WRAP_PHASE = 1
const FOLD_PHASE = 2

/** `memo` slots: the crossing's next twist (crossing age), its warning and its time left, and per player (by slot, up to 4) whether they still stand on the mouth they came out of; then the battle's next swap (phase age), the swap's warning and target slot, and the fold's clock and how far in its walls are (0..1). */
const NEXT_TWIST = 0
const TWIST_WARN = 1
const TWIST_LEFT = 2
const ON_MOUTH = 3
const NEXT_SWAP = 7
const SWAP_WARN = 8
const SWAP_TARGET = 9
const FOLD_AT = 10
const FOLD_IN = 11
const SLOTS = 12
/** A clock that never comes due. */
const NEVER = 1e9

const allSlots = (d: DomainState) => {
  while (d.memo.length < SLOTS) d.memo.push(0)
}

const slot = (d: DomainState, i: number) => d.memo[i] ?? 0

/* ---------------- Crossing ---------------- */

/** A domain point (`Pt`) in world px. */
const world = (arena: RiftArena, [x, y]: Pt) => ({ x: arena.x + x, y: arena.y + y })

/** Where gate `i` lets out: across its gap, or while space is twisted, back where the player last landed (the start for the first). */
export const gateExit = (i: number, twisted: boolean): Pt => (!twisted ? GATES[i]!.to : i === 0 ? PALKIA_DOMAIN.crossing.start : GATES[i - 1]!.to)

/** Whether space is twisted in the crossing now, or being warned of (for the look and for the mouths). */
export const twistOf = (d: DomainState): { twisted: boolean; warning: number } => {
  if (d.legend !== 'palkia' || d.act !== 'crossing' || d.memo.length < SLOTS) return { twisted: false, warning: 0 }
  return { twisted: slot(d, TWIST_LEFT) > 0, warning: slot(d, TWIST_WARN) > 0 ? 1 - slot(d, TWIST_WARN) / TWIST.warn : 0 }
}

const near = (x: number, y: number, at: { x: number; y: number }, r: number) => dm.sq(x - at.x) + dm.sq(y - at.y) < r * r

/** Takes each standing player who steps into a mouth through it, once they've stepped off the one they came out of. */
const crossGates = (g: Game, arena: RiftArena, d: DomainState, twisted: boolean) => {
  for (const p of g.players) {
    if (!standing(g, p) || p.slot >= 4) continue
    const flag = ON_MOUTH + p.slot
    if (slot(d, flag) > 0) {
      // Clear of every mouth and landing: the next one takes them.
      const onAny = GATES.some((gate, i) => near(p.x, p.y, world(arena, gate.from), MOUTH.clear) || near(p.x, p.y, world(arena, gateExit(i, false)), MOUTH.clear))
      if (!onAny) d.memo[flag] = 0
      continue
    }
    const i = GATES.findIndex((gate) => near(p.x, p.y, world(arena, gate.from), MOUTH.reach))
    if (i < 0) continue
    const from = world(arena, GATES[i]!.from)
    const to = world(arena, gateExit(i, twisted))
    burst(g, from.x, from.y - 8, { colors: ['#f8b8e8', '#ffffff', '#b070d8'], count: 18, speed: 90, ttl: 0.4 })
    p.x = to.x
    p.y = to.y
    p.vx = 0
    p.vy = 0
    d.memo[flag] = 1
    burst(g, to.x, to.y - 8, { colors: ['#f8b8e8', '#ffffff', '#b070d8'], count: 22, speed: 110, ttl: 0.45 })
    shakeScreen(g, twisted ? 5 : 2.5, p)
    g.events.push({ kind: 'domainCue', enemy: 'palkia', cue: twisted ? 'thrownBack' : 'warp' })
  }
}

const crossing = (g: Game, d: DomainState, dt: number) => {
  const arena = g.rift.arena
  if (!arena) return
  if (d.memo.length < SLOTS) {
    allSlots(d)
    d.memo[NEXT_TWIST] = TWIST.first
  }
  if (d.age >= slot(d, NEXT_TWIST)) {
    d.memo[NEXT_TWIST] = d.age + TWIST.every
    d.memo[TWIST_WARN] = TWIST.warn
  }
  if (slot(d, TWIST_WARN) > 0) {
    d.memo[TWIST_WARN] = slot(d, TWIST_WARN) - dt
    if (slot(d, TWIST_WARN) <= 0) {
      d.memo[TWIST_WARN] = 0
      d.memo[TWIST_LEFT] = TWIST.length
      shakeScreen(g, 4, 'team')
      g.events.push({ kind: 'domainCue', enemy: 'palkia', cue: 'twist' }, { kind: 'quake' })
    }
  }
  const twisted = slot(d, TWIST_LEFT) > 0
  if (twisted) d.memo[TWIST_LEFT] = Math.max(0, slot(d, TWIST_LEFT) - dt)
  crossGates(g, arena, d, twisted)
}

/* ---------------- Battle ---------------- */

/** How far in the Origin Forme's walls are now (0..1), and where the fold is in its cycle: the walls warning, moving or still. */
export const foldOf = (d: DomainState): { k: number; warning: boolean } => {
  if (d.legend !== 'palkia' || d.act !== 'battle' || d.phase < FOLD_PHASE || d.memo.length < SLOTS) return { k: 0, warning: false }
  const t = d.phaseAge - slot(d, FOLD_AT)
  return { k: slot(d, FOLD_IN), warning: t >= 0 && t < SQUEEZE.warn }
}

/** The fold's walls (0..1 in) at `t` s into its cycle. */
export const foldAt = (t: number) => {
  const { warn, close, hold, open } = SQUEEZE
  if (t < warn) return 0
  if (t < warn + close) return (t - warn) / close
  if (t < warn + close + hold) return 1
  if (t < warn + close + hold + open) return 1 - (t - warn - close - hold) / open
  return 0
}

/** The hall's walls in world px: where space wraps, pulled in by the fold (`fold`, 0..1, the fold's now by default). */
export const hallEdges = (arena: RiftArena, d: DomainState, fold = slot(d, FOLD_IN)) => {
  const c = arenaPoint(arena, d, [0, 0])
  const half = HALL.half - SQUEEZE.depth * fold
  return { west: c.x - half, east: c.x + half, top: c.y + HALL.top, bottom: c.y + HALL.bottom }
}

/** The hall's floor with its walls pulled in `k` (0..1) of the fold's depth. */
const foldedPlan = (d: DomainState, k: number) => {
  const plan = composePlan(PALKIA_DOMAIN, true, d.landed)
  if (k <= 0) return plan
  const half = HALL.half - SQUEEZE.depth * k
  const ax = PALKIA_DOMAIN.arena.at[0]
  const cut = (x: number) => Math.max(ax - half, Math.min(ax + half, x))
  return {
    ...plan,
    floor: plan.floor.map((s) => (s.kind === 'poly' ? { ...s, pts: s.pts.map(([x, y]): Pt => [cut(x), y]) } : s)),
  }
}

/** Space wraps: a player pressing on the east or west wall comes in at the other, and so do Palkia's shots. */
const wrap = (g: Game, arena: RiftArena, d: DomainState) => {
  const { west, east, top, bottom } = hallEdges(arena, d)
  const width = east - west
  for (const p of g.players) {
    if (!standing(g, p) || p.y < top || p.y > bottom) continue
    const foot = footOf(p)
    const across = p.x >= east - foot - 1 && p.vx > 0 ? -1 : p.x <= west + foot + 1 && p.vx < 0 ? 1 : 0
    if (across === 0) continue
    burst(g, p.x, p.y - 8, { colors: ['#f8b8e8', '#ffffff'], count: 10, speed: 70, ttl: 0.3 })
    p.x += across * (width - 2 * foot - 6)
    burst(g, p.x, p.y - 8, { colors: ['#f8b8e8', '#ffffff'], count: 10, speed: 70, ttl: 0.3 })
  }
  for (const h of g.hazards) {
    if (h.kind !== 'shot' || h.y < top || h.y > bottom) continue
    if (h.x > east - 3 && h.vx > 0) h.x -= width - 8
    else if (h.x < west + 3 && h.vx < 0) h.x += width - 8
  }
}

/** The swap's state for the look: the tether's warning (0..1) and who it's on, or null. */
export const swapOf = (g: Game, d: DomainState): { k: number; x: number; y: number } | null => {
  if (d.legend !== 'palkia' || d.act !== 'battle' || d.memo.length < SLOTS || slot(d, SWAP_WARN) <= 0) return null
  const p = g.players[slot(d, SWAP_TARGET)]
  return p ? { k: 1 - slot(d, SWAP_WARN) / SWAP.warn, x: p.x, y: p.y } : null
}

/** Palkia and the player it tethered trade places. */
const swapPlaces = (g: Game, boss: Enemy, d: DomainState) => {
  const p = g.players[slot(d, SWAP_TARGET)]
  if (!p || !standing(g, p) || offstage(boss)) return
  const { x, y } = p
  burst(g, p.x, p.y - 8, { colors: ['#f8b8e8', '#ffffff', '#b070d8'], count: 26, speed: 120, ttl: 0.45 })
  burst(g, boss.x, boss.y - 14, { colors: ['#f8b8e8', '#ffffff', '#b070d8'], count: 26, speed: 120, ttl: 0.45 })
  p.x = boss.x
  p.y = boss.y
  p.vx = 0
  p.vy = 0
  boss.x = x
  boss.y = y
  shakeScreen(g, 6, 'team')
  g.events.push({ kind: 'domainCue', enemy: 'palkia', cue: 'swap' }, { kind: 'quake' })
}

const swapTick = (g: Game, d: DomainState, boss: Enemy, dt: number) => {
  if (slot(d, SWAP_WARN) > 0) {
    d.memo[SWAP_WARN] = slot(d, SWAP_WARN) - dt
    if (slot(d, SWAP_WARN) <= 0) {
      d.memo[SWAP_WARN] = 0
      swapPlaces(g, boss, d)
    }
    return
  }
  // Not through a phase's opening or one of its own scripts (a teleport).
  if (d.phaseAge < slot(d, NEXT_SWAP) || (boss.fight && (boss.fight.shift > 0 || boss.fight.motion !== null))) return
  d.memo[NEXT_SWAP] = d.phaseAge + SWAP.every[d.phase >= FOLD_PHASE ? 1 : 0]
  d.memo[SWAP_TARGET] = nearestPlayer(g, boss.x, boss.y).slot
  d.memo[SWAP_WARN] = SWAP.warn
}

const foldTick = (g: Game, arena: RiftArena, d: DomainState) => {
  if (d.phaseAge < slot(d, FOLD_AT)) return
  let t = d.phaseAge - slot(d, FOLD_AT)
  const cycle = SQUEEZE.warn + SQUEEZE.close + SQUEEZE.hold + SQUEEZE.open
  if (t >= cycle) {
    d.memo[FOLD_AT] = slot(d, FOLD_AT) + SQUEEZE.every
    t = d.phaseAge - slot(d, FOLD_AT)
  }
  const k = t >= 0 ? foldAt(t) : 0
  if (k === slot(d, FOLD_IN)) return
  if (slot(d, FOLD_IN) === 0 && k > 0) {
    shakeScreen(g, 5, 'team')
    g.events.push({ kind: 'domainCue', enemy: 'palkia', cue: 'fold' }, { kind: 'quake' })
  }
  d.memo[FOLD_IN] = k
  arena.layout = foldedPlan(d, k)
}

export const PALKIA_HOOKS: DomainHooks = {
  crossing,
  phase: (_g, d, _boss, phase) => {
    allSlots(d)
    d.memo[NEXT_SWAP] = SWAP.first
    d.memo[SWAP_WARN] = 0
    // Before the fold's phase its clock never comes due (a plain number: the snapshots hold `memo` as JSON).
    d.memo[FOLD_AT] = phase >= FOLD_PHASE ? SQUEEZE.first : NEVER
  },
  battle: (g, d, boss, dt) => {
    const arena = g.rift.arena
    if (!arena || d.phase < WRAP_PHASE) return
    allSlots(d)
    if (d.phase >= FOLD_PHASE) foldTick(g, arena, d)
    swapTick(g, d, boss, dt)
    wrap(g, arena, d)
  },
}
