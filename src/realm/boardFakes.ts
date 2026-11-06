import { MINIGAMES, type MinigameId } from '../data/minigames'
import { brasiliaDay } from '../game/day'
import { GAME_BOARD_SIZE, periodStart, type GameBoard, type GameBoardEntry, type GameBoardPeriod } from './boards'

/**
 * Made-up mini game boards (`ps.realm('fake')`, `ps.realmBoard(…)`), so the
 * Placar can be seen without the API: fixed trainers and scores falling from
 * a strong round (or a dozen wins at a table), the same shots every time. The
 * player's line is its own claims faked this session (`claimGame`), or one
 * placed for the shot: inside the day's top, below the week's.
 */

const HANDLES = [
  'ashk', 'misty', 'brock', 'mayhoenn', 'dawn', 'serena_k', 'goh', 'iris', 'cilan', 'gary.oak', 'lillie', 'kiawe',
  'nessa', 'leon', 'marnie', 'hop', 'bea', 'raihan', 'sonia', 'piers', 'gloria', 'victor', 'penny', 'nemona',
  'arven', 'kieran', 'carmine', 'rika', 'geeta', 'larry',
] as const

/** Trainers on the fake day's board and the week's. */
const COUNT: Record<GameBoardPeriod, number> = { day: 9, week: HANDLES.length }

/** The fake leader's score: a strong solo round, or a dozen wins at a table. */
const topOf = (game: MinigameId) => {
  const def = MINIGAMES[game]
  return def.kind === 'solo' ? Math.round(def.maxScore * (game === 'fishing' ? 0.31 : 0.4)) : 12
}

/** Fake line `n` (0 the leader): the scores fall off a bit faster near the top. */
const scoreAt = (game: MinigameId, period: GameBoardPeriod, n: number) => {
  const top = topOf(game) * (period === 'day' ? 0.8 : 1)
  return Math.max(1, Math.round(top * (1 - 0.6 * (n / HANDLES.length) ** 0.8)))
}

/**
 * A fake board of `game` for `period`, with `you` on it: at `score` when it
 * played (faked claims), else at a spot picked for the shot.
 */
export const fakeGameBoard = (game: MinigameId, period: GameBoardPeriod, you: { handle: string; score: number | null } | null): GameBoard => {
  const others = HANDLES.filter((h) => h !== you?.handle).slice(0, COUNT[period]).map((handle, n) => ({ handle, score: scoreAt(game, period, n) }))
  const placed = you ? (you.score ?? scoreAt(game, period, period === 'day' ? 4 : 26) - (period === 'day' ? 0 : 1)) : null
  // Sorted best first; a tie goes to the fake trainer (they got there first).
  const lines = [...others, ...(you && placed !== null ? [{ handle: you.handle, score: placed }] : [])].sort((a, b) => b.score - a.score || (a.handle === you?.handle ? 1 : b.handle === you?.handle ? -1 : 0))
  const ranked: GameBoardEntry[] = lines.map((l, i) => ({ rank: i + 1, ...l }))
  return {
    game,
    period,
    start: periodStart(period, brasiliaDay(new Date())),
    entries: ranked.slice(0, GAME_BOARD_SIZE),
    me: ranked.find((e) => e.handle === you?.handle) ?? null,
    total: ranked.length,
  }
}
