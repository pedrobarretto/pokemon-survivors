import type { Vec } from './engine/math'
import { createRng } from './engine/rng'
import type { Game, Player } from './game/types'
import { createHeld, stateSum, stepTick, SUM_EVERY, type Held } from './game/lockstep'
import { inPlay } from './game/players'
import { moveCode, moveOf, TICK } from './game/replay'
import type { TickEntry } from './net/protocol'
import { room, sendMove, sendSum, takeTick } from './net/room'

/**
 * The shell's side of a co-op run: this device's slot in the shared game,
 * the ticks it simulated, the stick it samples at 60 Hz and sends, and the
 * prediction that draws its own Pokémon where its stick already took it
 * (the simulation only learns about a move a round trip later).
 *
 * Ticks come from the play server (`net/room.ts`), or, in dev builds, from a
 * local feed with bot teammates (`ps.coop()`), through the same lockstep path.
 */

/** Recent input samples kept for prediction (well over any round trip). */
const HISTORY = 128

/** Ticks kept in hand before simulating, to ride out network jitter (~33 ms). */
const HOLD = 2

/** A stick that didn't change is resent this often, so the server keeps stamping it (prediction re-anchors on it). */
const HEARTBEAT_MS = 250

/** Past this many ticks behind, the run is catching up (after a hidden tab or a rejoin): sounds and toasts wait. */
export const CATCH_UP = 30

/** Local bot teammates for dev builds: they wander near the player and pick level-ups after a beat. */
type Bots = { rng: () => number; sticks: Vec[] }

export type CoopLink = {
  slot: number
  /** Names by slot, from the room. */
  names: string[]
  held: Held
  /** Next tick to simulate. */
  tick: number
  /** Input samples taken (one per 60 Hz step of real time) and their stick codes. */
  sample: number
  history: Uint8Array
  sent: { code: number; at: number }
  /** Where this player's latest stamped move landed: the tick and the sample it carried. */
  stamp: { tick: number; sample: number }
  /** Real time not yet turned into samples. */
  acc: number
  /** The pause menu is open: the run goes on, the stick reads still. */
  menu: boolean
  /** `over` was sent for this run. */
  over: boolean
  /** Dev: a local feed with bots instead of the server. */
  bots: Bots | null
  /** Ticks the local feed made (local runs only). */
  made: number
  /** Entries waiting for the next local tick (local runs only). */
  queue: TickEntry[]
}

export const createLink = (slot: number, names: string[], players: number, bots = false): CoopLink => ({
  slot,
  names,
  held: createHeld(players),
  tick: 0,
  sample: 0,
  history: new Uint8Array(HISTORY),
  sent: { code: -1, at: 0 },
  stamp: { tick: 0, sample: -1 },
  acc: 0,
  menu: false,
  over: false,
  bots: bots ? { rng: createRng(7), sticks: Array.from({ length: players }, () => ({ x: 0, y: 0 })) } : null,
  made: 0,
  queue: [],
})

/** This device's player. */
export const me = (g: Game, link: CoopLink): Player => g.players[link.slot] ?? g.players[0]!

/** Queues an entry for this player: to the server, or into the local feed. */
export const sendEntry = (link: CoopLink, entry: TickEntry, viaServer: () => void) => {
  if (link.bots) link.queue.push(entry)
  else viaServer()
}

/** Samples the stick once (a 60 Hz step of real time) and sends it when it changed, or as a heartbeat. */
const sample = (link: CoopLink, move: Vec, now: number) => {
  link.sample++
  const code = moveCode(move)
  link.history[link.sample % HISTORY] = code
  if (code === link.sent.code && now - link.sent.at < HEARTBEAT_MS) return
  link.sent = { code, at: now }
  if (link.bots) link.queue.push([link.slot, 'move', code, link.sample])
  else sendMove(code, link.sample)
}

/** The local feed's next tick: this player's queued entries plus the bots' sticks and picks. */
const localTick = (g: Game, link: CoopLink, bots: Bots): TickEntry[] => {
  const entries = link.queue
  link.queue = []
  const mine = me(g, link)
  for (const p of g.players) {
    if (p.slot === link.slot || p.gone) continue
    if (link.made % 20 === p.slot) {
      // Drift around the player, a little out, with some wander.
      const dx = mine.x - p.x + Math.cos(link.made / 90 + p.slot * 2) * 70
      const dy = mine.y - p.y + Math.sin(link.made / 90 + p.slot * 2) * 50
      const len = Math.hypot(dx, dy)
      const stick = len < 20 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len }
      bots.sticks[p.slot] = stick
      entries.push([p.slot, 'move', moveCode(stick), link.made])
    }
    if (p.offers.length > 0 && bots.rng() < 0.02) entries.push([p.slot, 'offer', Math.floor(bots.rng() * p.offers.length), p.round])
  }
  link.made++
  return entries
}

/** Ticks known and not simulated yet. */
export const backlog = (link: CoopLink) => (link.bots ? link.made - link.tick : (room()?.known ?? 0) - link.tick)

/**
 * One frame of a co-op run: turns real time into input samples, then
 * simulates the ticks due, keeping `HOLD` in hand against jitter and catching
 * up a few extra per frame when behind (all of them, within a time budget,
 * after a long gap). Returns how many ticks ran.
 */
export const stepCoop = (g: Game, link: CoopLink, dt: number, move: Vec, now: number) => {
  link.acc += dt
  let due = 0
  while (link.acc >= TICK) {
    link.acc -= TICK
    sample(link, link.menu ? { x: 0, y: 0 } : move, now)
    due++
  }
  if (link.bots) {
    // The local feed makes ticks as fast as real time asks.
    for (let i = 0; i < due; i++) {
      const entries = localTick(g, link, link.bots)
      runTick(g, link, entries)
    }
    return due
  }
  // Keep HOLD ticks in hand; run what's due plus a sixth of any surplus.
  const usable = Math.max(0, backlog(link) - HOLD)
  const steps = Math.min(usable, due + Math.max(0, Math.ceil((usable - due) / 6)))
  const deadline = now + 12
  let ran = 0
  for (; ran < steps; ran++) {
    runTick(g, link, takeTick(link.tick))
    if (ran > 8 && performance.now() > deadline) break
  }
  return ran
}

const runTick = (g: Game, link: CoopLink, entries: readonly TickEntry[]) => {
  for (const e of entries) if (e[0] === link.slot && e[1] === 'move') link.stamp = { tick: link.tick, sample: e[3] }
  stepTick(g, link.held, entries)
  link.tick++
  if (!link.bots && link.tick % SUM_EVERY === 0) sendSum(link.tick, stateSum(g))
}

/** Prediction never reaches further than this many samples ahead (a slow link just shows the lag). */
const MAX_AHEAD = 30

/**
 * Where this player's stick already took them, ahead of the simulation: the
 * walk of every sample the server hasn't stamped into a simulated tick yet.
 * Draw-only (ignores ice, water and walls); the simulation catches up a round trip later.
 */
export const predictedOffset = (g: Game, link: CoopLink): Vec => {
  const p = me(g, link)
  if (link.stamp.sample < 0 || !inPlay(p) || g.phase !== 'playing' || g.hitstop > 0) return { x: 0, y: 0 }
  // Sample `s` lands `s - stamp.sample` ticks after the stamp: both sides count 60 per second.
  const simulated = link.stamp.sample + (link.tick - 1 - link.stamp.tick)
  const ahead = Math.min(MAX_AHEAD, link.sample - simulated)
  let x = 0
  let y = 0
  for (let i = 0; i < ahead; i++) {
    const v = moveOf(link.history[(link.sample - i) % HISTORY]!)
    x += v.x
    y += v.y
  }
  const k = p.stats.speed * TICK
  return { x: x * k, y: y * k }
}
