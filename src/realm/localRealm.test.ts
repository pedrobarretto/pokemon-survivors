import { afterEach, describe, expect, it, vi } from 'vitest'
import { REALM_PROTOCOL, realmPath, type RealmServerMessage } from '../net/realm'
import { LOCAL_REALM_URL, startLocalRealm } from './localRealm'

/** A seeded uniform rng (mulberry32), so the bots walk the same every run. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

afterEach(() => vi.useRealTimers())

const open = (bots: number) => {
  vi.useFakeTimers()
  const realm = startLocalRealm({ city: 'pallet', bots, random: seeded(7), now: () => Date.now(), me: { handle: 'ash' } })
  const inbox: RealmServerMessage[] = []
  const ws = realm.socket(`${LOCAL_REALM_URL}${realmPath('pallet')}`, {
    open: () => ws.send(JSON.stringify({ t: 'hello', v: REALM_PROTOCOL, city: 'pallet', token: 'me', room: 'plaza' })),
    message: (data) => inbox.push(JSON.parse(String(data)) as RealmServerMessage),
    close: () => undefined,
  })
  return { realm, ws, inbox }
}

describe('the in-page realm', () => {
  it('seats the player among its bots, who walk, talk and accept an invite', () => {
    const { realm, ws, inbox } = open(3)
    vi.advanceTimersByTime(50)
    const welcome = inbox.find((m) => m.t === 'welcome')
    expect(welcome?.t === 'welcome' && welcome.avatars.map((a) => a.handle).includes('ash')).toBe(true)
    // Short of `REALM.idleDropMs`: the player says nothing meanwhile.
    vi.advanceTimersByTime(20_000)
    expect(inbox.some((m) => m.t === 'moves')).toBe(true)
    expect(inbox.some((m) => m.t === 'said' || m.t === 'emoted')).toBe(true)
    // Each bot that's still in the plaza is invited, until one says yes.
    const here = new Set<number>(welcome?.t === 'welcome' ? welcome.avatars.map((a) => a.id) : [])
    for (const m of inbox) if (m.t === 'join') here.add(m.avatar.id)
    for (const m of inbox) if (m.t === 'gone') here.delete(m.id)
    for (const id of realm.bots().filter((id) => here.has(id))) {
      ws.send(JSON.stringify({ t: 'invite', id }))
      vi.advanceTimersByTime(3_000)
    }
    expect(inbox.some((m) => m.t === 'party' && m.party !== null)).toBe(true)
    realm.dispose()
  })

  it('refuses a socket for another city', () => {
    vi.useFakeTimers()
    const realm = startLocalRealm({ city: 'pallet', bots: 0 })
    const got: string[] = []
    realm.socket(`${LOCAL_REALM_URL}${realmPath('cerulean')}`, { open: () => undefined, message: (d) => got.push(String(d)), close: () => undefined })
    vi.advanceTimersByTime(10)
    expect(got).toEqual([JSON.stringify({ t: 'refused', why: 'city' })])
    realm.dispose()
  })
})
