import { describe, expect, it } from 'vitest'
import { SEASON_ONE } from '../data/seasons'
import { ERA1, era1Awards, era1Closed, era1Due, era1Gifts, era1Places, type Era1Board, type Era1Standing } from './era1'
import { applyGift, keepGiven, parseGift } from './gifts'
import { EMPTY_SAVE, type Save } from './meta'

const board = (side: Era1Board['side'], difficulty: Era1Board['difficulty'] = 'normal'): Era1Board => ({ side, difficulty })

/** A board of `field` players where `users` hold places 1, 2, 3… */
const standing = (b: Era1Board, field: number, users: readonly string[]): Era1Standing => ({ board: b, field, places: users.map((userId, i) => ({ userId, rank: i + 1 })) })

describe('era1Places', () => {
  it('rewards no one on a board too thin to be a race', () => {
    expect(era1Places(ERA1.minField - 1)).toBe(0)
  })

  it('rewards a share of a thin board, up to the cap of a full one', () => {
    expect(era1Places(ERA1.minField)).toBe(Math.floor(ERA1.minField * ERA1.share))
    expect(era1Places(5000)).toBe(ERA1.top)
    expect(era1Places(5000, true)).toBe(ERA1.coopTop)
  })
})

describe('era1Awards', () => {
  const top = Array.from({ length: 12 }, (_, i) => `p${i + 1}`)

  it('makes a solo board’s #1 its Champion and the rest of the cut Legends', () => {
    const awards = era1Awards([standing(board('standard'), 400, top)])
    expect(awards.get('p1')).toMatchObject({ tier: 'champion', rank: 1 })
    expect(awards.get('p10')).toMatchObject({ tier: 'hall', rank: 10 })
    expect(awards.has('p11')).toBe(false)
  })

  it('never makes a Champion of a co-op team, and stops at its cut', () => {
    const awards = era1Awards([{ board: board('duo'), field: 400, places: [{ userId: 'a', rank: 1 }, { userId: 'b', rank: 1 }, { userId: 'c', rank: 3 }, { userId: 'd', rank: 4 }] }])
    expect([awards.get('a')?.tier, awards.get('b')?.tier, awards.get('c')?.tier]).toEqual(['hall', 'hall', 'hall'])
    expect(awards.has('d')).toBe(false)
  })

  it('gives a player on several boards their best award once', () => {
    const awards = era1Awards([
      standing(board('standard', 'normal'), 400, ['x', 'y']),
      standing(board('legend', 'nightmare'), 400, ['y', 'x']),
      standing(board('standard', 'hard'), 400, ['z', 'x']),
      standing(board('legend', 'hard'), 400, ['w', 'z']),
    ])
    expect(awards.get('x')).toEqual({ tier: 'champion', rank: 1, board: board('standard', 'normal') })
    // Two #1s: the harder board names it.
    expect(awards.get('y')).toEqual({ tier: 'champion', rank: 1, board: board('legend', 'nightmare') })
    expect(awards.get('z')).toEqual({ tier: 'champion', rank: 1, board: board('standard', 'hard') })
  })

  it('leaves a thin board’s lower places out', () => {
    const awards = era1Awards([standing(board('legend', 'nightmare'), 12, top)])
    expect([...awards.keys()]).toEqual(['p1', 'p2', 'p3'])
  })
})

describe('era1Gifts', () => {
  /** A save after opening every gift of an award, as the API lists them. */
  const opened = (tier: 'champion' | 'hall'): { save: Save; given: { id: string; content: ReturnType<typeof era1Gifts>[number]['content'] }[] } => {
    const gifts = era1Gifts({ tier, rank: 1, board: board('standard', 'hard') }).map((g, i) => parseGift({ id: `gift-${i}`, content: g.content, reason: g.reason })!)
    const save = gifts.reduce<Save>((s, g) => {
      const out = applyGift(s, g)
      return out.status === 'applied' ? out.save : s
    }, EMPTY_SAVE)
    return { save, given: gifts.map((g) => ({ id: g.id, content: g.content })) }
  }

  it('lands the Champion’s title, frame and sky, and the API’s gifts keep them through a sync', () => {
    const { save, given } = opened('champion')
    expect(save.titles).toEqual(['era1Champion'])
    expect(save.style.owned).toMatchObject({ frame: ['era1Champion'], background: ['era1Champion'] })
    expect(keepGiven(save, given)).toEqual(save)
  })

  it('takes them off a save that gave them to itself', () => {
    const { save } = opened('hall')
    const kept = keepGiven(save, [])
    expect(kept.titles).toEqual([])
    expect(kept.style.owned.frame).toEqual([])
  })

  it('keys each gift by tier, so a player moved up later gets the stronger set too', () => {
    const keys = [...era1Gifts({ tier: 'hall', rank: 4, board: board('trio') }), ...era1Gifts({ tier: 'champion', rank: 1, board: board('standard') })].map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('the clock', () => {
  const start = Date.parse(SEASON_ONE.start)

  it('closes Era 1 when the season opens, and pays a day later', () => {
    expect(era1Closed(start - 1)).toBe(false)
    expect(era1Closed(start)).toBe(true)
    expect(era1Due(start)).toBe(false)
    expect(era1Due(start + ERA1.settleMs)).toBe(true)
  })
})
