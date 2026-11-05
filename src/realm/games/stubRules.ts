import type { TableRules } from '../../net/realmTables'

/**
 * The placeholder table game's rules (`stubs.ts` re-exports them), on their
 * own so the realm relay's bundle (`tables.ts`) never reaches the DOM code of
 * the other stubs. Goes with `stubs.ts`.
 */

type Nim = { left: number; turn: number; winner: number | null }

/** A placeholder table game: take 1 to 3 from 10 in turns, whoever takes the last wins. */
export const stubRules: TableRules<Nim, number, Nim> = {
  seats: 2,
  start: () => ({ left: 10, turn: 0, winner: null }),
  parseMove: (v) => (v === 1 || v === 2 || v === 3 ? v : null),
  play: (s, seat, m) => (seat !== s.turn || m > s.left ? null : { left: s.left - m, turn: 1 - s.turn, winner: s.left - m === 0 ? seat : null }),
  pending: (s) => (s.winner === null ? [s.turn] : []),
  result: (s) => (s.winner === null ? null : { winner: s.winner, forfeit: null }),
  view: (s) => s,
  parseView: (v) =>
    typeof v === 'object' && v !== null && 'left' in v && 'turn' in v && 'winner' in v && typeof v.left === 'number' && typeof v.turn === 'number' && (v.winner === null || typeof v.winner === 'number')
      ? { left: v.left, turn: v.turn, winner: v.winner }
      : null,
  bot: (s) => Math.max(1, Math.min(3, s.left % 4 || 1)),
}
