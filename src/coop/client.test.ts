import { describe, expect, it } from 'vitest'
import type { ClientMessage, Hello, Member, RoomView } from '../net/protocol'
import type { Store } from './bank'
import { CONNECT, MOVE, createCoopClient, type CoopDeps, type SocketHandlers } from './client'

/** A client on fake sockets: `sockets` are the ones it opened (`urls`: where), `hellos` what each sent first. */
const harness = (over: Partial<CoopDeps> = {}) => {
  let now = 0
  let tokens = 0
  const kept = new Map<string, string>()
  const store: Store = { get: (k) => kept.get(k) ?? null, set: (k, v) => void kept.set(k, v), remove: (k) => void kept.delete(k), keys: () => [...kept.keys()] }
  const sockets: SocketHandlers[] = []
  const urls: string[] = []
  const hellos: Hello[] = []
  const sent: ClientMessage[] = []
  const client = createCoopClient({
    url: 'https://relay.test',
    build: 'b1',
    socket: (url, on) => {
      sockets.push(on)
      urls.push(url)
      return {
        send: (d) => {
          const m = JSON.parse(d) as ClientMessage
          if (m.t === 'hello') hellos.push(m)
          else sent.push(m)
        },
        close: () => {},
        isOpen: () => true,
        buffered: () => 0,
      }
    },
    fetch: () => Promise.reject(new Error('offline')),
    store,
    token: async () => `token-${++tokens}`,
    name: () => '@ash',
    now: () => now,
    random: () => 0.5,
    ...over,
  })
  return { client, sockets, urls, hellos, sent, tick: (ms: number) => (now += ms) }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

const room: RoomView = { code: 'ABCDE', phase: 'playing', members: [], settings: {}, run: 1 }

/** A client seated in a playing room by a relay that does (or doesn't) take batches. */
const seated = async (batch: boolean) => {
  const h = harness()
  void h.client.join('ABCDE')
  await flush()
  h.sockets[0]?.open()
  h.sockets[0]?.message(JSON.stringify({ t: 'welcome', seat: 0, secret: 'secret-0000000000', room, ...(batch ? { batch: true } : {}) }))
  h.client.frame(1 / 60)
  h.sent.length = 0
  return h
}

describe('the co-op client', () => {
  it('asks for a fresh Clerk token on every (re)connect, never reusing one', async () => {
    const h = harness()
    void h.client.join('ABCDE')
    await flush()
    h.sockets[0]?.open()
    // A drop (not a final close): it reconnects after its backoff, with a new token.
    h.sockets[0]?.close(1006)
    h.tick(CONNECT.max * 2)
    h.client.frame(1 / 60)
    await flush()
    h.sockets[1]?.open()
    expect(h.hellos.map((m) => (m.auth.kind === 'clerk' ? m.auth.token : null))).toEqual(['token-1', 'token-2'])
    expect(h.hellos.map((m) => m.name)).toEqual(['@ash', '@ash'])
  })

  it('sends the inputs of a frame and the ping due as one batch, and one by one to a relay without batches', async () => {
    for (const batch of [true, false]) {
      const h = await seated(batch)
      h.client.input({ k: 'special', sample: 1 })
      h.client.input({ k: 'skip', round: 3 })
      h.tick(CONNECT.ping)
      h.client.frame(1 / 60)
      const kinds = h.sent.flatMap((m) => (m.t === 'batch' ? [m.m.map((x) => x.t)] : [[m.t]]))
      expect(kinds).toEqual(batch ? [['in', 'in', 'ping']] : [['in'], ['in'], ['ping']])
    }
  })

  it('stays quiet while nothing is due, then says it is here once a heartbeat', async () => {
    const h = await seated(true)
    for (let ms = 0; ms < CONNECT.heartbeat - 20; ms += 16) {
      h.tick(16)
      h.client.frame(1 / 60)
    }
    expect(h.sent).toEqual([])
    h.tick(20)
    h.client.frame(1 / 60)
    expect(h.sent).toHaveLength(1)
  })
})

describe('moving the room for the group', () => {
  const member = (seat: number, over: Partial<Member> = {}): Member => ({ seat, name: `p${seat}`, account: false, host: seat === 0, online: true, away: false, ready: seat !== 0, loadout: { starter: 'pichu' }, ...over })
  // A Brazilian group in a Cloudflare room (in the US): 150–160 ms from it, 5–30 ms from São Paulo.
  const lobby = (code: string, members: Member[]): RoomView => ({ code, phase: 'lobby', members, settings: { difficulty: 'hard' }, run: 0 })
  const far = { cf: 160, sa: 30 }

  /** The host of Cloudflare room KABCD, with São Paulo making rooms (or not, `made`). */
  const host = async (made: unknown) => {
    const posts: string[] = []
    const h = harness({
      vps: { sa: 'https://sa.test' },
      fetch: async (url, init) => {
        if (init.method === 'POST') posts.push(url)
        if (made === null && init.method === 'POST') throw new Error('offline')
        return { json: async () => (init.method === 'POST' ? made : { ok: true }) }
      },
    })
    void h.client.join('KABCD')
    await flush()
    h.sockets[0]?.open()
    const members = [member(0, { rtt: { cf: 150, sa: 5 } }), member(1, { rtt: far }), member(2, { rtt: far })]
    h.sockets[0]?.message(JSON.stringify({ t: 'welcome', seat: 0, secret: 'secret-0000000000', room: lobby('KABCD', members), batch: true, moves: true }))
    h.sent.length = 0
    return { ...h, posts }
  }

  it("makes a room on the group's relay, follows the old room's word there with the claim, and starts once everyone is in", async () => {
    const h = await host({ code: '3QRST', region: 'sam', claim: 'claim-0000000000000' })
    h.client.start()
    expect(h.client.state().moving).not.toBeNull()
    await flush()
    expect(h.posts).toEqual(['https://sa.test/rooms'])
    expect(h.sent).toEqual([{ t: 'move', code: '3QRST' }])
    h.sockets[0]?.message(JSON.stringify({ t: 'moved', code: '3QRST' }))
    await flush()
    expect(h.urls[1]).toBe('wss://sa.test/rooms/3QRST/ws')
    h.sockets[1]?.open()
    expect(h.hellos[1]).toMatchObject({ room: '3QRST', claim: 'claim-0000000000000' })
    h.sent.length = 0
    h.sockets[1]?.message(JSON.stringify({ t: 'welcome', seat: 1, secret: 'secret-1111111111', room: lobby('3QRST', [member(0, { host: false, loadout: null, ready: false }), member(1, { host: true, loadout: null, ready: false })]), batch: true, moves: true }))
    expect(h.sent).toEqual([{ t: 'loadout', loadout: { starter: 'pichu' } }, { t: 'settings', settings: { difficulty: 'hard' } }])
    h.sent.length = 0
    // One teammate in so far: the run waits for the other.
    h.client.frame(1 / 60)
    expect(h.sent.some((m) => m.t === 'start')).toBe(false)
    h.sockets[1]?.message(JSON.stringify({ t: 'room', room: lobby('3QRST', [member(0, { host: false, ready: true }), member(1, { host: true, ready: false }), member(2)]) }))
    h.client.frame(1 / 60)
    expect(h.sent.filter((m) => m.t === 'start')).toHaveLength(1)
    expect(h.client.state().moving).toBeNull()
  })

  it('starts where the room is when the relay can\'t make one, or when the old room never says moved', async () => {
    const down = await host(null)
    down.client.start()
    await flush()
    await flush()
    expect(down.sent).toEqual([{ t: 'start' }])
    const silent = await host({ code: '3QRST', region: 'sam', claim: 'claim-0000000000000' })
    silent.client.start()
    await flush()
    silent.sent.length = 0
    silent.tick(MOVE.echo + 1)
    silent.client.frame(1 / 60)
    expect(silent.sent.filter((m) => m.t === 'start')).toHaveLength(1)
    expect(silent.urls).toHaveLength(1)
  })

  it("follows an old link's room, bringing a guest's Pokémon and ready", async () => {
    const h = harness()
    void h.client.join('KABCD')
    await flush()
    h.sockets[0]?.open()
    h.sockets[0]?.message(JSON.stringify({ t: 'welcome', seat: 1, secret: 'secret-0000000000', room: lobby('KABCD', [member(0), member(1)]), batch: true, moves: true }))
    h.sockets[0]?.message(JSON.stringify({ t: 'moved', code: '3QRST' }))
    await flush()
    h.sockets[1]?.open()
    expect(h.hellos[1]).toMatchObject({ room: '3QRST' })
    expect(h.hellos[1]).not.toHaveProperty('claim')
    h.sent.length = 0
    h.sockets[1]?.message(JSON.stringify({ t: 'welcome', seat: 1, secret: 'secret-1111111111', room: lobby('3QRST', [member(0), member(1, { loadout: null, ready: false })]), batch: true, moves: true }))
    expect(h.sent).toEqual([{ t: 'loadout', loadout: { starter: 'pichu' } }, { t: 'ready', ready: true }])
    expect(h.client.state()).toMatchObject({ code: '3QRST', moving: null, movedIn: true })
  })
})
