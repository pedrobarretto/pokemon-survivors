import { describe, expect, it } from 'vitest'
import { GEM_CHECKOUT, GEM_PACKS, GEM_PATREON, GEM_PLAY, packGems } from '../data/gems'
import { PATREON_TIERS } from '../data/supporters'
import { checkoutRefusal, lockedCosmetics, playGems, refundedGems, runEarnsGems, wearableLook, type OwnedCosmetic } from './gems'

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
