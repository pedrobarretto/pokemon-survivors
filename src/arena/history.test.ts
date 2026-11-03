import { describe, expect, it } from 'vitest'
import type { ArenaHistoryEntry, ArenaResult } from '../game/arenaRank'
import { divisionProgress, historyEntry, LOCAL_HISTORY_MAX, mergeHistory, parseHistoryEntry, pushHistory, timeLeft } from './history'

const result: ArenaResult = {
  v: 1,
  score: [120, 95],
  winner: 0,
  seconds: 600,
  objective: null,
  surrender: null,
  seats: [
    { slot: 0, team: 0, starter: 'charmander', form: 'Charizard', bot: false, kos: 4, deaths: 2, scored: 60, damage: 9000, assists: 2, dealt: 3000, taken: 2500, healed: 0, interrupts: 1, afk: 0 },
    { slot: 1, team: 1, starter: 'squirtle', form: 'Blastoise', bot: true, kos: 1, deaths: 3, scored: 30, damage: 4000, assists: 0, dealt: 1500, taken: 4000, healed: 200, interrupts: 0, afk: 0 },
  ],
}

const entry = (at: number, over: Partial<ArenaHistoryEntry> = {}): ArenaHistoryEntry => ({ ...historyEntry(result, 0, at, 'practice')!, ...over })

describe('historyEntry', () => {
  it("is the seat's line, from its team's side", () => {
    expect(historyEntry(result, 0, 1000, 'practice')).toMatchObject({ outcome: 'win', team: 0, starter: 'charmander', kos: 4, scored: 60, rp: null, kind: 'practice' })
    expect(historyEntry(result, 1, 1000, 'practice')?.outcome).toBe('loss')
    expect(historyEntry({ ...result, winner: null }, 1, 1000, 'practice')?.outcome).toBe('draw')
    expect(historyEntry(result, 5, 1000, 'practice')).toBeNull()
  })
})

describe('mergeHistory', () => {
  it("adds the device's matches the API lacks, newest first", () => {
    const api = [entry(5_000_000, { id: 'a', kind: 'ranked', rp: 24 })]
    const device = [entry(9_000_000), entry(1_000_000)]
    expect(mergeHistory(api, device).map((e) => e.at)).toEqual([9_000_000, 5_000_000, 1_000_000])
  })

  it("drops a device practice the API already kept (another id, a moment apart)", () => {
    const api = [entry(1_060_000, { id: 'server-1' })]
    expect(mergeHistory(api, [entry(1_000_000)])).toHaveLength(1)
    expect(mergeHistory(api, [entry(1_000_000, { score: [1, 2] })])).toHaveLength(2)
  })

  it("is the device's alone without the API", () => {
    expect(mergeHistory(null, [entry(1)])).toHaveLength(1)
  })
})

describe('pushHistory', () => {
  it('keeps the newest, at most the cap', () => {
    let list: ArenaHistoryEntry[] = []
    for (let i = 0; i < LOCAL_HISTORY_MAX + 5; i++) list = pushHistory(list, entry(i * 1000))
    expect(list).toHaveLength(LOCAL_HISTORY_MAX)
    expect(list[0]!.at).toBe((LOCAL_HISTORY_MAX + 4) * 1000)
  })
})

describe('parseHistoryEntry', () => {
  it('round-trips an entry and refuses a broken one', () => {
    const e = entry(1234, { kind: 'ranked', rp: -18 })
    expect(parseHistoryEntry(JSON.parse(JSON.stringify(e)))).toEqual(e)
    expect(parseHistoryEntry({ ...e, starter: 'mewtwo' })).toBeNull()
    expect(parseHistoryEntry({ ...e, score: [1] })).toBeNull()
  })
})

describe('divisionProgress and timeLeft', () => {
  it('counts within the division, Master open-ended', () => {
    expect(divisionProgress(245)).toEqual({ done: 45, of: 100 })
    expect(divisionProgress(950)).toEqual({ done: 50, of: 0 })
  })

  it('splits what is left into days, hours and minutes, never negative', () => {
    expect(timeLeft(0, (2 * 1440 + 3 * 60 + 7) * 60_000 + 59_000)).toEqual({ days: 2, hours: 3, minutes: 7 })
    expect(timeLeft(10, 0)).toEqual({ days: 0, hours: 0, minutes: 0 })
  })
})
