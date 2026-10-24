import { describe, expect, it } from 'vitest'
import { hurtPlayer } from './combat'
import { spawnEnemy } from './enemies'
import { chooseOffer, step } from './game'
import { NO_RANKS } from './meta'
import { MOVES, moveStats, withBranch, type MoveDef } from './moves'
import { startGame, TICK, type ReplayStart } from './replay'
import { PAY_DAY, SHOP_TM_MOVES } from './shopTmMoves'
import { spawnAttack } from './spawn'
import { BASE_STATS } from './stats'
import { tutorMoves } from './tmRules'
import type { Game } from './types'
import { neverEvolves } from '../data/evolutions'

const START: ReplayStart = { seed: 3, starter: 'squirtle', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

const run = (): Game => {
  const g = startGame(START)
  chooseOffer(g, g.player.offers[0]!)
  return g
}

/** A hitbox of `move` with Pay Day's coin luck in `memo`, as its cast spawns it. */
const coin = (g: Game, luck: number) => spawnAttack(g, { move: 'payDay', type: 'normal', visual: 'payDay', x: 0, y: 0, shape: { kind: 'circle', r: 4 }, motion: { kind: 'static' }, damage: 1, ttl: 1, memo: luck })

describe('the shop-exclusive TMs', () => {
  it('never evolve, fork at Lv 4 and 7, and no tutor teaches them', () => {
    for (const id of Object.keys(SHOP_TM_MOVES) as (keyof typeof SHOP_TM_MOVES)[]) {
      expect(neverEvolves(id)).toBe(true)
      expect(MOVES[id].upgrades).toHaveLength(7)
      expect(tutorMoves()).not.toContain(id)
    }
  })

  it('Pay Day knocks ₽10 coins loose, up to its cap a run', () => {
    const g = run()
    const def: MoveDef = MOVES.payDay
    const e = spawnEnemy(g, 'rattata', 30, 0)
    const sure = coin(g, 1)
    def.onHit!(g, sure, e)
    expect(g.pickups.filter((k) => k.kind === 'coin')).toEqual([expect.objectContaining({ value: PAY_DAY.coin })])
    g.player.tm.coins = PAY_DAY.cap
    def.onHit!(g, sure, e)
    expect(g.pickups.filter((k) => k.kind === 'coin')).toHaveLength(1)
    // Its coin luck is the base chance plus the cast's status chance (the forks raise it).
    expect(moveStats('payDay', 4, BASE_STATS, 0).statusChance).toBeCloseTo(0.03)
  })

  it('Thief steals once from each Alpha or boss, never from the horde', () => {
    const g = run()
    const def: MoveDef = MOVES.thief
    const hit = spawnAttack(g, { move: 'thief', type: 'dark', visual: 'thief', x: 0, y: 0, shape: { kind: 'circle', r: 4 }, motion: { kind: 'static' }, damage: 1, ttl: 1 })
    const grunt = spawnEnemy(g, 'rattata', 30, 0)
    for (let i = 0; i < 40; i++) def.onHit!(g, hit, grunt)
    expect(g.pickups).toHaveLength(0)
    const boss = spawnEnemy(g, 'onix', 60, 0)
    for (let i = 0; i < 40; i++) def.onHit!(g, hit, boss)
    expect(g.pickups.filter((k) => k.kind === 'consumable')).toHaveLength(1)
    expect(g.pickups.filter((k) => k.kind === 'coin')).toHaveLength(1)
    expect(g.player.tm.stolen.has(boss.id)).toBe(true)
  })

  it('Protect lets no hit through while its bubble lasts', () => {
    const g = run()
    g.player.moves = [{ id: 'protect', level: 1, cooldown: 0, path: 0 }]
    step(g, { move: { x: 0, y: 0 }, special: false }, TICK)
    const hp = g.player.hp
    for (let i = 0; i < 3; i++) {
      g.player.iframes = 0
      hurtPlayer(g, 10)
    }
    expect(g.player.hp).toBe(hp)
    for (let i = 0; i < 90; i++) step(g, { move: { x: 0, y: 0 }, special: false }, TICK)
    g.player.iframes = 0
    g.player.guard = null
    hurtPlayer(g, 10)
    expect(g.player.hp).toBeLessThan(hp)
  })

  it('Protect holds to the newest bubble when its echo overlaps the first', () => {
    const g = run()
    // Lv 4 with the echo fork: a second bubble 0.3 s after the first, outlasting it.
    g.player.moves = [{ id: 'protect', level: 4, cooldown: 0, path: withBranch(0, 4, 1) }]
    const idle = { move: { x: 0, y: 0 }, special: false }
    const bubbles = () => g.attacks.filter((a) => a.move === 'protect' && a.visual === 'protect' && a.age < a.ttl)
    while (bubbles().length < 2) step(g, idle, TICK)
    const hp = g.player.hp
    // A guarded hit while both stand: the guard must follow the later bubble.
    g.player.iframes = 0
    hurtPlayer(g, 10)
    while (bubbles().length > 1) step(g, idle, TICK)
    expect(bubbles()).toHaveLength(1)
    g.player.iframes = 0
    hurtPlayer(g, 10)
    expect(g.player.hp).toBe(hp)
  })

  it('Hyper Beam charges, then holds the player still through the recharge', () => {
    const g = run()
    g.player.moves = [{ id: 'hyperBeam', level: 1, cooldown: 0, path: 0 }]
    spawnEnemy(g, 'rattata', 80, 0)
    step(g, { move: { x: 0, y: 0 }, special: false }, TICK)
    expect(g.attacks.some((a) => a.visual === 'hyperBeam' && a.age < 0)).toBe(true)
    expect(g.player.rooted).toBeGreaterThan(0.5)
  })
})
