import { TYPE_COLORS } from '../data/types'
import { burst } from './effects'
import { gaKitACast } from './gaKitASystem'
import { nextStacks, type StackEvent } from './kitRules'
import { stampWard, wardHolder } from './moveKit'
import { MOVES, moveStats, type CastStats, type MoveDef, type MoveId } from './moves'
import type { Attack, Enemy, Game, MoveWindow, OwnedMove } from './types'

/**
 * Engine side of the move kit: feeds `MoveDef.stacks` its events, runs the
 * guard and burrow windows and calls the moves' `onGuard` / `emerge` hooks.
 * `game.ts` calls `updateMoveKit` every tick and `afterCast` after each cast;
 * `combat.ts` reports hits and hurts through `moveEvent`.
 */

/** I-frames after a guard negates a hit, so the same crowd can't spend the next window at once. */
export const GUARD_IFRAMES = 0.4

/** Sends a stack event to the moves whose rule listens to it: `move` only (a hit by it), or all of them (null). */
export const moveEvent = (g: Game, move: MoveId | null, event: StackEvent) => {
  for (const owned of g.player.moves) {
    if (move !== null && owned.id !== move) continue
    const def: MoveDef = MOVES[owned.id]
    if (def.stacks) owned.stacks = nextStacks(def.stacks, owned.stacks ?? 0, event)
  }
}

/** A hit by `attack` landed on `e`: the move's `onHit` reacts (Rollout's ramp, Ice Ball's growth). */
export const moveHit = (g: Game, attack: Attack, e: Enemy) => {
  if (attack.move === 'special' || attack.move === 'ability') return
  const def: MoveDef = MOVES[attack.move]
  def.onHit?.(g, attack, e)
}

/** After `owned` fired: spends or grows its stacks on the cast and stamps where it fired from. */
export const afterCast = (g: Game, owned: OwnedMove) => {
  const def: MoveDef = MOVES[owned.id]
  if (def.stacks) owned.stacks = nextStacks(def.stacks, owned.stacks ?? 0, 'cast')
  owned.walkedAt = g.player.walked
  gaKitACast(g)
}

const ownedOf = (g: Game, w: MoveWindow) => g.player.moves.find((m) => m.id === w.move)

/** A guard window took a hit: the hit is gone, the move's `onGuard` answers it. */
export const guardHit = (g: Game, w: MoveWindow, from?: Enemy) => {
  const p = g.player
  p.guard = null
  p.iframes = Math.max(p.iframes, GUARD_IFRAMES)
  const def: MoveDef = MOVES[w.move]
  burst(g, p.x, p.y - 12, { colors: [TYPE_COLORS[def.type], '#ffffff'], count: 12, speed: 110, ttl: 0.35, size: 2 })
  g.events.push({ kind: 'guard' })
  const owned = ownedOf(g, w)
  if (owned && def.onGuard) withMods(g, moveStats(owned.id, owned.level, p.stats, owned.path), (s) => def.onGuard!(g, s, owned, from))
}

/** Runs a hook with the move's fork mods stamped on what it spawns, like a cast (`castMove` in `game.ts`). */
const withMods = (g: Game, s: CastStats, run: (s: CastStats) => void) => {
  const before = g.player.castMods
  g.player.castMods = s.mods
  run(s)
  g.player.castMods = before
}

/**
 * Per tick, before the moves cast: the open window keeps the ward fresh,
 * standing-still and walking stack events, the guard window running out and a
 * burrow ending in its move's `emerge`.
 */
export const updateMoveKit = (g: Game, dt: number) => {
  const p = g.player
  const holder = wardHolder(p)
  if (holder !== null) stampWard(p, holder, g.now)
  if (p.moving) moveEvent(g, null, 'move')
  else if (p.still > 0 && Math.floor(p.still) > Math.floor(p.still - dt)) moveEvent(g, null, 'still')
  if (p.guard && (p.guard.left -= dt) <= 0) p.guard = null
  const hidden = p.hidden
  if (hidden && (hidden.left -= dt) <= 0) {
    p.hidden = null
    const def: MoveDef = MOVES[hidden.move]
    const owned = ownedOf(g, hidden)
    if (owned && def.emerge) withMods(g, moveStats(owned.id, owned.level, p.stats, owned.path), (s) => def.emerge!(g, s, owned))
  }
}
