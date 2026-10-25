import { describe, expect, it } from 'vitest'
import { COOP } from '../data/coop'
import { RIFT } from '../data/rifts'
import { PLAYABLE } from '../data/hatchlings'
import { hurtPlayer } from './combat'
import { alphaDown } from './alphas'
import { awayHold, coopPayout, coopStats, playerDexLog } from './coop'
import { spawnEnemy } from './enemies'
import { createCoopGame, createGame, HITSTOP_REST, step, type CoopLoadout } from './game'
import { parseTickEntry, stepTick, type TickEntry } from './lockstep'
import { spawnMapEvent } from './mapEvents'
import { NO_RANKS } from './meta'
import { actAs, phaseOf, setPhase } from './players'
import { moveCode, TICK } from './replay'
import { openPortal } from './riftPortal'
import { restore, snapshot, stateHash } from './snapshot'
import { applyStatus } from './status'
import { updateStatuses } from './statusSystem'
import type { Game, Player } from './types'

const TEAM: CoopLoadout[] = [
  { starter: 'charmander', ranks: NO_RANKS, shiny: false, name: 'Ash' },
  { starter: 'squirtle', ranks: NO_RANKS, shiny: false, name: 'Misty' },
  { starter: 'pichu', ranks: NO_RANKS, shiny: false, name: 'Brock' },
]

/** A co-op run of `n` players past the opening draft (no screens open). */
const team = (n = 2, seed = 42) => createCoopGame(seed, TEAM.slice(0, n), { draft: false })

/** Steps `seconds`; `entries(tick)` feeds each tick. */
const run = (g: Game, seconds: number, entries: (tick: number) => TickEntry[] = () => []) => {
  for (let t = 0; t < Math.round(seconds / TICK); t++) stepTick(g, entries(t))
}

const players = (g: Game) => g.players as [Player, Player, ...Player[]]

/** Knocks the player out as if the horde did. */
const knockOut = (g: Game, p: Player) => {
  p.iframes = 0
  const before = actAs(g, p)
  hurtPlayer(g, 1e6)
  actAs(g, before)
}

/** Clears the horde so nothing interferes with a rule under test. */
const calm = (g: Game) => {
  g.enemies.length = 0
  g.nextEvent = Infinity
  g.spawnBudget = -1e9
}

describe('co-op faint and revive', () => {
  it('a fainted player waits for a teammate to stand by them, then gets up with some HP and i-frames', () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    b.x = a.x + 300
    knockOut(g, b)
    expect([b.hp, g.phase, b.record.faints]).toEqual([0, 'playing', 1])
    run(g, COOP.revive.time + 1)
    expect(b.hp).toBe(0)
    a.x = b.x
    a.y = b.y
    run(g, COOP.revive.time + 0.1)
    expect(b.hp).toBe(Math.round(b.stats.maxHp * COOP.revive.hp))
    expect(b.iframes).toBeGreaterThan(0)
    expect(a.record.revives).toBe(1)
  })

  it('ends the run only when nobody is left to play, and an away player still standing holds the world instead', () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    b.x = a.x + 300
    run(g, TICK, () => [{ slot: 1, kind: 'away' }])
    knockOut(g, a)
    expect(g.phase).toBe('playing')
    const time = g.time
    run(g, 2)
    expect(g.time).toBe(time)
    run(g, TICK, () => [{ slot: 1, kind: 'leave' }])
    expect([b.gone, g.phase]).toEqual([true, 'gameover'])
  })

  it('an away player holds the world for COOP.away.hold seconds, then counts as down and the wipe comes', () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    b.x = a.x + 300
    run(g, TICK, () => [{ slot: 1, kind: 'away' }])
    knockOut(g, a)
    const time = g.time
    run(g, COOP.away.hold - 1)
    expect([g.phase, g.time]).toEqual(['playing', time])
    expect(awayHold(g)?.slot).toBe(1)
    expect(awayHold(g)?.left).toBeCloseTo(1, 0)
    run(g, 1.1)
    expect(g.phase).toBe('gameover')
    expect(awayHold(g)).toBeNull()
  })

  it('coming back starts the away clock over, and a teammate standing never waits on it', () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    b.x = a.x + 300
    run(g, COOP.away.hold + 5, (t) => (t === 0 ? [{ slot: 1, kind: 'away' }] : []))
    expect([g.phase, awayHold(g)]).toEqual(['playing', null])
    run(g, TICK, () => [{ slot: 1, kind: 'back' }])
    run(g, TICK, () => [{ slot: 1, kind: 'away' }])
    knockOut(g, a)
    run(g, COOP.away.hold - 1)
    expect(g.phase).toBe('playing')
    expect(awayHold(g)?.slot).toBe(1)
  })

  it('a wipe ends the run in the simulation', () => {
    const g = team()
    calm(g)
    for (const p of g.players) knockOut(g, p)
    expect(g.phase).toBe('gameover')
  })

  it('away and fainted players are not hurt, and away players stop counting for the horde', () => {
    const g = team(3)
    const [, b] = players(g)
    const hp = (game: Game) => spawnEnemy(game, 'rattata', 0, 0).maxHp
    const full = hp(g)
    run(g, TICK, () => [{ slot: 1, kind: 'away' }])
    knockOut(g, b)
    expect(b.hp).toBe(b.stats.maxHp)
    expect(hp(g)).toBeLessThan(full)
    expect(hp(createGame('charmander', { ...COOP.view }, 42))).toBe(Math.round(full / (1 + 2 * COOP.scale.hp)))
  })
})

describe('co-op picks', () => {
  /** Gives each listed player a level-up and steps once so the screens open. */
  const levelUp = (g: Game, slots: number[]) => {
    for (const s of slots) g.players[s]!.pendingLevelUps = 1
    run(g, TICK)
  }

  it('holds the world while anyone picks; everyone picks at once and the timer picks for whoever does not', () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    levelUp(g, [0, 1])
    expect([g.phase, a.phase, b.phase]).toEqual(['levelup', 'levelup', 'levelup'])
    const time = g.time
    run(g, TICK, () => [{ slot: 0, kind: 'pick', screen: 'levelup', round: a.round, index: 0 }])
    expect([a.pendingLevelUps, g.phase]).toEqual([0, 'levelup'])
    run(g, COOP.pick.time)
    expect([b.pendingLevelUps, g.phase]).toEqual([0, 'playing'])
    expect(g.time).toBeLessThan(time + 1)
    expect(g.coop!.paused).toBeGreaterThan(COOP.pick.time - 1)
  })

  it('picks for an away player at once', () => {
    const g = team()
    calm(g)
    const [, b] = players(g)
    run(g, TICK, () => [{ slot: 1, kind: 'away' }])
    levelUp(g, [1])
    expect([b.pendingLevelUps, g.phase]).toEqual([0, 'playing'])
  })

  it('drops a pick that quotes an older round or another screen', () => {
    const g = team()
    calm(g)
    const [, b] = players(g)
    levelUp(g, [1])
    const round = b.round
    run(g, TICK, () => [{ slot: 1, kind: 'pick', screen: 'levelup', round: round - 1, index: 0 }])
    run(g, TICK, () => [{ slot: 1, kind: 'pick', screen: 'ability', round, index: 0 }])
    expect(b.pendingLevelUps).toBe(1)
    b.rerolls = 1
    run(g, TICK, () => [{ slot: 1, kind: 'reroll', round }])
    expect(b.round).toBeGreaterThan(round)
    run(g, TICK, () => [{ slot: 1, kind: 'pick', screen: 'levelup', round, index: 0 }])
    expect(b.pendingLevelUps).toBe(1)
  })

  it('an evolution and a personal screen play without holding the team; the timer leaves a cursed item', () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    a.evolution = { from: 4, to: 5, t: 0 }
    a.phase = 'evolving'
    b.offers = [{ kind: 'curse', id: 'lifeOrb', take: true }, { kind: 'curse', id: 'lifeOrb', take: false }]
    setPhase(g, 'curse', b)
    const time = g.time
    run(g, 1)
    expect([g.phase, phaseOf(g, a), phaseOf(g, b)]).toEqual(['playing', 'evolving', 'curse'])
    expect(g.time).toBeGreaterThan(time + 0.9)
    run(g, COOP.pick.time)
    expect([b.phase, b.curses.held]).toEqual(['playing', []])
  })

  it('an Alpha drops one prize for the team: whoever takes it opens the rare level-up for everyone', () => {
    const g = team(3)
    calm(g)
    const [a, b, c] = players(g) as [Player, Player, Player]
    b.x = a.x + 600
    c.x = a.x - 600
    alphaDown(g, spawnEnemy(g, 'rattata', a.x + 10, a.y))
    const prizes = g.pickups.filter((k) => k.kind === 'alphaPrize')
    expect(prizes.map((k) => k.owner)).toEqual([undefined])
    // Its EXP burst would open a level-up of its own first.
    g.pickups.splice(0, g.pickups.length, ...prizes)
    run(g, 1)
    expect(g.pickups.some((k) => k.kind === 'alphaPrize')).toBe(false)
    expect(g.players.map((p) => [p.phase, p.prize])).toEqual([['levelup', 'alpha'], ['levelup', 'alpha'], ['levelup', 'alpha']])
  })
})

describe('co-op locks (COOP_LOCKS)', () => {
  it('an epic rift sends the team into its old arena, not its domain (solo keeps the domain)', () => {
    const g = team()
    calm(g)
    const [a] = players(g)
    openPortal(g, 'kyogre', { x: a.x, y: a.y })
    run(g, RIFT.enterTime + 0.2)
    expect([g.rift.arena?.legend, g.rift.arena?.domain]).toEqual(['kyogre', null])
    const solo = createGame('charmander', { w: 480, h: 270 }, 42)
    openPortal(solo, 'kyogre', { x: solo.player.x, y: solo.player.y })
    for (let t = 0; t < Math.round((RIFT.enterTime + 0.2) / TICK); t++) step(solo, { move: { x: 0, y: 0 }, special: false }, TICK)
    expect(solo.rift.arena?.domain?.legend).toBe('kyogre')
  })

  it('opens no place entrance, even when one is due', () => {
    const g = team()
    calm(g)
    g.place.nextAt = 0
    run(g, 2)
    expect(g.place.entrance).toBeNull()
  })

  it("a mission's prize waits as a level-up for a player on a screen of their own", () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    b.offers = [{ kind: 'curse', id: 'lifeOrb', take: true }, { kind: 'curse', id: 'lifeOrb', take: false }]
    setPhase(g, 'curse', b)
    // Every lost Poké Ball lies under the first player: the mission is done on the next tick.
    const balls = spawnMapEvent(g, 'collect', Math.round(a.x), Math.round(a.y))
    balls.state.balls = balls.state.balls.map(() => ({ x: a.x, y: a.y, got: false }))
    stepTick(g, [])
    expect([a.phase, a.prize, b.phase, b.pendingLevelUps]).toEqual(['levelup', 'mission', 'curse', 1])
  })
})

describe('co-op endless vote', () => {
  const victory = (n: number) => {
    const g = team(n)
    calm(g)
    g.phase = 'victory'
    g.coop!.vote = { left: COOP.voteTime, votes: g.players.map(() => null), outcome: 'open' }
    return g
  }

  it('a majority goes on into the endless mode', () => {
    const g = victory(3)
    run(g, TICK, () => [{ slot: 0, kind: 'endless', vote: true }, { slot: 2, kind: 'endless', vote: true }])
    expect([g.phase, g.coop!.vote!.outcome, g.endless !== null]).toEqual(['playing', 'endless', true])
  })

  it('a tie ends the run, and so does the timer', () => {
    const tie = victory(2)
    run(tie, TICK, () => [{ slot: 0, kind: 'endless', vote: true }, { slot: 1, kind: 'endless', vote: false }])
    expect([tie.phase, tie.coop!.vote!.outcome]).toEqual(['victory', 'over'])
    const late = victory(3)
    run(late, TICK, () => [{ slot: 0, kind: 'endless', vote: true }])
    run(late, COOP.voteTime)
    expect(late.coop!.vote!.outcome).toBe('over')
  })

  it('an away player does not vote', () => {
    const g = victory(2)
    run(g, TICK, () => [{ slot: 1, kind: 'away' }, { slot: 1, kind: 'endless', vote: false }, { slot: 0, kind: 'endless', vote: true }])
    expect(g.coop!.vote!.outcome).toBe('endless')
  })
})

describe('co-op payout and stats', () => {
  it('splits the team total by everyone who started the run, rounding down, leavers included', () => {
    const g = team(3)
    g.coins = 1000
    run(g, TICK, () => [{ slot: 2, kind: 'leave' }])
    expect(g.players.map((p) => coopPayout(g, p.slot).coins)).toEqual([333, 333, 333])
  })

  it("each player's Pokédex marks only their own Pokémon caught", () => {
    const g = team()
    calm(g)
    run(g, 1)
    const own = (slot: number) => [...playerDexLog(g, slot).own.keys()]
    expect([own(0), own(1)]).toEqual([[PLAYABLE.charmander.line[0].dex], [PLAYABLE.squirtle.line[0].dex]])
  })

  it('credits a condition to whoever put it on: its DoT and its kill', () => {
    const g = team()
    calm(g)
    const [a, b] = players(g)
    const e = spawnEnemy(g, 'rattata', a.x + 200, a.y)
    e.hp = 3
    applyStatus(e.status, { kind: 'burn', chance: 1, duration: 3, power: 1 }, 10, false, 'ember', 1)
    for (let i = 0; i < 60; i++) updateStatuses(g, TICK)
    expect(b.damageByMove.ember).toBeGreaterThan(0)
    expect([a.record.kills, b.record.kills]).toEqual([0, 1])
    expect(coopStats(g).total.kills).toBe(1)
  })
})

describe('co-op entries', () => {
  it('reads only well-formed entries', () => {
    expect(parseTickEntry({ slot: 1, kind: 'move', code: 17 })).toEqual({ slot: 1, kind: 'move', code: 17 })
    for (const bad of [null, 7, 'move', [], { slot: 9, kind: 'away' }, { slot: 0, kind: 'move', code: 999 }, { slot: 0, kind: 'pick', screen: 'playing', round: 0, index: 0 }, { slot: 0, kind: 'stone', mega: 'nope' }, { slot: -1, kind: 'leave' }, { slot: 0, kind: 'endless', vote: 'yes' }, { slot: 0, kind: 'teleport' }]) {
      expect(parseTickEntry(bad)).toBeNull()
    }
  })

  it('ignores junk from a confused client without throwing or changing the run', () => {
    const junk = [{ slot: 5, kind: 'leave' }, { slot: 0, kind: 'pick', screen: 'levelup', round: 99, index: 3 }, { kind: 'move' }, { slot: 1, kind: 'banish', round: 0, index: 9 }, { slot: 0, kind: 'stone', mega: 'charizardX' }] as unknown as TickEntry[]
    const a = team(2, 9)
    const b = team(2, 9)
    run(a, 3, () => junk)
    run(b, 3)
    expect(stateHash(a)).toBe(stateHash(b))
  })
})


/** Bot entries for a scripted co-op run: sticks, specials, picks on whatever screen is up, and a player away for a while. */
const script = (g: Game) => (t: number): TickEntry[] => {
  const out: TickEntry[] = []
  for (const p of g.players) {
    if (t % 40 === p.slot * 9) out.push({ slot: p.slot, kind: 'move', code: moveCode({ x: Math.cos(t / 90 + p.slot), y: Math.sin(t / 70 + p.slot) }) })
    if (t % 150 === 30 + p.slot) out.push({ slot: p.slot, kind: 'special' })
    if (p.phase !== 'playing' && p.phase !== 'evolving' && (t + p.slot * 13) % 45 === 0) out.push({ slot: p.slot, kind: 'pick', screen: p.phase, round: p.round, index: t % Math.max(1, p.offers.length) })
  }
  if (t === 2400) out.push({ slot: 2, kind: 'away' })
  if (t === 4800) out.push({ slot: 2, kind: 'back' })
  return out
}

describe('co-op lockstep', () => {
  it('a hitstop counts down without holding the team in co-op; solo still freezes for it', () => {
    const g = team(2)
    calm(g)
    const [a] = players(g)
    const { x, time } = { x: a.x, time: g.time }
    g.hitstop = 0.07
    run(g, 0.05, () => [{ slot: 0, kind: 'move', code: moveCode({ x: 1, y: 0 }) }])
    expect(g.time).toBeCloseTo(time + 0.05)
    expect(a.x).toBeGreaterThan(x)
    expect(g.hitstop).toBeCloseTo(0.02)

    const solo = createGame('charmander', { w: 480, h: 270 }, 42)
    solo.phase = 'playing'
    const before = { x: solo.player.x, time: solo.time }
    solo.hitstop = 0.07
    for (let t = 0; t < 3; t++) step(solo, { move: { x: 1, y: 0 }, special: false }, TICK)
    expect(solo.time).toBe(before.time)
    expect(solo.player.x).toBe(before.x)
    expect(solo.hitstop).toBeCloseTo(0.07 - 3 * TICK)
  })

  it('a hitstop right after another one plays through: back-to-back impacts freeze once', () => {
    const solo = createGame('charmander', { w: 480, h: 270 }, 42)
    solo.phase = 'playing'
    const held = (seconds: number) => {
      let n = 0
      for (let t = 0; t < Math.round(seconds / TICK); t++) {
        const before = solo.time
        step(solo, { move: { x: 0, y: 0 }, special: false }, TICK)
        if (solo.time === before) n++
      }
      return n
    }
    solo.hitstop = 0.06
    expect(held(0.2)).toBe(4)
    solo.hitstop = 0.06
    expect(held(0.2)).toBe(0)
    held(HITSTOP_REST)
    solo.hitstop = 0.06
    expect(held(0.2)).toBe(4)
  })

  it('keeps two clients fed the same entries identical, bit for bit', () => {
    const a = team(3, 77)
    const b = team(3, 77)
    const feedA = script(a)
    for (let t = 0; t < 180 / TICK; t++) {
      const entries = feedA(t)
      stepTick(a, entries)
      stepTick(b, entries)
      if (t % 1800 === 0) expect(stateHash(b)).toBe(stateHash(a))
    }
    expect(a.time).toBeGreaterThan(60)
    expect(a.kills).toBeGreaterThan(50)
    expect(stateHash(b)).toBe(stateHash(a))
  }, 60_000)

  it('survives snapshot, restore and play on with the same hashes as the run that never stopped', () => {
    const a = team(3, 78)
    const feed = script(a)
    let t = 0
    for (; t < 60 / TICK; t++) stepTick(a, feed(t))
    // Mid-pick, mid-revive and away states ride along: the held sticks and the screens' rounds are in the state.
    const b = restore(snapshot(a))
    expect(stateHash(b)).toBe(stateHash(a))
    for (; t < 120 / TICK; t++) {
      const entries = feed(t)
      stepTick(a, entries)
      stepTick(b, entries)
    }
    expect(stateHash(b)).toBe(stateHash(a))
  }, 60_000)
})
