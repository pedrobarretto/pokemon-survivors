import { describe, expect, it } from 'vitest'
import { NO_ACHIEVEMENTS } from './achievements'
import { buyUpgrade, EMPTY_SAVE, NO_RANKS, parseSaveData, refundAll, upgradePrice, type Save } from './meta'
import { keepGiven } from './gifts'
import { bagCount } from './bag'
import { buyFromVitrine, buyKecleonEgg, buyStyle, claimGift, investInShop, vitrineCards, vitrineOf } from './shop'
import { applyPush, mergeSaves } from './sync'
import { buyQuick, buySlot, useQuick } from './incubator'

const save = (patch: Partial<Save>): Save => ({ ...EMPTY_SAVE, ...patch })

const guest = save({
  wallet: 500,
  ranks: { ...NO_RANKS, hpUp: 3 },
  dex: { 1: [10, 1], 25: [2, 0] },
  eggs: [{ tier: 'common', steps: 1500 }],
  hatched: { eevee: { shiny: true } },
  shinyStarters: { charmander: false },
  missions: { daily: { key: '2026-10-14', progress: { 'kills:500': 300 } }, weekly: { key: '2026-10-12', progress: {} } },
  achievements: { unlocked: ['survive5'], lifetime: { ...NO_ACHIEVEMENTS.lifetime, kills: 900, legends: ['lugia'] } },
  gifts: ['gift-a'],
})

const account = save({
  wallet: 2000,
  ranks: { ...NO_RANKS, hpUp: 1, protein: 2 },
  dex: { 1: [40, 0], 150: [1, 0] },
  eggs: [{ tier: 'common', steps: 200 }, { tier: 'rare', steps: 0 }],
  hatched: { eevee: { shiny: false }, gible: { shiny: false } },
  shinyStarters: { pichu: true },
  missions: { daily: { key: '2026-10-13', progress: { 'kills:500': 500 } }, weekly: { key: '2026-10-12', progress: { 'steps:5000': 4000 } } },
  achievements: { unlocked: ['firstRun'], lifetime: { ...NO_ACHIEVEMENTS.lifetime, kills: 600, runs: 40, legends: ['kyogre'] } },
  titles: ['ambassador'],
  gifts: ['gift-b', 'gift-a'],
})

describe('mergeSaves', () => {
  it("never pays back what one side spent on the Vitrine or on styles", () => {
    const before = save({ wallet: 20_000 })
    const v = vitrineOf('2026-10-21')
    const card = vitrineCards(v, 1).find((key) => key !== 'egg' && key !== 'style')!
    const shopped = buyStyle(buyFromVitrine(claimGift(before, v)!, v, card)!, 'frame', 'master')!
    const m = mergeSaves(before, shopped)
    expect(m.wallet).toBe(shopped.wallet)
    expect(m.style.owned.frame).toEqual(['master'])
    expect(m.shop).toEqual(shopped.shop)
    expect(bagCount(m.bag, v.gift)).toBeGreaterThanOrEqual(1)
    expect(mergeSaves(m, before)).toEqual({ ...m, style: { ...m.style, equipped: before.style.equipped }, bag: { ...m.bag, armed: before.bag.armed } })
  })

  it('merges two Kecleon Egg ladders climbed apart as the higher one: its count, its ₽ and its eggs', () => {
    const before = save({ wallet: 100_000 })
    const v = vitrineOf('2026-10-21')
    const one = buyKecleonEgg(before, v)!
    const two = buyKecleonEgg(one, v)!
    const m = mergeSaves(one, two)
    expect([m.shop.bought.kecleonEgg, m.wallet, m.eggs.length]).toEqual([2, 100_000 - 30_000, 2])
    expect(mergeSaves(m, one)).toMatchObject({ wallet: m.wallet, shop: { bought: { kecleonEgg: 2 } } })
  })

  it("counts the shop's level in the fortune: an investment on one side is neither paid back nor paid twice", () => {
    const before = save({ wallet: 200_000 })
    const invested = investInShop(before)!
    const elsewhere = buyStyle(before, 'frame', 'master')!
    const m = mergeSaves(invested, elsewhere)
    expect(m.shop.level).toBe(2)
    expect(m.wallet).toBe(200_000 - 30_000 - 5_000)
    expect(mergeSaves(m, invested).wallet).toBe(m.wallet)
    expect(mergeSaves(before, invested)).toMatchObject({ wallet: 170_000, shop: { level: 2 } })
  })

  it("takes the incoming side's partner and difficulty: the device that played last picked them", () => {
    const m = mergeSaves(save({ partner: 'squirtle', difficulty: 'hard' }), save({ partner: 'gible', difficulty: 'normal' }))
    expect(m.partner).toBe('gible')
    expect(m.difficulty).toBe('normal')
  })

  it("keeps every family's branch, the incoming side's where both evolved it", () => {
    const m = mergeSaves(save({ branches: { eevee: 'espeon', ralts: 'gallade' } }), save({ branches: { eevee: 'umbreon', scyther: 'scizor' } }))
    expect(m.branches).toEqual({ eevee: 'umbreon', ralts: 'gallade', scyther: 'scizor' })
  })

  it('joins the collection and keeps the larger upgrades and records', () => {
    const m = mergeSaves(account, guest)
    expect(m.ranks).toMatchObject({ hpUp: 3, protein: 2, iron: 0 })
    expect(m.dex).toEqual({ 1: [40, 1], 25: [2, 0], 150: [1, 0] })
    expect(m.hatched).toEqual({ eevee: { shiny: true }, gible: { shiny: false } })
    expect(m.shinyStarters).toEqual({ charmander: false, pichu: true })
    expect(m.eggs).toEqual([{ tier: 'rare', steps: 0 }, { tier: 'common', steps: 1500 }])
    expect(m.achievements.unlocked).toEqual(expect.arrayContaining(['survive5', 'firstRun']))
    expect(m.achievements.lifetime).toMatchObject({ kills: 900, runs: 40 })
    expect(m.achievements.lifetime.legends).toEqual(expect.arrayContaining(['kyogre', 'lugia']))
    expect(m.titles).toEqual(['ambassador'])
    expect(m.gifts).toEqual(['gift-a', 'gift-b'])
  })

  it("keeps a shiny hatch's Normal pick against a device that never picked, and the incoming pick when both did", () => {
    const hatched = save({ hatched: { gible: { shiny: true } } })
    const normal = save({ hatched: { gible: { shiny: true } }, shinyStarters: { gible: false } })
    expect(mergeSaves(normal, hatched).shinyStarters).toEqual({ gible: false })
    expect(mergeSaves(hatched, normal).shinyStarters).toEqual({ gible: false })
    expect(mergeSaves(normal, save({ shinyStarters: { gible: true } })).shinyStarters).toEqual({ gible: true })
  })

  it('keeps the current day of missions, and the most progress on the same week', () => {
    const m = mergeSaves(account, guest)
    expect(m.missions.daily).toEqual(guest.missions.daily)
    expect(m.missions.weekly.progress).toEqual({ 'steps:5000': 4000 })
  })

  it('counts ₽ spent on one side only once', () => {
    // The same 1000 ₽, spent on one device and still in the wallet on the other.
    const spent = buyUpgrade(save({ wallet: 1000 }), 'protein')!
    const m = mergeSaves(save({ wallet: 1000 }), spent)
    expect(m.ranks.protein).toBe(1)
    expect(m.wallet).toBe(1000 - upgradePrice('protein', 0))
  })

  it("counts the incubator's slots in the fortune and keeps them, with the eggs they hold and a Quick Incubator used on either side", () => {
    const before = save({ wallet: 200_000, shop: { ...EMPTY_SAVE.shop, level: 2 }, eggs: [{ tier: 'rare', steps: 100 }] })
    const slotted = buySlot(before)!
    const filled = { ...slotted, eggs: [...slotted.eggs, ...Array.from({ length: 3 }, () => ({ tier: 'common' as const, steps: 0 }))] }
    const quick = useQuick(buyQuick(before)!, 0)!
    const m = mergeSaves(filled, quick)
    expect(m.incubator).toEqual({ slots: 1, quick: { got: 1, used: 1 } })
    expect(m.wallet).toBe(200_000 - 150_000 - 8000)
    expect(m.eggs).toHaveLength(4)
    expect(m.eggs[0]).toEqual({ tier: 'rare', steps: 100, quick: true })
    expect(mergeSaves(m, filled)).toEqual(m)
    expect(parseSaveData(JSON.parse(JSON.stringify(m)))).toEqual(m)
  })

  it('changes nothing when merged again, in either order', () => {
    const m = mergeSaves(account, guest)
    expect(mergeSaves(m, guest)).toEqual(m)
    expect(mergeSaves(account, m)).toEqual(m)
    expect(mergeSaves(guest, account)).toEqual(m)
  })

  it('fills the incubator with the rarest, most walked eggs', () => {
    const a = save({ eggs: [{ tier: 'common', steps: 10 }, { tier: 'common', steps: 20 }, { tier: 'ultra', steps: 0 }] })
    const b = save({ eggs: [{ tier: 'rare', steps: 5 }, { tier: 'common', steps: 900 }] })
    expect(mergeSaves(a, b).eggs).toEqual([
      { tier: 'ultra', steps: 0 },
      { tier: 'rare', steps: 5 },
      { tier: 'common', steps: 900 },
    ])
  })
})

describe('applyPush', () => {
  it('stores a first push as it is', () => {
    expect(applyPush(null, { save: guest, base: null })).toEqual({ save: guest, revision: 1, merged: false })
  })

  it('takes a push on top of the latest revision as is, so spending and hatching stick', () => {
    const refunded = refundAll(account)
    expect(applyPush({ save: account, revision: 4 }, { save: refunded, base: 4 })).toEqual({ save: refunded, revision: 5, merged: false })
  })

  it('merges a push from an older revision', () => {
    const out = applyPush({ save: account, revision: 4 }, { save: guest, base: 2 })
    expect(out).toEqual({ save: mergeSaves(account, guest), revision: 5, merged: true })
  })

  it('keeps the Haunted Egg, its families and the candies spent through the API’s parse, merge and gift check', () => {
    const device = save({ eggs: [{ tier: 'haunted', steps: 100 }], hatched: { litwick: { shiny: true }, sandygast: { shiny: false } }, halloween: { candies: 900, spent: 300, hunted: [] } })
    // As `server/src/app.ts` and `db.ts` do: parse the body, apply the push, then keep only what gifts brought.
    const pushed = parseSaveData(JSON.parse(JSON.stringify(device)))
    const stored = keepGiven(applyPush({ save: account, revision: 3 }, { save: pushed, base: 2 }).save, [])
    expect(stored.eggs).toContainEqual({ tier: 'haunted', steps: 100 })
    expect(stored.hatched).toMatchObject({ litwick: { shiny: true }, sandygast: { shiny: false } })
    expect(stored.halloween).toEqual(device.halloween)
  })

  it('keeps the Kecleon Eggs, their families and the day’s purchase through the API’s parse, merge and gift check', () => {
    const device = save({
      eggs: [{ tier: 'kecleon', steps: 100 }, { tier: 'kecleonShiny', steps: 0 }],
      hatched: { porygon: { shiny: true }, smeargle: { shiny: false } },
      shop: { ...EMPTY_SAVE.shop, day: '2026-10-21', bought: { kecleonEgg: 4 } },
    })
    const pushed = parseSaveData(JSON.parse(JSON.stringify(device)))
    const stored = keepGiven(applyPush({ save: account, revision: 3 }, { save: pushed, base: 2 }).save, [])
    expect(stored.eggs).toEqual(expect.arrayContaining([{ tier: 'kecleon', steps: 100 }, { tier: 'kecleonShiny', steps: 0 }]))
    expect(stored.hatched).toMatchObject({ porygon: { shiny: true }, smeargle: { shiny: false } })
    expect(stored.shop.bought.kecleonEgg).toBe(4)
  })

  it("hands a reset save to devices that haven't seen the reset, and takes pushes from those that have", () => {
    const wiped = { save: EMPTY_SAVE, revision: 7 }
    expect(applyPush(wiped, { save: account, base: 6 }, 7)).toEqual({ ...wiped, merged: true })
    expect(applyPush(wiped, { save: account, base: null }, 7)).toEqual({ ...wiped, merged: true })
    expect(applyPush(wiped, { save: account, base: 7 }, 7)).toEqual({ save: account, revision: 8, merged: false })
  })
})
