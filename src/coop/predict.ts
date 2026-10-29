import { dir8 } from '../engine/math'
import { worldHeld } from '../game/coop'
import { hitstopHolds, walkPlayer } from '../game/game'
import { lungeStep, rollStep } from '../game/moveRules'
import { inPlay, localPlayer } from '../game/players'
import { inDoorway } from '../game/rift'
import { moveOf, TICK } from '../game/replay'
import { predictSpecial, type SpecialState } from '../game/special'
import { footOf, keepOut } from '../game/terrain'
import { aimVec } from '../game/versusKit'
import { VERSUS_KIT } from '../data/versus'
import type { Game, Player } from '../game/types'
import * as dm from '../engine/dmath'
import { HISTORY } from './client'
import type { Runner } from './runner'

/**
 * Own-movement prediction, draw-only. The simulation learns about this
 * player's stick and buttons a round trip and a hold later; meanwhile the
 * sprite moves where they already took it, on a copy of the player (the
 * ghost) run from the confirmed state through every input sample not
 * simulated yet, tick by tick as the step would:
 * - the walk (`walkPlayer`: water, ice, the special's pace), turning the
 *   ghost to the stick;
 * - the special (`predictSpecial`): a press the confirmed state hasn't seen
 *   starts it on the ghost when its copy of the timers says it's ready, so
 *   the charge, a dash or a chain's jumps show at once;
 * - the lunges and rolls already carrying the player (`lungeStep`,
 *   `rollStep`, the same functions the simulation moves it by), a lunge
 *   ending in a portal as the simulation's does (`inDoorway`);
 * - the hitstops (`hitstopHolds`), which co-op plays through: they count
 *   down and never hold the ghost, as they never hold the team;
 * - the terrain (`keepOut`: rocks, cliffs, lake shores, an arena's walls), so
 *   a dash into a wall stops where the simulation's would.
 * A copy of the game holds the ghost, with its own terrain cache and its own
 * special timers, so the simulation's state is never touched.
 *
 * Each frame: the steady offset (`steadyOffset`) says which sample the
 * confirmed state has reached (`simSample`); `walking` says whether the next
 * ticks walk the player at all; `walkAhead` runs the ghost from there to the
 * latest sample; the change against last frame's prediction for the same
 * sample is the correction (`err`), which shrinks every frame (`settle`).
 * What the ghost can't know (a hit, a chain jump aimed at a foe that
 * moved meanwhile, a move's lunge cast this tick)
 * reaches the sprite as a correction, however big; only a teleport of the
 * confirmed player (`teleported`) draws at once. While the step doesn't
 * walk the player (a screen, the rift's fall, a held world) the sprite eases
 * to the confirmed spot the same way.
 */

/** Ticks an Arena cast holds the Pokémon turned to its aim. */
const HOLD_TICKS = Math.round(VERSUS_KIT.hold / TICK)

/** Samples predicted ahead at most (~0.75 s): a worse link just shows its lag. */
export const MAX_AHEAD = 45

/** Seconds a correction takes to fade to a third. */
const BLEND = 0.08

/** A correction shrinks at least this many times the player's walking speed (px/s), so it never lingers. */
export const SETTLE_WALKS = 1.5

/** The confirmed player moving this much (px) past what its ticks can carry it (`MAX_STEP` each) teleported (a rift, a room, a restore): the sprite snaps. */
export const SNAP = 40

/** The farthest the run carries a player in one tick (px): a chain jump's 180 px over its 6 ticks. */
const MAX_STEP = 32

/** A press the confirmed state hasn't taken this many samples after its own is taken for lost (the relay never stamped it). */
const PRESS_LOST = 12

type Pos = { x: number; y: number }

/** A lunge or roll of this player's, carried on by the ghost: its motion's state and its age. */
type Carried = { roll: boolean; vx: number; vy: number; left: number; speed: number; age: number; ttl: number }

/** The ghost's look at the latest sample, for the drawn sprite: its special's timers and which way it faces. */
export type GhostLook = Pick<Player, 'dir' | 'facing' | 'moving'> & { special: SpecialState }

/** What this client's input gives prediction: the stick's samples (`history`, the latest `sample`) and the samples its special presses went out at. */
export type OwnInput = { history: Uint8Array; sample: number; specials: readonly number[]; aims?: readonly number[] }

export type Prediction = {
  /** The drawn spot of this player, this frame. */
  drawn: Pos
  /** The correction still being blended away. */
  err: Pos
  /** The prediction made for each input sample, to compare with the confirmed state once it gets there. */
  predicted: Float64Array
  predictedAt: Int32Array
  lastSample: number
  last: Pos
  ghost: Player | null
  world: Game | null
  terrain: Game['terrain']
  /** The ghost's own special timers (a copy: the confirmed ones are the simulation's). */
  special: SpecialState | null
  carried: Carried[]
  /** The ghost at the latest sample, or null while the step doesn't walk this player. */
  look: GhostLook | null
  /** |predicted − confirmed| (px) each time the confirmed state reaches a predicted sample; the shell takes them every frame (`noteDraw`). */
  errors: number[]
  /** The correction this frame added (px). */
  correction: number
  /** Corrections that snapped (teleports, drawn at once instead of blended) since the shell last took them (`noteDraw`). */
  snaps: number
  /** The confirmed game, spot and tick of last frame, to tell a teleport from a correction (`teleported`). */
  seen: { game: Game | null; x: number; y: number; next: number }
  /** Which stick sample each tick reads, kept steady across anchors (`steadyOffset`). */
  offset: SteadyOffset
}

/**
 * Which of this client's stick samples the run's ticks read: tick `t` reads
 * sample `t + offset` (both count 60 a second). Each anchor (this player's
 * last stick input the relay stamped) says it once, jittered by that
 * message's trip; `steadyOffset` keeps one that holds still.
 */
export type SteadyOffset = {
  /** The offset in use (sample − tick), null before the first anchor. */
  offset: number | null
  /** The last anchors' raw offsets (`OFFSETS` of them), oldest first. */
  recent: number[]
  /** The tick of the last anchor read (an anchor counts once). */
  anchor: number
  /** Anchors in a row whose median asked for another offset. */
  votes: number
  /** The last raw offset that sat `OFFSET_JUMP` off, waiting for a second to agree. */
  far: number | null
}

/** Anchors whose raw offsets the steady one is the median of. */
const OFFSETS = 9

/** Anchors in a row the median must ask for another offset before it moves (one-sample wobbles stay put). */
const OFFSET_VOTES = 3

/** An anchor this far (samples) off is an outlier, or, when the next one agrees, a new clock (a reconnect, a long pause). */
const OFFSET_JUMP = 8

/** Two far anchors this close (samples) agree. */
const OFFSET_AGREE = 2

export const createSteadyOffset = (): SteadyOffset => ({ offset: null, recent: [], anchor: -1, votes: 0, far: null })

/**
 * The steady sample ↔ tick offset after an anchor. Anchors come with every
 * message the client sends during a run (it says the stick in play again),
 * and at least once a second while walking (`CONNECT.anchor`); idle, the
 * state hashes still carry one every second or two. Taken raw, every new
 * anchor (then one each stick change, and every 250 ms) shifted the whole
 * prediction by its trip's jitter: 3.7 corrections a second of 1 to 3 px
 * blended into the sprite and the camera, and 8 to 14 px when a long frame
 * held the send. The median of the last few, moved only after a few anchors
 * in a row ask for it, holds still: a stick held still predicts the same path
 * whatever each trip took. A single anchor far off is ignored; two that agree
 * move it at once (the clocks really moved).
 */
export const steadyOffset = (s: SteadyOffset, anchor: { tick: number; sample: number }): number => {
  const raw = anchor.sample - anchor.tick
  const was = s.offset
  if (was !== null && anchor.tick === s.anchor) return was
  s.anchor = anchor.tick
  const far = was !== null && Math.abs(raw - was) > OFFSET_JUMP
  if (far && (s.far === null || Math.abs(raw - s.far) > OFFSET_AGREE)) {
    s.far = raw
    return was
  }
  s.far = null
  if (was === null || far) {
    s.offset = raw
    s.recent = [raw]
    s.votes = 0
    return raw
  }
  s.recent.push(raw)
  if (s.recent.length > OFFSETS) s.recent.shift()
  const median = [...s.recent].sort((a, b) => a - b)[s.recent.length >> 1]!
  s.votes = median === was ? 0 : s.votes + 1
  if (s.votes < OFFSET_VOTES) return was
  s.votes = 0
  s.offset = median
  return median
}

export const createPrediction = (): Prediction => ({
  drawn: { x: 0, y: 0 },
  err: { x: 0, y: 0 },
  predicted: new Float64Array(HISTORY * 2),
  predictedAt: new Int32Array(HISTORY).fill(-1),
  lastSample: -1,
  last: { x: 0, y: 0 },
  ghost: null,
  world: null,
  terrain: { seed: 0, cells: new Map() },
  special: null,
  carried: [],
  look: null,
  errors: [],
  correction: 0,
  snaps: 0,
  seen: { game: null, x: 0, y: 0, next: 0 },
  offset: createSteadyOffset(),
})

/**
 * Whether the next steps walk this player at all, mirroring the step's own
 * checks: not while a screen is up, the world is held, the rift's fall or a
 * wave legendary's scene plays, nor fainted or wrapped up. A hitstop never
 * stops it: co-op plays on through one (`hitstopHolds`).
 */
const walking = (g: Game, p: Player) =>
  g.phase === 'playing' && inPlay(p) && !worldHeld(g) && (g.rift.arena?.fall ?? null) === null && g.legendScene === null

/**
 * Shrinks the correction still drawn after `dt` seconds: the blend's fade, and
 * at least `SETTLE_WALKS` times the walking speed `walk` (px/s), so a small
 * one ends instead of trailing off.
 */
export const settle = (err: Pos, dt: number, walk: number) => {
  const size = dm.hypot(err.x, err.y)
  if (size === 0) return
  const left = Math.max(0, Math.min(size * Math.exp(-dt / BLEND), size - SETTLE_WALKS * walk * dt))
  err.x *= left / size
  err.y *= left / size
}

/**
 * Whether the confirmed player teleported since last frame: another game (a
 * restore), or a move farther than the ticks run since could carry it.
 */
export const teleported = (seen: Prediction['seen'], g: Game, p: Pos, next: number) =>
  seen.game !== g || Math.hypot(p.x - seen.x, p.y - seen.y) > SNAP + Math.max(0, next - seen.next) * MAX_STEP

/** The lunges and rolls carrying this player in the confirmed state, for the ghost to carry on. */
const carriedFrom = (g: Game, p: Player, out: Carried[]) => {
  out.length = 0
  for (const a of g.attacks) {
    if (a.owner !== p.slot || a.age >= a.ttl) continue
    const m = a.motion
    if (m.kind === 'lunge' && m.left > 0) out.push({ roll: false, vx: m.vx, vy: m.vy, left: m.left, speed: 0, age: a.age, ttl: a.ttl })
    else if (m.kind === 'roll') out.push({ roll: true, vx: 0, vy: 0, left: 0, speed: m.speed, age: a.age, ttl: a.ttl })
  }
}

/**
 * One tick of the ghost, in the step's order: the hitstop (counted down,
 * never held in co-op), the walk and its turn, the special, the lunges and
 * rolls (`updateAttacks`), the terrain (`updateTerrain`). `world` is the
 * ghost's copy of the game: its hitstop counts down there.
 */
const stepGhost = (world: Game, ghost: Player, carried: Carried[], code: number, pressed: boolean, turn = true) => {
  if (hitstopHolds(world, TICK)) return
  const move = moveOf(code)
  if (walkPlayer(world, move, TICK) && turn) {
    const len = dm.hypot(move.x, move.y)
    ghost.facing = { x: move.x / len, y: move.y / len }
    ghost.dir = dir8(move.x, move.y)
  }
  predictSpecial(world, pressed, TICK)
  let k = 0
  for (const c of carried) {
    c.age += TICK
    if (c.age >= 0) {
      if (c.roll) {
        const step = rollStep(ghost.facing, c.speed, TICK)
        ghost.x += step.dx
        ghost.y += step.dy
      } else {
        if (inDoorway(world, ghost)) c.left = 0
        const step = lungeStep(c, TICK)
        c.left = step.left
        ghost.x += step.dx
        ghost.y += step.dy
        if (c.left > 0) ghost.dir = dir8(c.vx, c.vy)
      }
    }
    if (c.age < c.ttl) carried[k++] = c
  }
  carried.length = k
  keepOut(world, ghost, footOf(ghost))
}

/**
 * Runs a copy of the confirmed player through the samples after `from` up
 * to `sample`, pressing the special at the samples in `presses` (sorted; one
 * at or before `from` presses on the first). Returns the positions at
 * `sample - 1`, `sample` and `at` (the start for `at <= from`, null past `sample`).
 */
const walkAhead = (pr: Prediction, g: Game, p: Player, history: Uint8Array, presses: readonly number[], from: number, sample: number, at: number, aims?: ReadonlyMap<number, number>) => {
  const ghost = Object.assign((pr.ghost ??= { ...p }), p)
  ghost.special = Object.assign((pr.special ??= { ...p.special }), p.special)
  if (pr.terrain.seed !== g.terrain.seed) pr.terrain = { seed: g.terrain.seed, cells: new Map() }
  if (pr.terrain.cells.size > 4096) pr.terrain.cells.clear()
  // A copy of the game around the copy of the player, with its own terrain cache: the step reads `g.player`.
  const world = Object.assign((pr.world ??= { ...g }), g, { player: ghost, terrain: pr.terrain })
  carriedFrom(g, p, pr.carried)
  let next = 0
  let prev = { x: ghost.x, y: ghost.y }
  let atPos: Pos | null = at <= from ? { x: ghost.x, y: ghost.y } : null
  /** Ticks the ghost stays turned to an Arena Unite Move's aim (`VERSUS_KIT.hold`), as the simulation holds it. */
  let hold = p.versus ? Math.round(p.versus.hold / TICK) : 0
  for (let s = from + 1; s <= sample; s++) {
    if (s === sample) prev = { x: ghost.x, y: ghost.y }
    let pressed = false
    while (next < presses.length && presses[next]! <= s) {
      pressed = true
      const aim = aims?.get(presses[next]!) ?? -1
      if (aim >= 0) {
        ghost.facing = aimVec(aim)
        ghost.dir = dir8(ghost.facing.x, ghost.facing.y)
        hold = HOLD_TICKS
      }
      next++
    }
    stepGhost(world, ghost, pr.carried, history[s % HISTORY]!, pressed, hold <= 0)
    hold--
    if (s === at) atPos = { x: ghost.x, y: ghost.y }
  }
  return { prev, cur: { x: ghost.x, y: ghost.y }, at: atPos }
}

/**
 * The special presses still to predict, sorted: sent after the last one the
 * confirmed state took (`Runner.pressed`), and not so long before `simSample`
 * that the relay must have lost them.
 */
export const pendingPresses = (specials: readonly number[], pressed: number, simSample: number) =>
  specials.filter((s) => s > pressed && s > simSample - PRESS_LOST).sort((a, b) => a - b)

/**
 * Where to draw this client's player this frame. `own` is this client's
 * input (the stick's latest sample and the presses), `frac` how far real
 * time is into the next sample, `dt` the frame's seconds.
 */
export const predict = (pr: Prediction, r: Runner, own: OwnInput, frac: number, dt: number): Pos => {
  const g = r.game
  const p = localPlayer(g)
  const anchor = r.anchor
  const sample = own.sample
  let cur: Pos = { x: p.x, y: p.y }
  let prev: Pos = cur
  let atLast: Pos | null = null
  let walked = false
  pr.look = null
  if (anchor && walking(g, p)) {
    // Ticks and samples both count 60 a second: tick `t` reads the sample `t + offset`.
    const simSample = steadyOffset(pr.offset, anchor) + r.next - 1
    // How good the prediction was for the sample the confirmed state just reached.
    const k = ((simSample % HISTORY) + HISTORY) % HISTORY
    if (pr.predictedAt[k] === simSample && pr.errors.length < 100_000) pr.errors.push(Math.hypot(pr.predicted[k * 2]! - p.x, pr.predicted[k * 2 + 1]! - p.y))
    const from = Math.min(simSample, sample)
    const ahead = Math.max(0, Math.min(MAX_AHEAD, sample - from))
    const aims = own.aims && own.aims.length === own.specials.length ? new Map(own.specials.map((s, i) => [s, own.aims![i]!])) : undefined
    const w = walkAhead(pr, g, p, own.history, pendingPresses(own.specials, r.pressed, simSample), from, from + ahead, pr.lastSample, aims)
    cur = w.cur
    prev = ahead > 0 ? w.prev : cur
    atLast = w.at
    walked = true
    const ghost = pr.ghost!
    pr.look = { dir: ghost.dir, facing: ghost.facing, moving: ghost.moving, special: ghost.special }
    const top = ((sample % HISTORY) + HISTORY) % HISTORY
    pr.predicted[top * 2] = cur.x
    pr.predicted[top * 2 + 1] = cur.y
    pr.predictedAt[top] = sample
  }
  // The confirmed state moved what was predicted for last frame's sample: blend the difference away. Not
  // walking, the confirmed spot stands for every sample: the sprite eases onto it instead of snapping back.
  pr.correction = 0
  if (pr.lastSample >= 0) {
    const was = pr.last
    const now = walked ? (atLast ?? (pr.lastSample === sample ? cur : null)) : cur
    if (now) {
      const dx = was.x - now.x
      const dy = was.y - now.y
      pr.correction = Math.hypot(dx, dy)
      pr.err.x += dx
      pr.err.y += dy
    }
    if (teleported(pr.seen, g, p, r.next)) {
      pr.err = { x: 0, y: 0 }
      pr.snaps++
    }
  }
  Object.assign(pr.seen, { game: g, x: p.x, y: p.y, next: r.next })
  settle(pr.err, dt, p.stats.speed)
  pr.last = cur
  pr.lastSample = sample
  const drawn = { x: prev.x + (cur.x - prev.x) * frac + pr.err.x, y: prev.y + (cur.y - prev.y) * frac + pr.err.y }
  // The blend never draws the sprite inside a wall.
  if (walked && pr.world) keepOut(pr.world, drawn, footOf(p))
  pr.drawn = drawn
  return drawn
}
