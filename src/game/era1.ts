import { SEASON_ONE } from '../data/seasons'
import type { TeamSizeKey } from './coopBoard'
import { DIFFICULTY_IDS, type Difficulty } from './difficulty'
import type { GiftContent, GiftReason } from './gifts'
import type { RunMode } from './ranking'

/**
 * The Era 1 Hall da Fama: every board's runs from before Temporada 1
 * (`SEASON_ONE`, period `era1` in `game/ranking.ts`) stay on show for good,
 * and the top of each main board earns a title and a frame, the board's #1 a
 * stronger set. The API alone decides and sends them as Mystery Gifts
 * (`server/src/era1.ts`, from its own tables), keyed once per player and
 * tier, so a client can't claim one and the save keeps them through
 * `keepGiven` like any gift the API sent. Pure; shared with the API.
 *
 * Which boards count: the solo boards of each mode (regular and Legend) and
 * difficulty, and the co-op boards of each team size and difficulty. Not the
 * per-Pokémon filter (dozens of thin tables would hand out a flood), nor the
 * friends view (it's the viewer's), nor day and week (they have no era), nor
 * the Desafio do dia (its ribbons are its reward). Co-op teams earn the Hall
 * tier only, and fewer of them: those boards opened two weeks before the
 * season, a run there is vouched by its clients' votes rather than a
 * re-simulation, and one place holds up to four players.
 */

export const ERA1 = {
  /** Places a solo board rewards at most. */
  top: 10,
  /** Teams a co-op board rewards at most. */
  coopTop: 3,
  /** A board rewards at most this share of the players (or teams) on it, so a thin board rewards a few, not everyone. */
  share: 1 / 4,
  /** A board with fewer players (or teams) than this isn't a race: it rewards no one. */
  minField: 10,
  /**
   * How long after the season opens the rewards go out: a run that started
   * before it may still be playing (endless mode lasts hours, `RANKED.maxTime`)
   * and its check may still be due.
   */
  settleMs: 24 * 3600_000,
} as const

/** The two rewards: the Hall's (a top place) and the Champion's (a board's #1, solo only). */
export const ERA1_TIERS = ['champion', 'hall'] as const

export type Era1Tier = (typeof ERA1_TIERS)[number]

/** A main board: a solo side (`RunMode`) or a co-op team size, and a difficulty. */
export type Era1Side = RunMode | TeamSizeKey

export const ERA1_SIDES = ['standard', 'legend', 'duo', 'trio', 'squad'] as const satisfies readonly Era1Side[]

export const isEra1Side = (v: unknown): v is Era1Side => ERA1_SIDES.some((s) => s === v)

export type Era1Board = { side: Era1Side; difficulty: Difficulty }

const isCoop = (side: Era1Side) => side !== 'standard' && side !== 'legend'

/** Places a board of `field` players (or teams) rewards: none under `ERA1.minField`, else a share of it up to the cap. */
export const era1Places = (field: number, coop = false) =>
  field < ERA1.minField ? 0 : Math.min(coop ? ERA1.coopTop : ERA1.top, Math.floor(field * ERA1.share))

/** A board as the API ranks it: how many are on it, and the players near its top with their place (a team's members share it). */
export type Era1Standing = { board: Era1Board; field: number; places: readonly { userId: string; rank: number }[] }

/** What a player earned: the tier, and the board and place that earned it. */
export type Era1Award = { tier: Era1Tier; rank: number; board: Era1Board }

/** The tier a place earns on a board that rewards it: a solo board's #1 is its Champion. */
const tierOf = (board: Era1Board, rank: number): Era1Tier => (rank === 1 && !isCoop(board.side) ? 'champion' : 'hall')

/** Whether `a` beats `b`: the stronger tier, then the better place, then the harder difficulty, then solo before co-op. */
const better = (a: Era1Award, b: Era1Award) => {
  if (a.tier !== b.tier) return a.tier === 'champion'
  if (a.rank !== b.rank) return a.rank < b.rank
  const hard = DIFFICULTY_IDS.indexOf(a.board.difficulty) - DIFFICULTY_IDS.indexOf(b.board.difficulty)
  if (hard !== 0) return hard > 0
  return ERA1_SIDES.indexOf(a.board.side) < ERA1_SIDES.indexOf(b.board.side)
}

/** Each rewarded player's best award across the boards, once: a player on several boards gets their best tier, not a pile. */
export const era1Awards = (standings: readonly Era1Standing[]): Map<string, Era1Award> => {
  const awards = new Map<string, Era1Award>()
  for (const { board, field, places } of standings) {
    const cut = era1Places(field, isCoop(board.side))
    for (const { userId, rank } of places) {
      if (rank > cut) continue
      const award: Era1Award = { tier: tierOf(board, rank), rank, board }
      const had = awards.get(userId)
      if (!had || better(award, had)) awards.set(userId, award)
    }
  }
  return awards
}

/** Each tier's gifts: a title and a frame, and the Champion's sky for the share cards besides. */
export const ERA1_GIFTS = {
  hall: [
    { kind: 'title', title: 'era1Legend' },
    { kind: 'style', style: { slot: 'frame', id: 'era1' } },
  ],
  champion: [
    { kind: 'title', title: 'era1Champion' },
    { kind: 'style', style: { slot: 'frame', id: 'era1Champion' } },
    { kind: 'style', style: { slot: 'background', id: 'era1Champion' } },
  ],
} as const satisfies Record<Era1Tier, readonly GiftContent[]>

/** The Mystery Gifts an award sends, each under its own key (`era1:champion:0`…), so sending again never doubles one. */
export const era1Gifts = (award: Era1Award): { content: GiftContent; reason: GiftReason; key: string }[] =>
  ERA1_GIFTS[award.tier].map((content, i) => ({
    content,
    reason: { kind: 'era1', tier: award.tier, rank: award.rank, side: award.board.side, difficulty: award.board.difficulty },
    key: `era1:${award.tier}:${i}`,
  }))

const START = Date.parse(SEASON_ONE.start)

/** Whether Era 1 has closed at `now` (ms): Temporada 1 opened and no new run can join its boards. */
export const era1Closed = (now: number) => now >= START

/** Whether Era 1's rewards are due at `now` (ms): `ERA1.settleMs` after it closed, once every run from before it has ended. */
export const era1Due = (now: number) => now >= START + ERA1.settleMs
