import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { PROTOCOL, homeOf, type ClientMessage, type Hello, type ServerMessage } from '../../../src/net/protocol'
import { configFrom } from '../src/config'
import { BOUND_REFRESH } from '../../src/room'
import { RESTART_CLOSE } from '../src/rooms'
import { startRelay, type Relay } from '../src/server'

type Client = { ws: WebSocket; inbox: ServerMessage[]; closed: Promise<number> }

const dir = mkdtempSync(join(tmpdir(), 'ps-relay-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const start = (port = 0) => startRelay({ ...configFrom({}), host: '127.0.0.1', port, dataDir: dir, allowGuests: true }, () => undefined)

const isServerMessage = (v: unknown): v is ServerMessage => typeof v === 'object' && v !== null && 't' in v

const open = async (relay: Relay, code: string): Promise<Client> => {
  const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/rooms/${code}/ws`)
  const inbox: ServerMessage[] = []
  ws.addEventListener('message', (e) => {
    const v: unknown = JSON.parse(String(e.data))
    if (isServerMessage(v)) inbox.push(v)
  })
  const closed = new Promise<number>((resolve) => ws.addEventListener('close', (e) => resolve(e.code)))
  await new Promise((resolve) => ws.addEventListener('open', resolve))
  return { ws, inbox, closed }
}

const say = (c: Client, msg: ClientMessage) => c.ws.send(JSON.stringify(msg))

/** Waits for the first message (from the start of the inbox) that `pick` accepts. */
const waitFor = async <T,>(c: Client, pick: (m: ServerMessage) => T | null, ms = 8000): Promise<T> => {
  const until = Date.now() + ms
  while (Date.now() < until) {
    for (const m of c.inbox) {
      const v = pick(m)
      if (v !== null) return v
    }
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error(`timed out; got ${c.inbox.map((m) => m.t).join(',')}`)
}

const hello = (code: string, guest: string, over: Partial<Hello> = {}): Hello => ({
  t: 'hello',
  v: PROTOCOL,
  build: 'b1',
  room: code,
  auth: { kind: 'guest', id: guest },
  secret: null,
  name: guest.slice(0, 5),
  resume: null,
  ...over,
})

const createRoom = async (relay: Relay) => {
  const res = await fetch(`http://127.0.0.1:${relay.port}/rooms`, { method: 'POST', body: JSON.stringify({ v: PROTOCOL, build: 'b1' }) })
  const body: unknown = await res.json()
  if (typeof body !== 'object' || body === null || !('code' in body) || typeof body.code !== 'string') throw new Error(`create failed: ${JSON.stringify(body)}`)
  return body.code
}

const A = 'guest-aaaaaaaaaaaaaaaa'
const B = 'guest-bbbbbbbbbbbbbbbb'

describe('São Paulo relay', () => {
  it('makes rooms of its own home and refuses codes it has no room for', async () => {
    const relay = await start()
    const health: unknown = await (await fetch(`http://127.0.0.1:${relay.port}/health`)).json()
    expect(health).toMatchObject({ ok: true, protocol: PROTOCOL, home: 'sa' })
    const code = await createRoom(relay)
    expect(homeOf(code)).toBe('sa')
    expect(code).toMatch(/^[2-5]/)
    const c = await open(relay, 'K7QF2')
    say(c, hello('K7QF2', A))
    expect(await waitFor(c, (m) => (m.t === 'refused' ? m.code : null))).toBe('unavailable')
    await relay.close()
  })

  it('waits for the relay holding the data dir to stop before loading its rooms', async () => {
    const first = await start()
    let up = false
    const second = start().then((r) => ((up = true), r))
    await new Promise((r) => setTimeout(r, 600))
    expect(up).toBe(false)
    await first.close()
    await (await second).close()
  })

  it('keeps a run through a restart: clients are told to reconnect, resume from their tick, the log survives', async () => {
    const relay = await start()
    const code = await createRoom(relay)
    const a = await open(relay, code)
    say(a, hello(code, A))
    const secretA = await waitFor(a, (m) => (m.t === 'welcome' ? m.secret : null))
    say(a, { t: 'loadout', loadout: { starter: 'pichu' } })
    const b = await open(relay, code)
    say(b, hello(code, B))
    const secretB = await waitFor(b, (m) => (m.t === 'welcome' ? m.secret : null))
    say(b, { t: 'loadout', loadout: { starter: 'gible' } })
    say(b, { t: 'ready', ready: true })
    await waitFor(a, (m) => (m.t === 'room' && m.room.members[1]?.ready ? true : null))
    say(a, { t: 'start' })
    await waitFor(b, (m) => (m.t === 'start' ? true : null))

    say(a, { t: 'in', k: 'move', d: [7] })
    const stamped = await waitFor(b, (m) => (m.t === 'frame' ? (m.ticks.find(([, es]) => es.some((e) => e[0] === 0 && e[2] === 7))?.[0] ?? null) : null), 12_000)
    await new Promise((r) => setTimeout(r, 300))
    const seen = Math.max(...a.inbox.flatMap((m) => (m.t === 'frame' ? [m.to] : [])))

    // A deploy: the process stops, every socket told it's a restart.
    await relay.close()
    expect(await Promise.all([a.closed, b.closed])).toEqual([RESTART_CLOSE, RESTART_CLOSE])
    const next = await start()

    // A comes back with its state at `seen`: it gets the tail from there, nothing replayed.
    const a2 = await open(next, code)
    say(a2, hello(code, A, { secret: secretA, resume: { run: 1, from: seen } }))
    const sync = await waitFor(a2, (m) => (m.t === 'sync' ? m : null))
    expect(sync).toMatchObject({ reason: 'resume', from: seen })
    // The clock resumes at its bound, past every tick sent (`room.ts`).
    expect(sync.to - seen).toBeGreaterThanOrEqual(BOUND_REFRESH)
    const live = await waitFor(a2, (m) => (m.t === 'frame' && m.from >= sync.to ? m : null))
    expect(live.from).toBe(sync.to)

    // B lost its state: it starts from the seed and gets the whole (short) log, with A's input where it was stamped.
    const b2 = await open(next, code)
    say(b2, hello(code, B, { secret: secretB }))
    const fresh = await waitFor(b2, (m) => (m.t === 'sync' ? m : null))
    expect(fresh).toMatchObject({ reason: 'join', from: 0, base: null })
    const replayed = await waitFor(b2, (m) => (m.t === 'frame' && m.from === 0 ? m : null))
    expect(replayed.ticks).toContainEqual([stamped, [[0, 'move', 7]]])
    await next.close()
  })

  it('takes no new room past its capacity or while starved, but still seats players in the rooms it has', async () => {
    const own = mkdtempSync(join(tmpdir(), 'ps-relay-full-'))
    const relay = await startRelay({ ...configFrom({ MAX_ROOMS: '1' }), host: '127.0.0.1', port: 0, dataDir: own, allowGuests: true }, () => undefined)
    const health = async () => (await fetch(`http://127.0.0.1:${relay.port}/health`)).json()
    const post = () => fetch(`http://127.0.0.1:${relay.port}/rooms`, { method: 'POST', body: JSON.stringify({ v: PROTOCOL, build: 'b1' }) })
    expect(await health()).toMatchObject({ rooms: 0, full: false })
    const code = await createRoom(relay)
    expect(await health()).toMatchObject({ rooms: 1, full: true })
    const refused = await post()
    expect(refused.status).toBe(503)
    expect(await refused.json()).toEqual({ error: 'full' })
    // Joining the room it has is never refused for capacity.
    const a = await open(relay, code)
    say(a, hello(code, A))
    await waitFor(a, (m) => (m.t === 'welcome' ? true : null))
    const b = await open(relay, code)
    say(b, hello(code, B))
    await waitFor(b, (m) => (m.t === 'welcome' ? true : null))
    await relay.close()

    // Room to spare, but a starved event loop: still full, until a calm minute.
    const roomy = await startRelay({ ...configFrom({}), host: '127.0.0.1', port: 0, dataDir: own, allowGuests: true }, () => undefined)
    roomy.setLoad({ loopP99Ms: 75, hostBusyPct: 40 })
    const starved = await fetch(`http://127.0.0.1:${roomy.port}/rooms`, { method: 'POST', body: JSON.stringify({ v: PROTOCOL, build: 'b1' }) })
    expect(starved.status).toBe(503)
    roomy.setLoad({ loopP99Ms: 7, hostBusyPct: 40 })
    expect(homeOf(await createRoom(roomy))).toBe('sa')
    await roomy.close()
    rmSync(own, { recursive: true, force: true })
  })
})
