import { describe, expect, it } from 'vitest'
import { VERSUS } from '../data/versus'
import { LIMITS } from '../net/protocol'
import { arenaResult } from './arenaRank'
import { parseTickEntry, stepTick, type TickEntry } from './lockstep'
import { stateHash } from './snapshot'
import { createVersusGame } from './versus'
import { pvpHit } from './versusCombat'
import { assistsOf, fullBucket, surrenderNeed, takeToken, voteState } from './versusSocial'
import { actAs } from './players'
import type { Game } from './types'

const humans = (n: number) => Array.from({ length: n }, (_, i) => ({ starter: 'charmander' as const, name: `p${i}`, team: 0 as const }))

/** Steps `g` for `seconds` with no inputs. */
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepTick(g, [])
}

describe('takeToken', () => {
  it('lets a burst through, then one per refill', () => {
    const rule = { burst: 3, every: 2 }
    const b = fullBucket(rule)
    expect([0, 0, 0, 0].map((t) => takeToken(b, t, rule))).toEqual([true, true, true, false])
    expect(takeToken(b, 1.9, rule)).toBe(false)
    expect(takeToken(b, 2.1, rule)).toBe(true)
    expect(takeToken(b, 2.2, rule)).toBe(false)
    // A long silence refills only up to the burst.
    expect([100, 100, 100, 100].map((t) => takeToken(b, t, rule))).toEqual([true, true, true, false])
  })
})

describe('the surrender vote', () => {
  it('needs two thirds of the humans, and the one human alone decides', () => {
    expect([1, 2, 3, 4].map(surrenderNeed)).toEqual([1, 2, 2, 3])
    expect(voteState(1, 0, 1, false)).toBe('passed')
    expect(voteState(2, 1, 3, false)).toBe('passed')
    expect(voteState(2, 0, 4, false)).toBe('open')
    expect(voteState(2, 0, 4, true)).toBe('failed')
    // Two no's of four leave too few to reach three.
    expect(voteState(1, 2, 4, false)).toBe('failed')
    expect(voteState(0, 0, 0, false)).toBe('failed')
  })

  const vote = (slot: number, yes = true): TickEntry => ({ slot, kind: 'surrender', vote: yes })

  it('ends the match as a loss for the team that gave up, past half of it', () => {
    const g = createVersusGame(5, humans(1))
    g.versus!.score = [30, 10]
    stepTick(g, [vote(0)])
    expect(g.versus!.surrender[0]).toBeNull()
    g.time = VERSUS.surrender.from
    stepTick(g, [vote(0)])
    stepTick(g, [])
    expect(g.phase).toBe('gameover')
    expect(g.versus!.result).toEqual({ winner: 1, surrender: 0 })
    expect(arenaResult(g)).toMatchObject({ winner: 1, surrender: 0 })
  })

  it('fails on a no that leaves too few, then waits out the cooldown; bots never vote', () => {
    const g = createVersusGame(5, humans(2))
    g.time = VERSUS.surrender.from
    // Slot 2 is a bot of the humans' team.
    stepTick(g, [vote(2)])
    expect(g.versus!.surrender[0]).toBeNull()
    // One no of two leaves too few: the vote fails on the tick it's counted.
    stepTick(g, [vote(0), vote(1, false)])
    expect(g.versus!.surrender[0]).toBeNull()
    expect(g.versus!.surrenderAt[0]).toBeGreaterThan(g.time)
    expect(g.phase).toBe('playing')
    stepTick(g, [vote(1)])
    expect(g.versus!.surrender[0]).toBeNull()
    g.time = g.versus!.surrenderAt[0]
    stepTick(g, [vote(1), vote(0)])
    stepTick(g, [])
    expect(g.versus!.result?.surrender).toBe(0)
  })
})

describe('quick chat and pings', () => {
  it("keep a player's lines up to their bucket, the same on every client, and no bot's", () => {
    const a = createVersusGame(9, humans(2))
    const b = createVersusGame(9, humans(2))
    const say = (slot: number): TickEntry => ({ slot, kind: 'chat', msg: 'go' })
    for (const g of [a, b]) {
      stepTick(g, [say(0), say(0), say(0), say(0), say(1), say(5)])
      stepTick(g, [{ slot: 0, kind: 'ping', ping: 'danger', x: 99999 % 4096, y: -40 }])
    }
    expect(a.versus!.talk.map((l) => l.slot)).toEqual([0, 0, 0, 1])
    expect(a.versus!.pings).toHaveLength(1)
    expect(stateHash(a)).toBe(stateHash(b))
    run(a, Math.max(VERSUS.talk.keep, VERSUS.ping.keep) + 0.1)
    expect(a.versus!.talk).toHaveLength(0)
    expect(a.versus!.pings).toHaveLength(0)
  })

  it('reads entries off the wire, refusing unknown lines, kinds and far coordinates', () => {
    expect(parseTickEntry({ slot: 1, kind: 'chat', msg: 'gg' })).toEqual({ slot: 1, kind: 'chat', msg: 'gg' })
    expect(parseTickEntry({ slot: 1, kind: 'chat', msg: 'hello there' })).toBeNull()
    expect(parseTickEntry({ slot: 1, kind: 'ping', ping: 'omw', x: -300, y: 12 })).toEqual({ slot: 1, kind: 'ping', ping: 'omw', x: -300, y: 12 })
    expect(parseTickEntry({ slot: 1, kind: 'ping', ping: 'omw', x: 1.5, y: 12 })).toBeNull()
    expect(parseTickEntry({ slot: 1, kind: 'ping', ping: 'nuke', x: 0, y: 0 })).toBeNull()
    expect(parseTickEntry({ slot: 1, kind: 'ping', ping: 'omw', x: 0, y: 1e6 })).toBeNull()
    expect(parseTickEntry({ slot: 1, kind: 'surrender', vote: 'yes' })).toBeNull()
  })
})

describe('the scoreboard', () => {
  it('counts assists within the window, never for the knocker', () => {
    expect(assistsOf([-99, 10, 2.9, 9.5], 11, 8, 1)).toEqual([3])
    expect(assistsOf([10, 10], 30, 8, -1)).toEqual([])
  })

  it('credits damage, interrupts, the knockout and the assist on a rival', () => {
    const g = createVersusGame(3, [])
    const [a, b] = g.players.filter((p) => p.versus!.team === 0)
    const target = g.players.find((p) => p.versus!.team === 1)!
    target.versus!.channel = 0.2
    actAs(g, b!)
    pvpHit(g, target, 40, null)
    expect(b!.versus!.interrupts).toBe(1)
    expect(b!.versus!.dealt).toBeGreaterThan(0)
    expect(target.versus!.taken).toBe(b!.versus!.dealt)
    actAs(g, a!)
    pvpHit(g, target, 1e6, null)
    expect(a!.versus!.kos).toBe(1)
    expect(b!.versus!.assists).toBe(1)
    expect(a!.versus!.assists).toBe(0)
  })

  it('fits the busiest result the relay carries', () => {
    const g = createVersusGame(3, [])
    for (const p of g.players) {
      Object.assign(p.versus!, { kos: 99, deaths: 99, scored: 9999, assists: 99, dealt: 9_999_999, taken: 9_999_999, healed: 9_999_999, interrupts: 999 })
      p.damageByMove = { ember: 9_999_999 }
    }
    g.versus!.result = { winner: 1, surrender: 0 }
    expect(JSON.stringify(arenaResult(g, 1)).length).toBeLessThan(LIMITS.result)
  })
})
