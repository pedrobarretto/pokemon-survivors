import { describe, expect, it } from 'vitest'
import { FURNITURE_IDS } from '../data/furniture'
import { collectionsOn, earnWayOf, filterPage, freshOn, isFresh, pageOf } from './catalog'

describe('freshOn', () => {
  it('marks a drop NOVO for two weeks from its day, and never before it', () => {
    expect(freshOn('2026-11-20', '2026-11-19')).toBe(false)
    expect(freshOn('2026-11-20', '2026-11-20')).toBe(true)
    expect(freshOn('2026-11-20', '2026-12-03')).toBe(true)
    expect(freshOn('2026-11-20', '2026-12-04')).toBe(false)
  })

  it('never tags the launch catalog, which has no date', () => {
    expect(freshOn(undefined, '2026-11-04')).toBe(false)
    expect(isFresh('fireRedCover', '2026-11-04')).toBe(false)
  })
})

describe('pageOf', () => {
  it("shows a collection's pieces on sale and its earned ones", () => {
    const gallery = pageOf('gallery', '2026-11-05')
    expect(gallery).toContain('fireRedCover')
    expect(gallery).toContain('clashPainting')
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

describe('earnWayOf', () => {
  it('tells how every earned piece comes, and only the legends\' pieces by capture', () => {
    expect(earnWayOf('doll:kyogre')).toEqual({ kind: 'legends', legends: ['kyogre'] })
    expect(earnWayOf('goldenMagikarpPlaque')).toEqual({ kind: 'game', game: 'fishing', after: { stat: 'best', at: 400 } })
    expect(earnWayOf('stampDesk')).toEqual({ kind: 'stamps', at: 5 })
    expect(earnWayOf('woodChair')).toBeNull()
    expect(pageOf('trophies', '2026-11-18').filter((id) => earnWayOf(id) === null)).toEqual([])
    expect(FURNITURE_IDS.filter((id) => earnWayOf(id)?.kind === 'legends').every((id) => id.startsWith('doll:') || id.endsWith('Painting'))).toBe(true)
  })
})
