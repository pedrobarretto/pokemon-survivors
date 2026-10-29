import type { Entry, RunStart, Scalar } from '../net/protocol'
import { parseTickEntry, type PickScreen, type TickEntry } from '../game/lockstep'
import type { MegaId } from '../data/megas'
import type { PingKind, QuickChat } from '../game/versusSocial'

/**
 * Inputs on the wire. The relay stamps them as `[seat, kind, ...values]` and
 * knows nothing of their meaning; this module turns a stamped entry into the
 * simulation's `TickEntry` (seat → slot, values → fields) and builds the
 * values a client sends. A client may append values the simulation ignores
 * (the input sample of a move or a special press, a pick's nonce), which is how it recognizes its own
 * inputs coming back. Part of the simulation's build id (`simBuild.ts`): every
 * client must read entries the same way.
 */

/** What a client sends, by kind (the relay's `in {k, d}`). */
export type Input =
  | { k: 'move'; code: number; sample: number }
  | { k: 'special'; sample: number }
  | { k: 'mega' | 'lunge' }
  | { k: 'pick'; screen: PickScreen; round: number; index: number }
  | { k: 'reroll' | 'skip'; round: number }
  | { k: 'banish'; round: number; index: number }
  | { k: 'stone'; mega: MegaId }
  | { k: 'endless'; vote: boolean }
  /** Arena: a quick chat line, a ping, a surrender vote (`game/versusSocial.ts`). */
  | { k: 'chat'; msg: QuickChat }
  | { k: 'ping'; ping: PingKind; x: number; y: number }
  | { k: 'surrender'; vote: boolean }

/**
 * Inputs that must get through (resent until seen in a frame): picks, the
 * screen buttons, a stone, a vote (a surrender's too; a resent one counts
 * once). A chat line or a ping lost on a dropped link is just gone.
 */
export type ReliableInput = Extract<Input, { k: 'pick' | 'reroll' | 'skip' | 'banish' | 'stone' | 'endless' | 'surrender' }>

export const isReliable = (i: Input): i is ReliableInput =>
  i.k === 'pick' || i.k === 'reroll' || i.k === 'skip' || i.k === 'banish' || i.k === 'stone' || i.k === 'endless' || i.k === 'surrender'

/** The values of an input on the wire, a nonce last for the reliable ones (the simulation never reads it). */
export const inputValues = (i: Input, nonce = 0): Scalar[] => {
  switch (i.k) {
    case 'move':
      return [i.code, i.sample]
    case 'special':
      return [i.sample]
    case 'mega':
    case 'lunge':
      return []
    case 'pick':
      return [i.screen, i.round, i.index, nonce]
    case 'reroll':
    case 'skip':
      return [i.round, nonce]
    case 'banish':
      return [i.round, i.index, nonce]
    case 'stone':
      return [i.mega, nonce]
    case 'endless':
    case 'surrender':
      return [i.vote, nonce]
    case 'chat':
      return [i.msg]
    case 'ping':
      return [i.ping, i.x, i.y]
  }
}

/** Each seat's slot in the run's game: its place in `RunStart.players`. */
export const slotsOf = (start: RunStart): ReadonlyMap<number, number> => new Map(start.players.map((p, slot) => [p.seat, slot]))

/** A stamped entry as the simulation's tick entry, or null for a seat that isn't in the run or a malformed entry. Never throws. */
export const toTickEntry = (e: Entry, slots: ReadonlyMap<number, number>): TickEntry | null => {
  const [seat, kind, a, b, c] = e
  const slot = slots.get(seat)
  if (slot === undefined) return null
  const raw: Record<string, unknown> = { slot, kind }
  switch (kind) {
    case 'move':
      raw.code = a
      break
    case 'pick':
      raw.screen = a
      raw.round = b
      raw.index = c
      break
    case 'reroll':
    case 'skip':
      raw.round = a
      break
    case 'banish':
      raw.round = a
      raw.index = b
      break
    case 'stone':
      raw.mega = a
      break
    case 'endless':
    case 'surrender':
      raw.vote = a
      break
    case 'chat':
      raw.msg = a
      break
    case 'ping':
      raw.ping = a
      raw.x = b
      raw.y = c
      break
  }
  return parseTickEntry(raw, slots.size)
}

/** A tick's stamped entries as tick entries, in order. */
export const toTickEntries = (entries: readonly Entry[], slots: ReadonlyMap<number, number>): TickEntry[] => {
  const out: TickEntry[] = []
  for (const e of entries) {
    const t = toTickEntry(e, slots)
    if (t) out.push(t)
  }
  return out
}
