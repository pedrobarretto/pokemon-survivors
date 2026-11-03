import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { runLearnset } from '../game/learnsets'
import { offerPool, rollOffers } from '../game/leveling'
import { isManual, maxMoveLevel, MOVE_IDS, MOVES, moveStats, type MoveDef, type MoveId } from '../game/moves'
import { applyDeltas, BASE_STATS } from '../game/stats'
import type { OwnedItem, OwnedMove } from '../game/types'
import { EVOLUTIONS, neverEvolves, readyEvolutions } from './evolutions'
import { PLAYABLE_IDS } from './hatchlings'
import { ITEMS, type ItemDef } from './items'

const maxed = (id: MoveId): OwnedMove => ({ id, level: maxMoveLevel(id), cooldown: 0 })
const charcoal: OwnedItem = { id: 'charcoal', level: 1 }

describe('evolved move kinds', () => {
  it('keep the kind of the move they evolve from, so a Sharpness or Iron Fist build keeps its boost', () => {
    const tags = (id: MoveId) => {
      const def: MoveDef = MOVES[id]
      return def.tags ?? []
    }
    for (const e of EVOLUTIONS) for (const tag of tags(e.from)) expect(tags(e.to), `${e.from} → ${e.to}`).toContain(tag)
  })
})

describe('move evolution eligibility', () => {
  it('needs the move at max level and its paired item', () => {
    expect(readyEvolutions({ moves: [maxed('ember')], items: [] })).toEqual([])
    expect(readyEvolutions({ moves: [{ ...maxed('ember'), level: 2 }], items: [charcoal] })).toEqual([])
    expect(readyEvolutions({ moves: [maxed('ember')], items: [{ id: 'mysticWater', level: 3 }] })).toEqual([])
    expect(readyEvolutions({ moves: [maxed('ember')], items: [charcoal] }).map((e) => e.to)).toEqual(['flamethrower'])
  })

  it('lets one item evolve every move it pairs with', () => {
    const ready = readyEvolutions({ moves: [maxed('ember'), maxed('fireSpin')], items: [charcoal] })
    expect(ready.map((e) => e.to)).toEqual(['flamethrower', 'fireBlast'])
  })

  it('takes priority over random upgrades (the Poké Ball rolls a single offer)', () => {
    const loadout = { starter: 'charmander', moves: [maxed('ember')], items: [charcoal] } as const
    expect(rollOffers(loadout, createRng(3), 1)).toEqual([{ kind: 'evolution', from: 'ember', to: 'flamethrower' }])
    expect(rollOffers(loadout, createRng(3), 3)[0]).toEqual({ kind: 'evolution', from: 'ember', to: 'flamethrower' })
  })

  it('never offers the base move again once it evolved', () => {
    const pool = offerPool({ starter: 'charmander', moves: [{ id: 'flamethrower', level: 1, cooldown: 0 }], items: [] })
    const moves = pool.flatMap(([o]) => (o.kind === 'move' ? [o.id] : []))
    expect(moves).not.toContain('ember')
    expect(moves).toContain('fireSpin')
  })
})

describe('evolved moves keep growing', () => {
  const offersFor = (id: MoveId, level: number) =>
    offerPool({ starter: 'charmander', moves: [{ id, level, cooldown: 0 }], items: [] }).flatMap(([o, w]) => (o.kind === 'move' && o.id === id ? [[o.level, w]] : []))

  it('go from Lv1 to Lv5, like every evolved move', () => {
    for (const evo of EVOLUTIONS) expect(maxMoveLevel(evo.to)).toBe(5)
  })

  it('offers the next level up to the max, weighed like any owned move’s', () => {
    const upgrade = offerPool({ starter: 'charmander', moves: [{ id: 'fireSpin', level: 2, cooldown: 0 }], items: [] }).find(([o]) => o.kind === 'move' && o.id === 'fireSpin')
    expect(offersFor('flamethrower', 1)).toEqual([[2, upgrade?.[1]]])
    expect(offersFor('flamethrower', 4)).toEqual([[5, upgrade?.[1]]])
    expect(offersFor('flamethrower', 5)).toEqual([])
  })
})

describe('evolution pairs', () => {
  it('keep the move type and pair with that type’s boosting item or a generic one', () => {
    for (const evo of EVOLUTIONS) {
      const item: ItemDef = ITEMS[evo.item]
      expect(MOVES[evo.to].type).toBe(MOVES[evo.from].type)
      expect([MOVES[evo.from].type, undefined]).toContain(item.boosts)
    }
  })

  it('never let one item evolve more than two moves (Charcoal keeps its original three)', () => {
    const uses = new Map<string, number>()
    for (const evo of EVOLUTIONS) uses.set(evo.item, (uses.get(evo.item) ?? 0) + 1)
    for (const [item, n] of uses) expect([item, n <= (item === 'charcoal' ? 3 : 2)]).toEqual([item, true])
  })

  it('evolve moves some Pokémon can learn, and give every learnable move an evolution (signatures grow by forks instead)', () => {
    const learnable = new Set<MoveId>(PLAYABLE_IDS.flatMap((id) => runLearnset(id, null)))
    const from: readonly MoveId[] = EVOLUTIONS.map((e) => e.from)
    for (const id of from) expect([id, learnable.has(id)]).toEqual([id, true])
    for (const id of learnable) if (!neverEvolves(id)) expect([id, from.includes(id)]).toEqual([id, true])
    expect(new Set(from).size).toBe(from.length)
    expect(new Set(EVOLUTIONS.map((e) => e.to)).size).toBe(EVOLUTIONS.length)
  })

  it('give every base move in MOVES an evolution, signatures aside', () => {
    const to = new Set<MoveId>(EVOLUTIONS.map((e) => e.to))
    const from = new Set<MoveId>(EVOLUTIONS.map((e) => e.from))
    const bases = MOVE_IDS.filter((id) => !to.has(id) && !neverEvolves(id))
    for (const id of bases) expect([id, from.has(id)]).toEqual([id, true])
    for (const id of MOVE_IDS.filter(neverEvolves)) expect([id, from.has(id)]).toEqual([id, false])
  })

  it('keep a manual move manual when it evolves (one manual move per loadout)', () => {
    for (const evo of EVOLUTIONS) expect([evo.to, isManual(evo.to)]).toEqual([evo.to, isManual(evo.from)])
  })

  it('pair a generic item too: Pyro Ball and Muscle Band make Searing Shot', () => {
    const ready = readyEvolutions({ moves: [maxed('pyroBall')], items: [{ id: 'muscleBand', level: 1 }] })
    expect(ready.map((e) => e.to)).toEqual(['searingShot'])
  })
})

describe('type-boosting items', () => {
  it('boost only moves of their type', () => {
    const stats = applyDeltas(BASE_STATS, ITEMS.charcoal.levels)
    expect(moveStats('ember', 1, stats).damage).toBeCloseTo(moveStats('ember', 1, BASE_STATS).damage * 1.3)
    expect(moveStats('swift', 1, stats).damage).toBe(moveStats('swift', 1, BASE_STATS).damage)
  })

  it('are only offered when the starter learns moves of that type', () => {
    const items = offerPool({ starter: 'squirtle', moves: [], items: [] }).flatMap(([o]) => (o.kind === 'item' ? [o.id] : []))
    expect(items).toContain('mysticWater')
    expect(items).toContain('metalCoat')
    expect(items).not.toContain('charcoal')
  })

  it('include the newer type items for learnsets of their type', () => {
    const items = offerPool({ starter: 'gastly', moves: [], items: [] }).flatMap(([o]) => (o.kind === 'item' ? [o.id] : []))
    expect(items).toContain('spellTag')
    expect(items).not.toContain('metalCoat')
  })
})
