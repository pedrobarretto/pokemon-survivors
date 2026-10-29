import { describe, expect, it } from 'vitest'
import { VALE, VERSUS } from '../data/versus'
import { stepTick } from './lockstep'
import { actAs } from './players'
import { restore, snapshot, stateHash } from './snapshot'
import { TICK } from './tick'
import { createVersusGame, seatMatch } from './versus'
import { pvpHit } from './versusCombat'
import { channelTime, goalOpen, winnerOf } from './versusRules'
import type { Game } from './types'

const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / TICK); i++) stepTick(g, [])
}

describe('seatMatch', () => {
  it('keeps the humans first on the teams they asked for and fills both teams with bots playing other Pokémon', () => {
    const seats = seatMatch(7, [
      { starter: 'charmander', name: 'ash', team: 1 },
      { starter: 'squirtle', name: 'misty' },
    ])
    expect(seats.slice(0, 2)).toMatchObject([{ name: 'ash', team: 1, bot: false }, { name: 'misty', team: 0, bot: false }])
    for (const team of [0, 1]) {
      const mine = seats.filter((s) => s.team === team)
      expect(mine).toHaveLength(VERSUS.teamSize)
      expect(new Set(mine.map((s) => s.starter)).size).toBe(VERSUS.teamSize)
    }
  })

  it('sends a human to the other team when theirs is full', () => {
    const humans = Array.from({ length: VERSUS.teamSize + 1 }, (_, i) => ({ starter: 'charmander' as const, name: `p${i}`, team: 0 as const }))
    expect(seatMatch(1, humans)[VERSUS.teamSize]!.team).toBe(1)
  })
})

describe('rules', () => {
  it('channels faster with more Energy cut by teammates in the goal, and calls a tie a draw', () => {
    expect(channelTime(30, 0)).toBeGreaterThan(channelTime(5, 0))
    expect(channelTime(30, 2)).toBeLessThan(channelTime(30, 0))
    expect(winnerOf([3, 3])).toBeNull()
    expect(winnerOf([2, 9])).toBe(1)
  })
})

describe('a match', () => {
  it('plays the same on two clients and goes on the same from a snapshot', () => {
    const a = createVersusGame(42, [{ starter: 'treecko', name: 'a' }])
    const b = createVersusGame(42, [{ starter: 'treecko', name: 'a' }])
    run(a, 20)
    run(b, 20)
    expect(stateHash(a)).toBe(stateHash(b))
    const c = restore(snapshot(a))
    run(a, 10)
    run(c, 10)
    expect(stateHash(c)).toBe(stateHash(a))
  })

  it('lets a rival hurt and knock out a Pokémon, never a teammate, and brings it back on its pad', () => {
    const g = createVersusGame(3, [])
    const [blue, mate] = g.players.filter((p) => p.versus!.team === 0)
    const red = g.players.find((p) => p.versus!.team === 1)!
    red.versus!.energy = 10
    const before = actAs(g, blue!)
    expect(pvpHit(g, mate!, 50, null)).toBe(0)
    expect(pvpHit(g, red, 50, null)).toBeGreaterThan(0)
    pvpHit(g, red, red.stats.maxHp * 10, null)
    actAs(g, before)
    expect(red.hp).toBe(0)
    expect(red.versus!.energy).toBe(0)
    expect(g.versus!.orbs.reduce((sum, o) => sum + o.value, 0)).toBe(5)
    expect(blue!.versus!.kos).toBe(1)
    run(g, red.versus!.respawn + 0.1)
    expect(red.hp).toBe(red.stats.maxHp)
    expect(Math.abs(red.x - VALE.spawn[1].x)).toBeLessThan(VERSUS.spawnPad.r)
  })

  it('scores Energy carried into an open rival goal, and opens a base goal only once a lane goal of its team breaks', () => {
    const g = createVersusGame(5, [{ starter: 'mudkip', name: 'me' }])
    const me = g.players[0]!
    const s = g.versus!
    me.versus!.bot = false
    const lane = s.goals.find((o) => o.team === 1 && !o.base)!
    const base = s.goals.find((o) => o.team === 1 && o.base)!
    expect(goalOpen(s, base)).toBe(false)
    me.versus!.energy = 10
    // Held in the goal's middle, safe from anyone passing by.
    for (let i = 0; i < 120 && me.versus!.energy > 0; i++) {
      me.x = lane.x
      me.y = lane.y
      me.versus!.hurtAt = -99
      stepTick(g, [])
    }
    expect(s.score[0]).toBeGreaterThanOrEqual(10)
    expect(lane.left).toBeLessThan(lane.max)
    lane.broken = true
    expect(goalOpen(s, base)).toBe(true)
  })

  it('times a human’s longest stretch without acting, away included, and none for bots', () => {
    const g = createVersusGame(4, [{ starter: 'mudkip', name: 'me' }])
    const v = g.players[0]!.versus!
    run(g, 20)
    stepTick(g, [{ slot: 0, kind: 'move', code: 40 }])
    run(g, 5)
    expect(v.still).toBeLessThan(5.1)
    expect(v.afk).toBeGreaterThanOrEqual(20)
    stepTick(g, [{ slot: 0, kind: 'move', code: 0 }, { slot: 0, kind: 'away' }])
    run(g, 30)
    expect(v.afk).toBeGreaterThanOrEqual(30)
    expect(g.players.filter((p) => p.versus!.bot).every((p) => p.versus!.afk === 0)).toBe(true)
  })

  it('has its bots carry Energy to the rival goals over a whole match, ending on the clock', () => {
    const g = createVersusGame(9, [])
    run(g, VERSUS.length + 1)
    expect(g.phase).toBe('gameover')
    expect(g.versus!.result).not.toBeNull()
    expect(g.versus!.score[0]).toBeGreaterThan(0)
    expect(g.versus!.score[1]).toBeGreaterThan(0)
  }, 30_000)
})
