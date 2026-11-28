import { describe, expect, it } from 'vitest'
import { FIND_ODDS, REPEAT_SHINY } from '../data/seasonOneUnlocks'
import { applyGift } from './gifts'
import { isGameGift } from './gameGifts'
import { EMPTY_SAVE, type Save } from './meta'
import { countsAsPartner, featFamilies, graveFind, mergeFinds, mergeResearch, newFeatFamily, NO_RESEARCH, parseFinds, parseResearch, recordResearch, repeatFeatFamily, repeatShinyHit, repeatShinyOpen, researchStatus, rollFind, seasonGifts, tvShinyRoll, type ResearchRun } from './seasonOneUnlocks'
import { mergeSaves } from './sync'

const win = (over: Partial<ResearchRun> = {}): ResearchRun => ({ starter: 'charmander', victory: true, hits: 0, wet: false, ...over })

describe('map encounters', () => {
  it('rolls from the seed alone, near the table’s odds', () => {
    const seeds = Array.from({ length: 20_000 }, (_, i) => i * 7919 + 13)
    for (const find of ['rotom', 'castform'] as const) {
      const share = seeds.filter((s) => rollFind(s, find)).length / seeds.length
      expect(share).toBeCloseTo(FIND_ODDS[find], 1)
      expect(rollFind(42, find)).toBe(rollFind(42, find))
    }
  })

  it('keeps only known finds and merges them as a union', () => {
    expect(parseFinds(['rotom', 'nope', 'rotom'])).toEqual(['rotom'])
    expect(mergeFinds(['castform'], ['rotom'])).toEqual(mergeFinds(['rotom'], ['castform']))
  })
})

describe('research', () => {
  it('moves a chain one step a win, once per run recorded', () => {
    const run = win({ hits: 200, wet: true })
    const once = recordResearch(NO_RESEARCH, run, null)
    expect(once).toMatchObject({ mankey: 1, goomy: 1 })
    expect(recordResearch(once, run, run)).toBe(once)
  })

  it('ignores a run that was not won', () => {
    expect(recordResearch(NO_RESEARCH, win({ victory: false, hits: 500, wet: true }), null)).toBe(NO_RESEARCH)
  })

  it('asks the step under way for its own number of hits', () => {
    const one = recordResearch(NO_RESEARCH, win({ hits: 30 }), null)
    expect(one.mankey).toBe(1)
    expect(recordResearch(one, win({ hits: 59 }), null).mankey).toBe(1)
    expect(recordResearch(one, win({ hits: 60 }), null).mankey).toBe(2)
  })

  it('counts each Water or Dragon partner once, and no legends', () => {
    expect(countsAsPartner('squirtle')).toBe(true)
    expect(countsAsPartner('charmander')).toBe(false)
    expect(countsAsPartner('kyogre')).toBe(false)
    const one = recordResearch(NO_RESEARCH, win({ starter: 'squirtle' }), null)
    expect(one.partners).toEqual(['squirtle'])
    expect(recordResearch(one, win({ starter: 'squirtle' }), null).partners).toEqual(['squirtle'])
  })

  it('merges to the side further along, the same either way, and parses clamped', () => {
    const a = { mankey: 2, goomy: 0, partners: ['squirtle'] as const }
    const b = { mankey: 1, goomy: 3, partners: ['dratini'] as const }
    expect(mergeResearch(a, b)).toEqual(mergeResearch(b, a))
    expect(mergeResearch(a, b)).toMatchObject({ mankey: 2, goomy: 3 })
    expect(parseResearch({ mankey: 99, goomy: -1, partners: ['nope', 'squirtle'] })).toEqual({ mankey: 3, goomy: 0, partners: ['squirtle'] })
    expect(parseResearch(null)).toEqual(NO_RESEARCH)
  })

  it('shows the step under way', () => {
    expect(researchStatus({ ...NO_RESEARCH, goomy: 1 }, 'goomy').steps.map((s) => [s.done, s.current])).toEqual([[true, false], [false, true], [false, false]])
    expect(researchStatus({ ...NO_RESEARCH, goomy: 3 }, 'goomy').complete).toBe(true)
  })
})

describe('the gifts they earn', () => {
  it('gives a family once, from an encounter or a finished chain, as the game’s own gift', () => {
    const save = { ...EMPTY_SAVE, finds: ['rotom' as const], research: { ...NO_RESEARCH, goomy: 3 } }
    const gifts = seasonGifts(save)
    expect(gifts.map((g) => g.content)).toEqual([{ kind: 'family', family: 'rotom' }, { kind: 'family', family: 'goomy' }])
    expect(gifts.every((g) => isGameGift(g.id))).toBe(true)
    const out = applyGift(save, gifts[0]!)
    if (out.status !== 'applied') throw new Error(out.status)
    expect(out.save.hatched.rotom).toEqual({ shiny: false })
    expect(seasonGifts(out.save).map((g) => g.content)).toEqual([{ kind: 'family', family: 'goomy' }])
  })

  it('survives a save merge', () => {
    const a = { ...EMPTY_SAVE, finds: ['castform' as const] }
    const b = { ...EMPTY_SAVE, research: { ...NO_RESEARCH, mankey: 3 } }
    const merged = mergeSaves(a, b)
    expect(merged.finds).toEqual(['castform'])
    expect(merged.research.mankey).toBe(3)
  })
})

describe('mini game feats', () => {
  it('brings Wishiwashi the first time only', () => {
    expect(featFamilies('fishing', ['feebas', 'wishiwashi'])).toEqual(['wishiwashi'])
    expect(newFeatFamily('fishing', [], ['wishiwashi'])).toBe('wishiwashi')
    expect(newFeatFamily('fishing', ['wishiwashi'], ['wishiwashi'])).toBeNull()
    expect(newFeatFamily('berryCatch', [], ['wishiwashi'])).toBeNull()
  })
})

describe('shinies on repeat finds', () => {
  it('opens only for an owner without the shiny', () => {
    expect(repeatShinyOpen({}, 'rotom')).toBe(false)
    expect(repeatShinyOpen({ rotom: { shiny: false } }, 'rotom')).toBe(true)
    expect(repeatShinyOpen({ rotom: { shiny: true } }, 'rotom')).toBe(false)
  })

  it('rolls Rotom’s from the seed near its odds, apart from the TV’s own draw', () => {
    const seeds = Array.from({ length: 40_000 }, (_, i) => i * 7919 + 13)
    const hits = (pick: (s: number) => boolean) => seeds.filter(pick).length
    expect(hits((s) => repeatShinyHit('rotom', tvShinyRoll(s))) / seeds.length).toBeCloseTo(REPEAT_SHINY.rotom, 2)
    // Among the runs whose TV flickers, the shiny lands as often as anywhere.
    const tv = seeds.filter((s) => rollFind(s, 'rotom'))
    expect(tv.filter((s) => repeatShinyHit('rotom', tvShinyRoll(s))).length / tv.length).toBeCloseTo(REPEAT_SHINY.rotom, 1)
  })

  it('finds a repeat Wishiwashi only once it was hooked before', () => {
    expect(repeatFeatFamily('fishing', [], ['wishiwashi'])).toBeNull()
    expect(repeatFeatFamily('fishing', ['wishiwashi'], ['feebas'])).toBeNull()
    expect(repeatFeatFamily('fishing', ['wishiwashi'], ['wishiwashi'])).toBe('wishiwashi')
  })

  it('waits as a game-made shiny hatch once banked, and survives a merge', () => {
    const save = mergeSaves({ ...EMPTY_SAVE, finds: ['rotom' as const], hatched: { rotom: { shiny: false } }, gifts: ['season:rotom'] }, { ...EMPTY_SAVE, shinyFinds: ['rotom' as const] })
    const [gift] = seasonGifts(save)
    expect(gift?.content).toEqual({ kind: 'shinyHatch', family: 'rotom' })
    expect(isGameGift(gift!.id)).toBe(true)
    const out = applyGift(save, gift!)
    if (out.status !== 'applied') throw new Error(out.status)
    expect(out.save.hatched.rotom).toEqual({ shiny: true })
    expect(seasonGifts(out.save)).toEqual([])
  })
})

describe('a graveyard Spiritomb', () => {
  const none = { finds: [], shinyFinds: [], hatched: {} }

  it('brings the family on the first win, and its shiny when the one beaten was shiny', () => {
    expect(graveFind(none, false)).toEqual({ family: true, shiny: false })
    expect(graveFind(none, true)).toEqual({ family: true, shiny: true })
  })

  it('brings the shiny on a repeat win too, to an owner without it', () => {
    const owner = { finds: ['spiritomb' as const], shinyFinds: [], hatched: { spiritomb: { shiny: false } } }
    expect(graveFind(owner, false)).toEqual({ family: false, shiny: false })
    expect(graveFind(owner, true)).toEqual({ family: false, shiny: true })
  })

  it('never banks the shiny twice: owned, or already waiting in the gift box', () => {
    expect(graveFind({ finds: ['spiritomb' as const], shinyFinds: [], hatched: { spiritomb: { shiny: true } } }, true).shiny).toBe(false)
    expect(graveFind({ finds: ['spiritomb' as const], shinyFinds: ['spiritomb' as const], hatched: {} }, true).shiny).toBe(false)
  })

  it('opens as both gifts on a first shiny win: the family, then its shiny', () => {
    let save: Save = { ...EMPTY_SAVE, finds: ['spiritomb'], shinyFinds: ['spiritomb'] }
    expect(seasonGifts(save).map((g) => g.content)).toEqual([
      { kind: 'family', family: 'spiritomb' },
      { kind: 'shinyHatch', family: 'spiritomb' },
    ])
    for (const gift of seasonGifts(save)) {
      const out = applyGift(save, gift)
      if (out.status !== 'applied') throw new Error(out.status)
      save = out.save
    }
    expect(save.hatched.spiritomb).toEqual({ shiny: true })
    expect(seasonGifts(save)).toEqual([])
  })
})
