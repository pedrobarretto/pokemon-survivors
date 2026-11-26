import { describe, expect, it } from 'vitest'
import { RIFT } from '../data/rifts'
import { hurtPlayer } from './combat'
import { chooseOffer, createGame, step } from './game'
import { enterArena, riftWin } from './riftArena'
import { collectTm } from './tms'
import type { Game, Pickup } from './types'

const DT = 1 / 60
const still = { move: { x: 0, y: 0 }, special: false }

describe('falling in a rift arena', () => {
  it('holds the world while the rift throws the player out, then lands them back alive with their Revive kept', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    const outside = g.enemies
    g.player.revives = 1
    enterArena(g, 'lugia', g.player.x, g.player.y)
    g.player.iframes = 0
    hurtPlayer(g, g.player.stats.maxHp * 100)
    expect(g.phase).toBe('playing')
    expect(g.rift.arena?.fall).toBe(RIFT.fallTime)

    const time = g.time
    for (let t = 0; t < RIFT.fallTime - DT; t += DT) step(g, still, DT)
    expect(g.time).toBe(time)
    expect(g.rift.arena).not.toBeNull()
    step(g, still, DT)

    expect(g.rift.arena).toBeNull()
    expect(g.enemies).toBe(outside)
    expect(g.player.hp).toBe(Math.round(g.player.stats.maxHp * RIFT.fallHp))
    expect(g.player.revives).toBe(1)
    expect(g.rift.cleared).toEqual([])
    expect(g.events.some((e) => e.kind === 'riftExit' && e.outcome === 'fallen')).toBe(true)
  })
})

const tmDiscs = (g: Game) => g.pickups.filter((k): k is Extract<Pickup, { kind: 'tm' }> => k.kind === 'tm')

describe('a rift won', () => {
  it('leaves Latios’s Luster Purge beside Latias’s Mist Ball when he fought beside her', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    enterArena(g, 'latias', g.player.x, g.player.y)
    riftWin(g, g.rift.arena!, g.player.x, g.player.y, 'latios')
    expect(tmDiscs(g).map((k) => [k.move, k.source])).toEqual([['mistBall', 'legendary'], ['lusterPurge', 'legendary']])
  })

  it('leaves only the legendary’s own TM when it fought alone', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    enterArena(g, 'latias', g.player.x, g.player.y)
    riftWin(g, g.rift.arena!, g.player.x, g.player.y)
    expect(tmDiscs(g).map((k) => k.move)).toEqual(['mistBall'])
  })

  it('teaches one of the pair’s TMs: the other disc turns into ₽ once one is learned', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    enterArena(g, 'latias', g.player.x, g.player.y)
    riftWin(g, g.rift.arena!, g.player.x, g.player.y, 'latios')
    const [mist, luster] = tmDiscs(g)
    collectTm(g, luster!)
    chooseOffer(g, g.player.offers.find((o) => o.kind === 'tm' && o.id === 'lusterPurge')!)
    expect(g.player.moves.some((m) => m.id === 'lusterPurge')).toBe(true)
    const coins = g.coins
    collectTm(g, mist!)
    expect(g.phase).toBe('playing')
    expect(g.coins).toBeGreaterThan(coins)
    expect(g.player.moves.some((m) => m.id === 'mistBall')).toBe(false)
    expect(g.events.some((e) => e.kind === 'tmMastered' && e.move === 'mistBall' && e.why === 'legendary')).toBe(true)
  })
})
