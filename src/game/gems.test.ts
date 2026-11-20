import { describe, expect, it } from 'vitest'
import { GEM_CHECKOUT, GEM_PACKS, GEM_PATREON, GEM_PLAY, GEM_PROMOS, packGems, packGemsOn, promoOf } from '../data/gems'
import { addDays } from './day'
import { PATREON_TIERS } from '../data/supporters'
import { bundleLastDay, bundleOnSale, bundlePrice, checkoutRefusal, lockedCosmetics, playGems, refundedGems, runEarnsGems, wearableLook, type OwnedCosmetic } from './gems'

describe('playGems', () => {
  it('gives the match and the win until the daily cap', () => {
    const { match, win, daily } = GEM_PLAY.arena
    expect(playGems(false, 0)).toBe(match)
    expect(playGems(true, 0)).toBe(match + win)
    expect(playGems(true, daily - 3)).toBe(3)
    expect(playGems(true, daily)).toBe(0)
    expect(playGems(false, daily + 10)).toBe(0)
  })

  it('counts a run for the day only from its fifth minute', () => {
    expect(runEarnsGems(GEM_PLAY.run.seconds - 1)).toBe(false)
    expect(runEarnsGems(GEM_PLAY.run.seconds)).toBe(true)
  })
})

describe('checkoutRefusal', () => {
  it('sells a once pack once and stops at the day’s limit in each currency', () => {
    expect(checkoutRefusal('welcome', 'brl', 0, false)).toBeNull()
    expect(checkoutRefusal('welcome', 'brl', 0, true)).toBe('once')
    expect(checkoutRefusal('pouch', 'brl', 0, true)).toBeNull()
    expect(checkoutRefusal('vault', 'brl', 0, false)).toBeNull()
    expect(checkoutRefusal('pouch', 'brl', GEM_PACKS.vault.brl, false)).toBe('cap')
    expect(checkoutRefusal('vault', 'usd', 0, false)).toBeNull()
    expect(checkoutRefusal('pouch', 'usd', GEM_CHECKOUT.daily.usd - GEM_PACKS.pouch.usd, false)).toBeNull()
    expect(checkoutRefusal('pouch', 'usd', GEM_CHECKOUT.daily.usd - GEM_PACKS.pouch.usd + 1, false)).toBe('cap')
  })
})

describe('Patreon gems', () => {
  it('match the pack of the same price', () => {
    for (const tier of ['supporter', 'gold', 'diamond'] as const) {
      const pack = Object.values(GEM_PACKS).find((p) => p.usd === PATREON_TIERS[tier] - 1)
      expect(pack && pack.gems + pack.bonus).toBe(GEM_PATREON[tier])
    }
    expect(packGems('bag')).toBe(GEM_PATREON.supporter)
  })
})

describe('refundedGems', () => {
  it('takes back in proportion, the whole pack on a full refund', () => {
    expect(refundedGems(550, 2490, 2490)).toBe(550)
    expect(refundedGems(550, 2490, 1245)).toBe(275)
    expect(refundedGems(550, 2490, 1)).toBe(1)
    expect(refundedGems(550, 2490, 9999)).toBe(550)
  })
})

describe('wearableLook', () => {
  it('keeps only owned ids in their own slot', () => {
    expect(wearableLook({ head: 'strawHat', trail: 'sparkTrail' }, new Set(['strawHat']))).toEqual({ head: 'strawHat' })
    expect(wearableLook({ head: 'sparkTrail' }, new Set(['sparkTrail']))).toEqual({})
    expect(wearableLook('nope', new Set())).toEqual({})
  })

  it('keeps only owned skins', () => {
    expect(wearableLook({ skins: ['charmanderSuit', 'bulbasaurAutumn'] }, new Set(['bulbasaurAutumn']))).toEqual({ skins: ['bulbasaurAutumn'] })
    expect(wearableLook({ head: 'strawHat', skins: ['charmanderSuit'] }, new Set(['strawHat']))).toEqual({ head: 'strawHat' })
  })
})

describe('bundlePrice', () => {
  it("takes the owned seasons' share off a line's collection, and stops once it's all owned", () => {
    expect(bundlePrice('bulbasaurSeasons', new Set())).toBe(1200)
    expect(bundlePrice('bulbasaurSeasons', new Set(['bulbasaurSakura']))).toBe(800)
    expect(bundlePrice('bulbasaurSeasons', new Set(['bulbasaurSakura', 'bulbasaurWinter', 'charmanderSuit']))).toBe(400)
    expect(bundlePrice('bulbasaurSeasons', new Set(['bulbasaurSakura', 'bulbasaurAutumn', 'bulbasaurWinter']))).toBeNull()
    expect(bundlePrice('phantumpSeasons', new Set())).toBe(900)
    expect(bundlePrice('phantumpSeasons', new Set(['phantumpAutumn']))).toBe(600)
    expect(bundlePrice('phantumpSeasons', new Set(['phantumpAutumn', 'phantumpSakura']))).toBe(300)
  })

  it("scales a season's launch offer by its missing skins' own prices, never above them", () => {
    expect(bundlePrice('autumnLaunch', new Set())).toBe(2600)
    // 2600 × (4650 − 550) / 4650, to 10 gems; 2600 × (4650 − 400) / 4650.
    expect(bundlePrice('autumnLaunch', new Set(['bulbasaurAutumn']))).toBe(2290)
    expect(bundlePrice('autumnLaunch', new Set(['shroomishAutumn']))).toBe(2380)
    const allButOne = new Set(['bulbasaurAutumn', 'chikoritaAutumn', 'treeckoAutumn', 'turtwigAutumn', 'budewAutumn', 'rowletAutumn', 'sprigatitoAutumn', 'shroomishAutumn'])
    expect(bundlePrice('autumnLaunch', allButOne)).toBeLessThan(400)
  })

  it('sells the launch offers for their 14 days only, and the collections from launch on', () => {
    expect(bundleLastDay('sakuraLaunch')).toBe('2026-11-18')
    expect(bundleOnSale('sakuraLaunch', '2026-11-04')).toBe(false)
    expect(bundleOnSale('sakuraLaunch', '2026-11-05')).toBe(true)
    expect(bundleOnSale('sakuraLaunch', '2026-11-18')).toBe(true)
    expect(bundleOnSale('sakuraLaunch', '2026-11-19')).toBe(false)
    expect(bundleOnSale('bulbasaurSeasons', '2027-03-01')).toBe(true)
  })
})

describe('lockedCosmetics', () => {
  const owned: OwnedCosmetic[] = [
    { id: 'strawHat', source: 'buy', at: 100 },
    { id: 'sparkTrail', source: 'buy', at: 200 },
    { id: 'crown', source: 'gift', at: 300 },
  ]

  it('locks what gems bought from the taken-back pack on, while the balance is negative', () => {
    expect(lockedCosmetics(-550, owned, 200)).toEqual(['sparkTrail'])
    expect(lockedCosmetics(-550, owned, 50)).toEqual(['sparkTrail', 'strawHat'])
  })

  it('never locks a gift, nor anything once the balance is back to 0 or no pack was taken back', () => {
    expect(lockedCosmetics(-1, owned, 0)).not.toContain('crown')
    expect(lockedCosmetics(0, owned, 0)).toEqual([])
    expect(lockedCosmetics(-1, owned, null)).toEqual([])
  })
})

describe('gem promos', () => {
  it('adds Black Friday’s half to every paid pack but the welcome pack, from its first day to its last', () => {
    expect(promoOf('2026-11-26')).toBeNull()
    expect(promoOf('2026-11-27')?.name).toBe('blackFriday')
    expect(promoOf('2026-11-30')?.name).toBe('blackFriday')
    expect(promoOf('2026-12-01')).toBeNull()
    expect(packGemsOn('pouch', '2026-11-28')).toBe(300)
    expect(packGemsOn('bag', '2026-11-28')).toBe(825)
    expect(packGemsOn('welcome', '2026-11-28')).toBe(packGems('welcome'))
    expect(packGemsOn('pouch', '2026-11-26')).toBe(packGems('pouch'))
  })

  it('never overlap', () => {
    GEM_PROMOS.forEach((p, i) => {
      expect(p.from <= p.to).toBe(true)
      const next = GEM_PROMOS[i + 1]
      if (next) expect(addDays(p.to, 1) <= next.from).toBe(true)
    })
  })
})
