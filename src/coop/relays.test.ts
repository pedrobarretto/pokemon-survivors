import { describe, expect, it } from 'vitest'
import { createCoopClient } from './client'
import { MOVE_MARGIN_MS, NEAR_RTT_MS, groupHome, measureRtt, pickHome, relayFor } from './relays'

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
    const rtts = (sa: number | null, us: number | null) => new Map([['sa', sa], ['us', us]] as const)
    // São Paulo (São Paulo 8 ms, Boston ~120), Buenos Aires (35 / 150).
    expect(pickHome(rtts(8, 120))).toBe('sa')
    expect(pickHome(rtts(35, 150))).toBe('sa')
    // New York (120 / 8), Chicago (140 / 25), Los Angeles (180 / 65).
    expect(pickHome(rtts(120, 8))).toBe('us')
    expect(pickHome(rtts(140, 25))).toBe('us')
    expect(pickHome(rtts(180, 65))).toBe('us')
    // Lisbon (200 / 85), Tokyo (260 / 170), a relay down, none in the build.
    expect(pickHome(rtts(200, 85))).toBe('cf')
    expect(pickHome(rtts(260, 170))).toBe('cf')
    expect(pickHome(rtts(NEAR_RTT_MS + 1, null))).toBe('cf')
    expect(pickHome(rtts(null, 12))).toBe('us')
    expect(pickHome(new Map())).toBe('cf')
  })

  it('measures the median round trip after the one that opens the connection, null when unreachable', async () => {
    let now = 0
    const waits = [400, 50, 45, 48, 300, 44]
    const get = async () => void (now += waits.shift() ?? 0)
    expect(await measureRtt(SA, get, () => now)).toBe(48)
    expect(await measureRtt(SA, () => Promise.reject(new Error('offline')), () => now)).toBeNull()
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
})
