import { describe, expect, it } from 'vitest'
import { EGG_TIERS, EGGS, hatchPool } from './eggs'
import { applyGift, DISCORD_GIFT, giftToOpen, keepGiven, parseGift, type Gift, type GiftContent } from './gifts'
import { EMPTY_SAVE, parseSaveData, type Save } from './meta'

const gift = (content: GiftContent, id = 'g1'): Gift => ({ id, content, reason: null })

/** The outcome of a gift that must land. */
const applied = (save: Save, g: Gift) => {
  const out = applyGift(save, g)
  if (out.status !== 'applied') throw new Error(`expected applied, got ${out.status}`)
  return out
}

describe('applyGift', () => {
  it('lands once: the same gift again is only claimed', () => {
    const once = applied(EMPTY_SAVE, gift({ kind: 'coins', amount: 500 })).save
    expect(once.wallet).toBe(500)
    expect(once.gifts).toEqual(['g1'])
    expect(applyGift(once, gift({ kind: 'coins', amount: 500 })).status).toBe('claimed')
  })

  it('puts an egg in the incubator, and waits while it is full', () => {
    expect(applied(EMPTY_SAVE, gift({ kind: 'egg', tier: 'friend' })).save.eggs).toEqual([{ tier: 'friend', steps: 0 }])
    const full: Save = { ...EMPTY_SAVE, eggs: Array.from({ length: EGGS.slots }, () => ({ tier: 'common' as const, steps: 0 })), eggQueue: Array.from({ length: EGGS.queue }, () => ({ tier: 'common' as const, steps: 0 })) }
    expect(applyGift(full, gift({ kind: 'egg', tier: 'friend' })).status).toBe('wait')
  })

  it('owns and wears a gift title and a gift frame', () => {
    const titled = applied(EMPTY_SAVE, gift({ kind: 'title', title: 'ambassador' })).save
    expect(titled.titles).toEqual(['ambassador'])
    expect(titled.title).toBe('ambassador')
    // The title survives the save's parser only while it's owned.
    expect(parseSaveData(titled).title).toBe('ambassador')
    expect(parseSaveData({ ...titled, titles: [] }).title).toBeNull()
    const framed = applied(EMPTY_SAVE, gift({ kind: 'style', style: { slot: 'frame', id: 'ambassador' } })).save
    expect(framed.style.owned.frame).toEqual(['ambassador'])
    expect(framed.style.equipped.frame).toBe('ambassador')
  })

  it('hatches a family shiny, and pays its egg back when it was shiny already', () => {
    const first = applied(EMPTY_SAVE, gift({ kind: 'shinyHatch', family: 'munchlax' }))
    expect(first.save.hatched.munchlax).toEqual({ shiny: true })
    expect(first.hatch).toMatchObject({ id: 'munchlax', shiny: true, duplicate: false })
    const again = applied(first.save, gift({ kind: 'shinyHatch', family: 'munchlax' }, 'g2'))
    expect(again.hatch).toMatchObject({ duplicate: true, refund: EGG_TIERS.friend.refund })
    expect(again.save.wallet).toBe(EGG_TIERS.friend.refund)
  })
})

describe('parseGift', () => {
  it('takes known gifts and leaves kinds or values this build lacks', () => {
    expect(parseGift({ id: 'x', content: { kind: 'egg', tier: 'friend' }, reason: { kind: 'welcome', from: 'Ash' } })).toEqual({
      id: 'x',
      content: { kind: 'egg', tier: 'friend' },
      reason: { kind: 'welcome', from: 'ash' },
    })
    expect(parseGift({ id: 'x', content: { kind: 'ribbon', tier: 'gold' } })).toBeNull()
    expect(parseGift({ id: 'x', content: { kind: 'style', style: { slot: 'frame', id: 'meadow' } } })).toBeNull()
    expect(parseGift({ id: 'x', content: { kind: 'coins', amount: -5 } })).toBeNull()
  })

  it('reads the Discord thank-you as the API stores it', () => {
    const stored = JSON.parse(JSON.stringify({ id: 'x', content: DISCORD_GIFT, reason: { kind: 'discord' } }))
    expect(parseGift(stored)).toEqual({ id: 'x', content: DISCORD_GIFT, reason: { kind: 'discord' } })
  })
})

describe('Friendship Egg', () => {
  it('only hatches Munchlax, and Munchlax hatches from nothing else', () => {
    expect(hatchPool('friend', {}).map(([id]) => id)).toEqual(['munchlax'])
    expect(hatchPool('common', {}).some(([id]) => id === 'munchlax')).toBe(false)
  })
})

describe('giftToOpen', () => {
  it('skips an egg waiting for room and opens the next gift', () => {
    const full: Save = { ...EMPTY_SAVE, eggs: Array.from({ length: EGGS.slots }, () => ({ tier: 'common' as const, steps: 0 })), eggQueue: Array.from({ length: EGGS.queue }, () => ({ tier: 'common' as const, steps: 0 })) }
    const egg = gift({ kind: 'egg', tier: 'rare' }, 'g1')
    const coins = gift({ kind: 'coins', amount: 100 }, 'g2')
    expect(giftToOpen(full, [egg, coins])).toEqual({ gift: coins, blocked: false })
    expect(giftToOpen(full, [egg])).toEqual({ gift: egg, blocked: true })
    expect(giftToOpen(EMPTY_SAVE, [egg, coins])).toEqual({ gift: egg, blocked: false })
    expect(giftToOpen(EMPTY_SAVE, [])).toBeNull()
  })
})

describe('keepGiven', () => {
  const supporter = gift({ kind: 'title', title: 'supporter' }, 'title')
  const frame = gift({ kind: 'style', style: { slot: 'frame', id: 'supporter' } }, 'frame')
  const ticket = gift({ kind: 'shinyPick' }, 'ticket')
  const bronze = { day: '2026-10-18', tier: 'bronze', rank: 40, total: 50 } as const
  const ribbon = gift({ kind: 'ribbon', ribbon: bronze }, 'ribbon')
  const walking: Save = { ...EMPTY_SAVE, companion: { id: 'pichu', shiny: false } }
  const thanked = [supporter, frame, ticket, ribbon].reduce((s, g) => applied(s, g).save, walking)

  it('keeps every reward the gifts brought', () => {
    expect(keepGiven(thanked, [supporter, frame, ticket, ribbon])).toEqual(thanked)
  })

  it("drops what no gift brought, and unwears it: an edited save isn't a supporter", () => {
    const kept = keepGiven(thanked, [])
    expect(kept).toMatchObject({ titles: [], title: null, ribbons: [], shinyPicks: [], companion: null })
    expect(kept.style.owned.frame).toEqual([])
    expect(kept.style.equipped.frame).toBe('classic')
  })

  it('keeps styles bought with ₽, and takes the ribbon as it was given', () => {
    const bought: Save = { ...EMPTY_SAVE, style: { owned: { frame: ['poke'], background: [], wallpaper: [] }, equipped: { frame: 'poke', background: 'night', wallpaper: 'classic' } } }
    expect(keepGiven(bought, []).style).toEqual(bought.style)
    const gilded: Save = { ...thanked, ribbons: [{ day: '2026-10-18', tier: 'gold', rank: 1, total: 50 }] }
    expect(keepGiven(gilded, [ribbon]).ribbons).toEqual([bronze])
  })
})
