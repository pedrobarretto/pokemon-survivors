import { describe, expect, it } from 'vitest'
import { EMPTY_SAVE, parseSave, SAVE_VERSION, type Save } from './meta'
import { savedSupporterTier } from './supporters'
import { hallPokemon, trainerAvatar } from './trainer'

const supporter: Save = { ...EMPTY_SAVE, titles: ['supporter'] }

describe('trainerAvatar', () => {
  it('shows the partner at its final stage, shiny only when picked', () => {
    expect(trainerAvatar({ ...EMPTY_SAVE, partner: 'squirtle' }, null)).toEqual({ dex: 9, shiny: false })
    expect(trainerAvatar(EMPTY_SAVE, null)).toEqual({ dex: 6, shiny: false })
    expect(trainerAvatar({ ...EMPTY_SAVE, shinyStarters: { charmander: true } }, null)).toEqual({ dex: 6, shiny: true })
    expect(trainerAvatar({ ...EMPTY_SAVE, shinyStarters: { charmander: false } }, null)).toEqual({ dex: 6, shiny: false })
  })

  it("prefers a supporter's companion, if it can still walk along", () => {
    expect(trainerAvatar({ ...supporter, companion: { id: 'squirtle', shiny: false } }, 'supporter')).toEqual({ dex: 9, shiny: false })
    // Not a supporter (any more), or a shiny not owned: back to the partner.
    expect(trainerAvatar({ ...supporter, companion: { id: 'squirtle', shiny: false } }, null).dex).toBe(6)
    expect(trainerAvatar({ ...supporter, companion: { id: 'squirtle', shiny: true } }, 'supporter').dex).toBe(6)
  })
})

describe('partner', () => {
  it('survives a reload, and an unknown or missing one falls back to Charmander', () => {
    const load = (partner: unknown) => parseSave(JSON.stringify({ ...EMPTY_SAVE, version: SAVE_VERSION, partner })).partner
    expect(load('gible')).toBe('gible')
    for (const bad of [undefined, 'missingno', 'toString', 7]) expect(load(bad)).toBe('charmander')
  })
})

describe('savedSupporterTier', () => {
  it('reads the tier from the thank-you gifts', () => {
    expect(savedSupporterTier(EMPTY_SAVE)).toBeNull()
    expect(savedSupporterTier(supporter)).toBe('supporter')
    const gold = { ...supporter, style: { ...supporter.style, owned: { ...supporter.style.owned, background: ['supporter'] as const } } }
    expect(savedSupporterTier(gold)).toBe('gold')
  })
})

describe('hallPokemon', () => {
  it('shows a shiny picked with a ticket first, then the companion, then the partner', () => {
    const picked: Save = { ...supporter, shinyPicks: [{ id: 'a', pick: 'gible' }, { id: 'b', pick: null }], companion: { id: 'squirtle', shiny: false } }
    expect(hallPokemon(picked, 'supporter')).toEqual({ id: 'gible', shiny: true })
    expect(hallPokemon({ ...picked, shinyStarters: { gible: false } }, 'supporter')).toEqual({ id: 'gible', shiny: false })
    expect(hallPokemon({ ...picked, shinyPicks: [{ id: 'b', pick: null }] }, 'supporter')).toEqual({ id: 'squirtle', shiny: false })
    expect(hallPokemon({ ...supporter, partner: 'bulbasaur', shinyStarters: { bulbasaur: true } }, 'supporter')).toEqual({ id: 'bulbasaur', shiny: true })
  })

  it('skips a companion the save can no longer walk with', () => {
    expect(hallPokemon({ ...supporter, companion: { id: 'squirtle', shiny: true } }, 'supporter')).toEqual({ id: 'charmander', shiny: false })
  })

  it('reads a save the API trimmed to a few fields', () => {
    const trimmed = parseSave(JSON.stringify({ version: SAVE_VERSION, partner: 'pichu', shinyPicks: [{ id: 'x', pick: 'eevee' }] }))
    expect(hallPokemon(trimmed, 'supporter')).toEqual({ id: 'eevee', shiny: true })
  })
})
