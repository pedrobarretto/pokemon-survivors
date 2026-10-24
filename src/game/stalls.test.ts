import { describe, expect, it } from 'vitest'
import { HALLOWEEN } from '../data/halloween'
import { STALLS } from '../data/visitors'
import { addDays } from './day'
import { EGGS } from './eggs'
import { candiesLeft } from './halloween'
import { EMPTY_SAVE, type Save } from './meta'
import { buyFromStall, stallBlock, stallGoods, stallOn } from './stalls'

const { hauntedEgg: EGG, hauntedEggCandies: SWEET } = STALLS.halloween.goods
const rich = (patch: Partial<Save> = {}): Save => ({ ...EMPTY_SAVE, wallet: 50_000, halloween: { candies: 5_000, spent: 0, hunted: [] }, ...patch })

describe('Duskull’s stall', () => {
  it('sells the Haunted Egg only on the Noite das Bruxas days', () => {
    expect(stallGoods('halloween')).toEqual(['hauntedEgg', 'hauntedEggCandies'])
    for (const day of [HALLOWEEN.from, '2026-10-31', HALLOWEEN.to]) {
      expect(stallOn(day)).toBe('halloween')
      expect(stallBlock(rich(), 'hauntedEgg', day)).toBeNull()
    }
    for (const day of [addDays(HALLOWEEN.from, -1), addDays(HALLOWEEN.to, 1), '2027-10-24']) {
      expect(stallBlock(rich(), 'hauntedEggCandies', day)).toBe('closed')
      expect(buyFromStall(rich(), 'hauntedEgg', day)).toBeNull()
    }
  })

  it('sells as many a day as the incubator takes, for ₽ into `spent` or for candies the jar keeps counting', () => {
    const day = '2026-10-25'
    const once = buyFromStall(rich(), 'hauntedEgg', day)!
    expect([once.wallet, once.spent]).toEqual([50_000 - EGG.price, EGG.price])
    const twice = buyFromStall(once, 'hauntedEggCandies', day)!
    expect([twice.wallet, twice.halloween.candies, candiesLeft(twice.halloween)]).toEqual([once.wallet, 5_000, 5_000 - SWEET.price])
    const thrice = buyFromStall(twice, 'hauntedEgg', day)!
    expect(thrice.eggs).toEqual(Array.from({ length: 3 }, () => ({ tier: 'haunted', steps: 0 })))
    expect(stallBlock(thrice, 'hauntedEgg', day)).toBe('full')
  })

  it('refuses a full incubator, a short wallet and too few candies left', () => {
    const full = rich({ eggs: Array.from({ length: EGGS.slots }, () => ({ tier: 'common', steps: 0 }) as const) })
    expect(stallBlock(full, 'hauntedEggCandies', HALLOWEEN.from)).toBe('full')
    expect(stallBlock(rich({ wallet: EGG.price - 1 }), 'hauntedEgg', HALLOWEEN.from)).toBe('poor')
    const sweetless = rich({ halloween: { candies: 5_000, spent: 5_001 - SWEET.price, hunted: [] } })
    expect(stallBlock(sweetless, 'hauntedEggCandies', HALLOWEEN.from)).toBe('poor')
    expect(stallBlock(sweetless, 'hauntedEgg', HALLOWEEN.from)).toBeNull()
  })
})
