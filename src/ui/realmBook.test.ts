import { describe, expect, it } from 'vitest'
import { STAMP_IDS, STAMP_MILESTONES } from '../data/realmStamps'
import { realmBookEn } from '../i18n/realmStamps/en'
import { realmBookEs } from '../i18n/realmStamps/es'
import { realmBookFr } from '../i18n/realmStamps/fr'
import { realmBookPt } from '../i18n/realmStamps/pt'
import { realmBookZh } from '../i18n/realmStamps/zh'
import { drawErrands } from '../realm/errands'
import { SHEET_ORDER } from '../render/stampArt'
import { stampLook } from './realmBook'

describe('the Livro de Estampas', () => {
  it('keeps a hidden stamp a "?" until it is earned, and a plain one a silhouette', () => {
    expect(stampLook('wetFeet', new Set())).toBe('hidden')
    expect(stampLook('wetFeet', new Set(['wetFeet']))).toBe('earned')
    expect(stampLook('firstSteps', new Set())).toBe('locked')
  })

  it('has one icon for every stamp and reward', () => {
    const wanted = [...STAMP_IDS, ...STAMP_MILESTONES.map((m) => m.reward.id)].sort()
    expect([...SHEET_ORDER].sort()).toEqual(wanted)
  })
})

describe('the Recados', () => {
  it('have words, in every language, for whatever a day can draw', () => {
    const deeds = new Set(Array.from({ length: 500 }, (_, i) => drawErrands(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)).map((e) => e.deed)).flat())
    for (const text of [realmBookPt, realmBookEn, realmBookEs, realmBookFr, realmBookZh]) for (const deed of deeds) expect(Object.keys(text.errands.tasks)).toContain(deed)
  })
})
