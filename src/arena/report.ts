import type { EventData } from '../analytics'
import type { MatchKind } from '../data/arenaRanked'
import { isRecord } from '../game/parse'
import type { Game } from '../game/types'

/**
 * The Arena's `versus_end` as the shell sends it, pure: this player's line of
 * a match, at its end or as it stood when they left it, and the copy held on
 * the device while it runs (`ps:versusHeld`), which the next page load sends
 * when the page went away without a word. DOM-free, never part of the simulation.
 */

export type VersusEnd = EventData<'versus_end'>

/** How a player left a match before its end. */
export type VersusLeave = Exclude<VersusEnd['outcome'], 'end'>

/**
 * This player's `versus_end` (`slot`: their seat; `local`: against bots on the
 * in-page relay). A match the clock ended reports `end` whatever `left` says, with
 * its winner and result; one still on reports `left`, with neither, at its clock
 * and score then. Null when the seat isn't in the match.
 */
export const versusReport = (g: Game, slot: number, kind: MatchKind, local: boolean, left: VersusLeave): VersusEnd | null => {
  const s = g.versus
  const me = g.players[slot]?.versus
  if (!s || !me) return null
  const winner = s.result?.winner
  return {
    mode: local ? 'bots' : 'friends',
    kind,
    outcome: s.result ? 'end' : left,
    second: Math.floor(g.time),
    winner: winner === undefined ? null : winner === null ? 'draw' : winner === 0 ? 'blue' : 'red',
    team: me.team === 0 ? 'blue' : 'red',
    result: winner === undefined ? null : winner === null ? 'draw' : winner === me.team ? 'win' : 'loss',
    blue: s.score[0],
    red: s.score[1],
    kos: me.kos,
    deaths: me.deaths,
    scored: me.scored,
    level: g.players[slot]!.level,
    starter: g.players[slot]!.starter,
    humans: g.players.filter((p) => !p.versus?.bot).length,
    format: s.format,
    surrender: s.result?.surrender == null ? null : s.result.surrender === 0 ? 'blue' : 'red',
  }
}

/** A held report as stored: when it was last written (ms) and the match then, as a `gone` one. */
export type HeldVersus = { at: number; data: VersusEnd }

/** A held report read back; null for anything that isn't one (another build's, junk). */
export const parseHeldVersus = (v: unknown): HeldVersus | null => {
  if (!isRecord(v) || typeof v.at !== 'number' || !isRecord(v.data)) return null
  const d = v.data
  if (d.outcome !== 'gone' || typeof d.second !== 'number' || typeof d.kind !== 'string' || typeof d.starter !== 'string') return null
  // Written by `versusEnd` on this device: the shape checked above is the one it writes.
  return { at: v.at, data: d as VersusEnd }
}
