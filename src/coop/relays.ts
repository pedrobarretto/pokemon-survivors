import { homeOf, type RelayHome, type Rtts, type VpsHome } from '../net/protocol'

/**
 * Which relay a room lives on. Cloudflare's everywhere (the default and the
 * fallback), plus the VPS relays this build has a URL for (`RELAY_URLS` in
 * `coopShell.ts`; today São Paulo's, for rooms whose host is in South America:
 * Cloudflare has no Durable Objects there, so a Brazilian room runs in the US,
 * 116–140 ms away). A room's code says its relay (`homeOf`),
 * so links and typed codes find it without asking anyone. The host's measure
 * picks where a room is made (`pickHome`); the group's, reported in its lobby,
 * where it moves before its first run (`groupHome`). A VPS relay never caps
 * the game: one whose `/health` says `full` gets no new room, Cloudflare does.
 */

/** Each VPS relay's base URL in this build (absent: that relay is off). */
export type VpsUrls = Partial<Record<VpsHome, string>>

/** A VPS relay round trip up to this (ms) can make the host's room that relay's (São Paulo: Brazil, Argentina, Uruguay, Paraguay, Chile). Past it, Cloudflare is about as near. */
export const NEAR_RTT_MS = 70

const isVps = (home: RelayHome): home is VpsHome => home !== 'cf'

/** The relay serving room `code`: its home's when this build has it, Cloudflare's (`cf`) otherwise. */
export const relayFor = (code: string, cf: string, vps: VpsUrls) => {
  const home = homeOf(code)
  return (isVps(home) ? vps[home] : undefined) ?? cf
}

/** A VPS relay as this device measured it: its round trip (ms) and whether its `/health` said it takes no new room. */
export type RelayProbe = { rtt: number; full: boolean }

/**
 * Where a host's new room goes (`home`): the VPS relay with the lowest round
 * trip, if within `NEAR_RTT_MS` and not full (null: it didn't answer), else
 * Cloudflare. `passed`: the nearer VPS relay skipped for being full, if any.
 */
export const pickHome = (probes: ReadonlyMap<VpsHome, RelayProbe | null>): { home: RelayHome; passed: VpsHome | null } => {
  let best: { home: RelayHome; rtt: number } = { home: 'cf', rtt: Infinity }
  let passed: { home: VpsHome; rtt: number } | null = null
  for (const [home, p] of probes) {
    if (p === null || p.rtt > NEAR_RTT_MS) continue
    if (p.full) passed = !passed || p.rtt < passed.rtt ? { home, rtt: p.rtt } : passed
    else if (p.rtt < best.rtt) best = { home, rtt: p.rtt }
  }
  return { home: best.home, passed: passed && passed.rtt < best.rtt ? passed.home : null }
}

/** The middle of `values` (the lower one of an even count), or null when empty. */
export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((x, y) => x - y)
  return sorted[Math.floor((sorted.length - 1) / 2)]!
}

/** A `/health` answer saying the relay is full (`relay/node`'s `capacity.ts`); one without `full` (a relay before it) isn't. */
const saysFull = (body: unknown) => typeof body === 'object' && body !== null && 'full' in body && body.full === true

/**
 * A relay as this device sees it, or null when it doesn't answer: one
 * `GET /health` to open the connection (DNS, TCP, TLS), then the median round
 * trip (ms) of `tries` more on it, and whether the last one said it's full.
 * `get` answers the parsed body. Each asks its own URL: a browser holds
 * identical GETs in flight behind one another (its cache lock).
 */
export const measureRelay = async (url: string, get: (url: string) => Promise<unknown>, now: () => number, tries = 5): Promise<RelayProbe | null> => {
  try {
    let body = await get(`${url}/health?n=0`)
    const times: number[] = []
    for (let i = 1; i <= tries; i++) {
      const at = now()
      body = await get(`${url}/health?n=${i}`)
      times.push(now() - at)
    }
    const rtt = median(times)
    return rtt === null ? null : { rtt, full: saysFull(body) }
  } catch {
    return null
  }
}

/** A room moves only when another relay's worst round trip beats its own by this much (ms): less isn't worth the hop. */
export const MOVE_MARGIN_MS = 40

/** The worst round trip of the group to `home` (ms), or null when any member didn't measure it (or it didn't answer them). */
const worstRtt = (home: RelayHome, group: readonly Rtts[]) => {
  let worst = 0
  for (const rtts of group) {
    const ms = rtts[home]
    if (ms === undefined || ms === null) return null
    worst = Math.max(worst, ms)
  }
  return worst
}

/**
 * Where a room in `current` should run for the group about to play in it:
 * the relay whose worst member round trip is lowest, if it beats the
 * current one's by `MOVE_MARGIN_MS`; null to stay. The candidates are the VPS
 * relays this build has (`homes`) and, for a Cloudflare room, that room
 * itself (each member's round trip to it; a Cloudflare room elsewhere can't be
 * measured). `group` holds every member's reported round trips, null for one
 * that didn't report (a client before it): then nobody can say, and it stays.
 * A relay in `full` (the host's own measure) is never a candidate.
 */
export const groupHome = (current: RelayHome, homes: readonly VpsHome[], group: readonly (Rtts | null)[], full: ReadonlySet<VpsHome> = new Set()): RelayHome | null => {
  const known = group.filter((r): r is Rtts => r !== null)
  if (known.length === 0 || known.length < group.length) return null
  const here = worstRtt(current, known)
  if (here === null) return null
  let best: { home: RelayHome; worst: number } | null = null
  for (const home of homes) {
    const worst = home === current || full.has(home) ? null : worstRtt(home, known)
    if (worst !== null && (!best || worst < best.worst)) best = { home, worst }
  }
  return best && best.worst + MOVE_MARGIN_MS <= here ? best.home : null
}
