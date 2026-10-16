import type { Vec } from '../engine/math'
import type { TickEntry } from '../net/protocol'
import { leaveRun } from './coop'
import { continueEndless } from './endlessSystem'
import { pickOffer, rerollOffers, skipLevelUp, stepTeam, type StepInput } from './game'
import { moveOf, TICK } from './replay'
import type { Game } from './types'

/**
 * Co-op lockstep on the client: every player's game applies the same tick
 * entries (relayed by the server, `net/protocol.ts`) in the same order and
 * steps, so the runs stay identical bit for bit. Sticks hold between ticks
 * until they change; presses last one tick. Pure.
 */

/** What carries over between ticks: each player's stick and the input counter it came with (for prediction). */
export type Held = { moves: Vec[]; samples: number[] }

export const createHeld = (players: number): Held => ({
  moves: Array.from({ length: players }, () => moveOf(0)),
  samples: Array.from({ length: players }, () => -1),
})

/** Applies one tick's entries (picks and leaves land before the step, like a replay's events), then steps it. */
export const stepTick = (g: Game, held: Held, entries: readonly TickEntry[]) => {
  const inputs: StepInput[] = held.moves.map((move) => ({ move, special: false }))
  for (const e of entries) {
    const slot = e[0]
    const p = g.players[slot]
    const input = inputs[slot]
    if (!p || !input) continue
    switch (e[1]) {
      case 'move':
        held.moves[slot] = moveOf(e[2])
        held.samples[slot] = e[3]
        input.move = held.moves[slot]!
        break
      case 'special':
      case 'mega':
      case 'lunge':
        input[e[1]] = true
        break
      case 'offer':
        pickOffer(g, p, e[2], e[3])
        break
      case 'reroll':
        rerollOffers(g, p)
        break
      case 'skip':
        skipLevelUp(g, p)
        break
      case 'endless':
        continueEndless(g)
        break
      case 'away':
        p.away = true
        break
      case 'back':
        p.away = false
        break
      case 'leave':
        leaveRun(g, p)
        break
    }
  }
  stepTeam(g, inputs, TICK)
}

/** Ticks between checksums: every 2 s of play. */
export const SUM_EVERY = 120

const view = new DataView(new ArrayBuffer(8))

/** FNV-1a over a number's exact bits, so two engines agree only if the simulations do. */
const mix = (h: number, n: number) => {
  view.setFloat64(0, n)
  for (let i = 0; i < 8; i++) h = Math.imul(h ^ view.getUint8(i), 16777619)
  return h
}

/**
 * A checksum of the run's state: clock, ids, the team and the horde. Players
 * compare it at the same tick (`SUM_EVERY`) to catch a drift early. Unsigned 32 bits.
 */
export const stateSum = (g: Game) => {
  let h = mix(mix(mix(2166136261, g.time), g.nextId), g.kills)
  for (const p of g.players) h = mix(mix(mix(mix(h, p.x), p.y), p.hp), p.level)
  h = mix(h, g.enemies.length)
  for (const e of g.enemies) h = mix(mix(mix(h, e.x), e.y), e.hp)
  return h >>> 0
}
