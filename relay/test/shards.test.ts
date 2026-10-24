import { describe, expect, it } from 'vitest'
import { homeOf, parseRoomCode } from '../../src/net/protocol'
import { randomCode } from '../src/codes'
import { createRoom, loadState, type Room } from '../src/room'
import { DEFAULT_ROOMS_PER_SHARD, INBOUND_BUDGET, RATE_WINDOW_MS, SHARD_INDEXES, SHARD_REGIONS, admits, capOf, createMeter, due, earliest, shardCode, shardName, shardOf, tally } from '../src/shards'

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

const room = (movedTo: string | null = null): Room => {
  const state = loadState(null, { secret: () => 'secret-0000000000', seed: () => 1 }, 0)
  createRoom(state, { code: 'ABCDE', build: 'b1', region: 'auto' }, 0)
  if (!state.room) throw new Error('no room')
  return { ...state.room, movedTo }
}

describe('shard codes', () => {
  it('name their shard, and stay Cloudflare codes the game routes as before', () => {
    for (const region of SHARD_REGIONS) {
      for (const index of [0, 1, 17, SHARD_INDEXES - 1]) {
        for (let i = 0; i < 50; i++) {
          const code = shardCode({ region, index }, random)
          expect(parseRoomCode(code)).toBe(code)
          expect(homeOf(code)).toBe('cf')
          expect(shardOf(code)).toEqual({ region, index })
        }
      }
    }
    expect(shardName({ region: 'enam', index: 3 })).toBe('enam:3')
  })

  it('tell apart the codes made before shards, but for the 1 in 31 that pass the check by chance', () => {
    let marked = 0
    const n = 31_000
    for (let i = 0; i < n; i++) if (shardOf(randomCode('cf')) !== null) marked++
    expect(marked / n).toBeGreaterThan(0.8 / 31)
    expect(marked / n).toBeLessThan(1.2 / 31)
    // A VPS relay's code never names a shard.
    for (let i = 0; i < 200; i++) expect(shardOf(randomCode('sa'))).toBeNull()
  })

  it('fail the check when any one character changes', () => {
    const code = shardCode({ region: 'weur', index: 4 }, random)
    for (let i = 0; i < code.length; i++) {
      const other = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1)
      expect(shardOf(other)).toBeNull()
    }
  })
})

describe('filling a shard', () => {
  it('takes rooms up to its cap and refuses past it, not counting rooms the group moved away from', () => {
    expect(admits([], 2)).toBe(true)
    expect(admits([room(), null], 2)).toBe(true)
    expect(admits([room(), room()], 2)).toBe(false)
    expect(admits([room(), room('KXYZ2'), room('KXYZ3')], 2)).toBe(true)
  })

  it('refuses past its inbound budget, measured over whole windows, whatever its count', () => {
    const m = createMeter(0)
    for (let t = 0; t < RATE_WINDOW_MS; t += 1) tally(m, t, 1)
    // The first window isn't whole yet: nothing measured.
    expect(admits([room()], 24, m.rate)).toBe(true)
    tally(m, RATE_WINDOW_MS)
    expect(m.rate).toBe(1000)
    expect(admits([room()], 24, m.rate)).toBe(false)
    expect(admits([room()], 24, INBOUND_BUDGET - 1)).toBe(true)
    // A quiet spell after it: the next window it closes is slow.
    tally(m, 10 * RATE_WINDOW_MS)
    expect(m.rate).toBe(0)
  })

  it('reads its cap from the var, else the default', () => {
    expect(capOf('16')).toBe(16)
    for (const raw of [undefined, '', 'many', '0', '2.5', '1000']) expect(capOf(raw)).toBe(DEFAULT_ROOMS_PER_SHARD)
  })
})

describe("the shard's alarm", () => {
  it('is the earliest of its rooms’ deadlines, and wakes only the rooms whose own came', () => {
    expect(earliest([])).toBeNull()
    expect(earliest([null, null])).toBeNull()
    expect(earliest([5000, null, 1200, 9000])).toBe(1200)
    expect(due(1200, 1200)).toBe(true)
    expect(due(5000, 1200)).toBe(false)
    expect(due(null, 1200)).toBe(false)
  })
})
