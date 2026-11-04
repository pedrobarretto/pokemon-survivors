import type { PlayableId } from './data/hatchlings'
import { dailyCoopChallenge, type CoopBoard, type CoopBoardEntry, type CoopChallengeBoard, type CoopMember, type TeamSize } from './game/coopBoard'
import type { DayKey } from './game/day'
import type { Difficulty } from './game/difficulty'
import type { BoardPeriod } from './game/ranking'

/**
 * Made-up co-op boards (`ps.coopBoard('fake')`), so the Ranking's Co-op side,
 * the Desafio co-op do dia and the co-op end's button can be seen without the
 * API. Fixed teams and times, cut to the board's size: the same shots every
 * time. The player's own team (`me`) sits below the top, as `@you`.
 */

type Trainer = Omit<CoopMember, 'starter' | 'stage' | 'branch' | 'shiny'>

const TRAINERS: readonly Trainer[] = [
  { handle: 'ashk', name: 'Ash', supporter: 'gold', og: true },
  { handle: 'misty', name: 'Misty', supporter: null, og: false },
  { handle: 'brock', name: 'Brock', supporter: 'supporter', og: false },
  { handle: 'mayhoenn', name: 'May', supporter: null, og: false },
  { handle: 'dawn', name: 'Dawn', supporter: 'diamond', og: false },
  { handle: 'serena_k', name: 'Serena', supporter: null, og: false },
  { handle: 'goh', name: 'Goh', supporter: null, og: false },
  { handle: 'iris', name: 'Iris', supporter: 'supporter', og: true },
  { handle: 'cilan', name: 'Cilan', supporter: null, og: false },
  { handle: 'gary.oak', name: 'Gary Oak', supporter: null, og: false },
  { handle: 'lillie', name: 'Lillie', supporter: null, og: false },
  { handle: 'kiawe', name: 'Kiawe', supporter: 'gold', og: false },
]

/** Pokémon, how far they evolved, and shiny: one per seat of the fake teams. */
const PICKS: readonly (readonly [PlayableId, number, boolean])[] = [
  ['charmander', 2, false],
  ['squirtle', 2, true],
  ['bulbasaur', 1, false],
  ['pichu', 2, false],
  ['gible', 2, false],
  ['froakie', 2, false],
  ['eevee', 0, false],
  ['treecko', 2, false],
  ['piplup', 1, false],
  ['riolu', 1, true],
  ['torchic', 2, false],
  ['fennekin', 1, false],
]

const RUNS = 14

const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const member = (i: number): CoopMember => {
  const [starter, stage, shiny] = PICKS[i % PICKS.length]!
  return { ...TRAINERS[i % TRAINERS.length]!, starter, stage, branch: null, shiny }
}

/** Fake team `n` (0 the best) of `size`, on `difficulty`: times falling from a victory past 20:00. */
const entry = (n: number, size: TeamSize, difficulty: Difficulty): CoopBoardEntry => ({
  rank: n + 1,
  run: `fake-${size}-${n}`,
  size,
  difficulty,
  time: n === 0 ? 1260 + size * 11 : Math.max(95, 1180 - n * 71 - size * 13),
  outcome: n === 0 ? 'victory' : 'wipe',
  at: at(17 + n * 41),
  members: Array.from({ length: size }, (_, seat) => member(n * 3 + seat * 5)),
})

/** The player's own team, under the top: `@you` and a friend. */
const mine = (size: TeamSize, difficulty: Difficulty): CoopBoardEntry => ({
  ...entry(RUNS + 9, size, difficulty),
  run: `fake-${size}-me`,
  members: Array.from({ length: size }, (_, seat) => (seat === 0 ? { ...member(6), handle: 'you', name: 'Você', supporter: 'supporter', og: false } : member(seat * 4 + 1))),
})

export const fakeCoopBoard = (size: TeamSize, difficulty: Difficulty, period: BoardPeriod): CoopBoard => ({
  size,
  difficulty,
  period,
  entries: Array.from({ length: period === 'day' ? 6 : RUNS }, (_, n) => entry(n, size, difficulty)),
  me: mine(size, difficulty),
})

export const fakeCoopChallengeBoard = (day: DayKey, size: TeamSize): CoopChallengeBoard => {
  const { difficulty } = dailyCoopChallenge(day)
  return { day, size, difficulty, total: 37 - size * 5, entries: Array.from({ length: 9 }, (_, n) => entry(n, size, difficulty)), me: mine(size, difficulty) }
}
