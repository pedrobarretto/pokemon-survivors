import { describe, expect, it } from 'vitest'
import { isHiddenPlace, PLACE, PLACE_IDS } from '../data/places'
import { hurtPlayer } from './combat'
import { createGame, step } from './game'
import { enterPlace } from './placeInterior'

const DT = 1 / 60
const still = { move: { x: 0, y: 0 }, special: false }

describe('fainting in a place', () => {
  it.each(PLACE_IDS)('holds the world while the rescue comes in the %s, then lands the player at the door alive with their Revive kept', (id) => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    const outside = g.enemies
    const door = { x: g.player.x, y: g.player.y }
    g.player.revives = 1
    enterPlace(g, id, door.x, door.y)
    // The cave (and a hidden zone) opens on its title card.
    for (let t = 0; t < 2; t += DT) step(g, still, DT)
    g.player.iframes = 0
    hurtPlayer(g, g.player.stats.maxHp * 100)
    expect(g.phase).toBe('playing')
    expect(g.place.inside?.fall).toBe(PLACE.fallTime)

    const time = g.time
    for (let t = 0; t < PLACE.fallTime - DT; t += DT) step(g, still, DT)
    expect(g.time).toBe(time)
    expect(g.place.inside).not.toBeNull()
    step(g, still, DT)

    expect(g.place.inside).toBeNull()
    expect(g.enemies).toBe(outside)
    expect(g.player.hp).toBe(Math.round(g.player.stats.maxHp * PLACE.fallHp))
    expect(g.player.x).toBe(door.x)
    expect(g.player.revives).toBe(1)
    // A hidden zone counts as found (`cleared`) on the way in; the others need their goal.
    expect(g.place.cleared).toEqual(isHiddenPlace(id) ? [id] : [])
    expect(g.events.some((e) => e.kind === 'place' && e.notice.kind === 'exit' && e.notice.outcome === 'fallen')).toBe(true)
  })
})
