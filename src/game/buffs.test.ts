import { describe, expect, it } from 'vitest'
import { addBuff } from './buffs'
import type { Buff } from './types'

describe('addBuff', () => {
  it('refreshes a running buff to at least its full duration, stacking up to twice it', () => {
    const buffs: Buff[] = []
    addBuff(buffs, 'xAttack', 20)
    buffs[0]!.left = 3
    addBuff(buffs, 'xAttack', 20)
    expect(buffs[0]!.left).toBe(23)
    addBuff(buffs, 'xAttack', 20)
    expect(buffs[0]!.left).toBe(40)
  })

  it('never shortens a longer stack (an altar\'s) when a bottle is picked up', () => {
    const buffs: Buff[] = []
    addBuff(buffs, 'xSpeed', 30)
    addBuff(buffs, 'xSpeed', 30)
    expect(buffs[0]!.left).toBe(60)
    addBuff(buffs, 'xSpeed', 20)
    expect(buffs[0]!.left).toBe(60)
  })
})
