import { describe, expect, it } from 'vitest'
import { forgetCooled } from './attacks'

describe('a run-long hitbox forgetting its hits', () => {
  it('drops the foes off their cooldown and keeps the cooling and once-only ones', () => {
    const hits = new Map([[1, 4], [2, 5], [3, 6], [4, Infinity]])
    forgetCooled(hits, 5)
    expect([...hits.keys()]).toEqual([3, 4])
  })
})
