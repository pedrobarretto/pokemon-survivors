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

  it('lists a Desafio co-op run only on its day’s difficulty, started on its day', () => {
    const { difficulty } = dailyCoopChallenge(DAY)
    const other = difficulty === 'normal' ? 'hard' : 'normal'
    const challenge = (over: Record<string, unknown>, endedAt = NOON) => coopListing(report(2, { endedAt, result: result(2, { challenge: DAY, ...over }) }))
    expect(challenge({ difficulty })?.result.challenge).toBe(DAY)
    expect(challenge({ difficulty: other })).toBeNull()
    // Ended two days later: it can't have started on its day.
    expect(challenge({ difficulty }, NOON + 2 * 86_400_000)).toBeNull()
  })
})
