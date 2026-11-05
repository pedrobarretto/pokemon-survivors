import { describe, expect, it } from 'vitest'
import { chooseOffer, createGame } from './game'
import { dropXp, LOOT, MAX_XP_PICKUPS, pokeballAsks, updatePickups } from './pickups'
import type { Game } from './types'
import * as dm from '../engine/dmath'
import { setPhase } from './players'
import { CONSUMABLES } from './consumables'

const DT = 1 / 60

describe('magnet', () => {
  it('reels in a candy flying sideways past the player instead of letting it orbit', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    g.pickups.length = 0
    dropXp(g, g.player.x + 25, g.player.y - 6, 1)
    const candy = g.pickups[0]!
    candy.attracted = true
    candy.vx = 0
    candy.vy = 400
    for (let i = 0; i < 60 && g.pickups.length; i++) updatePickups(g, DT)
    expect(g.pickups).toHaveLength(0)
  })

  it('catches the player while they run in circles', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    g.pickups.length = 0
    g.player.stats.magnet = 80
    const cx = g.player.x
    const cy = g.player.y
    dropXp(g, cx + 140, cy, 1)
    for (let i = 0; i < 180 && g.pickups.length; i++) {
      const a = i * DT * 3
      g.player.x = cx + dm.cos(a) * 60
      g.player.y = cy + dm.sin(a) * 60
      updatePickups(g, DT)
    }
    expect(g.pickups).toHaveLength(0)
  })
})

const candies = (g: Game) => g.pickups.flatMap((k) => (k.kind === 'xp' ? [k] : []))

describe('Exp. Candy cap', () => {
  const full = () => {
    const g = createGame('honedge', { w: 480, h: 270 }, 1)
    g.pickups.length = 0
    for (let i = 0; i < MAX_XP_PICKUPS; i++) dropXp(g, -500, -500, 2)
    return g
  }

  it('still drops the candy where the foe fainted, folding the oldest one into it', () => {
    const g = full()
    const oldest = candies(g)[0]
    dropXp(g, 40, 60, 5)
    const after = candies(g)
    expect(after).toHaveLength(MAX_XP_PICKUPS)
    expect(after).not.toContain(oldest)
    expect(after.at(-1)).toMatchObject({ x: 40, y: 60, value: 7 })
    expect(after.reduce((sum, k) => sum + k.value, 0)).toBe(MAX_XP_PICKUPS * 2 + 5)
  })

  it('leaves a candy already flying to the player alone', () => {
    const g = full()
    const [flying] = candies(g)
    flying!.attracted = true
    dropXp(g, 40, 60, 5)
    expect(candies(g)).toContain(flying)
    expect(candies(g)).toHaveLength(MAX_XP_PICKUPS)
  })
})

describe('loot left behind', () => {
  it('goes once it lay out of sight past its age, but not on screen, not young and not a one-of-a-kind find', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    g.pickups.length = 0
    const far = { x: g.player.x + 2000, y: g.player.y, vx: 0, vy: 0, attracted: false, age: LOOT.maxAge } as const
    g.pickups.push(
      { ...far, id: 1, kind: 'coin', value: 5 },
      { ...far, id: 2, kind: 'treat' },
      { ...far, id: 3, kind: 'coin', value: 5, age: LOOT.maxAge - 1 },
      { ...far, id: 4, kind: 'tm', move: 'iceBeam', source: 'boss' },
      { ...far, id: 5, kind: 'xp', value: 3 },
      { ...far, id: 6, kind: 'berry', x: g.player.x + 60 },
    )
    updatePickups(g, DT)
    expect(g.pickups.map((k) => k.id)).toEqual([3, 4, 5, 6])
  })
})

describe('Poké Ball prizes', () => {
  const owned = { moves: [{ id: 'ember', level: 2, cooldown: 0, path: 0 }], items: [{ id: 'charcoal', level: 1 }] } as const

  it('ask before a new move or item takes a slot, and upgrade what the player has on their own', () => {
    expect(pokeballAsks({ kind: 'move', id: 'fireSpin', level: 1 }, owned)).toBe(true)
    expect(pokeballAsks({ kind: 'item', id: 'muscleBand', level: 1 }, owned)).toBe(true)
    expect(pokeballAsks({ kind: 'move', id: 'ember', level: 3 }, owned)).toBe(false)
    expect(pokeballAsks({ kind: 'item', id: 'charcoal', level: 2 }, owned)).toBe(false)
    expect(pokeballAsks({ kind: 'evolution', from: 'ember', to: 'flamethrower' }, owned)).toBe(false)
    expect(pokeballAsks({ kind: 'berry' }, owned)).toBe(false)
  })

  it('leave a new item behind on a pass, or put it in on a take', () => {
    const g = createGame('charmander', { w: 400, h: 240 }, 3)
    const ball = () => {
      setPhase(g, 'pokeball')
      g.player.offers = [{ kind: 'item', id: 'muscleBand', level: 1 }, { kind: 'pass' }]
    }
    ball()
    chooseOffer(g, g.player.offers[1]!)
    expect(g.phase).toBe('playing')
    expect(g.player.items).toEqual([])
    ball()
    chooseOffer(g, g.player.offers[0]!)
    expect(g.player.items).toEqual([{ id: 'muscleBand', level: 1 }])
  })
})

describe('Super Rod', () => {
  it('reels in everything on the ground but a choice of Mega Stones', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    g.pickups.length = 0
    const far = { x: g.player.x + 1500, y: g.player.y, vx: 0, vy: 0, attracted: false, age: 5 } as const
    g.pickups.push(
      { ...far, id: 1, kind: 'xp', value: 3 },
      { ...far, id: 2, kind: 'coin', value: 5 },
      { ...far, id: 3, kind: 'berry' },
      { ...far, id: 4, kind: 'pokeball' },
      { ...far, id: 5, kind: 'consumable', item: 'potion' },
      { ...far, id: 6, kind: 'alphaPrize' },
      { ...far, id: 7, kind: 'megaStone', mega: 'charizardX' },
      { ...far, id: 8, kind: 'megaStone', mega: 'charizardY' },
    )
    CONSUMABLES.superRod.apply(g)
    expect(g.pickups.filter((k) => k.attracted).map((k) => k.id)).toEqual([1, 2, 3, 4, 5, 6])
    g.pickups.length = 7
    CONSUMABLES.superRod.apply(g)
    expect(g.pickups.every((k) => k.attracted)).toBe(true)
  })
})
