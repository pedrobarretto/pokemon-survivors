import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRealmClient, parseRealmMessage } from './client'
import { LOCAL_REALM_URL, startLocalRealm } from './localRealm'

afterEach(() => vi.useRealTimers())

describe('parseRealmMessage', () => {
  it('drops anything malformed', () => {
    expect(parseRealmMessage('{"t":"said","id":1,"line":"<script>"}')).toBeNull()
    expect(parseRealmMessage('{"t":"moves","rows":[[1,2,3,9,1]]}')).toEqual({ t: 'moves', rows: [] })
    expect(parseRealmMessage('nope')).toBeNull()
  })
})

describe('createRealmClient', () => {
  it('is seated by the in-page realm and hears its room', async () => {
    vi.useFakeTimers()
    const realm = startLocalRealm({ city: 'pallet', bots: 2, random: () => 0.5 })
    const client = createRealmClient({ url: LOCAL_REALM_URL, socket: realm.socket, token: async () => 'me', now: () => Date.now() })
    const seen: string[] = []
    client.onMessage((m) => seen.push(m.t))
    client.join('pallet', 'plaza')
    await vi.advanceTimersByTimeAsync(500)
    expect(client.status().kind).toBe('open')
    expect(seen[0]).toBe('welcome')
    realm.dispose()
  })
})
