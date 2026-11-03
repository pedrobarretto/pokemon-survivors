import { describe, expect, it } from 'vitest'
import { VERSUS } from '../data/versus'
import { VALE } from '../data/versusMaps'
import { stepTick } from './lockstep'
import { actAs } from './players'
import { nearestEnemy } from './queries'
import { restore, snapshot, stateHash } from './snapshot'
import { spawnAttack } from './spawn'
import { TICK } from './tick'
import { updateAttacks } from './attacks'
import { rebuildGrid } from './enemies'
import { createVersusGame } from './versus'
import { avatarOf, pvpHit, syncAvatars } from './versusCombat'
import { patchAt, updateGrass } from './versusGrass'
import type { Game, Player } from './types'

const PATCH = VALE.grass[0]!
const middle = { x: (PATCH.x0 + PATCH.x1) / 2, y: (PATCH.y0 + PATCH.y1) / 2 }

const put = (p: Player, x: number, y: number) => {
  p.x = x
  p.y = y
}

/** A match with one Blue and one Red Pokémon played by hand (standing still), the rest on their pads. */
const duel = (seed = 3) => {
  const g = createVersusGame(seed, [], 'standard', 'vale')
  const blue = g.players.find((p) => p.versus!.team === 0)!
  const red = g.players.find((p) => p.versus!.team === 1)!
  blue.versus!.bot = false
  red.versus!.bot = false
  return { g, blue, red }
}

/** Puts the bodies where their players stand and works out the grass, as a tick does. */
const settle = (g: Game, dt = 0) => {
  syncAvatars(g)
  rebuildGrid(g)
  updateGrass(g, dt)
}

describe('tall grass', () => {
  it('hides a Pokémon from rival moves aiming, but a hitbox that reaches it still lands', () => {
    const { g, blue, red } = duel()
    put(red, middle.x, middle.y)
    put(blue, middle.x + 100, middle.y)
    settle(g)
    expect(red.versus!.hidden).toBe(true)
    const body = avatarOf(g, red)!
    const before = actAs(g, blue)
    expect(nearestEnemy(g, blue.x, blue.y, 200)).toBeNull()
    spawnAttack(g, { move: 'ember', type: 'fire', visual: 'ember', x: red.x, y: red.y - body.radius, shape: { kind: 'circle', r: 12 }, motion: { kind: 'static' }, damage: 40, ttl: 0.5 })
    actAs(g, before)
    const hp = red.hp
    updateAttacks(g, TICK)
    expect(red.hp).toBeLessThan(hp)
    // The hit shows it: now the rival's moves aim at it.
    expect(red.versus!.hidden).toBe(false)
    actAs(g, blue)
    expect(nearestEnemy(g, blue.x, blue.y, 200)?.id).toBe(body.id)
  })

  it('shows a Pokémon to a rival close by or in the same patch, and for a moment after a hit', () => {
    const { g, blue, red } = duel()
    put(red, middle.x, middle.y)
    put(blue, middle.x + VERSUS.grass.near + 30, middle.y)
    settle(g)
    expect(red.versus!.hidden).toBe(true)
    put(blue, middle.x + VERSUS.grass.near - 5, middle.y)
    settle(g)
    expect(red.versus!.hidden).toBe(false)
    // In the same patch, past the radius.
    put(red, PATCH.x0 + 1, middle.y)
    put(blue, PATCH.x1 - 1, middle.y)
    expect(PATCH.x1 - PATCH.x0 - 2).toBeGreaterThan(VERSUS.grass.near)
    settle(g)
    expect(red.versus!.hidden).toBe(false)
    put(blue, middle.x + 200, middle.y)
    settle(g)
    expect(red.versus!.hidden).toBe(true)
    const before = actAs(g, blue)
    pvpHit(g, red, 10, null)
    actAs(g, before)
    expect(red.versus!.hidden).toBe(false)
    settle(g, VERSUS.grass.reveal - 0.2)
    expect(red.versus!.hidden).toBe(false)
    settle(g, 0.3)
    expect(red.versus!.hidden).toBe(true)
  })

  it('holds its own moves while it stands in the grass, and fires again once out', () => {
    const { g, blue, red } = duel()
    const moves = blue.moves
    // A rival in the open nearby: something to shoot at.
    const target = { x: middle.x + 60, y: middle.y + 40 }
    for (const m of moves) m.cooldown = 0.05
    for (let i = 0; i < 30; i++) {
      put(blue, middle.x, middle.y)
      put(red, target.x, target.y)
      stepTick(g, [])
    }
    expect(patchAt(VALE.grass, blue.x, blue.y)).toBe(0)
    expect(moves.every((m) => m.cooldown === 0.05)).toBe(true)
    expect(g.attacks.some((a) => a.owner === blue.slot)).toBe(false)
    for (let i = 0; i < 10; i++) {
      put(blue, middle.x, PATCH.y1 + 30)
      put(red, target.x, target.y)
      stepTick(g, [])
    }
    expect(g.attacks.some((a) => a.owner === blue.slot)).toBe(true)
  })

  it('plays the same on two clients and from a snapshot with Pokémon in the grass', () => {
    const start = () => {
      const { g, blue, red } = duel(11)
      put(blue, middle.x, middle.y)
      const east = VALE.grass[VALE.grass.length / 2]!
      put(red, (east.x0 + east.x1) / 2, (east.y0 + east.y1) / 2)
      return g
    }
    const run = (g: Game, seconds: number) => {
      for (let i = 0; i < Math.round(seconds / TICK); i++) stepTick(g, [])
    }
    const a = start()
    const b = start()
    run(a, 1)
    expect(a.players.filter((p) => p.versus!.hidden)).toHaveLength(2)
    run(a, 19)
    run(b, 20)
    expect(stateHash(a)).toBe(stateHash(b))
    const c = restore(snapshot(a))
    run(a, 10)
    run(c, 10)
    expect(stateHash(c)).toBe(stateHash(a))
  })
})
