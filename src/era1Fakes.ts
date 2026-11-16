import type { PlayableId } from './data/hatchlings'
import type { CoopBoard, CoopBoardEntry, CoopMember, TeamSize } from './game/coopBoard'
import type { Difficulty } from './game/difficulty'
import type { Board, BoardEntry, RunMode } from './game/ranking'
import type { SupporterTier } from './game/supporters'

/**
 * Made-up Era 1 boards (`ps.era1('fake')`), so the Hall da Fama can be seen
 * without the API: the long endless runs of the old boards, fixed names and
 * times, the same shots every time. `field` sets how many are on the board
 * (thin boards reward fewer places, `era1Places`). The player's own line
 * sits below the top, as `@you`.
 */

type Trainer = readonly [handle: string, name: string, supporter: SupporterTier | null, og: boolean]

const TRAINERS: readonly Trainer[] = [
  ['ravena', 'Ravena', 'gold', true],
  ['kaiohk', 'Kaio', null, false],
  ['mizu_tw', '水無月', 'diamond', false],
  ['brunao', 'Brunão', 'supporter', false],
  ['lucy.b', 'Lucy B.', null, false],
  ['tetsu', 'Tetsu', null, true],
  ['marcelinha', 'Marcelinha', 'gold', false],
  ['jpdark', 'JP Dark', null, false],
  ['camille', 'Camille', null, false],
  ['ozzy99', 'Ozzy', 'supporter', false],
  ['vale_rs', 'Valentina', null, false],
  ['nicog', 'Nico G.', null, false],
]

const STANDARD: readonly (readonly [PlayableId, number])[] = [
  ['gible', 2],
  ['charmander', 2],
  ['froakie', 2],
  ['riolu', 1],
  ['treecko', 2],
  ['pichu', 2],
  ['squirtle', 2],
  ['torchic', 2],
  ['piplup', 2],
  ['bulbasaur', 2],
]

const LEGENDS: readonly PlayableId[] = ['rayquaza', 'kyogre', 'groudon', 'mewtwo', 'dialga', 'lugia', 'hoOh', 'deoxys']

/** Seconds of the run at place `n` (0 the best): 8 h at the top, falling fast, then slowly. */
const timeAt = (n: number) => Math.round(28_800 * 0.86 ** n - n * 37)

const at = (days: number) => new Date(Date.parse('2026-11-15T12:00:00Z') - days * 86_400_000).toISOString()

const who = (n: number) => {
  const [handle, name, supporter, og] = TRAINERS[n % TRAINERS.length]!
  const lap = Math.floor(n / TRAINERS.length)
  return { handle: lap ? `${handle}${lap + 1}` : handle, name, supporter, og }
}

const entry = (n: number, mode: RunMode): BoardEntry => {
  const [starter, stage] = mode === 'legend' ? [LEGENDS[n % LEGENDS.length]!, 0] : STANDARD[n % STANDARD.length]!
  const { handle, name, supporter, og } = who(n)
  return { rank: n + 1, starter, stage, branch: null, time: Math.max(900, timeAt(n)), outcome: 'death', at: at(n * 2 + 1), handle, name, supporter, supporterSince: supporter ? at(60) : null, og, run: `fake-era1-${n}` }
}

export const fakeEra1Board = (mode: RunMode, field: number): Board => {
  const shown = Math.min(field, 50)
  const me: BoardEntry = { ...entry(field + 3, mode), rank: field + 4, handle: 'you', name: 'Você', supporter: null, og: false }
  return { entries: Array.from({ length: shown }, (_, n) => entry(n, mode)), me, total: field + 4 }
}

const member = (i: number): CoopMember => {
  const [starter, stage] = STANDARD[i % STANDARD.length]!
  const { handle, name, supporter, og } = who(i)
  return { handle, name, starter, stage, branch: null, shiny: i % 7 === 3, supporter, og }
}

const team = (n: number, size: TeamSize, difficulty: Difficulty): CoopBoardEntry => ({
  rank: n + 1,
  run: `fake-era1-${size}-${n}`,
  size,
  difficulty,
  time: Math.max(900, Math.round(timeAt(n) * 0.6)),
  outcome: 'wipe',
  at: at(n + 1),
  members: Array.from({ length: size }, (_, seat) => member(n * size + seat)),
})

export const fakeEra1CoopBoard = (size: TeamSize, difficulty: Difficulty, field: number): CoopBoard => ({
  size,
  difficulty,
  period: 'era1',
  entries: Array.from({ length: Math.min(field, 20) }, (_, n) => team(n, size, difficulty)),
  me: null,
  total: field,
})
