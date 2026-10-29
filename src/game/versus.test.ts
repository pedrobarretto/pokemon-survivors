import { describe, expect, it } from 'vitest'
import { VERSUS, VERSUS_FORMATS } from '../data/versus'
import { GLADE, VALE } from '../data/versusMaps'
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
      expect(mine).toHaveLength(4)
      expect(new Set(mine.map((s) => s.starter)).size).toBe(4)
    }
  })

  it('sends a human to the other team when theirs is full', () => {
    const humans = Array.from({ length: 5 }, (_, i) => ({ starter: 'charmander' as const, name: `p${i}`, team: 0 as const }))
    expect(seatMatch(1, humans)[4]!.team).toBe(1)
  })

  it('seats three a side for a 3v3, leaving out humans past both teams', () => {
    const humans = Array.from({ length: 7 }, (_, i) => ({ starter: 'charmander' as const, name: `p${i}` }))
    const seats = seatMatch(2, humans, 3)
    expect(seats).toHaveLength(6)
    expect(seats.filter((s) => s.team === 0)).toHaveLength(3)
    expect(seats.every((s) => !s.bot)).toBe(true)
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

  it('plays a 3v3 on the Clareira on its own clock: two goals a side, Drednaw at its time, the stretch for the last minute', () => {
    const g = createVersusGame(4, [{ starter: 'chikorita', name: 'me' }], 'quick')
    const s = g.versus!
    const rules = VERSUS_FORMATS.quick
    expect(g.players).toHaveLength(6)
    expect(s.map).toBe('glade')
    expect(s.goals.filter((o) => o.team === 0)).toHaveLength(2)
    expect(s.goals.every((o) => goalOpen(s, o))).toBe(true)
    expect(Math.abs(g.players[0]!.x - GLADE.spawn[0].x)).toBeLessThan(VERSUS.spawnPad.r)
    run(g, rules.drednaw.first + 0.1)
    expect(s.objective?.kind).toBe('drednaw')
    run(g, rules.length - rules.stretch - rules.drednaw.first)
    expect(s.stretch).toBe(true)
    expect(s.objective?.kind).toBe('zapdos')
  }, 30_000)

  it('has its bots carry Energy to the rival goals over a whole match, ending on the clock', () => {
    const g = createVersusGame(9, [])
    run(g, VERSUS_FORMATS.standard.length + 1)
    expect(g.phase).toBe('gameover')
    expect(g.versus!.result).not.toBeNull()
    expect(g.versus!.score[0]).toBeGreaterThan(0)
    expect(g.versus!.score[1]).toBeGreaterThan(0)
  }, 30_000)

  it('ends a 3v3 at three minutes with both teams scoring', () => {
    const g = createVersusGame(10, [], 'quick')
    run(g, VERSUS_FORMATS.quick.length - 1)
    expect(g.phase).toBe('playing')
    run(g, 2)
    expect(g.phase).toBe('gameover')
    expect(g.versus!.score[0]).toBeGreaterThan(0)
    expect(g.versus!.score[1]).toBeGreaterThan(0)
  }, 30_000)
})
