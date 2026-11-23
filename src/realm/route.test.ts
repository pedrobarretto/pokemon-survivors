import { describe, expect, it } from 'vitest'
import { REALM_ROOMS, TOWN_ROOMS, type Point } from '../data/realmMap'
import { blocked } from './interp'
import { doorPoint, doorToward, routeTo, routeToward } from './route'

describe('the way to a room', () => {
  it('picks the first door on the shortest way', () => {
    expect(doorToward('trail', 'arcade')?.to).toBe('plaza')
    expect(doorToward('plaza', 'arcade')?.to).toBe('pier')
    expect(doorToward('pier', 'arcade')?.to).toBe('arcade')
    expect(doorToward('pier', 'pier')).toBeNull()
  })

  it('walks from where a trainer lands to every door of every room, on open ground and into the door', () => {
    for (const id of TOWN_ROOMS) {
      const room = REALM_ROOMS[id]
      for (const door of room.doors) {
        const end = doorPoint(room, door.at)
        expect(end, `${id} → ${door.to}`).not.toBeNull()
        const route = routeTo(room, room.spawn, end as Point)
        expect(route.length, `${id} → ${door.to}`).toBeGreaterThan(0)
        expect(route.at(-1)).toEqual(end)
        for (const p of route) expect(blocked(room, p.x, p.y), `${id} → ${door.to} at ${p.x},${p.y}`).toBe(false)
      }
    }
  })

  it('walks around what stands in a straight line', () => {
    // The plaza's fountain stands between its south spawn and the café's door.
    const route = routeToward('plaza', 'cafe', REALM_ROOMS.plaza.spawn)
    expect(route.length).toBeGreaterThan(1)
  })
})
