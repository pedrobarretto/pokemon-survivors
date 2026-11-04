import { describe, expect, it } from 'vitest'
import { collectionsOn, filterPage, isFresh, pageOf } from './catalog'

describe('isFresh', () => {
  it('marks a dated piece NOVO for two weeks from its day, and never before it', () => {
    expect(isFresh('fireRedCover', '2026-11-03')).toBe(false)
    expect(isFresh('fireRedCover', '2026-11-04')).toBe(true)
    expect(isFresh('fireRedCover', '2026-11-17')).toBe(true)
    expect(isFresh('fireRedCover', '2026-11-18')).toBe(false)
    expect(isFresh('woodChair', '2026-11-04')).toBe(false)
  })
})

describe('pageOf', () => {
  it("shows a collection's pieces on sale, its earned ones, and NOVO first", () => {
    const gallery = pageOf('gallery', '2026-11-05')
    expect(gallery[0]).toBe('fireRedCover')
    expect(gallery).toContain('clashPainting')
    expect(pageOf('gallery', '2026-11-01')).not.toContain('fireRedCover')
  })

  it('gathers every earned piece on the trophies page', () => {
    const trophies = pageOf('trophies', '2026-11-05')
    expect(trophies).toContain('doll:kyogre')
    expect(trophies).toContain('rayquazaPainting')
    expect(trophies).not.toContain('woodChair')
  })

  it('lists only collections with something on their page', () => {
    const sets = collectionsOn('2026-11-05')
    expect(sets).toContain('trainer')
    expect(sets.at(-1)).toBe('trophies')
  })
})

describe('filterPage', () => {
  it('filters by shelf and by currency, leaving earned pieces out of a currency', () => {
    const page = pageOf('gallery', '2026-11-05')
    expect(filterPage(page, 'all', 'coins')).toEqual(page.filter((id) => id.endsWith('Cover')))
    expect(filterPage(page, 'floor', 'all')).toEqual([])
    expect(filterPage(pageOf('trainer', '2026-11-05'), 'rug', 'gems')).toEqual(['masterBallRug'])
  })
})
