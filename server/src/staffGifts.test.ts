import { describe, expect, it } from 'vitest'
import { giftRefusal, parseStaffGift, STAFF_GIFTS, tally } from './staffGifts'

describe('giftRefusal', () => {
  const none = { eggs: 0, coins: 0 }

  it('lets staff send common and rare eggs, the owner an ultra one too', () => {
    expect(giftRefusal('staff', { kind: 'egg', tier: 'rare' }, none)).toBeNull()
    expect(giftRefusal('staff', { kind: 'egg', tier: 'ultra' }, none)).toBe('tier')
    expect(giftRefusal('staff', { kind: 'egg', tier: 'kecleonShiny' }, none)).toBe('tier')
    expect(giftRefusal('owner', { kind: 'egg', tier: 'ultra' }, none)).toBeNull()
  })

  it('holds staff to the daily allowance, never the owner', () => {
    const spent = { eggs: STAFF_GIFTS.perDay.eggs, coins: STAFF_GIFTS.perDay.coins - 100 }
    expect(giftRefusal('staff', { kind: 'egg', tier: 'common' }, spent)).toBe('eggs')
    expect(giftRefusal('staff', { kind: 'coins', amount: 100 }, spent)).toBeNull()
    expect(giftRefusal('staff', { kind: 'coins', amount: 101 }, spent)).toBe('coins')
    expect(giftRefusal('owner', { kind: 'egg', tier: 'common' }, { eggs: 99, coins: 99_999 })).toBeNull()
  })

  it('refuses ₽ amounts that are not positive or past one gift’s cap', () => {
    expect(giftRefusal('staff', { kind: 'coins', amount: 0 }, none)).toBe('amount')
    expect(giftRefusal('staff', { kind: 'coins', amount: STAFF_GIFTS.coinsPerGift.staff + 1 }, none)).toBe('amount')
  })
})

describe('parseStaffGift and tally', () => {
  it('reads a command’s kind and counts what went out today', () => {
    expect(parseStaffGift('rare', null)).toEqual({ kind: 'egg', tier: 'rare' })
    expect(parseStaffGift('coins', 500)).toEqual({ kind: 'coins', amount: 500 })
    expect(parseStaffGift('coins', null)).toBeNull()
    expect(parseStaffGift('shiny', null)).toBeNull()
    expect(tally([{ kind: 'egg', tier: 'rare' }, { kind: 'coins', amount: 300 }, { kind: 'coins', amount: 200 }])).toEqual({ eggs: 1, coins: 500 })
  })
})
