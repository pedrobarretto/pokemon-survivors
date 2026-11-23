import { describe, expect, it } from 'vitest'
import { CAFE_PATRONS, cafePose, newCafePose } from './cafeLife'

const waiter = CAFE_PATRONS.find((p) => p.dex === 113)!
const customer = CAFE_PATRONS.find((p) => p.dex === 133)!

describe('cafePose', () => {
  it('keeps the waiter inside the door until it comes out', () => {
    const pose = newCafePose()
    cafePose(waiter, 1, pose)
    expect(pose.gone).toBe(true)
    cafePose(waiter, 3, pose)
    expect(pose.gone).toBe(false)
  })

  it('walks facing where it heads, and stands facing its key when still', () => {
    const pose = newCafePose()
    cafePose(customer, 4, pose)
    expect(pose.anim).toBe('Walk')
    expect(pose.dir).toBe(6)
    cafePose(customer, 7, pose)
    expect(pose.anim).toBe('Idle')
    expect(pose.dir).toBe(4)
  })

  it('loops', () => {
    const [a, b] = [newCafePose(), newCafePose()]
    cafePose(customer, 3, a)
    cafePose(customer, 3 + customer.loop, b)
    expect(b).toEqual(a)
  })
})
