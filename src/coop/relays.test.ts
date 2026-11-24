import { describe, expect, it } from 'vitest'
import { createCoopClient } from './client'
import { MOVE_MARGIN_MS, NEAR_RTT_MS, groupHome, measureRelay, pickHome, placeOf, relayFor, type RelayProbe } from './relays'

const CF = 'https://cf.test'
const SA = 'https://sa.test'
const HK = 'https://hk.test'

describe('relays', () => {
  it('finds a room on the relay its code names, and on Cloudflare when this build lacks that relay', () => {
    expect(relayFor('3K7QF', CF, { sa: SA })).toBe(SA)
    expect(relayFor('K7QF2', CF, { sa: SA })).toBe(CF)
    // A build without São Paulo sends its codes to Cloudflare, and so does one without Hong Kong (6 to 9).
    expect(relayFor('3K7QF', CF, {})).toBe(CF)
    expect(relayFor('7K7QF', CF, { sa: SA })).toBe(CF)
    expect(relayFor('7K7QF', CF, { sa: SA, hk: HK })).toBe(HK)
    expect(relayFor('3K7QF', CF, { sa: SA, hk: HK })).toBe(SA)
  })

  it('puts each host on the nearer VPS relay, Hong Kong for mainland China and Taiwan', () => {
    const home = (sa: number, hk: number) =>
      pickHome(
        new Map([
          ['sa', { rtt: sa, full: false }],
          ['hk', { rtt: hk, full: false }],
        ] as const),
      ).home
    // Shenzhen (25 ms to Hong Kong), Shanghai (40), Beijing (60), Taipei (22).
    expect(home(340, 25)).toBe('hk')
    expect(home(350, 40)).toBe('hk')
    expect(home(360, 60)).toBe('hk')
    expect(home(330, 22)).toBe('hk')
    // São Paulo's own, and Lisbon, far from both.
    expect(home(8, 330)).toBe('sa')
    expect(home(200, 230)).toBe('cf')
    // Hong Kong full: a mainland host's room goes to Cloudflare, never across the world to São Paulo.
    expect(
      pickHome(
        new Map([
          ['sa', { rtt: 340, full: false }],
          ['hk', { rtt: 25, full: true }],
        ] as const),
      ),
    ).toEqual({ home: 'cf', passed: 'hk' })
  })

  it('decides as before in a build without Hong Kong', () => {
    // No `VITE_COOP_URL_HK`: Hong Kong is never measured, so a mainland host's room is Cloudflare's, as today.
    expect(pickHome(new Map([['sa', { rtt: 340, full: false }]] as const))).toEqual({ home: 'cf', passed: null })
    const cn = { cf: 190, sa: 340, 'cf:wnam': 180, 'cf:apac': 200 }
    const br = { cf: 120, sa: 8, 'cf:wnam': 170, 'cf:apac': 330 }
    expect(groupHome('cf', ['sa', 'cf:wnam', 'cf:apac'], [cn, br])).toBeNull()
    // Round trips to Hong Kong reported by a newer teammate change nothing either: it isn't a site of this build.
    expect(groupHome('cf', ['sa', 'cf:wnam', 'cf:apac'], [{ ...cn, hk: 30 }, { ...cn, hk: 35 }])).toBeNull()
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
    // A São Paulo room without the Cloudflare probes has nowhere better.
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

  it('moves a group spread over continents to Cloudflare in between, only when everyone probed it', () => {
    const sites = ['sa', 'cf:enam', 'cf:apac'] as const
    // A Brazilian host's São Paulo room with a Singaporean: the US east coast is the best worst round trip.
    const br = { sa: 10, 'cf:enam': 130, 'cf:apac': 340 }
    const sg = { sa: 350, 'cf:enam': 230, 'cf:apac': 25 }
    expect(groupHome('sa', sites, [br, sg])).toBe('cf:enam')
    // The same pair in the Singaporean's Cloudflare room (its pings say 340 for the Brazilian).
    expect(groupHome('cf', sites, [{ ...br, cf: 340 }, { ...sg, cf: 25 }])).toBe('cf:enam')
    // A Brazilian group stays in São Paulo, and a Cloudflare room's own region never beats it by the margin.
    expect(groupHome('sa', sites, [br, { ...br, sa: 30 }])).toBeNull()
    expect(groupHome('cf', sites, [{ ...sg, cf: 30 }, { ...sg, cf: 20 }])).toBeNull()
    // A client before the probes (no `cf:` round trips): only the VPS relays are candidates.
    expect(groupHome('sa', sites, [br, { sa: 350 }])).toBeNull()
  })

  it('keeps a mainland Chinese group in Hong Kong, and a group with Brazilians where the worst round trip is lowest', () => {
    const sites = ['sa', 'hk', 'cf:enam', 'cf:wnam', 'cf:apac'] as const
    // A mainland player meets Cloudflare outside the mainland (often its US west coast), so its Cloudflare round trips run long.
    const cn = { sa: 350, hk: 35, 'cf:enam': 230, 'cf:wnam': 180, 'cf:apac': 200 }
    const tw = { sa: 330, hk: 22, 'cf:enam': 190, 'cf:wnam': 140, 'cf:apac': 40 }
    const br = { sa: 8, hk: 330, 'cf:enam': 120, 'cf:wnam': 170, 'cf:apac': 330 }
    // Hosted in Hong Kong: a group of mainland and Taiwanese players stays.
    expect(groupHome('hk', sites, [cn, { ...cn, hk: 55 }, tw])).toBeNull()
    // The same group in a Cloudflare room (pickHome went there, Hong Kong being down then) moves to Hong Kong.
    expect(groupHome('cf', sites, [{ ...cn, cf: 200 }, { ...tw, cf: 40 }])).toBe('hk')
    // A mainland host with a Brazilian: neither VPS relay, Cloudflare on the US west coast is the best worst (180 ms).
    expect(groupHome('hk', sites, [cn, br])).toBe('cf:wnam')
    expect(groupHome('sa', sites, [cn, br])).toBe('cf:wnam')
  })

  it('makes a moved room on the relay and in the region its site names', () => {
    expect(placeOf('sa')).toEqual({ home: 'sa', region: 'auto' })
    expect(placeOf('hk')).toEqual({ home: 'hk', region: 'auto' })
    expect(placeOf('cf:enam')).toEqual({ home: 'cf', region: 'enam' })
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
