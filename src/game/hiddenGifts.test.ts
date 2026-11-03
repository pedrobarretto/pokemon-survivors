import { describe, expect, it } from 'vitest'
import { applyGift, keepGiven } from './gifts'
import { gameGiftsApplied, isGameGift } from './gameGifts'
import { hiddenGiftId, hiddenGifts } from './hiddenGifts'
import { EMPTY_SAVE, type Save } from './meta'

const found = (...places: Save['achievements']['lifetime']['places']): Save => ({
  ...EMPTY_SAVE,
  achievements: { ...EMPTY_SAVE.achievements, lifetime: { ...EMPTY_SAVE.achievements.lifetime, places } },
})

describe('the hidden zones’ gifts', () => {
  it('give each zone’s look once it was found, once, and the API keeps it', () => {
    expect(hiddenGifts(found('cave', 'sky'))).toEqual([])
    const gifts = hiddenGifts(found('cave', 'grotto'))
    expect(gifts.map((g) => g.id)).toEqual([hiddenGiftId('grotto')])
    expect(gifts.every((g) => isGameGift(g.id))).toBe(true)
    const out = applyGift(found('cave', 'grotto'), gifts[0]!)
    if (out.status !== 'applied') throw new Error(out.status)
    expect(out.save.style.owned.frame).toContain('grotto')
    expect(hiddenGifts(out.save)).toEqual([])
    expect(keepGiven(out.save, gameGiftsApplied(out.save))).toEqual(out.save)
  })

  it('aren’t vouched for a save that never found the zone', () => {
    const out = applyGift(EMPTY_SAVE, { id: hiddenGiftId('underground'), content: { kind: 'style', style: { slot: 'wallpaper', id: 'secretBase' } }, reason: null })
    if (out.status !== 'applied') throw new Error(out.status)
    expect(keepGiven(out.save, gameGiftsApplied(out.save)).style.owned.wallpaper).not.toContain('secretBase')
  })
})
