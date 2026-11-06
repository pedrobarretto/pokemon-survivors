import { MINIGAMES, type GameOutcome, type MinigameId } from '../data/minigames'
import { weekStart, type DayKey } from '../game/day'

/**
 * The mini games' boards (Placar): each game's best of the Brasília day and
 * of the week (Monday to Sunday, `America/Sao_Paulo`, like the run boards).
 * A solo game ranks its best score; a table game the matches won against a
 * person (a bot's wins would make it a grind board). They fill from the claim
 * the client already sends (`POST /realm/game/claim`, so a score past
 * `maxScore` or a game under `minMs` never reaches them), one row per account,
 * game and period, keeping the best. Pure; shared with the API
 * (`server/src/realm.ts` stores and reads them, `GET /realm/boards/:game`).
 */

export const GAME_BOARD_PERIODS = ['day', 'week'] as const

export type GameBoardPeriod = (typeof GAME_BOARD_PERIODS)[number]

export const isGameBoardPeriod = (v: unknown): v is GameBoardPeriod => GAME_BOARD_PERIODS.some((p) => p === v)

/** Lines a board lists (the viewer's own comes on top of them when it's further down). */
export const GAME_BOARD_SIZE = 20

/** The first day of the period holding `day`: the day itself, or its week's Monday. */
export const periodStart = (period: GameBoardPeriod, day: DayKey): DayKey => (period === 'day' ? day : weekStart(day))

/**
 * What a finished game puts on its boards: a solo game's score (kept if it's
 * the period's best), one win for a table game won against a person (added),
 * or null for nothing (a loss, a draw, a bot's match, an outcome of the other
 * kind). How the row keeps it is `boardKeeps`.
 */
export const boardPoints = (game: MinigameId, outcome: GameOutcome): number | null => {
  if (MINIGAMES[game].kind === 'solo') return 'score' in outcome ? outcome.score : null
  return 'result' in outcome && outcome.result === 'win' && outcome.vs === 'human' ? 1 : null
}

/** How a game's row takes new points: a solo game keeps the best score, a table game adds the wins. */
export const boardKeeps = (game: MinigameId): 'best' | 'sum' => (MINIGAMES[game].kind === 'solo' ? 'best' : 'sum')

/** A line of a board: where it stands (ties go to who got there first), the trainer's @handle and its score (points, or wins at a table). */
export type GameBoardEntry = { rank: number; handle: string; score: number }

/**
 * A game's board for a period starting `start`: the top `GAME_BOARD_SIZE`,
 * the viewer's own line wherever it is (null signed out or off it) and how
 * many trainers it holds.
 */
export type GameBoard = { game: MinigameId; period: GameBoardPeriod; start: DayKey; entries: GameBoardEntry[]; me: GameBoardEntry | null; total: number }
