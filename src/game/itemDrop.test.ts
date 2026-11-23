import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { ITEMS, type ItemId } from '../data/items'
import { chooseOffer, step } from './game'
import { DROP_REST, dropItem, needsSwap, swapItems } from './itemDrop'
import { loadout, MAX_ITEMS, offerPool, recomputeStats, rollOffers } from './leveling'
import { maxMoveLevel } from './moves'
import { runLearnset } from './learnsets'
import { NO_RANKS } from './meta'
import { parseReplay, recordEvent, recordStep, resimulate, startGame, startRecording, TICK, type ReplayStart } from './replay'
import type { Game, OwnedItem } from './types'

const START: ReplayStart = { seed: 11, starter: 'charmander', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

/** Six held items, none of them Charcoal (Ember's pair). */
const SIX: readonly ItemId[] = ['muscleBand', 'quickClaw', 'wideLens', 'lightClay', 'leftovers', 'choiceScarf']
const held = (ids: readonly ItemId[]): OwnedItem[] => ids.map((id) => ({ id, level: 2 }))

/** A fresh run past its opening draft, playing, holding `items`. */
const staged = (items: readonly ItemId[]) => {
  const g = startGame(START)
  Object.assign(g, { phase: 'playing' })
  Object.assign(g.player, { phase: 'playing', pendingLevelUps: 0, offers: [], items: held(items) })
  recomputeStats(g)
  return g
}

describe('Largar item', () => {
  it('frees the slot, drops its stats and keeps the item out of the offers for a while', () => {
    const g = staged(SIX)
    const might = g.player.stats.might
    dropItem(g, 0)
    expect(g.player.items.map((i) => i.id)).toEqual(SIX.slice(1))
    expect(g.player.stats.might).toBeLessThan(might)
    const offered = (game: Game) => offerPool(loadout(game)).some(([o]) => o.kind === 'item' && o.id === 'muscleBand')
    expect(offered(g)).toBe(false)
    g.player.level += DROP_REST
    expect(offered(g)).toBe(true)
  })

  it('ignores an index with no item', () => {
    const g = staged(SIX)
    dropItem(g, MAX_ITEMS)
    expect(g.player.items).toHaveLength(MAX_ITEMS)
  })

  it("offers a full build a maxed move's missing pair item as a swap, and a berry beside swap cards alone", () => {
    const ember = { id: 'ember', level: maxMoveLevel('ember'), cooldown: 0 } as const
    expect(swapItems([ember], held(SIX))).toEqual(['charcoal'])
    expect(swapItems([{ ...ember, level: 2 }], held(SIX))).toEqual([])
    expect(swapItems([ember], held(SIX.slice(1)))).toEqual([])
    // Every item maxed and no new move to learn: the swap is the only card, so the berry joins it.
    const maxed = SIX.map((id) => ({ id, level: ITEMS[id].levels.length }))
    const banished = new Set(runLearnset('charmander', null))
    const offers = rollOffers({ starter: 'charmander', moves: [ember], items: maxed, banished }, createRng(1))
    expect(offers).toHaveLength(2)
    expect(offers.some((o) => needsSwap({ items: maxed }, o))).toBe(true)
    expect(offers.some((o) => o.kind === 'berry')).toBe(true)
  })

  it('never adds an item past the slots: a swap card drops one first', () => {
    const g = staged(SIX)
    Object.assign(g.player, { phase: 'levelup', pendingLevelUps: 1, offers: [{ kind: 'item', id: 'charcoal', level: 1 }] })
    Object.assign(g, { phase: 'levelup' })
    chooseOffer(g, g.player.offers[0]!)
    expect(g.player.items.some((i) => i.id === 'charcoal')).toBe(false)
  })

  it('re-simulates a recorded drop and the swap pick after it', () => {
    const view = { ...START.view }
    const g = staged(SIX)
    const rec = startRecording(START)
    for (let i = 0; i < 30; i++) step(g, { move: recordStep(rec, view, { x: 1, y: 0 }), special: false }, TICK)
    recordEvent(rec, ['drop', 2])
    dropItem(g, 2)
    for (let i = 0; i < 30; i++) step(g, { move: recordStep(rec, view, { x: 0, y: 1 }), special: false }, TICK)
    const again = staged(SIX)
    const end = resimulate(parseReplay(JSON.parse(JSON.stringify(rec.replay)))!, again)
    expect(end.time).toBe(g.time)
    expect(again.player.items.map((i) => i.id)).toEqual(g.player.items.map((i) => i.id))
    expect(again.player.dropped).toEqual([{ id: 'wideLens', until: g.player.level + DROP_REST }])
  })
})
