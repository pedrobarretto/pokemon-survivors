import { describe, expect, it } from 'vitest'
import { catalogSections, currencyFor, dailyPicks, equip, methodsFor, ownedOnly, packFor, sameLook, shopCatalog, shownPacks, takeOff, unequip } from './gemShop'
import { cosmeticPrice, showsIn, slotOf } from '../data/cosmetics'
import { isSkinId } from '../data/skinCatalog'

describe('currencyFor', () => {
  it('shows reais in Brazilian Portuguese or a Brazilian time zone, dollars elsewhere', () => {
    expect(currencyFor('pt-BR', 'Europe/Lisbon')).toBe('brl')
    expect(currencyFor('en-US', 'America/Recife')).toBe('brl')
    expect(currencyFor('es-419', 'America/Mexico_City')).toBe('usd')
    expect(currencyFor('fr-FR', undefined)).toBe('usd')
    expect(methodsFor('usd')).toEqual(['card'])
    expect(methodsFor('brl')[0]).toBe('pix')
  })

  it('offers the welcome pack first, until the account has it', () => {
    expect(shownPacks([])[0]).toBe('welcome')
    expect(shownPacks(['welcome'])).not.toContain('welcome')
    expect(shownPacks(['welcome'])).toContain('pouch')
  })
})

describe('looks', () => {
  it('puts an item in its own slot, takes a slot off and keeps only what is owned', () => {
    const look = equip({}, 'strawHat')
    expect(look).toEqual({ head: 'strawHat' })
    expect(unequip(equip(look, 'sparkTrail'), 'head')).toEqual({ trail: 'sparkTrail' })
    expect(ownedOnly(equip(look, 'sparkTrail'), new Set(['sparkTrail']))).toEqual({ trail: 'sparkTrail' })
  })

  it("wears one skin per line, in place of the line's other", () => {
    const look = equip(equip({}, 'bulbasaurSakura'), 'charmanderSuit')
    expect(equip(look, 'bulbasaurWinter').skins).toEqual(['charmanderSuit', 'bulbasaurWinter'])
    expect(takeOff(look, 'bulbasaurSakura')).toEqual({ skins: ['charmanderSuit'] })
    expect(unequip(look, { line: 'charmander' })).toEqual({ skins: ['bulbasaurSakura'] })
    expect(ownedOnly(look, new Set(['charmanderSuit']))).toEqual({ skins: ['charmanderSuit'] })
    expect(sameLook(look, equip(equip({}, 'bulbasaurSakura'), 'charmanderSuit'))).toBe(true)
  })
})

describe('shopCatalog', () => {
  it('groups what is on sale by slot', () => {
    const slots = shopCatalog('2026-10-29')
    expect(slots.find((s) => s.slot === 'head')?.items).toContain('strawHat')
    expect(slots.every((s) => s.items.length > 0)).toBe(true)
  })

  it('never shows an unsold item the player lacks, and keeps the Arena-only slots apart', () => {
    expect(shopCatalog('2026-11-25').flatMap((s) => s.items)).not.toContain('legendTitle')
    expect(shopCatalog('2026-11-25', new Set(['legendTitle'])).flatMap((s) => s.items)).toContain('legendTitle')
    const { main, arena } = catalogSections(shopCatalog('2026-11-25'))
    expect(arena.map((s) => s.slot).sort()).toEqual(['emote', 'goal', 'ko', 'spawn'])
    expect(main.map((s) => s.slot)).toContain('head')
  })
})

describe('dailyPicks', () => {
  it('draws a look and a skin on sale that day, the same for everyone', () => {
    const picks = dailyPicks('2026-11-20')
    expect(picks).toEqual(dailyPicks('2026-11-20'))
    expect(picks).toHaveLength(2)
    expect(isSkinId(picks[0])).toBe(false)
    expect(isSkinId(picks[1])).toBe(true)
    for (const id of picks) {
      expect(cosmeticPrice(id)).toBeGreaterThan(0)
      expect(showsIn(slotOf(id), 'run')).toBe(true)
    }
    const days = Array.from({ length: 10 }, (_, i) => dailyPicks(`2026-12-${String(i + 1).padStart(2, '0')}`).join())
    expect(new Set(days).size).toBeGreaterThan(1)
  })

  it('skips what the player owns while there is something else, and skins before their launch', () => {
    const [look, skin] = dailyPicks('2026-11-20')
    const next = dailyPicks('2026-11-20', new Set([look!, skin!]))
    expect(next).not.toContain(look)
    expect(next).not.toContain(skin)
    expect(dailyPicks('2026-11-01').some((id) => isSkinId(id))).toBe(false)
  })
})

describe('packFor', () => {
  it('points at the cheapest pack that covers the gems missing', () => {
    expect(packFor(300, [], 'brl')).toBe('welcome')
    expect(packFor(150, ['welcome'], 'usd')).toBe('pouch')
    expect(packFor(450, ['welcome'], 'brl')).toBe('bag')
    expect(packFor(99_999, ['welcome'], 'usd')).toBe('vault')
  })
})
