import { describe, expect, it } from 'vitest'
import { NO_ACHIEVEMENTS } from './achievements'
import { buyUpgrade, EMPTY_SAVE, NO_RANKS, parseSaveData, refundAll, upgradePrice, type Save } from './meta'
import { keepGiven } from './gifts'
import { bagCount } from './bag'
import { buyFromVitrine, buyKecleonEgg, buyStyle, claimGift, investInShop, vitrineCards, vitrineOf } from './shop'
import { NO_PATHS } from './legendPaths'
import { applyPush, behind, mergeSaves, pushBuild, takesRevision, type Stored } from './sync'
import { buyQuick, buySlot, useQuick } from './incubator'
import { hatchEgg } from './eggs'
import { createRng } from '../engine/rng'

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

  it('keeps the waiting line, moving its rarest eggs into the slots the merged incubator has free, never counting one twice', () => {
    const line = [{ tier: 'ultra' as const, steps: 0 }, { tier: 'rare' as const, steps: 0 }]
    const full = save({ eggs: Array.from({ length: 3 }, () => ({ tier: 'common' as const, steps: 0 })), eggQueue: line })
    const slotted = save({ incubator: { ...EMPTY_SAVE.incubator, slots: 1 }, shop: { ...EMPTY_SAVE.shop, level: 2 } })
    const m = mergeSaves(full, slotted)
    expect(m.eggs.slice(0, 2)).toEqual(line)
    expect(m.eggQueue).toEqual([{ tier: 'common', steps: 0 }])
    expect(mergeSaves(m, full)).toEqual(m)
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
    expect(applyPush(null, { save: guest, base: null, build: null })).toEqual({ save: guest, revision: 1, build: null, merged: false })
  })

  it('takes a push on top of the latest revision as is, so spending and hatching stick', () => {
    const refunded = refundAll(account)
    expect(applyPush({ save: account, revision: 4, build: null }, { save: refunded, base: 4, build: null })).toEqual({ save: refunded, revision: 5, build: null, merged: false })
  })

  it('merges a blank save pushed on top of the latest revision instead of wiping the account', () => {
    // A device whose local save was lost but whose account link (and revision) survived.
    const out = applyPush({ save: account, revision: 4, build: null }, { save: EMPTY_SAVE, base: 4, build: null })
    expect(out).toEqual({ save: mergeSaves(account, EMPTY_SAVE), revision: 5, build: null, merged: true })
    expect(out.save.hatched).toEqual(account.hatched)
  })

  it('merges a push from an older revision', () => {
    const out = applyPush({ save: account, revision: 4, build: null }, { save: guest, base: 2, build: null })
    expect(out).toEqual({ save: mergeSaves(account, guest), revision: 5, build: null, merged: true })
  })

  it('keeps the Haunted Egg, its families and the candies spent through the API’s parse, merge and gift check', () => {
    const device = save({ eggs: [{ tier: 'haunted', steps: 100 }], hatched: { litwick: { shiny: true }, sandygast: { shiny: false } }, halloween: { candies: 900, spent: 300, hunted: [] } })
    // As `server/src/app.ts` and `db.ts` do: parse the body, apply the push, then keep only what gifts brought.
    const pushed = parseSaveData(JSON.parse(JSON.stringify(device)))
    const stored = keepGiven(applyPush({ save: account, revision: 3, build: null }, { save: pushed, base: 2, build: null }).save, [])
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
    const stored = keepGiven(applyPush({ save: account, revision: 3, build: null }, { save: pushed, base: 2, build: null }).save, [])
    expect(stored.eggs).toEqual(expect.arrayContaining([{ tier: 'kecleon', steps: 100 }, { tier: 'kecleonShiny', steps: 0 }]))
    expect(stored.hatched).toMatchObject({ porygon: { shiny: true }, smeargle: { shiny: false } })
    expect(stored.shop.bought.kecleonEgg).toBe(4)
  })

  it("hands a reset save to devices that haven't seen the reset, and takes pushes from those that have", () => {
    const wiped = { save: EMPTY_SAVE, revision: 7, build: null }
    expect(applyPush(wiped, { save: account, base: 6, build: null }, 7)).toEqual({ ...wiped, merged: true })
    expect(applyPush(wiped, { save: account, base: null, build: null }, 7)).toEqual({ ...wiped, merged: true })
    expect(applyPush(wiped, { save: account, base: 7, build: null }, 7)).toEqual({ save: account, revision: 8, build: null, merged: false })
  })

  // What a build from before the legend paths and Palkia kept of the account's save: its parse drops what it doesn't know.
  const current = save({ legends: { kyogre: 2, palkia: 1 }, paths: { ...NO_PATHS, cells: 40, cores: 2, nuts: 120 } })
  const stripped = save({ legends: { kyogre: 2 } })

  it('merges a push from an older build on top of the latest revision, every time, so it never drops what it can’t read', () => {
    const first = applyPush({ save: current, revision: 4, build: 2000 }, { save: stripped, base: 4, build: 1000 })
    expect(first).toMatchObject({ revision: 5, build: 2000, merged: true })
    expect(first.save.legends).toEqual(current.legends)
    expect(first.save.paths).toEqual(current.paths)
    // The old build reads the merged save back, strips it again and pushes on top of it.
    const again = applyPush(first, { save: stripped, base: 5, build: 1000 })
    expect(again).toMatchObject({ revision: 6, build: 2000, merged: true })
    expect(again.save.legends).toEqual(current.legends)
  })

  it('keeps an egg an older build hatched on top of the latest revision hatched, push after push', () => {
    const incubating = { ...current, eggs: [{ tier: 'rare', steps: 4000 }, { tier: 'common', steps: 2000 }], eggPity: { rare: 5 } } satisfies Save
    const device = hatchEgg(parseSaveData(JSON.parse(JSON.stringify({ ...incubating, legends: stripped.legends, paths: undefined }))), 0, createRng(1))
    expect(device).not.toBeNull()
    const hatched = device?.save ?? stripped
    const first = applyPush({ save: incubating, revision: 4, build: 2000 }, { save: hatched, base: 4, build: null })
    expect(first).toMatchObject({ revision: 5, merged: true })
    expect(first.save.eggs).toEqual([{ tier: 'common', steps: 2000 }])
    expect(first.save.eggPity).toEqual(hatched.eggPity)
    expect(first.save.legends).toEqual(current.legends)
    // The old build takes the stored save back and pushes on top of it again.
    expect(applyPush(first, { save: { ...first.save, paths: NO_PATHS }, base: 5, build: null }).save.eggs).toEqual([{ tier: 'common', steps: 2000 }])
  })

  it('merges a push from a game too old to send its build once a build stored the save', () => {
    const refunded = refundAll(current)
    expect(applyPush({ save: current, revision: 4, build: 2000 }, { save: refunded, base: 4, build: null })).toMatchObject({ build: 2000, merged: true })
    expect(applyPush({ save: current, revision: 4, build: null }, { save: refunded, base: 4, build: null }).merged).toBe(false)
  })

  it('takes a push from the same or a newer build on top of the latest revision as is, and keeps the newest build', () => {
    const refunded = refundAll(current)
    expect(applyPush({ save: current, revision: 4, build: 2000 }, { save: refunded, base: 4, build: 2000 })).toEqual({ save: refunded, revision: 5, build: 2000, merged: false })
    expect(applyPush({ save: current, revision: 4, build: null }, { save: refunded, base: 4, build: 3000 })).toEqual({ save: refunded, revision: 5, build: 3000, merged: false })
  })

  it('merges a save without a stored capture or path progress, whatever build it says it is', () => {
    expect(applyPush({ save: current, revision: 4, build: null }, { save: stripped, base: 4, build: null }).save.legends).toEqual(current.legends)
    expect(behind(stripped, current)).toBe(true)
    expect(behind({ ...current, legends: { kyogre: 1, palkia: 1 } }, current)).toBe(true)
    expect(behind({ ...current, paths: { ...current.paths, nuts: 119 } }, current)).toBe(true)
    expect(behind({ ...current, legends: { ...current.legends, lugia: 1 }, paths: { ...current.paths, cells: 41 } }, current)).toBe(false)
  })

  it('counts Cosmog’s runs as progress only while it’s the same Cosmog', () => {
    const raising = save({ paths: { ...NO_PATHS, cosmog: { ...NO_PATHS.cosmog, runs: 6, sun: 4, moon: 2 } } })
    const grown = save({ paths: { ...NO_PATHS, cosmog: { ...NO_PATHS.cosmog, raised: ['solgaleo'] } } })
    expect(behind(save({ paths: { ...NO_PATHS, cosmog: { ...NO_PATHS.cosmog, runs: 5 } } }), raising)).toBe(true)
    expect(behind(grown, raising)).toBe(false)
    expect(behind(raising, grown)).toBe(true)
  })
})

/**
 * Two devices of one account, each with its own save and the revision it last
 * took, syncing through `applyPush` as `push` in `account.ts` does
 * (`takesRevision`); `refuse` stands for a full storage refusing the write.
 */
describe('two devices with different saves', () => {
  type Device = { save: Save; revision: number | null; refuse?: boolean }
  const sync = (stored: Stored | null, device: Device): Stored & { merged: boolean } => {
    const out = applyPush(stored, { save: device.save, base: device.revision, build: null })
    const written = !device.refuse
    if (written) device.save = out.save
    if (takesRevision(true, written, out.merged)) device.revision = out.revision
    return out
  }
  const played = (s: Save, patch: Partial<Save>, runs: number): Save => ({
    ...s,
    ...patch,
    achievements: { ...s.achievements, lifetime: { ...s.achievements.lifetime, runs: s.achievements.lifetime.runs + runs } },
  })

  it('brings the afternoon on one device into the evening on the other, and both end the same', () => {
    const pc1: Device = { save: guest, revision: null }
    const pc2: Device = { save: account, revision: null }
    let stored = sync(null, pc2)
    stored = sync(stored, pc1)
    // Afternoon on PC 1: a run, a family hatched, a species caught.
    pc1.save = played(pc1.save, { hatched: { ...pc1.save.hatched, axew: { shiny: false } }, dex: { ...pc1.save.dex, 610: [3, 1] } }, 1)
    stored = sync(stored, pc1)
    // Evening on PC 2, which played offline meanwhile and never saw PC 1's afternoon.
    pc2.save = played(pc2.save, { hatched: { ...pc2.save.hatched, dratini: { shiny: true } } }, 2)
    stored = sync(stored, pc2)
    expect(pc2.save.hatched).toMatchObject({ axew: { shiny: false }, dratini: { shiny: true }, eevee: { shiny: true }, gible: { shiny: false } })
    expect(pc2.save.dex[610]).toEqual([3, 1])
    // Lifetime records keep the larger side: PC 2's own runs, counted from the account's.
    expect(pc2.save.achievements.lifetime.runs).toBe(account.achievements.lifetime.runs + 2)
    stored = sync(stored, pc1)
    expect(pc1.save).toEqual(pc2.save)
    expect(stored.save).toEqual(pc2.save)
  })

  it('keeps the account’s families when a device writes an older copy over the save a sync brought, and keeps its purchase', () => {
    const pc1: Device = { save: account, revision: null }
    let stored = sync(null, pc1)
    const pc2: Device = { save: stored.save, revision: stored.revision }
    // PC 1 hatches a family from a gift (no run), and PC 2 syncs it in.
    pc1.save = { ...pc1.save, hatched: { ...pc1.save.hatched, axew: { shiny: true } }, gifts: [...pc1.save.gifts, 'gift-c'] }
    stored = sync(stored, pc1)
    const held = pc2.save
    stored = sync(stored, pc2)
    expect(pc2.save.hatched.axew).toEqual({ shiny: true })
    // A screen still holding the save from before writes it back with a Vitrine buy, on top of the latest revision.
    pc2.save = buyStyle(held, 'background', 'meadow') ?? held
    stored = sync(stored, pc2)
    expect(stored.save.hatched.axew).toEqual({ shiny: true })
    expect(stored.save.gifts).toContain('gift-c')
    expect(stored.save.style.owned.background).toContain('meadow')
    expect(stored.save.spent).toBe(pc2.save.spent)
  })

  it('never lets a device whose storage refused the synced save replace the account’s with the one it kept', () => {
    const pc1: Device = { save: account, revision: null }
    let stored = sync(null, pc1)
    const pc2: Device = { save: guest, revision: null, refuse: true }
    stored = sync(stored, pc2)
    // The merge never landed on PC 2, so it keeps no revision to push on top of.
    expect(pc2.save).toEqual(guest)
    expect(pc2.revision).toBeNull()
    pc2.refuse = false
    pc2.save = played(pc2.save, {}, 1)
    stored = sync(stored, pc2)
    expect(Object.keys(stored.save.hatched)).toEqual(expect.arrayContaining(Object.keys(account.hatched)))
    expect(stored.save.titles).toEqual(account.titles)
    expect(pc2.save).toEqual(stored.save)
  })

  it('keeps a family a build too old to know it dropped, once a current build pushes on top', () => {
    const pc1: Device = { save: { ...account, hatched: { ...account.hatched, axew: { shiny: false } } }, revision: null }
    let stored = sync(null, pc1)
    // An open tab of an older build reads the account's save without the family it doesn't know, and takes it.
    const { axew: _, ...known } = stored.save.hatched
    pc1.save = { ...stored.save, hatched: known }
    pc1.revision = stored.revision
    // The reloaded tab, on the current build, pushes that save on top of the latest revision.
    stored = sync(stored, pc1)
    expect(stored.merged).toBe(true)
    expect(stored.save.hatched.axew).toEqual({ shiny: false })
  })
})

describe('behind', () => {
  const stored = save({
    hatched: { eevee: { shiny: false } },
    dex: { 25: [4, 1] },
    achievements: { unlocked: ['firstRun'], lifetime: NO_ACHIEVEMENTS.lifetime },
    shinyStarters: { pichu: false },
    clears: { charmander: 'hard' },
    gifts: ['gift-a'],
    titles: ['ambassador'],
    evo: ['iceStone'],
  })

  it('takes a save with all of the account’s collection and more, spending and all', () => {
    const more = { ...stored, wallet: 0, spent: 900, hatched: { ...stored.hatched, gible: { shiny: true } }, dex: { 25: [9, 3], 1: [1, 0] } } satisfies Save
    expect(behind(more, stored)).toBe(false)
    expect(applyPush({ save: stored, revision: 4, build: null }, { save: more, base: 4, build: null })).toMatchObject({ save: more, merged: false })
  })

  it('finds the collection a save lacks: a family, a species or a catch, a medal, a shiny, a clear, a gift, an item', () => {
    expect(behind({ ...stored, hatched: {} }, stored)).toBe(true)
    expect(behind({ ...stored, dex: {} }, stored)).toBe(true)
    expect(behind({ ...stored, dex: { 25: [4, 0] } }, stored)).toBe(true)
    expect(behind({ ...stored, dex: { 25: [3, 1] } }, stored)).toBe(true)
    expect(behind({ ...stored, achievements: NO_ACHIEVEMENTS }, stored)).toBe(true)
    expect(behind({ ...stored, shinyStarters: {} }, stored)).toBe(true)
    expect(behind({ ...stored, clears: { charmander: 'normal' } }, stored)).toBe(true)
    expect(behind({ ...stored, gifts: [] }, stored)).toBe(true)
    expect(behind({ ...stored, titles: [] }, stored)).toBe(true)
    expect(behind({ ...stored, evo: [] }, stored)).toBe(true)
  })
})

describe('takesRevision', () => {
  it('moves the revision only with a save the device holds', () => {
    expect(takesRevision(true, true, true)).toBe(true)
    expect(takesRevision(true, false, false)).toBe(false)
    expect(takesRevision(false, false, false)).toBe(true)
    expect(takesRevision(false, false, true)).toBe(false)
  })
})

describe('pushBuild', () => {
  it('takes a build no later than a day ahead of the clock, and nothing else', () => {
    const now = 1_800_000_000_000
    expect([1_790_000_000, 1_800_086_400, 1_800_086_401, 0, -5, 1.5, '1790000000', null, undefined].map((b) => pushBuild(b, now))).toEqual([1_790_000_000, 1_800_086_400, null, null, null, null, null, null, null])
  })
})
