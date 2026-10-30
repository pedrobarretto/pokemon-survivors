import { describe, expect, it } from 'vitest'
import { COVE, GLADE, REEF, VALE } from '../data/versusMaps'
import { onFloor, zoneAt } from './vale'
import { versusTag } from './team'

describe('the maps\' floors', () => {
  it('has the spawn pads, the goals and the camps on the floor, and the hedge around it', () => {
    for (const map of [VALE, GLADE, COVE, REEF]) for (const p of [...map.spawn, ...map.goals, ...map.camps]) expect(onFloor(map.rects, p.x, p.y)).toBe(true)
    expect(onFloor(VALE.rects, 200, -190)).toBe(false)
    expect(onFloor(VALE.rects, 800, 0)).toBe(false)
    expect(onFloor(GLADE.rects, 360, 100)).toBe(false)
  })

  it('tells the bases, the lanes and the jungle apart', () => {
    const vale = VALE.look
    expect(zoneAt(vale, -700, 0)).toBe('base')
    expect(zoneAt(vale, 700, 100)).toBe('base')
    expect(zoneAt(vale, 0, -300)).toBe('lane')
    expect(zoneAt(vale, 100, 50)).toBe('jungle')
    expect(zoneAt(vale, -350, 190)).toBe('passage')
    const glade = GLADE.look
    expect(zoneAt(glade, -565, 0)).toBe('base')
    expect(zoneAt(glade, 0, 255)).toBe('lane')
    expect(zoneAt(glade, 0, 0)).toBe('jungle')
    expect(zoneAt(glade, -350, 0)).toBe('passage')
    const cove = COVE.look
    expect(zoneAt(cove, -330, 0)).toBe('jungle')
    expect(zoneAt(cove, 0, 0)).toBe('jungle')
    expect(zoneAt(cove, -140, 0)).toBe('passage')
    expect(zoneAt(cove, 0, -340)).toBe('lane')
    expect(zoneAt(REEF.look, 0, -262)).toBe('lane')
    expect(zoneAt(REEF.look, 100, 0)).toBe('passage')
  })
})

describe('versusTag', () => {
  it("writes a human's name, and a bot's Pokémon", () => {
    expect(versusTag('@ana', 'Bulbasaur', 0)).toBe('ANA')
    expect(versusTag('', 'Charmander', 3)).toBe('CHARMANDER')
    expect(versusTag('', 'Flabébé', 3)).toBe('FLABEBE')
  })
})
