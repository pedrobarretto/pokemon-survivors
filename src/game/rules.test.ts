import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { createGrid, insert, query } from '../engine/spatial'
import { effectiveness } from '../data/types'
import { ITEMS } from '../data/items'
import manifest from '../data/sprites.generated.json'
import { REGIONS, STARTER_IDS, STARTERS } from '../data/starters'
import { maxMoveLevel, moveStats } from './moves'
import { applyOffer, MAX_MOVES, MAXED_OUT, nothingToChoose, offerPool, rollOffers, starterStats } from './leveling'
import { createGame } from './game'
import { BASE_STATS } from './stats'
import type { OwnedMove } from './types'

describe('effectiveness', () => {
  it('softens the official chart', () => {
    expect(effectiveness('water', ['rock', 'ground'])).toBe(2)
    expect(effectiveness('fire', ['grass'])).toBe(1.5)
    expect(effectiveness('fire', ['water'])).toBe(0.75)
    expect(effectiveness('normal', ['ghost', 'poison'])).toBe(0.5)
  })

  it('covers the starters\' secondary types', () => {
    expect(effectiveness('steel', ['rock', 'ground'])).toBe(1.5)
    expect(effectiveness('dark', ['ghost', 'poison'])).toBe(1.5)
    expect(effectiveness('fighting', ['ghost', 'poison'])).toBe(0.5)
    expect(effectiveness('fairy', ['fighting'])).toBe(1.5)
  })

  it('lets Dragon resist the starter types and fall to Ice, Dragon and Fairy', () => {
    for (const type of ['fire', 'water', 'grass', 'electric'] as const) expect(effectiveness(type, ['dragon'])).toBe(0.75)
    expect(effectiveness('ice', ['dragon', 'ground'])).toBe(2)
    expect(effectiveness('fairy', ['dragon'])).toBe(1.5)
    expect(effectiveness('dragon', ['fairy'])).toBe(0.5)
  })
})

describe('starter roster', () => {
  it('lists every starter in exactly one region', () => {
    const listed = REGIONS.flatMap((r) => r.starters)
    expect(listed.toSorted()).toEqual(STARTER_IDS.toSorted())
  })

  it('has walk/idle/hurt sheets for every evolution stage', () => {
    const sheets: Record<string, { anims: Record<string, unknown> }> = manifest
    for (const id of STARTER_IDS)
      for (const stage of STARTERS[id].line) expect(Object.keys(sheets[stage.dex]?.anims ?? {}).sort()).toEqual(['Hurt', 'Idle', 'Walk'])
  })

  it('only grows stronger when evolving', () => {
    for (const id of STARTER_IDS) expect(starterStats(id, 2).maxHp).toBeGreaterThan(starterStats(id, 0).maxHp)
  })
})

describe('level-up offers', () => {
  it('never offers more than three distinct choices', () => {
    const offers = rollOffers({ starter: 'charmander', moves: [{ id: 'ember', level: 1, cooldown: 0 }], items: [] }, createRng(1))
    expect(offers).toHaveLength(3)
    expect(new Set(offers.map((o) => JSON.stringify(o))).size).toBe(3)
  })

  it('only offers moves from the starter learnset', () => {
    const pool = offerPool({ starter: 'squirtle', moves: [], items: [] })
    const moves = pool.flatMap(([o]) => (o.kind === 'move' ? [o.id] : []))
    expect(moves).toContain('whirlpool')
    expect(moves).not.toContain('ember')
  })

  // No two of these make a duo recipe, so nothing is left to offer.
  it('stops offering new moves when slots are full and falls back to a berry when maxed', () => {
    const full: OwnedMove[] = (['ember', 'fireSpin', 'swift', 'iceShard', 'sludgeBomb', 'gust'] as const).map((id) => ({
      id,
      level: maxMoveLevel(id),
      cooldown: 0,
    }))
    expect(full).toHaveLength(MAX_MOVES)
    const items = (Object.keys(ITEMS) as (keyof typeof ITEMS)[]).slice(0, 6).map((id) => ({ id, level: ITEMS[id].levels.length }))
    expect(rollOffers({ starter: 'charmander', moves: full, items }, createRng(2))).toEqual([{ kind: 'berry' }])
  })

  it('has nothing to choose only when every card is the berry', () => {
    expect(nothingToChoose([{ kind: 'berry' }])).toBe(true)
    expect(nothingToChoose([{ kind: 'berry' }, { kind: 'move', id: 'ember', level: 2 }])).toBe(false)
    expect(nothingToChoose([])).toBe(false)
  })
})

describe('a level-up with everything maxed', () => {
  it('adds a little damage each time, up to the cap', () => {
    const g = createGame('charmander', { w: 400, h: 240 }, 3)
    const might = g.player.stats.might
    applyOffer(g, { kind: 'berry' })
    expect(g.player.stats.might).toBeCloseTo(might + MAXED_OUT.might)
    for (let i = 0; i < MAXED_OUT.cap + 5; i++) applyOffer(g, { kind: 'berry' })
    expect(g.player.maxedLevels).toBe(MAXED_OUT.cap)
    expect(g.player.stats.might).toBeCloseTo(might + MAXED_OUT.cap * MAXED_OUT.might)
  })
})

describe('moveStats', () => {
  it('stacks upgrades and player modifiers', () => {
    const lv1 = moveStats('ember', 1, BASE_STATS)
    const lv2 = moveStats('ember', 2, { ...BASE_STATS, might: 1.5, amount: 1 })
    expect(lv1.amount).toBe(1)
    expect(lv2.amount).toBe(3) // +1 upgrade, +1 player
    expect(lv2.damage).toBe(lv1.damage * 1.5)
  })
})

describe('spatial grid', () => {
  it('finds neighbours across cell borders', () => {
    const grid = createGrid(32)
    insert(grid, 0, 31, 31)
    insert(grid, 1, 33, 33)
    insert(grid, 2, 500, 500)
    expect(query(grid, 32, 32, 8, []).sort()).toEqual([0, 1])
  })
})
