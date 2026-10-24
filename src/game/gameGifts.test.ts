import { describe, expect, it } from 'vitest'
import { HALLOWEEN, NIGHT_BOSSES } from '../data/halloween'
import { gameGiftsApplied } from './gameGifts'
import { applyGift, keepGiven } from './gifts'
import { halloweenGifts } from './halloween'
import { EMPTY_SAVE, type Save } from './meta'

/** A save that filled the jar, finished the hunt and opened every gift the game made. */
const opened = halloweenGifts({ ...EMPTY_SAVE, halloween: { candies: 800, spent: 0, hunted: NIGHT_BOSSES } }, HALLOWEEN.from).reduce<Save>((s, g) => {
  const out = applyGift(s, g)
  return out.status === 'applied' ? out.save : s
}, { ...EMPTY_SAVE, halloween: { candies: 800, spent: 0, hunted: NIGHT_BOSSES } })

const sync = (save: Save) => keepGiven(save, gameGiftsApplied(save))

describe('gameGiftsApplied', () => {
  it('keeps the Halloween rewards the save earned through a sync', () => {
    const kept = sync(opened)
    expect(kept.titles).toEqual(expect.arrayContaining(['pumpkinKing', 'exorcist']))
    expect(kept.style.owned).toMatchObject({ frame: expect.arrayContaining(['pumpkin', 'spectral']), background: ['halloween'], wallpaper: ['haunted'] })
  })

  it('drops a reward the save holds no evidence for', () => {
    const edited: Save = { ...opened, halloween: { candies: 10, spent: 0, hunted: [] } }
    const kept = sync(edited)
    expect(kept.titles).toEqual([])
    expect(kept.style.owned).toMatchObject({ frame: ['pumpkin'], background: [], wallpaper: [] })
  })

  it('still drops an unrelated never-sold frame', () => {
    const supporter: Save = { ...opened, style: { ...opened.style, owned: { ...opened.style.owned, frame: [...opened.style.owned.frame, 'supporter'] } } }
    expect(sync(supporter).style.owned.frame).not.toContain('supporter')
  })
})
