import { describe, expect, it } from 'vitest'
import { FESTIVAL, FESTIVALS } from '../data/festivals'
import { bagCount } from './bag'
import {
  claimOpen,
  donateFrom,
  donationRefusal,
  festivalAnnounced,
  festivalGifts,
  festivalGiftsVouched,
  festivalOn,
  isHeld,
  latestFestival,
  parseDonationAmount,
  parseFestivalStatus,
  plazaStage,
  reachedMilestones,
} from './festival'
import { gameGiftsApplied } from './gameGifts'
import { applyGift, keepGiven, type Gift } from './gifts'
import { EMPTY_SAVE, type Save } from './meta'
import { applyPush } from './sync'

const lanternas = FESTIVALS[0]

/** Opens every gift in turn, as the gift box does. */
const openAll = (save: Save, gifts: readonly Gift[]) =>
  gifts.reduce<Save>((s, g) => {
    const out = applyGift(s, g)
    return out.status === 'applied' ? out.save : s
  }, save)

describe('festival calendar', () => {
  it('runs the Festival das Lanternas from 11-03 for 14 days, and keeps it on the plaza after', () => {
    expect(festivalOn('2026-11-02')).toBeNull()
    expect(festivalOn('2026-11-03')?.id).toBe('lanternas')
    expect(festivalOn('2026-11-16')?.id).toBe('lanternas')
    expect(festivalOn('2026-11-17')).toBeNull()
    expect(latestFestival('2026-11-02')).toBeNull()
    expect(latestFestival('2026-11-20')?.id).toBe('lanternas')
  })

  it('announces a festival in the shop a week before it opens, and while it runs', () => {
    expect(festivalAnnounced('2026-10-26')).toBeNull()
    expect(festivalAnnounced('2026-10-27')?.id).toBe('lanternas')
    expect(festivalAnnounced('2026-11-16')?.id).toBe('lanternas')
    expect(festivalAnnounced('2026-11-17')).toBeNull()
  })

  it('lets its gifts be opened until 7 days after its last day', () => {
    expect(claimOpen(lanternas, '2026-11-02')).toBe(false)
    expect(claimOpen(lanternas, '2026-11-23')).toBe(true)
    expect(claimOpen(lanternas, '2026-11-24')).toBe(false)
  })
})

describe('the pot', () => {
  it('reaches milestones and plaza stages as it grows', () => {
    expect([0, 10_000_000, 41_000_000, 60_000_000, 100_000_000, 150_000_000].map((pot) => [reachedMilestones(lanternas, pot), plazaStage(lanternas, pot)])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 2],
      [4, 3],
      [5, 4],
    ])
    expect(plazaStage(null, 1e9)).toBe(0)
  })
})

describe('festivalGifts', () => {
  const totals = { pots: { lanternas: 41_000_000 }, given: {} }

  it('gives everyone the milestones the pot reached, until the save opened them', () => {
    const gifts = festivalGifts(EMPTY_SAVE, totals, '2026-11-05')
    expect(gifts.map((g) => g.id)).toEqual(['festival:lanternas:0', 'festival:lanternas:1'])
    expect(festivalGifts(openAll(EMPTY_SAVE, gifts), totals, '2026-11-05')).toEqual([])
    expect(festivalGifts(EMPTY_SAVE, totals, '2026-11-24')).toEqual([])
  })

  it('makes a Mecenas of who gave the threshold, counted donations only', () => {
    const ids = (given: number) => festivalGifts(EMPTY_SAVE, { pots: {}, given: { lanternas: given } }, '2026-11-05').map((g) => g.id)
    expect(ids(FESTIVAL.patron - 1)).toEqual([])
    expect(ids(FESTIVAL.patron)).toEqual(['festival:lanternas:patron'])
  })

  it('puts the Lures in the Bag and hatches the shiny Togepi', () => {
    const save = openAll(EMPTY_SAVE, festivalGifts(EMPTY_SAVE, { pots: { lanternas: 150_000_000 }, given: {} }, '2026-11-16'))
    expect(bagCount(save.bag, 'lure')).toBe(3)
    expect(save.hatched.togepi).toEqual({ shiny: true })
    expect(save.eggs.map((e) => e.tier)).toEqual(['rare', 'kecleon'])
  })
})

describe('festivalGiftsVouched', () => {
  const opened = openAll(EMPTY_SAVE, festivalGifts(EMPTY_SAVE, { pots: { lanternas: 30_000_000 }, given: { lanternas: 60_000 } }, '2026-11-05'))
  const push = (totals: Parameters<typeof festivalGiftsVouched>[1]) => keepGiven(opened, gameGiftsApplied(opened, totals))

  it('keeps the Lantern frame and the Mecenas title when the API sums back them, after the claim window too', () => {
    const kept = push({ pots: { lanternas: 30_000_000 }, given: { lanternas: 60_000 } })
    expect(kept.style.owned.frame).toContain('lantern')
    expect(kept.titles).toEqual(['patron'])
  })

  it('drops them from a save that claims more than the pot or the donations reached', () => {
    const kept = push({ pots: { lanternas: 29_999_999 }, given: { lanternas: 10_000 } })
    expect(kept.style.owned.frame).not.toContain('lantern')
    expect(kept.titles).toEqual([])
    expect(keepGiven(opened, gameGiftsApplied(opened)).titles).toEqual([])
  })
})

describe('donating', () => {
  const ok = { festival: lanternas, amount: 10_000, handle: 'ash', runs: 3, today: 0, wallet: 50_000 }

  it('refuses outside a festival, without a handle or runs, past the cap or the wallet', () => {
    expect(donationRefusal(ok)).toBeNull()
    expect(donationRefusal({ ...ok, festival: null })).toBe('closed')
    expect(donationRefusal({ ...ok, handle: null })).toBe('profile')
    expect(donationRefusal({ ...ok, runs: 2 })).toBe('runs')
    expect(donationRefusal({ ...ok, today: FESTIVAL.dailyCap - 9_999 })).toBe('cap')
    expect(donationRefusal({ ...ok, wallet: 9_999 })).toBe('funds')
  })

  it('takes whole ₽ within the limits and holds the richest wallets', () => {
    expect([100, 200_000, 99, 200_001, 1.5, '1000', NaN].map(parseDonationAmount)).toEqual([100, 200_000, null, null, null, null, null])
    expect(isHeld(FESTIVAL.heldWallet)).toBe(false)
    expect(isHeld(FESTIVAL.heldWallet + 1)).toBe(true)
  })

  it('is never refunded by a merge with a device that still had the ₽', () => {
    const before: Save = { ...EMPTY_SAVE, wallet: 100_000, spent: 5_000 }
    const stored = { save: donateFrom(before, 40_000), revision: 8 }
    // Another device pushes on top of the revision before the donation, having earned 1 000 ₽ since.
    const other = applyPush(stored, { save: { ...before, wallet: 101_000 }, base: 7 })
    expect(other.merged).toBe(true)
    expect(other.save.wallet).toBe(61_000)
    expect(other.save.spent).toBe(45_000)
  })
})

describe('parseFestivalStatus', () => {
  it('reads the API answer defensively', () => {
    const status = parseFestivalStatus({
      day: '2026-11-05',
      festival: 'lanternas',
      pots: { lanternas: 41_208_400, nope: 5 },
      top: [{ handle: 'okashiwaya', amount: 2_600_000 }, { handle: '!!', amount: 1 }],
      donors: 312,
      me: { today: 50_000, given: { lanternas: 50_000 }, held: 0, public: false, rank: 87 },
    })
    expect(status).toEqual({
      day: '2026-11-05',
      festival: 'lanternas',
      pots: { lanternas: 41_208_400 },
      top: [{ handle: 'okashiwaya', amount: 2_600_000 }],
      donors: 312,
      me: { today: 50_000, given: { lanternas: 50_000 }, held: 0, public: false, rank: 87 },
    })
    expect(parseFestivalStatus({ day: '2026-11-05', me: { rank: 0 } })?.me?.rank).toBeNull()
    expect(parseFestivalStatus({ day: 'soon' })).toBeNull()
    expect(parseFestivalStatus({ day: '2026-11-05', festival: 'other' })?.festival).toBeNull()
  })
})
