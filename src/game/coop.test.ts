import { describe, expect, it } from 'vitest'
import { COOP } from '../data/coop'
import { createRng } from '../engine/rng'
import type { TickEntry } from '../net/protocol'
import { hurtPlayer } from './combat'
import { spawnEnemy } from './enemies'
import { createCoopGame, createGame, type PlayerSetup } from './game'
import { gainXp } from './leveling'
import { createHeld, stateSum, stepTick, SUM_EVERY } from './lockstep'
import { NO_RANKS } from './meta'
import { actAs } from './players'
import { moveCode, TICK } from './replay'

const VIEW = { w: 480, h: 300 }
const TEAM: PlayerSetup[] = [
  { starter: 'charmander', ranks: NO_RANKS, shiny: false },
  { starter: 'pichu', ranks: NO_RANKS, shiny: false },
  { starter: 'gible', ranks: NO_RANKS, shiny: false },
]

const coop = (setups = TEAM) => createCoopGame({ ...VIEW }, 42, setups, 'normal')

/** Steps `seconds` with nobody touching anything. */
const idle = (g: ReturnType<typeof coop>, seconds: number, entries: (tick: number) => TickEntry[] = () => []) => {
  const held = createHeld(g.players.length)
  for (let t = 0; t < seconds / TICK; t++) stepTick(g, held, entries(t))
}

describe('co-op lockstep', () => {
  it('keeps two clients fed the same ticks identical, picks included', () => {
    const a = coop()
    const b = coop()
    const heldA = createHeld(3)
    const heldB = createHeld(3)
    const bot = createRng(5)
    for (let t = 0; t < 90 / TICK; t++) {
      const entries: TickEntry[] = []
      for (const p of a.players) {
        if (t % 30 === p.slot * 7) {
          const angle = bot() * Math.PI * 2
          entries.push([p.slot, 'move', moveCode({ x: Math.cos(angle), y: Math.sin(angle) }), t])
        }
        if (p.offers.length > 0 && bot() < 0.05) entries.push([p.slot, 'offer', Math.floor(bot() * p.offers.length), p.round])
        if (t % 500 === 100 + p.slot) entries.push([p.slot, 'special'])
      }
      stepTick(a, heldA, entries)
      stepTick(b, heldB, entries)
      if (t % SUM_EVERY === 0) expect(stateSum(b)).toBe(stateSum(a))
    }
    expect(a.time).toBeGreaterThan(30)
    expect(stateSum(b)).toBe(stateSum(a))
  })

  it('tells runs that drifted apart', () => {
    const a = coop()
    const b = coop()
    idle(a, 5)
    idle(b, 5, (t) => (t === 10 ? [[1, 'move', 3, 0]] : []))
    expect(stateSum(b)).not.toBe(stateSum(a))
  })
})

describe('co-op rules', () => {
  it('shares every candy: the team levels up together and each player picks their own', () => {
    const g = coop()
    gainXp(g, 15)
    expect(g.players.map((p) => p.level)).toEqual([2, 2, 2])
    expect(g.players[0]!.xp).toBeCloseTo(g.players[2]!.xp)
    idle(g, TICK)
    expect(g.phase).toBe('levelup')
    expect(g.players.every((p) => p.offers.length > 0)).toBe(true)
  })

  it('waits for the whole team, then the timer picks for whoever has not', () => {
    const g = coop()
    gainXp(g, 15)
    idle(g, TICK)
    const [first] = g.players
    idle(g, TICK, () => [[0, 'offer', 0, first!.round]])
    expect(first!.pendingLevelUps).toBe(0)
    expect(g.phase).toBe('levelup')
    idle(g, COOP.pickTime + 0.1)
    expect(g.players.every((p) => p.pendingLevelUps === 0)).toBe(true)
    expect(g.phase).toBe('playing')
  })

  it('drops a pick that quotes an older round', () => {
    const g = coop()
    gainXp(g, 15)
    idle(g, TICK)
    const p = g.players[1]!
    idle(g, TICK, () => [[1, 'offer', 0, p.round - 1]])
    expect(p.pendingLevelUps).toBe(1)
  })

  it('a fainted player waits for a teammate to stand by them; the run ends when nobody stands', () => {
    const g = coop(TEAM.slice(0, 2))
    const [a, b] = g.players as [NonNullable<(typeof g.players)[0]>, NonNullable<(typeof g.players)[0]>]
    b.x = a.x + 400
    actAs(g, b, () => hurtPlayer(g, 9999))
    expect(b.down).not.toBeNull()
    expect(g.phase).toBe('playing')
    a.x = b.x
    a.y = b.y
    a.iframes = 999
    idle(g, COOP.revive.time + 0.2)
    expect(b.down).toBeNull()
    expect(b.hp).toBe(Math.round(b.stats.maxHp * COOP.revive.hp))
    a.iframes = 0
    b.iframes = 0
    actAs(g, a, () => hurtPlayer(g, 9999))
    actAs(g, b, () => hurtPlayer(g, 9999))
    expect(g.phase).toBe('gameover')
  })

  it('ends the run when the last player standing leaves', () => {
    const g = coop(TEAM.slice(0, 2))
    actAs(g, g.players[0]!, () => hurtPlayer(g, 9999))
    idle(g, TICK, () => [[1, 'leave']])
    expect(g.players[1]!.gone).toBe(true)
    expect(g.phase).toBe('gameover')
  })

  it('makes the horde tougher with every teammate', () => {
    const solo = createGame('charmander', { ...VIEW }, 42)
    const team = coop()
    const hp = (g: typeof solo) => spawnEnemy(g, 'rattata', 0, 0).maxHp
    expect(hp(team)).toBe(Math.round(hp(solo) * (1 + COOP.hp * 2)))
  })
})
