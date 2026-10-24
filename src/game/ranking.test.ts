import { describe, expect, it } from 'vitest'
import { RUN_LENGTH } from '../data/waves'
import { clockAllows, freeHandle, handleProblem, maxKills, parseDisplayName, parseHandle, parseRunResult, rankable, RANKED, reportProblem, runMode, suggestHandle, type RunResult } from './ranking'

const run = (o: Partial<Record<keyof RunResult, unknown>> = {}) => ({ starter: 'charmander', stage: 1, difficulty: 'hard', time: 300, outcome: 'death', level: 20, kills: 800, version: 'abc1234', ...o })

describe('parseRunResult', () => {
  it('keeps a plausible run', () => {
    expect(parseRunResult(run())).toEqual({ ...run(), branch: null })
  })

  it("keeps a branch of the run's family it evolved into, and reads any other as none", () => {
    const eevee = (stage: number, branch: unknown) => parseRunResult(run({ starter: 'eevee', stage, branch }))?.branch
    expect(eevee(1, 'espeon')).toBe('espeon')
    // Another family's branch, one Eevee hasn't evolved into yet, garbage.
    for (const [stage, branch] of [[1, 'gallade'], [0, 'espeon'], [1, 'mewtwo'], [1, 7]] as const) expect(eevee(stage, branch)).toBeNull()
    // Kirlia (stage 1) isn't Gardevoir yet.
    expect(parseRunResult(run({ starter: 'ralts', stage: 1, branch: 'gardevoir' }))?.branch).toBeNull()
  })

  it('refuses unknown Pokémon, difficulties, outcomes and stages', () => {
    for (const o of [{ starter: 'missingno' }, { difficulty: 'easy' }, { outcome: 'won' }, { stage: 3 }, { stage: 1.5 }]) expect(parseRunResult(run(o))).toBeNull()
  })

  it('refuses a victory before Mewtwo shows up', () => {
    expect(parseRunResult(run({ outcome: 'victory', time: RUN_LENGTH - 1 }))).toBeNull()
    expect(parseRunResult(run({ outcome: 'victory', time: RUN_LENGTH + 2 }))).not.toBeNull()
  })

  it('refuses more faints than the clock allows, and impossible times', () => {
    expect(parseRunResult(run({ kills: maxKills(300) + 1 }))).toBeNull()
    for (const time of [-1, Number.NaN, RANKED.maxTime + 1, '300']) expect(parseRunResult(run({ time }))).toBeNull()
  })

  it('lets long endless runs faint far more per second', () => {
    // A real 2-hour endless run: 342,655 faints in 7,335 s (~47/s).
    expect(parseRunResult(run({ outcome: 'victory', time: 7335, level: 430, kills: 342_655 }))).not.toBeNull()
    // A Legend run in Nightmare: Mewtwo, 629,648 faints in 69:03 (~152/s).
    expect(parseRunResult(run({ starter: 'mewtwo', stage: 0, difficulty: 'nightmare', outcome: 'victory', time: 4143, level: 491, kills: 629_648 }))).not.toBeNull()
  })
})

describe('runMode', () => {
  it('puts a legend’s run on the Legend boards, at its single stage', () => {
    expect(runMode('kyogre')).toBe('legend')
    expect([runMode('charmander'), runMode('eevee')]).toEqual(['standard', 'standard'])
    expect(parseRunResult(run({ starter: 'kyogre', stage: 0 }))).not.toBeNull()
    expect(parseRunResult(run({ starter: 'kyogre', stage: 1 }))).toBeNull()
  })
})

describe('clockAllows', () => {
  it('lets the run fit the wall clock since its token, plus the slack', () => {
    expect(clockAllows(600, 600 + RANKED.slack)).toBe(true)
    expect(clockAllows(600, 601 + RANKED.slack)).toBe(false)
  })
})

describe('reportProblem', () => {
  const result = (o: Partial<RunResult> = {}) => ({ ...(run() as RunResult), branch: null, ...o })
  const fresh = (seed: number | null) => ({ seed, reported: null })

  it('takes only the seed dealt with the token, and any on a row from before seeds were dealt', () => {
    expect(reportProblem(fresh(42), result(), 42)).toBeNull()
    expect(reportProblem(fresh(42), result(), 43)).toBe('seed')
    expect(reportProblem(fresh(null), result(), 43)).toBeNull()
  })

  it('lets only a victory grow (endless mode), never shrink or change Pokémon', () => {
    const won = { seed: 42, reported: { starter: 'charmander', difficulty: 'hard', time: RUN_LENGTH, outcome: 'victory' } } as const
    expect(reportProblem(won, result({ time: RUN_LENGTH + 600, outcome: 'victory' }), 42)).toBeNull()
    expect(reportProblem(won, result({ time: RUN_LENGTH - 1 }), 42)).toBe('mismatch')
    expect(reportProblem(won, result({ time: RUN_LENGTH + 600, starter: 'squirtle' }), 42)).toBe('mismatch')
    const died = { seed: 42, reported: { starter: 'charmander', difficulty: 'hard', time: 300, outcome: 'death' } } as const
    // The same report again (a retry) still goes; a longer one would be a seed kept on hold.
    expect(reportProblem(died, result(), 42)).toBeNull()
    expect(reportProblem(died, result({ time: 900 }), 42)).toBe('mismatch')
  })
})

describe('rankable', () => {
  it('drops quits in the first minute only', () => {
    expect(rankable(run({ outcome: 'quit', time: 59 }) as RunResult)).toBe(false)
    expect(rankable(run({ outcome: 'quit', time: 60 }) as RunResult)).toBe(true)
    expect(rankable(run({ outcome: 'death', time: 5 }) as RunResult)).toBe(true)
  })
})

describe('handles', () => {
  it('normalizes what the player typed', () => {
    expect(parseHandle('  @Pedro_B ')).toBe('pedro_b')
  })

  it('says what is wrong', () => {
    expect(handleProblem('ab')).toBe('short')
    expect(handleProblem('a'.repeat(21))).toBe('long')
    expect(handleProblem('joão')).toBe('chars')
    expect(handleProblem('admin')).toBe('reserved')
    expect(handleProblem('ash_99')).toBeNull()
  })

  it('suggests a valid handle from any name', () => {
    expect(suggestHandle('Zoë Müller')).toBe('zoemuller')
    expect(suggestHandle('李')).toBe('trainer')
    expect(suggestHandle('Al')).toBe('traineral')
    for (const name of ['Pedro Barretto', 'X Æ A-12', 'Admin', 'Maximiliano Fernández de la Cruz']) expect(handleProblem(suggestHandle(name))).toBeNull()
  })

  it('finds the first free handle, keeping it within the limit', () => {
    expect(freeHandle('ash', new Set())).toBe('ash')
    expect(freeHandle('ash', new Set(['ash', 'ash2']))).toBe('ash3')
    expect(freeHandle('a'.repeat(20), new Set(['a'.repeat(20)]))).toBe(`${'a'.repeat(19)}2`)
  })
})

describe('parseDisplayName', () => {
  it('trims, folds spaces and drops control characters', () => {
    expect(parseDisplayName('  Ash\u0000  Ketchum​ ')).toBe('Ash Ketchum')
  })

  it('refuses empty and long names', () => {
    expect(parseDisplayName('   ')).toBeNull()
    expect(parseDisplayName('a'.repeat(25))).toBeNull()
    expect(parseDisplayName('🔥'.repeat(24))).toBe('🔥'.repeat(24))
  })
})
