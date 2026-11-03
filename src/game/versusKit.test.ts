import { describe, expect, it } from 'vitest'
import { TAU } from '../engine/math'
import { VERSUS_FORMATS, VERSUS_KIT } from '../data/versus'
import { parseTickEntry, stepTick, type TickEntry } from './lockstep'
import { TICK } from './tick'
import { actAs } from './players'
import { nearestEnemy } from './queries'
import { createVersusGame } from './versus'
import { AIM_DIRS, aimCast, aimCode, aimVec, autoTarget, rankTarget, reachCode } from './versusKit'
import type { Game, Player } from './types'

describe('aim encoding', () => {
  it('round-trips every direction code and lands within half a step of any direction', () => {
    for (let k = 0; k < AIM_DIRS; k++) {
      const d = aimVec(k)
      expect(aimCode(d.x, d.y)).toBe(k)
    }
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * TAU
      const back = aimVec(aimCode(Math.cos(a), Math.sin(a)))
      const off = Math.acos(Math.min(1, back.x * Math.cos(a) + back.y * Math.sin(a)))
      expect(off).toBeLessThanOrEqual(TAU / AIM_DIRS / 2 + 1e-9)
    }
    expect(aimCode(0, 0)).toBe(0)
    expect(reachCode(-4)).toBe(0)
    expect(reachCode(999)).toBe(255)
  })
})

describe('target priority', () => {
  const far = { x: 100, y: 0, hp: 10, maxHp: 100 }
  const near = { x: 10, y: 0, hp: 80, maxHp: 100 }
  const tank = { x: 50, y: 0, hp: 60, maxHp: 400 }

  it('picks the closest, the lowest HP share or the lowest HP', () => {
    expect(rankTarget([far, near, tank], 0, 0, 'closest')).toBe(near)
    expect(rankTarget([far, near, tank], 0, 0, 'lowestShare')).toBe(far)
    expect(rankTarget([near, tank], 0, 0, 'lowestShare')).toBe(tank)
    expect(rankTarget([near, tank], 0, 0, 'lowest')).toBe(tank)
    expect(rankTarget([], 0, 0, 'closest')).toBeNull()
  })

  it('breaks a tie with the closer one', () => {
    const twin = { ...far, x: 30 }
    expect(rankTarget([far, twin], 0, 0, 'lowest')).toBe(twin)
  })
})

describe('kit entries', () => {
  it('reads casts, locks and priorities, and refuses anything out of range', () => {
    expect(parseTickEntry({ slot: 0, kind: 'cast', skill: 2, dir: 127, reach: 255, target: -1 }, 8)).toEqual({ slot: 0, kind: 'cast', skill: 2, dir: 127, reach: 255, target: -1 })
    expect(parseTickEntry({ slot: 1, kind: 'cast', skill: 0, dir: 3, reach: 40, target: 812 }, 8)).not.toBeNull()
    for (const bad of [{ skill: 3 }, { dir: 128 }, { dir: 1.5 }, { reach: 256 }, { target: -2 }, { target: '4' }]) {
      expect(parseTickEntry({ slot: 0, kind: 'cast', skill: 0, dir: 0, reach: 0, target: -1, ...bad }, 8)).toBeNull()
    }
    expect(parseTickEntry({ slot: 0, kind: 'lock', target: -1 }, 8)).toEqual({ slot: 0, kind: 'lock', target: -1 })
    expect(parseTickEntry({ slot: 0, kind: 'lock', target: 0.5 }, 8)).toBeNull()
    expect(parseTickEntry({ slot: 0, kind: 'prio', prio: 2 }, 8)).toEqual({ slot: 0, kind: 'prio', prio: 2 })
    expect(parseTickEntry({ slot: 0, kind: 'prio', prio: 3 }, 8)).toBeNull()
    // Every kit entry is held to the match's seats: slot 7 is a 4v4's, not a 3v3's six.
    for (const kind of ['cast', 'lock', 'prio'] as const) {
      const raw = { slot: 7, kind, skill: 0, dir: 0, reach: 0, target: -1, prio: 0 }
      expect(parseTickEntry(raw, 8)).not.toBeNull()
      expect(parseTickEntry(raw, 6)).toBeNull()
    }
  })
})

/** A match with one human (slot 0) standing alone on an empty map, a rival's body 60 px east of them. */
const duel = () => {
  const g = createVersusGame(11, [{ starter: 'charmander', name: 'me' }])
  const me = g.players[0]!
  const rival = g.players.find((p) => p.versus!.team === 1)!
  for (const p of g.players) if (p !== me && p !== rival) p.gone = true
  rival.versus!.bot = false
  me.x = rival.x - 60
  me.y = rival.y
  g.enemies = g.enemies.filter((e) => e.behavior.kind === 'avatar' && (e.behavior.slot === me.slot || e.behavior.slot === rival.slot))
  // The draft's card: Move 1.
  g.phase = 'playing'
  me.phase = 'playing'
  me.offers = []
  me.pendingLevelUps = 0
  me.moves.push({ id: 'ember', level: 1, cooldown: 0, path: 0 })
  return { g, me, rival }
}

/** Steps `g` for `seconds` with no inputs. */
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / TICK); i++) stepTick(g, [])
}

const bodyOf = (g: Game, p: Player) => g.enemies.find((e) => e.id === p.versus!.avatar)!

describe('the kit in a match', () => {
  it('casts Move 1 only on a cast entry, once recharged, and turns to the aim', () => {
    const { g, me, rival } = duel()
    const move1 = me.moves[1]!
    stepTick(g, [])
    expect(move1.cooldown).toBe(0)
    const body = bodyOf(g, rival)
    stepTick(g, [{ slot: 0, kind: 'cast', skill: 0, dir: aimCode(0, 1), reach: 100, target: body.id }])
    expect(move1.cooldown).toBeGreaterThan(0)
    // Aimed at the target wherever the direction said: east.
    expect(me.facing.x).toBeGreaterThan(0.99)
    const after = move1.cooldown
    stepTick(g, [{ slot: 0, kind: 'cast', skill: 0, dir: 0, reach: 100, target: -1 }])
    expect(move1.cooldown).toBeLessThan(after)
  })

  it('holds a lasting move (Flame Wheel’s trail, Whirlpool’s aura) a while past each cast, never for good', () => {
    for (const id of ['flameWheel', 'whirlpool'] as const) {
      const { g, me } = duel()
      me.moves[1] = { id, level: 1, cooldown: 0, path: 0 }
      const cast: TickEntry = { slot: 0, kind: 'cast', skill: 0, dir: 0, reach: 100, target: -1 }
      const lasting = () => g.attacks.filter((a) => a.owner === me.slot && a.move === id && a.lasting)
      stepTick(g, [cast])
      expect(lasting()).toHaveLength(1)
      // Cast again within the hold: it goes on, from the new cast.
      run(g, VERSUS_KIT.persist - 1)
      stepTick(g, [cast])
      run(g, VERSUS_KIT.persist - 0.5)
      expect(lasting()).toHaveLength(1)
      // No cast: it ends.
      run(g, 1)
      expect(g.attacks.some((a) => a.owner === me.slot && a.move === id && a.ttl === Infinity)).toBe(false)
      expect(lasting()).toHaveLength(0)
    }
  })

  it('aims the basic attack at the lock, else by priority, and a cast at its target or nobody', () => {
    const { g, me, rival } = duel()
    const body = bodyOf(g, rival)
    expect(autoTarget(g, me)?.id).toBe(body.id)
    me.versus!.lock = 999_999
    expect(autoTarget(g, me)?.id).toBe(body.id)
    const before = actAs(g, me)
    me.versus!.focus = aimCast(g, me, { skill: 0, dir: aimCode(-1, 0), reach: 80, target: -1 })
    expect(nearestEnemy(g, me.x, me.y, 300)).toBeNull()
    expect(me.facing.x).toBeLessThan(-0.99)
    me.versus!.focus = aimCast(g, me, { skill: 0, dir: aimCode(-1, 0), reach: 80, target: body.id })
    expect(nearestEnemy(g, me.x, me.y, 300)?.id).toBe(body.id)
    // Out of the move's own reach: nobody, so it flies along the aim.
    expect(nearestEnemy(g, me.x, me.y, 30)).toBeNull()
    me.versus!.focus = null
    actAs(g, before)
  })

  it('learns Move 2 at its level and lets the first evolution upgrade Move 1 in place', () => {
    const { g, me } = duel()
    const before = actAs(g, me)
    me.level = VERSUS_KIT.secondMove
    me.pendingLevelUps = 1
    stepTick(g, [])
    expect(me.phase).toBe('levelup')
    expect(me.versus!.learn).toBe(2)
    stepTick(g, [{ slot: 0, kind: 'pick', screen: 'levelup', round: me.round, index: 0 }])
    expect(me.moves).toHaveLength(VERSUS_KIT.moves)
    // A level-up into the evolution's level, picked, evolves it.
    me.level = VERSUS_FORMATS.standard.evolveAt[0]
    me.pendingLevelUps = 1
    stepTick(g, [])
    stepTick(g, [{ slot: 0, kind: 'pick', screen: 'levelup', round: me.round, index: 0 }])
    me.moves[1]!.level = 5
    me.moves[1]!.path = 4
    for (let i = 0; i < 120 && me.stage === 0; i++) stepTick(g, [])
    expect(me.stage).toBe(1)
    // The Ability first, then the upgrade.
    for (let i = 0; i < 4 && me.phase === 'ability'; i++) stepTick(g, [{ slot: 0, kind: 'pick', screen: 'ability', round: me.round, index: 0 }])
    expect(me.versus!.learn).toBe(1)
    const offer = me.offers[0]!
    stepTick(g, [{ slot: 0, kind: 'pick', screen: 'levelup', round: me.round, index: 0 }])
    expect(offer.kind === 'move' && me.moves[1]!.id === offer.id).toBe(true)
    expect(me.moves[1]).toMatchObject({ level: 5, path: 4 })
    expect(me.moves).toHaveLength(VERSUS_KIT.moves)
    actAs(g, before)
  })
})
