import { describe, expect, it, vi } from 'vitest'
import type { BoardEntry } from '../../src/game/ranking'
import { boardFrom, frozenBoards, type RankedBoard } from './era1Board'

const entry = (rank: number): BoardEntry => ({
  starter: 'charmander',
  stage: 2,
  branch: null,
  time: 10_000 - rank,
  outcome: 'death',
  at: '2026-11-01T00:00:00.000Z',
  bag: [],
  rank,
  handle: `p${rank}`,
  name: `P${rank}`,
  supporter: null,
  supporterSince: null,
  og: false,
  run: `r${rank}`,
})

/** `n` players, `u1` first. */
const field = (n: number): RankedBoard => ({
  entries: Array.from({ length: n }, (_, i) => entry(i + 1)),
  users: Array.from({ length: n }, (_, i) => `u${i + 1}`),
})

describe('boardFrom', () => {
  it('cuts the top and finds the viewer anywhere', () => {
    const b = boardFrom(field(120), 'u90')
    expect(b.entries).toHaveLength(50)
    expect(b.me?.rank).toBe(90)
    expect(b.total).toBe(120)
    expect(boardFrom(field(3), 'nobody').me).toBeNull()
  })

  it('ranks the viewer and who they follow among themselves', () => {
    const b = boardFrom(field(120), 'u90', new Set(['u7', 'u100', 'stranger']))
    expect(b.entries.map((e) => [e.handle, e.rank])).toEqual([['p7', 1], ['p90', 2], ['p100', 3]])
    expect(b.me?.rank).toBe(2)
    expect(b.total).toBe(3)
  })
})

describe('frozenBoards', () => {
  it('reads a board once while fresh, then serves the stale one while it refreshes', async () => {
    let clock = 0
    let version = 0
    const read = vi.fn(async () => field(++version))
    const get = frozenBoards((k: string) => k, read, () => clock)
    expect((await get('a')).entries).toHaveLength(1)
    expect((await get('a')).entries).toHaveLength(1)
    expect(read).toHaveBeenCalledTimes(1)
    clock = 11 * 60_000
    expect((await get('a')).entries).toHaveLength(1)
    expect((await get('a')).entries).toHaveLength(2)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('forgets a failed read', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(field(2))
    const get = frozenBoards((k: string) => k, read)
    await expect(get('a')).rejects.toThrow('down')
    expect((await get('a')).entries).toHaveLength(2)
  })
})
