import { describe, expect, it } from 'vitest'
import { catalogSections, currencyFor, equip, methodsFor, ownedOnly, shopCatalog, shownPacks, unequip } from './gemShop'

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
