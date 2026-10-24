import { describe, expect, it } from 'vitest'
import { createCoopClient } from './client'
import { MOVE_MARGIN_MS, NEAR_RTT_MS, groupHome, measureRelay, pickHome, relayFor, type RelayProbe } from './relays'

const CF = 'https://cf.test'
const SA = 'https://sa.test'
const US = 'https://us.test'

describe('relays', () => {
  it('finds a room on the relay its code names, and on Cloudflare when this build lacks that relay', () => {
    const both = { sa: SA, us: US }
    expect(relayFor('3K7QF', CF, both)).toBe(SA)
    expect(relayFor('7K7QF', CF, both)).toBe(US)
    expect(relayFor('K7QF2', CF, both)).toBe(CF)
    // A build without the US relay sends its codes to Cloudflare.
    expect(relayFor('7K7QF', CF, { sa: SA })).toBe(CF)
  })

  it("puts a host's room on the nearest VPS relay within the cap, else on Cloudflare", () => {
    const probe = (rtt: number | null): RelayProbe | null => (rtt === null ? null : { rtt, full: false })
    const home = (sa: number | null, us: number | null) => pickHome(new Map([['sa', probe(sa)], ['us', probe(us)]] as const)).home
    // São Paulo (São Paulo 8 ms, Boston ~120), Buenos Aires (35 / 150).
    expect(home(8, 120)).toBe('sa')
    expect(home(35, 150)).toBe('sa')
    // New York (120 / 8), Chicago (140 / 25), Los Angeles (180 / 65).
    expect(home(120, 8)).toBe('us')
    expect(home(140, 25)).toBe('us')
    expect(home(180, 65)).toBe('us')
    // Lisbon (200 / 85), Tokyo (260 / 170), a relay down, none in the build.
    expect(home(200, 85)).toBe('cf')
    expect(home(260, 170)).toBe('cf')
    expect(home(NEAR_RTT_MS + 1, null)).toBe('cf')
    expect(home(null, 12)).toBe('us')
    expect(pickHome(new Map()).home).toBe('cf')
  })

  it('never puts a new room on a full VPS relay, and says which one it passed', () => {
    const probes = (sa: RelayProbe | null, us: RelayProbe | null) => pickHome(new Map([['sa', sa], ['us', us]] as const))
    // São Paulo full: a Brazilian host's room goes to Cloudflare.
    expect(probes({ rtt: 8, full: true }, { rtt: 120, full: false })).toEqual({ home: 'cf', passed: 'sa' })
    // The next near one takes it; one full but farther than the pick isn't "passed".
    expect(probes({ rtt: 8, full: true }, { rtt: 50, full: false })).toEqual({ home: 'us', passed: 'sa' })
    expect(probes({ rtt: 60, full: true }, { rtt: 20, full: false })).toEqual({ home: 'us', passed: null })
    // A full relay out of reach was never a candidate.
    expect(probes({ rtt: 150, full: true }, null)).toEqual({ home: 'cf', passed: null })
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

  it("moves a room to the relay best for the group's worst round trip, only by a clear margin", () => {
    const homes = ['sa', 'us'] as const
    // The first 4-player room (278P4): its host in São Paulo, two players in Spain, one in Mississippi.
    const room278 = [{ sa: 7, us: 140 }, { sa: 227, us: 100 }, { sa: 239, us: 100 }, { sa: 175, us: 40 }]
    expect(groupHome('sa', homes, room278)).toBe('us')
    // All in Brazil: São Paulo it stays.
    expect(groupHome('sa', homes, [{ sa: 8, us: 130 }, { sa: 30, us: 150 }])).toBeNull()
    // Short of the margin: not worth the hop.
    expect(groupHome('sa', homes, [{ sa: 10, us: 120 }, { sa: 150, us: 120 - 1 + MOVE_MARGIN_MS }])).toBeNull()
    expect(groupHome('sa', homes, [{ sa: 10, us: 110 }, { sa: 150, us: 110 }])).toBe('us')
    // A Cloudflare room is measured as itself; a Cloudflare room elsewhere never is.
    const lab = [{ cf: 120, sa: 5, us: 140 }, { cf: 30, sa: 230, us: 100 }, { cf: 30, sa: 230, us: 100 }]
    expect(groupHome('cf', homes, lab)).toBeNull()
    expect(groupHome('cf', homes, [{ cf: 140, sa: 8, us: 130 }, { cf: 150, sa: 30, us: 150 }])).toBe('sa')
    expect(groupHome('sa', homes, [{ cf: 5, sa: 200, us: 200 }])).toBeNull()
  })

  it("stays put when anyone's round trips are missing or a relay didn't answer them", () => {
    const homes = ['sa', 'us'] as const
    // A client before the reports (null), and nobody at all.
    expect(groupHome('sa', homes, [{ sa: 5, us: 140 }, null])).toBeNull()
    expect(groupHome('sa', homes, [])).toBeNull()
    // US east down for one of them: no candidate left.
    expect(groupHome('sa', homes, [{ sa: 5, us: 40 }, { sa: 230, us: null }])).toBeNull()
    // Not measured to the room it is in (the Cloudflare pings not in yet): it can't compare.
    expect(groupHome('cf', homes, [{ sa: 5, us: 40 }, { cf: 200, sa: 200, us: 40 }])).toBeNull()
    // A relay this build lacks is never a candidate.
    expect(groupHome('sa', ['sa'], [{ sa: 5, us: 40 }, { sa: 230, us: 40 }])).toBeNull()
  })

  it('never moves a room to a full relay', () => {
    const homes = ['sa', 'us'] as const
    const room278 = [{ sa: 7, us: 140 }, { sa: 227, us: 100 }, { sa: 239, us: 100 }, { sa: 175, us: 40 }]
    expect(groupHome('sa', homes, room278, new Set(['us']))).toBeNull()
    expect(groupHome('cf', homes, [{ cf: 140, sa: 8, us: 130 }, { cf: 150, sa: 30, us: 150 }], new Set(['sa']))).toBeNull()
    // The room's own relay being full keeps it where it is (it's already there).
    expect(groupHome('sa', homes, room278, new Set(['sa']))).toBe('us')
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
