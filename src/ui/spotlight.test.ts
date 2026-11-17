import { describe, expect, it } from 'vitest'
import { placeCard } from './spotlight'

const PHONE = { left: 0, top: 0, right: 360, bottom: 740 }
const DESKTOP = { left: 0, top: 0, right: 1440, bottom: 900 }

describe('placeCard', () => {
  it('puts the card above a bar at the foot of a phone', () => {
    const at = placeCard({ left: 10, top: 600, right: 350, bottom: 660 }, PHONE, 336, 200)
    expect(at.y + 200).toBeLessThanOrEqual(600)
  })

  it('puts the card beside a tall column, where the room is', () => {
    const at = placeCard({ left: 0, top: 60, right: 300, bottom: 620 }, DESKTOP, 440, 180)
    expect(at.x).toBeGreaterThanOrEqual(300)
  })

  it('keeps the card inside the safe area, and in the middle with nothing to point at', () => {
    const near = placeCard({ left: 300, top: 10, right: 360, bottom: 40 }, PHONE, 336, 200)
    expect(near.x + 336).toBeLessThanOrEqual(360)
    expect(placeCard(null, PHONE, 300, 200)).toEqual({ x: 30, y: 270 })
  })
})
