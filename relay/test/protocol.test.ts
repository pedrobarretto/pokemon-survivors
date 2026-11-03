import { describe, expect, it } from 'vitest'
import source from '../../src/net/protocol.ts?raw'
import arenaSource from '../../src/net/arena.ts?raw'
import queueSource from '../../src/net/arenaQueue.ts?raw'
import rankedSource from '../../src/data/arenaRanked.ts?raw'
import formatsSource from '../../src/data/arenaFormats.ts?raw'
import { LIMITS, parseClientMessage } from '../../src/net/protocol'

const importsOf = (text: string) => [...text.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]/gm)].map((m) => m[1])

describe('protocol', () => {
  it('imports nothing, so the relay never bundles game code', () => {
    expect(source).not.toMatch(/^\s*import[\s{*'"]/m)
    expect(source).not.toMatch(/^\s*export\s[^;=]*\sfrom\s*['"]/m)
    expect(source).not.toMatch(/\brequire\(|\bimport\(/)
  })

  it("bundles nothing of the game's with the Arena: its wire, its queue rules and their numbers", () => {
    expect(importsOf(arenaSource)).toEqual([])
    expect(importsOf(rankedSource)).toEqual([])
    expect(importsOf(formatsSource)).toEqual([])
    expect(importsOf(queueSource)).toEqual(['../data/arenaRanked', '../data/arenaFormats'])
  })

  it("carries an Arena result on `over`, and drops one past its size rather than the vote", () => {
    expect(parseClientMessage(JSON.stringify({ t: 'over', tick: 9, h: 'ab', result: '{"v":1}' }))).toEqual({ t: 'over', tick: 9, h: 'ab', result: '{"v":1}' })
    expect(parseClientMessage(JSON.stringify({ t: 'over', tick: 9, h: 'ab', result: 'x'.repeat(LIMITS.result + 1) }))).toEqual({ t: 'over', tick: 9, h: 'ab' })
    expect(parseClientMessage(JSON.stringify({ t: 'kick', seat: 7 }))).toEqual({ t: 'kick', seat: 7 })
  })

  it('refuses inputs posing as relay entries, and messages past their size', () => {
    expect(parseClientMessage('{"t":"in","k":"move","d":[3,1]}')).toEqual({ t: 'in', k: 'move', d: [3, 1] })
    expect(parseClientMessage('{"t":"in","k":"away","d":[]}')).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'in', k: 'move', d: ['x'.repeat(LIMITS.message)] }))).toBeNull()
    const chunk = JSON.stringify({ t: 'snap', tick: 600, h: 'ab', part: 0, parts: 1, data: 'A'.repeat(100_000) })
    expect(parseClientMessage(chunk)).toMatchObject({ t: 'snap', part: 0 })
    expect(parseClientMessage(JSON.stringify({ t: 'hash', tick: 61, h: 'ab' }))).toBeNull()
  })

  it('takes a batch of the messages a batch may carry, and nothing else', () => {
    const one = { t: 'in', k: 'move', d: [3, 1] }
    expect(parseClientMessage(JSON.stringify({ t: 'batch', m: [one, { t: 'ping', at: 5 }] }))).toEqual({ t: 'batch', m: [one, { t: 'ping', at: 5 }] })
    expect(parseClientMessage(JSON.stringify({ t: 'batch', m: [] }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'batch', m: Array(LIMITS.batch + 1).fill(one) }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'batch', m: [one, { t: 'in', k: 'away', d: [] }] }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'batch', m: [{ t: 'batch', m: [one] }] }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'batch', m: [{ t: 'snap', tick: 600, h: 'ab', part: 0, parts: 1, data: 'AA==' }] }))).toBeNull()
  })

  it('takes a link report of whole numbers only', () => {
    const net = { t: 'net', rtt: 120, rtt95: 180, hold: 5, underruns: 2, stalls: 7, reconnects: 1 }
    expect(parseClientMessage(JSON.stringify(net))).toEqual(net)
    expect(parseClientMessage(JSON.stringify({ ...net, rtt: 1.5 }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ ...net, stalls: undefined }))).toBeNull()
  })
})
