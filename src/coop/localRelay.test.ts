import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Store } from './bank'
import { localPlayer } from '../game/players'
import { botPick } from './bot'
import { createCoopClient, type CoopClient } from './client'
import { createLocalRelay, LOCAL_RELAY_URL, type LocalRelay } from './localRelay'

const memoryStore = (): Store => {
  const kept = new Map<string, string>()
  return { get: (k) => kept.get(k) ?? null, set: (k, v) => void kept.set(k, v), remove: (k) => void kept.delete(k), keys: () => [...kept.keys()] }
}

const rng = (seed: number) => {
  let s = seed >>> 0 || 1
  return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32
}

/** A guest client on the local relay; `heard` keeps every message the relay sent it. */
const guest = (relay: LocalRelay, seed: number) => {
  const heard: string[] = []
  const client = createCoopClient({
    url: LOCAL_RELAY_URL,
    build: 'b1',
    socket: (url, on) => relay.socket(url, { ...on, message: (d) => (heard.push(String(d)), on.message(d)) }),
    fetch: relay.fetch,
    store: memoryStore(),
    token: async () => null,
    name: () => `@p${seed}`,
    now: () => Date.now(),
    random: rng(seed),
  })
  return { client, heard }
}

/** Real time passing for the relay's timers, the clients' display frames running at 60 Hz. */
const play = async (clients: readonly CoopClient[], ms: number) => {
  for (let t = 0; t < ms; t += 16) {
    await vi.advanceTimersByTimeAsync(16)
    for (const c of clients) c.frame(16 / 1000)
  }
}

describe('the in-page relay', () => {
  beforeEach(() => void vi.useFakeTimers())
  afterEach(() => void vi.useRealTimers())

  it('makes a room, seats its creator and runs a run through the real client', async () => {
    const relay = createLocalRelay({ now: () => Date.now(), random: rng(7) })
    const { client } = guest(relay, 1)
    const made = await client.create()
    if (!made.ok) throw new Error(made.why)
    const joined = client.join(made.code)
    await vi.advanceTimersByTimeAsync(1)
    expect(await joined).toMatchObject({ ok: true, seat: 0 })
    client.setLoadout(botPick(0))
    await play([client], 50)
    client.start()
    // Tick 0 comes `TIMES.startDelay` (3 s) after the start; a second of play after it.
    await play([client], 4000)
    const r = client.state().runner
    if (!r) throw new Error('no run')
    expect(client.state().status.kind).toBe('playing')
    expect(r.next).toBeGreaterThan(30)
    // The run opens on the first move's pick: taking it goes through the relay and starts the run's clock.
    expect(r.game.phase).toBe('levelup')
    client.input({ k: 'pick', screen: 'levelup', round: localPlayer(r.game).round, index: 0 })
    await play([client], 1000)
    expect(r.game.time).toBeGreaterThan(0.5)
    // The lone seat uploads the snapshots, kept in memory: a fresh rejoin (a new tab) restores the agreed one at tick 600.
    expect(r.uploader).toBe(true)
    await play([client], 10_000)
    const syncs: (number | null)[] = []
    client.on((e) => void (e.kind === 'sync' && syncs.push(e.base)))
    client.rejoinFresh()
    // The snapshot inflates on real streams, not on the fake timers: give it real turns until the run moves past it (a slow CI box needs a few).
    await vi.waitFor(
      async () => {
        await play([client], 100)
        expect(client.state().runner?.next).toBeGreaterThan(600)
      },
      { timeout: 10_000, interval: 20 },
    )
    expect(syncs).toEqual([600])
    relay.dispose()
    await vi.advanceTimersByTimeAsync(1)
    expect(client.state().status).toEqual({ kind: 'closed', why: 'expired' })
  })

  it('seats two clients in one room and sends them the same ticks, their hashes agreeing', async () => {
    const relay = createLocalRelay({ now: () => Date.now(), random: rng(9) })
    const a = guest(relay, 1)
    const b = guest(relay, 2)
    const made = await a.client.create()
    if (!made.ok) throw new Error(made.why)
    const joins = [a.client.join(made.code), b.client.join(made.code)]
    await vi.advanceTimersByTimeAsync(1)
    expect((await Promise.all(joins)).map((j) => j.ok && j.seat)).toEqual([0, 1])
    a.client.setLoadout(botPick(0))
    b.client.setLoadout(botPick(1))
    b.client.setReady(true)
    await play([a.client, b.client], 50)
    a.client.start()
    await play([a.client, b.client], 5000)
    const frames = (heard: string[]) => heard.filter((m) => m.startsWith('{"t":"frame"'))
    expect(frames(a.heard).length).toBeGreaterThan(60)
    expect(frames(a.heard)).toEqual(frames(b.heard))
    expect(a.client.state().runner?.start.players.map((p) => p.seat)).toEqual([0, 1])
    // Hashes went every 60 ticks and nobody was told to heal.
    expect([...a.heard, ...b.heard].some((m) => m.startsWith('{"t":"heal"'))).toBe(false)
    relay.dispose()
  })
})
