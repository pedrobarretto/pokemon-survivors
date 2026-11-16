import { describe, expect, it } from 'vitest'
import * as dm from './dmath'
import { dir8 } from './math'

/** The rounded angle `dir8` stands in for. */
const byAngle = (x: number, y: number) => ((2 - ((dm.round(dm.atan2(y, x) / (Math.PI / 4)) + 8) % 8) + 8) % 8)

describe('dir8', () => {
  it('faces the nearest of the 8 directions, as rounding the angle does', () => {
    for (let k = 0; k < 3600; k++) {
      const angle = (k / 3600) * Math.PI * 2 + 0.0001
      const x = Math.cos(angle) * 37
      const y = Math.sin(angle) * 37
      expect(dir8(x, y), `${k}`).toBe(byAngle(x, y))
    }
  })

  it('reads screen space: down is 0, right 2, up 4, left 6', () => {
    expect([dir8(0, 1), dir8(1, 0), dir8(0, -1), dir8(-1, 0), dir8(0, 0)]).toEqual([0, 2, 4, 6, 2])
    expect([dir8(1, 1), dir8(1, -1), dir8(-1, -1), dir8(-1, 1)]).toEqual([1, 3, 5, 7])
  })
})
