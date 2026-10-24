import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { banishOffer, createGame } from './game'
import { DUO_RECIPES, fusable, isDuo, readyDuos } from './duoRules'
import { applyOffer, loadout, offerPool, rollOffers } from './leveling'
import { maxMoveLevel, MOVE_IDS, MOVES, type MoveId } from './moves'
import { setPhase } from './players'
import type { OwnedMove } from './types'

const maxed = (id: MoveId): OwnedMove => ({ id, level: maxMoveLevel(id), cooldown: 0 })
const at = (id: MoveId, level: number): OwnedMove => ({ id, level, cooldown: 0 })

describe('duo recipes', () => {
  it('fuse a max-level move of each type', () => {
    expect(readyDuos([maxed('ember'), maxed('razorLeaf')])).toEqual([{ from: ['ember', 'razorLeaf'], to: 'firePledge' }])
    expect(readyDuos([at('ember', 7), maxed('razorLeaf')])).toEqual([])
    expect(readyDuos([maxed('ember'), maxed('swift')])).toEqual([])
  })

  it('never spend the move kept back (a legend’s own legendary move)', () => {
    expect(readyDuos([maxed('sacredFire'), maxed('razorLeaf')], 'sacredFire')).toEqual([])
    expect(readyDuos([maxed('sacredFire'), maxed('ember'), maxed('razorLeaf')], 'sacredFire').map((d) => d.from)).toEqual([['ember', 'razorLeaf']])
  })

  it('take an evolved move at any level', () => {
    expect(fusable(at('flamethrower', 1))).toBe(true)
    expect(readyDuos([at('flamethrower', 1), maxed('vineWhip')]).map((d) => d.from)).toEqual([['flamethrower', 'vineWhip']])
  })

  it('spend the weaker move of a type, keeping the stronger one', () => {
    const [duo] = readyDuos([at('flamethrower', 5), maxed('ember'), maxed('razorLeaf')])
    expect(duo?.from).toEqual(['ember', 'razorLeaf'])
  })

  it('list every recipe the loadout makes, in recipe order', () => {
    const duos = readyDuos([maxed('ember'), maxed('razorLeaf'), maxed('waterGun')])
    expect(duos.map((d) => d.to)).toEqual(['firePledge', 'waterPledge', 'grassPledge'])
  })

  it('make Fusion Flare when the Fire move is the stronger, Fusion Bolt otherwise', () => {
    expect(readyDuos([at('flamethrower', 5), maxed('shockWave')]).map((d) => d.to)).toEqual(['fusionFlare'])
    expect(readyDuos([maxed('ember'), at('wildboltStorm', 5)]).map((d) => d.to)).toEqual(['fusionBolt'])
  })

  it('stop once the loadout holds a duo move: one per run', () => {
    expect(readyDuos([at('firePledge', 1), maxed('ember'), maxed('waterGun')])).toEqual([])
  })

  it('name only duo moves, each made by one recipe', () => {
    const made = DUO_RECIPES.flatMap((r) => ('alt' in r ? [r.to, r.alt] : [r.to]))
    expect(new Set(made).size).toBe(made.length)
    expect(MOVE_IDS.filter(isDuo).sort()).toEqual([...made].sort())
    for (const id of made) expect([id, maxMoveLevel(id)]).toEqual([id, 5])
    for (const r of DUO_RECIPES) expect(MOVES[r.to].type).toBe(r.types[0])
  })
})

describe('duo offers', () => {
  const lv = { starter: 'charmander', items: [] } as const

  it('come right after evolutions, and the Poké Ball never fuses on its own', () => {
    const moves = [maxed('ember'), maxed('razorLeaf')]
    expect(rollOffers({ ...lv, moves }, createRng(1), 3)[0]).toEqual({ kind: 'duo', from: ['ember', 'razorLeaf'], to: 'firePledge' })
    const ember = rollOffers({ ...lv, moves, items: [{ id: 'charcoal', level: 1 }] }, createRng(1), 3)
    expect(ember.slice(0, 2).map((o) => o.kind)).toEqual(['evolution', 'duo'])
    expect(rollOffers({ ...lv, moves }, createRng(1), 1, { duos: false })[0]?.kind).not.toBe('duo')
  })

  it('fuse into the first slot, free the second and never offer either again', () => {
    const g = createGame('charmander', { w: 400, h: 240 }, 5)
    g.player.moves = [maxed('ember'), at('fireSpin', 3), maxed('razorLeaf')]
    applyOffer(g, { kind: 'duo', from: ['ember', 'razorLeaf'], to: 'firePledge' })
    expect(g.player.moves.map((m) => `${m.id}:${m.level}`)).toEqual(['firePledge:1', 'fireSpin:3'])
    const offered = offerPool(loadout(g)).flatMap(([o]) => (o.kind === 'move' ? [o.id] : []))
    expect(offered).not.toContain('ember')
    expect(offered).not.toContain('razorLeaf')
    expect(offered).toContain('firePledge')
    expect(g.events.some((e) => e.kind === 'duoFused')).toBe(true)
  })

  it('banish the base move of an evolved ingredient too', () => {
    const g = createGame('charmander', { w: 400, h: 240 }, 5)
    g.player.moves = [at('flamethrower', 2), maxed('vineWhip')]
    applyOffer(g, { kind: 'duo', from: ['flamethrower', 'vineWhip'], to: 'firePledge' })
    expect([...g.player.banished].sort()).toEqual(['ember', 'flamethrower', 'vineWhip'])
  })

  it('can be forgotten: the card is drawn again and the recipe, either outcome, never comes back', () => {
    const g = createGame('charmander', { w: 400, h: 240 }, 5)
    g.player.moves = [at('flamethrower', 5), maxed('shockWave')]
    setPhase(g, 'levelup')
    g.player.banishes = 1
    g.player.offers = rollOffers(loadout(g), g.rng, 3)
    expect(g.player.offers[0]).toMatchObject({ kind: 'duo', to: 'fusionFlare' })
    banishOffer(g, 0)
    expect(g.player.banishes).toBe(0)
    expect(g.player.offers.some((o) => o.kind === 'duo')).toBe(false)
    g.player.moves = [maxed('ember'), at('wildboltStorm', 5)]
    expect(readyDuos(g.player.moves, null, g.player.banished)).toEqual([])
    expect(readyDuos([maxed('ember'), maxed('razorLeaf')], null, g.player.banished).map((d) => d.to)).toEqual(['firePledge'])
  })
})
