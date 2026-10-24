import { describe, expect, it } from 'vitest'
import { DEFAULT_MAX_ROOMS, STARVING, fullWhy } from '../src/capacity'
import { configFrom } from '../src/config'

const calm = { loopP99Ms: 7, hostBusyPct: 40 }

describe('relay capacity', () => {
  it('is full at its room limit, whatever the load', () => {
    expect(fullWhy(39, 40, calm)).toBeNull()
    expect(fullWhy(40, 40, calm)).toBe('rooms')
    expect(fullWhy(0, 0, calm)).toBe('rooms')
  })

  it('is full while the last minute starved its event loop or the machine', () => {
    expect(fullWhy(0, 40, { ...calm, loopP99Ms: 75 })).toBe('loop')
    expect(fullWhy(0, 40, { ...calm, loopP99Ms: STARVING.loopP99Ms })).toBeNull()
    expect(fullWhy(0, 40, { ...calm, hostBusyPct: 97 })).toBe('host')
    // Before the first minute (or off Linux) nothing is known: not full.
    expect(fullWhy(0, 40, { loopP99Ms: null, hostBusyPct: null })).toBeNull()
  })

  it('reads MAX_ROOMS, falling back to the default on anything but a whole number', () => {
    expect(configFrom({}).maxRooms).toBe(DEFAULT_MAX_ROOMS)
    expect(configFrom({ MAX_ROOMS: '2' }).maxRooms).toBe(2)
    expect(configFrom({ MAX_ROOMS: '0' }).maxRooms).toBe(0)
    expect(configFrom({ MAX_ROOMS: 'lots' }).maxRooms).toBe(DEFAULT_MAX_ROOMS)
    expect(configFrom({ MAX_ROOMS: '-3' }).maxRooms).toBe(DEFAULT_MAX_ROOMS)
  })
})
