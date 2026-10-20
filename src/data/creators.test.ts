import { describe, expect, it } from 'vitest'
import { CREATOR_IDS, creatorOfAccount, creatorUrl, featuredCreator, parseLive } from './creators'

const NOW = Date.parse('2026-10-20T20:00:00Z')

describe('parseLive', () => {
  it('keeps known creators still live', () => {
    const id = CREATOR_IDS[0]!
    expect(parseLive([{ id, until: '2026-10-20T22:00:00Z' }], NOW)).toEqual([{ id, until: '2026-10-20T22:00:00Z' }])
  })

  it('drops ended streams, unknown creators and junk', () => {
    const id = CREATOR_IDS[0]!
    expect(parseLive([{ id, until: '2026-10-20T19:00:00Z' }, { id: 'nobody', until: '2026-10-20T22:00:00Z' }, { id }, null, 'x'], NOW)).toEqual([])
    expect(parseLive(null, NOW)).toEqual([])
  })
})

describe('featuredCreator', () => {
  it('features whoever is live first', () => {
    const live = [CREATOR_IDS.at(-1)!]
    expect(featuredCreator(0, live)).toBe(live[0])
  })

  it('takes turns a day at a time otherwise', () => {
    const days = Array.from({ length: CREATOR_IDS.length }, (_, d) => featuredCreator(20_000 + d, []))
    expect(new Set(days).size).toBe(CREATOR_IDS.length)
  })
})

describe('creators', () => {
  it('links the live page only while live', () => {
    const id = CREATOR_IDS[0]!
    expect(creatorUrl(id, true)).not.toBe(creatorUrl(id, false))
  })

  it('finds nobody for a guest or a stranger', () => {
    expect(creatorOfAccount(null)).toBeNull()
    expect(creatorOfAccount('someone_else_entirely')).toBeNull()
  })
})
