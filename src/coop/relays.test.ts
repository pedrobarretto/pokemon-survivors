import { describe, expect, it } from 'vitest'
import { createCoopClient } from './client'
import { MOVE_MARGIN_MS, NEAR_RTT_MS, groupHome, measureRelay, pickHome, relayFor, type RelayProbe } from './relays'

const CF = 'https://cf.test'
const SA = 'https://sa.test'

describe('relays', () => {
  it('finds a room on the relay its code names, and on Cloudflare when this build lacks that relay', () => {
    expect(relayFor('3K7QF', CF, { sa: SA })).toBe(SA)
    expect(relayFor('K7QF2', CF, { sa: SA })).toBe(CF)
    // A build without São Paulo sends its codes to Cloudflare, and so does a code of no home (6 to 9, US east's once).
    expect(relayFor('3K7QF', CF, {})).toBe(CF)
    expect(relayFor('7K7QF', CF, { sa: SA })).toBe(CF)
  })

  it("puts a host's room on São Paulo within the cap, else on Cloudflare", () => {
    const home = (rtt: number | null) => pickHome(new Map([['sa', rtt === null ? null : { rtt, full: false }]] as const)).home
    // São Paulo (8 ms), Buenos Aires (35), right at the cap.
    expect(home(8)).toBe('sa')
    expect(home(35)).toBe('sa')
    expect(home(NEAR_RTT_MS)).toBe('sa')
    // Lisbon (200), past the cap, São Paulo down, none in the build.
    expect(home(200)).toBe('cf')
    expect(home(NEAR_RTT_MS + 1)).toBe('cf')
    expect(home(null)).toBe('cf')
    expect(pickHome(new Map()).home).toBe('cf')
  })

  it('never puts a new room on a full VPS relay, and says it passed it only when it was near', () => {
    const probes = (sa: RelayProbe | null) => pickHome(new Map([['sa', sa]] as const))
    expect(probes({ rtt: 8, full: true })).toEqual({ home: 'cf', passed: 'sa' })
    expect(probes({ rtt: 150, full: true })).toEqual({ home: 'cf', passed: null })
  })

  it('measures the median round trip after the one that opens the connection, and its fullness, null when unreachable', async () => {
    let now = 0
    const waits = [400, 50, 45, 48, 300, 44]
    // A relay from before capacity says no `full`: not full.
    const get = async () => ((now += waits.shift() ?? 0), { ok: true })
    expect(await measureRelay(SA, get, () => now)).toEqual({ rtt: 48, full: false })
    expect(await measureRelay(SA, async () => ({ ok: true, rooms: 40, full: true }), () => now)).toMatchObject({ full: true })
    expect(await measureRelay(SA, () => Promise.reject(new Error('offline')), () => now)).toBeNull()
  })

  it("moves a Cloudflare room to São Paulo when it is best for the group's worst round trip, only by a clear margin", () => {
    const homes = ['sa'] as const
    // A Brazilian group in a Cloudflare room (in the US).
    expect(groupHome('cf', homes, [{ cf: 140, sa: 8 }, { cf: 150, sa: 30 }])).toBe('sa')
    // Short of the margin: not worth the hop.
    expect(groupHome('cf', homes, [{ cf: 140, sa: 8 }, { cf: 150, sa: 150 - MOVE_MARGIN_MS + 1 }])).toBeNull()
    expect(groupHome('cf', homes, [{ cf: 140, sa: 8 }, { cf: 150, sa: 150 - MOVE_MARGIN_MS }])).toBe('sa')
    // Someone far from São Paulo (the lab: one host in Brazil, two in Spain): it stays.
    expect(groupHome('cf', homes, [{ cf: 120, sa: 5 }, { cf: 30, sa: 230 }, { cf: 30, sa: 230 }])).toBeNull()
    // A São Paulo room has nowhere better: a Cloudflare room elsewhere can't be measured.
    expect(groupHome('sa', homes, [{ cf: 5, sa: 200 }])).toBeNull()
  })

  it("stays put when anyone's round trips are missing or a relay didn't answer them", () => {
    const homes = ['sa'] as const
    // A client before the reports (null), and nobody at all.
    expect(groupHome('cf', homes, [{ cf: 140, sa: 8 }, null])).toBeNull()
    expect(groupHome('cf', homes, [])).toBeNull()
    // São Paulo down for one of them.
    expect(groupHome('cf', homes, [{ cf: 140, sa: 8 }, { cf: 150, sa: null }])).toBeNull()
    // Not measured to the room it is in (the Cloudflare pings not in yet): it can't compare.
    expect(groupHome('cf', homes, [{ sa: 8 }, { cf: 150, sa: 30 }])).toBeNull()
    // A relay this build lacks is never a candidate.
    expect(groupHome('cf', [], [{ cf: 140, sa: 8 }, { cf: 150, sa: 30 }])).toBeNull()
  })

  it('never moves a room to a full relay', () => {
    expect(groupHome('cf', ['sa'], [{ cf: 140, sa: 8 }, { cf: 150, sa: 30 }], new Set(['sa']))).toBeNull()
  })

  it('creates on São Paulo when near, and on Cloudflare when São Paulo is down', async () => {
    const posted: string[] = []
    const client = (saUp: boolean) =>
      createCoopClient({
        url: CF,
        vps: { sa: SA },
        build: 'b1',
        socket: () => ({ send: () => {}, close: () => {}, isOpen: () => false, buffered: () => 0 }),
        fetch: async (url, init) => {
          if (url.startsWith(SA) && !saUp) throw new Error('offline')
          if (init.method === 'POST') posted.push(url)
          return { json: async () => (url.startsWith(SA) ? { code: '3K7QF', region: 'sam' } : { code: 'K7QF2', region: 'enam' }) }
        },
        store: { get: () => null, set: () => {}, remove: () => {}, keys: () => [] },
        token: async () => null,
        name: () => 'Ash',
        now: () => 0,
        random: () => 0.5,
      })
    expect(await client(true).create()).toMatchObject({ ok: true, code: '3K7QF', home: 'sa' })
    expect(await client(false).create()).toMatchObject({ ok: true, code: 'K7QF2', home: 'cf' })
    expect(posted).toEqual([`${SA}/rooms`, `${CF}/rooms`])
  })

  it('creates on Cloudflare when São Paulo says it is full, at its /health or at its create', async () => {
    const posted: string[] = []
    const client = (health: boolean, refuses: boolean) =>
      createCoopClient({
        url: CF,
        vps: { sa: SA },
        build: 'b1',
        socket: () => ({ send: () => {}, close: () => {}, isOpen: () => false, buffered: () => 0 }),
        fetch: async (url, init) => {
          if (init.method === 'POST') posted.push(url)
          const body = !url.startsWith(SA) ? { code: 'K7QF2', region: 'enam' } : init.method === 'GET' ? { ok: true, rooms: 40, full: health } : refuses ? { error: 'full' } : { code: '3K7QF', region: 'sam' }
          return { json: async () => body }
        },
        store: { get: () => null, set: () => {}, remove: () => {}, keys: () => [] },
        token: async () => null,
        name: () => 'Ash',
        now: () => 0,
        random: () => 0.5,
      })
    // Full at /health: São Paulo isn't even asked.
    expect(await client(true, true).create()).toMatchObject({ ok: true, home: 'cf', overflow: 'sa' })
    expect(posted).toEqual([`${CF}/rooms`])
    // Filled up since: its refusal sends the room to Cloudflare too.
    posted.length = 0
    expect(await client(false, true).create()).toMatchObject({ ok: true, home: 'cf', overflow: 'sa' })
    expect(posted).toEqual([`${SA}/rooms`, `${CF}/rooms`])
    expect(await client(false, false).create()).not.toHaveProperty('overflow')
  })
})
