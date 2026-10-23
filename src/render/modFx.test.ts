import { describe, expect, it } from 'vitest'
import { flightAngle } from './modFx'

describe('flightAngle', () => {
  it('points along every flight a fork can give a shot: straight, Seek, Boomerang', () => {
    expect(flightAngle({ kind: 'linear', vx: 0, vy: 10 })).toBeCloseTo(Math.PI / 2)
    expect(flightAngle({ kind: 'homing', vx: -10, vy: 0, speed: 10, turn: 5, target: null })).toBeCloseTo(Math.PI)
    expect(flightAngle({ kind: 'boomerang', vx: 10, vy: 0, ax: -18, ay: 0 })).toBeCloseTo(0)
  })

  it('follows Halo’s ring the way it spins', () => {
    expect(flightAngle({ kind: 'orbit', angle: 0, spin: 3.6, radius: 38 })).toBeCloseTo(Math.PI / 2)
    expect(flightAngle({ kind: 'orbit', angle: 0, spin: -3.6, radius: 38 })).toBeCloseTo(-Math.PI / 2)
  })

  it('has none for a hitbox that does not fly', () => {
    expect(flightAngle({ kind: 'static' })).toBeNull()
    expect(flightAngle({ kind: 'follow', ox: 10, oy: 0 })).toBeNull()
  })
})
