import { describe, expect, it } from 'vitest'
import { dailyCoopChallenge } from '../../src/game/coopBoard'
import type { DayKey } from '../../src/game/day'
import type { CoopReport } from '../../src/net/coopReport'
import { arenaSignature, verifyArenaSignature } from './arena'
import { coopListing, parseCoopReport, teamKey } from './coopBoards'

const DAY: DayKey = '2026-11-02'

/** 15:00 UTC on `DAY`: noon in Brasília. */
const NOON = Date.UTC(2026, 10, 2, 15)

const player = (slot: number) => ({ slot, starter: 'charmander', stage: 1, branch: null, shiny: false, level: 30, kills: 100 })

const result = (size: number, over: Record<string, unknown> = {}) => ({
  v: 1,
  difficulty: 'normal',
  challenge: null,
  time: 600,
  outcome: 'wipe',
  kills: 100 * size,
  players: Array.from({ length: size }, (_, slot) => player(slot)),
  ...over,
})

const users = ['u_b', 'u_a', 'u_c', 'u_d', 'u_e']

const report = (size = 2, over: Partial<CoopReport> = {}): CoopReport => ({
  v: 1,
  room: 'K7QF2',
  run: 1,
  region: 'sam',
  endedAt: NOON,
  seats: Array.from({ length: size }, (_, slot) => ({ slot, userId: users[slot]!, handle: users[slot]!.slice(2), left: false })),
  result: result(size),
  votes: size,
  ...over,
})

describe('parseCoopReport', () => {
  it('reads a report as the relay sends it, signed like the Arena’s', () => {
    const body = JSON.stringify(report())
    expect(verifyArenaSignature(body, arenaSignature(body, 's3cret'), 's3cret')).toBe(true)
    expect(parseCoopReport(JSON.parse(body))).toEqual(report())
  })

  it('refuses seats out of slot order, a bad account id, a missing field or a bad run', () => {
    const seats = report().seats
    expect(parseCoopReport({ ...report(), seats: [seats[1], seats[0]] })).toBeNull()
    expect(parseCoopReport({ ...report(), seats: [{ ...seats[0], userId: 7 }] })).toBeNull()
    expect(parseCoopReport({ ...report(), votes: undefined })).toBeNull()
    expect(parseCoopReport({ ...report(), run: -1 })).toBeNull()
    expect(parseCoopReport({ ...report(), endedAt: 'now' })).toBeNull()
  })

  it('reads what the relay saw of the run when it says, and refuses it malformed', () => {
    const seen = report(2, { startedAt: NOON - 700_000, ticks: 42_000 })
    expect(parseCoopReport(JSON.parse(JSON.stringify(seen)))).toEqual(seen)
    expect(parseCoopReport({ ...report(), ticks: -1 })).toBeNull()
    expect(parseCoopReport({ ...report(), ticks: 1.5 })).toBeNull()
    expect(parseCoopReport({ ...report(), startedAt: 'then' })).toBeNull()
    expect(parseCoopReport({ ...report(), startedAt: NOON + 1 })).toBeNull()
  })
})

describe('coopListing', () => {
  it('lists a team of accounts by its sorted ids, members by slot with who left', () => {
    const r = report(3, { seats: report(3).seats.map((s) => (s.slot === 2 ? { ...s, left: true } : s)), votes: 2 })
    const l = coopListing(r)
    expect(l).toMatchObject({ size: 3, team: 'u_a,u_b,u_c' })
    expect(l?.members.map((m) => [m.slot, m.userId, m.left])).toEqual([
      [0, 'u_b', false],
      [1, 'u_a', false],
      [2, 'u_c', true],
    ])
    expect(teamKey(['u_c', 'u_a'])).toBe(teamKey(['u_a', 'u_c']))
  })

  it('never lists a guest seat, one account twice, a lone player, a lone vote or a result that doesn’t fit', () => {
    expect(coopListing(report(2, { seats: [report().seats[0]!, { slot: 1, userId: null, handle: null, left: false }] }))).toBeNull()
    expect(coopListing(report(2, { seats: report().seats.map((s) => ({ ...s, userId: 'u_a' })) }))).toBeNull()
    expect(coopListing(report(1))).toBeNull()
    expect(coopListing(report(5))).toBeNull()
    expect(coopListing(report(2, { votes: 1 }))).toBeNull()
    expect(coopListing(report(2, { result: result(3) }))).toBeNull()
    expect(coopListing(report(2, { result: result(2, { outcome: 'victory' }) }))).toBeNull()
  })

  it('never lists a run longer than its relay played it, or levels its clock can’t reach', () => {
    // The forged run of 2026-11-17: two accounts' clients agreeing on 8 hours, 41 s after the run started.
    const forged = result(2, { time: 28_800, kills: 200_000, players: [0, 1].map((slot) => ({ ...player(slot), stage: 0, shiny: true, level: 9999, kills: 100_000 })) })
    expect(coopListing(report(2, { result: forged, startedAt: NOON - 41_000, ticks: 2460 }))).toBeNull()
    // Past the ticks sent, or the wall clock from tick 0 to the end, beyond the slack.
    expect(coopListing(report(2, { ticks: 600 * 60 }))).not.toBeNull()
    expect(coopListing(report(2, { ticks: 590 * 60 }))).toBeNull()
    expect(coopListing(report(2, { startedAt: NOON - 600_000 }))).not.toBeNull()
    expect(coopListing(report(2, { startedAt: NOON - 500_000 }))).toBeNull()
    // An older relay says neither: the result's own bounds still hold.
    expect(coopListing(report(2))).not.toBeNull()
    // At 10:00 a seat may report Lv 400 at most, far past any climb; Lv 1210 at 186 minutes is a real Dupla's.
    const level = (n: number) => coopListing(report(2, { result: result(2, { players: [player(0), { ...player(1), level: n }] }) }))
    expect(level(400)).not.toBeNull()
    expect(level(401)).toBeNull()
    expect(coopListing(report(2, { result: result(2, { time: 11_169, players: [0, 1].map((slot) => ({ ...player(slot), level: 1210 })) }) }))).not.toBeNull()
  })

  it('lists a Desafio co-op run only on its day’s difficulty, started on its day', () => {
    const { difficulty } = dailyCoopChallenge(DAY)
    const other = difficulty === 'normal' ? 'hard' : 'normal'
    const challenge = (over: Record<string, unknown>, endedAt = NOON) => coopListing(report(2, { endedAt, result: result(2, { challenge: DAY, ...over }) }))
    expect(challenge({ difficulty })?.result.challenge).toBe(DAY)
    expect(challenge({ difficulty: other })).toBeNull()
    // Ended two days later: it can't have started on its day.
    expect(challenge({ difficulty }, NOON + 2 * 86_400_000)).toBeNull()
  })

  it('lists a co-op Legend run on its own side: every seat a legend at its one stage, never a challenge', () => {
    const legends = (over: Record<string, unknown> = {}, starters = ['kyogre', 'mew']) =>
      coopListing(report(2, { result: result(2, { legend: true, players: starters.map((starter, slot) => ({ ...player(slot), starter, stage: 0 })), ...over }) }))
    expect(legends()?.result).toMatchObject({ legend: true, players: [{ starter: 'kyogre', stage: 0, branch: null }, { starter: 'mew' }] })
    // A regular seat in a Legend run, a legend in a regular run, a stage past the legend's one, a Legend challenge: none lists.
    expect(legends({}, ['kyogre', 'charmander'])).toBeNull()
    expect(coopListing(report(2, { result: result(2, { players: [player(0), { ...player(1), starter: 'mew', stage: 0 }] }) }))).toBeNull()
    expect(legends({ players: [{ ...player(0), starter: 'kyogre', stage: 1 }, { ...player(1), starter: 'mew', stage: 0 }] })).toBeNull()
    expect(legends({ challenge: DAY })).toBeNull()
    expect(legends({ legend: 'yes' })).toBeNull()
    // An older client leaves `legend` out: a regular run.
    expect(coopListing(report(2))?.result.legend).toBe(false)
  })
})
