import { TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import { TRIALS, type TrialDef, type TrialId } from '../data/legendPaths'
import { recomputeStats } from './leveling'
import { setDummies, setMove } from './training'
import { createAbilityState } from './abilities'
import type { Game } from './types'

/**
 * Machoke's Torre at the Dojo (`TRIALS` in `data/legendPaths.ts`): a trial
 * runs on a training run (`Game.training.trial`), with the loadout the trial
 * hands out, its dummies (moving, or with HP that doesn't refill) and a goal
 * against the clock. Like the rest of the Dojo it's never ranked nor replayed:
 * the shell starts it, reads how it went and banks a win (`clearTrial` in
 * `game/legendPaths.ts`), and Kubfu's gift follows from the save.
 */

/**
 * A trial under way: `wait` s of "ready" before the clock starts, then `left`
 * s on it; what the goal counts so far (`progress`: damage, hits or knockouts),
 * and how it ended (null while it goes on).
 */
export type TrialRun = { id: TrialId; wait: number; left: number; progress: number; result: 'won' | 'lost' | null }

/** Seconds of "ready" before a trial's clock starts. */
export const TRIAL_READY = 2

/**
 * How the dummies move: px from the player's start (a dodger circles out of a
 * still player's reach), how fast they circle (rad/s), and how far and how
 * often a dodger hops aside.
 */
export const TRIAL_MOTION = { reach: 74, dodgeReach: 230, circle: 0.9, slowCircle: 0.35, hop: 50, hopEvery: 1.6 } as const

/** The trial's loadout on the player: its moves at their levels and nothing else (no items, no ability). */
const handOut = (g: Game, def: TrialDef) => {
  const p = g.player
  for (const m of [...p.moves]) setMove(g, m.id, 0)
  p.items.length = 0
  p.ability = createAbilityState()
  for (const m of def.moves) setMove(g, m.id, m.level)
  recomputeStats(g)
}

/** Starts trial `id` on the Dojo's run: its loadout, its dummies, a clean count and the "ready" before the clock. */
export const startTrial = (g: Game, id: TrialId) => {
  const t = g.training
  if (!t) return
  const def: TrialDef = TRIALS[id]
  handOut(g, def)
  setDummies(g, t.target, def.dummies.count)
  if (def.dummies.hp !== undefined) for (const post of t.posts) {
    const e = g.enemies.find((x) => x.id === post.id)
    if (e) e.hp = e.maxHp = def.dummies.hp
  }
  g.player.damageByMove = {}
  t.trial = { id, wait: TRIAL_READY, left: def.time, progress: 0, result: null }
}

/** Whether a trial's dummies keep their own HP (knock them out) instead of the Dojo's endless one. */
export const finiteDummies = (g: Game) => {
  const trial = g.training?.trial
  if (!trial) return false
  const def: TrialDef = TRIALS[trial.id]
  return def.dummies.hp !== undefined
}

/** A hit landed on a dummy (`damageEnemy`): a hits trial counts it. */
export const trialHit = (g: Game) => {
  const trial = g.training?.trial
  if (!trial || trial.wait > 0 || trial.result !== null || TRIALS[trial.id].goal.kind !== 'hits') return
  trial.progress++
}

/** A trial's dummy fell (`updateTraining`): a knockouts trial counts it. */
export const trialKnockout = (g: Game) => {
  const trial = g.training?.trial
  if (!trial || trial.result !== null || TRIALS[trial.id].goal.kind !== 'knockouts') return
  trial.progress++
}

/**
 * The trial's every tick, from `updateTraining`: the "ready", then the clock;
 * the dummies' posts circle the start (a dodger also hops aside now and then),
 * damage counts from the clock's start, and the goal met wins, the clock out loses.
 */
export const updateTrial = (g: Game, dt: number) => {
  const t = g.training
  const trial = t?.trial
  if (!t || !trial || trial.result !== null) return
  const def: TrialDef = TRIALS[trial.id]
  if (trial.wait > 0) {
    trial.wait -= dt
    if (trial.wait <= 0) g.player.damageByMove = {}
    return
  }
  trial.left = Math.max(0, trial.left - dt)
  const move = def.dummies.move
  if (move) {
    const speed = move === 'circle' ? TRIAL_MOTION.circle : TRIAL_MOTION.slowCircle
    t.posts.forEach((post, i) => {
      const a = (i / t.posts.length) * TAU + g.now * speed
      const hop = move === 'dodge' && Math.floor(g.now / TRIAL_MOTION.hopEvery + i * 0.37) % 2 === 1 ? TRIAL_MOTION.hop : 0
      const r = (move === 'dodge' ? TRIAL_MOTION.dodgeReach : TRIAL_MOTION.reach) - hop
      post.x = dm.round(t.home.x + dm.cos(a) * r)
      post.y = dm.round(t.home.y + dm.sin(a) * r * 0.8)
    })
  }
  if (def.goal.kind === 'damage') trial.progress = Object.values(g.player.damageByMove).reduce((sum: number, v) => sum + (v ?? 0), 0)
  if (trial.progress >= def.goal.need) trial.result = 'won'
  else if (trial.left <= 0) trial.result = 'lost'
}
