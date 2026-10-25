import { abortAllDurableObjects, runInDurableObject } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { randomCode } from '../src/codes'
import { LOG_BATCH, TIMES } from '../src/room'
import type { ShardObject } from '../src/shardObject'
import { shardCode, shardName, shardOf } from '../src/shards'
import { CLOSE_CODES, PROTOCOL, type ClientMessage, type CreateResponse, type Hello, type ServerMessage } from '../../src/net/protocol'

type Client = { ws: WebSocket; inbox: ServerMessage[]; closed: Promise<number>; closedWith: number | null }

const isServerMessage = (v: unknown): v is ServerMessage => typeof v === 'object' && v !== null && 't' in v

const open = async (code: string): Promise<Client> => {
  const res = await exports.default.fetch(`https://relay.test/rooms/${code}/ws`, { headers: { Upgrade: 'websocket' } })
  const ws = res.webSocket
  if (!ws) throw new Error(`no socket: ${res.status}`)
  ws.accept()
  const inbox: ServerMessage[] = []
  ws.addEventListener('message', (e) => {
    const v: unknown = JSON.parse(String(e.data))
    if (isServerMessage(v)) inbox.push(v)
  })
  const client: Client = { ws, inbox, closed: Promise.resolve(0), closedWith: null }
  client.closed = new Promise<number>((resolve) =>
    ws.addEventListener('close', (e) => {
      client.closedWith = e.code
      resolve(e.code)
    }),
  )
  return client
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

const createRoom = async () => {
  const res = await exports.default.fetch('https://relay.test/rooms', { method: 'POST', body: JSON.stringify({ v: PROTOCOL, build: 'b1' }) })
  const body: CreateResponse = await res.json()
  if (!('code' in body)) throw new Error(`create failed: ${JSON.stringify(body)}`)
  return body.code
}

const A = 'guest-aaaaaaaaaaaaaaaa'
const B = 'guest-bbbbbbbbbbbbbbbb'
const C = 'guest-cccccccccccccccc'

/** Joins A then B to `code`, readies them and starts a run: both clients with their secrets. */
const playing = async (code: string) => {
  const a = await open(code)
  say(a, hello(code, A))
  const secretA = await waitFor(a, (m) => (m.t === 'welcome' ? m.secret : null))
  say(a, { t: 'loadout', loadout: { starter: 'pichu' } })
  const b = await open(code)
  say(b, hello(code, B))
  const secretB = await waitFor(b, (m) => (m.t === 'welcome' ? m.secret : null))
  say(b, { t: 'loadout', loadout: { starter: 'gible' } })
  say(b, { t: 'ready', ready: true })
  await waitFor(a, (m) => (m.t === 'room' && m.room.members[1]?.ready ? true : null))
  say(a, { t: 'start' })
  await waitFor(b, (m) => (m.t === 'start' ? true : null))
  return { a, b, secretA, secretB }
}

/** The tick a stick input `v` from seat 0 was stamped at, as `c` saw it. */
const stampedAt = (c: Client, v: number) => waitFor(c, (m) => (m.t === 'frame' ? (m.ticks.find(([, es]) => es.some((e) => e[0] === 0 && e[2] === v))?.[0] ?? null) : null), 12_000)

/** The last tick `c` has seen go out. */
const seen = (c: Client) => Math.max(0, ...c.inbox.flatMap((m) => (m.t === 'frame' ? [m.to] : [])))

/** The shard a code names (all these tests' rooms are `auto`: no location in the test runtime). */
const shardOfCode = (code: string) => {
  const s = shardOf(code)
  if (!s) throw new Error(`${code} names no shard`)
  return env.SHARDS.getByName(shardName(s))
}

describe('relay', () => {
  it('serves a real health check', async () => {
    const res = await exports.default.fetch('https://relay.test/health')
    expect(await res.json()).toMatchObject({ ok: true, protocol: PROTOCOL })
  })

  it('keeps a run through a Durable Object restart that lost the newest second of log: clients resume, no tick is sent twice', async () => {
    const code = await createRoom()
    const { a, b, secretA, secretB } = await playing(code)

    say(a, { t: 'in', k: 'move', d: [7] })
    const kept = await stampedAt(b, 7)
    // The log goes to storage once a second of ticks: right after the batch holding move 7 is written...
    const batch = (Math.floor(kept / LOG_BATCH) + 1) * LOG_BATCH
    await waitFor(a, (m) => (m.t === 'frame' && m.to >= batch ? true : null))
    // ...move 8 goes out to everyone, and the relay crashes before its batch is (a deploy tears it down at once, storage stays).
    say(a, { t: 'in', k: 'move', d: [8] })
    const lost = await stampedAt(b, 8)
    await abortAllDurableObjects()
    await Promise.all([a.closed, b.closed])
    expect(lost).toBeLessThan(batch + LOG_BATCH)
    const sentTo = Math.max(seen(a), seen(b))

    // A comes back with its state (move 8 included): it resumes from its tick, and the clock goes on past every tick it ever sent.
    const a2 = await open(code)
    say(a2, hello(code, A, { secret: secretA, resume: { run: 1, from: seen(a) } }))
    const sync = await waitFor(a2, (m) => (m.t === 'sync' ? m : null))
    expect(sync).toMatchObject({ reason: 'resume', from: seen(a) })
    expect(sync.to).toBeGreaterThanOrEqual(sentTo)
    const live = await waitFor(a2, (m) => (m.t === 'frame' && m.from >= sync.to ? m : null), 15_000)
    expect(live.from).toBe(sync.to)

    // B lost its state: it rebuilds from the seed and the log, which kept move 7 and lost move 8 (the hash check heals whoever ends up apart).
    const b2 = await open(code)
    say(b2, hello(code, B, { secret: secretB }))
    const fresh = await waitFor(b2, (m) => (m.t === 'sync' ? m : null))
    expect(fresh).toMatchObject({ reason: 'join', from: 0, base: null })
    const replayed = await waitFor(b2, (m) => (m.t === 'frame' && m.from === 0 ? m : null))
    expect(replayed.ticks).toContainEqual([kept, [[0, 'move', 7]]])
    expect(replayed.ticks.flatMap(([, es]) => es).some((e) => e[2] === 8)).toBe(false)
  })

  it('brings every room of a shard back after a restart: each run resumes past every tick it sent, a lobby keeps its seats', async () => {
    const codes = [await createRoom(), await createRoom(), await createRoom()]
    expect(new Set(codes.map((c) => shardName(shardOf(c) ?? { region: 'auto', index: -1 })))).toEqual(new Set(['auto:0']))
    const [lobbyCode, ...runCodes] = codes as [string, string, string]
    const lobby = await open(lobbyCode)
    say(lobby, hello(lobbyCode, C))
    const lobbySecret = await waitFor(lobby, (m) => (m.t === 'welcome' ? m.secret : null))
    const runs = await Promise.all(runCodes.map(playing))
    await Promise.all(runs.map(async ({ a, b }, i) => {
      say(a, { t: 'in', k: 'move', d: [20 + i] })
      await stampedAt(b, 20 + i)
    }))

    await abortAllDurableObjects()
    await Promise.all([lobby.closed, ...runs.flatMap(({ a, b }) => [a.closed, b.closed])])

    const back = await open(lobbyCode)
    say(back, hello(lobbyCode, C, { secret: lobbySecret }))
    expect(await waitFor(back, (m) => (m.t === 'welcome' ? m.seat : null))).toBe(0)
    await Promise.all(runs.map(async ({ a, b, secretA }, i) => {
      const code = runCodes[i] ?? ''
      const a2 = await open(code)
      say(a2, hello(code, A, { secret: secretA, resume: { run: 1, from: seen(a) } }))
      const sync = await waitFor(a2, (m) => (m.t === 'sync' ? m : null))
      expect(sync).toMatchObject({ reason: 'resume', from: seen(a) })
      expect(sync.to).toBeGreaterThanOrEqual(Math.max(seen(a), seen(b)))
      const live = await waitFor(a2, (m) => (m.t === 'frame' && m.from >= sync.to ? m : null), 15_000)
      expect(live.from).toBe(sync.to)
    }))
  })

  it('keeps a room that throws from the rest of its shard: it starts over from its storage, the others play on', async () => {
    const [broken, fine] = [await createRoom(), await createRoom()]
    expect(shardOf(broken)).toEqual(shardOf(fine))
    const first = await open(broken)
    say(first, hello(broken, A))
    const secret = await waitFor(first, (m) => (m.t === 'welcome' ? m.secret : null))
    const { a, b } = await playing(fine)
    await waitFor(b, (m) => (m.t === 'frame' ? true : null))

    // A bug in one room's step: the next seat it makes throws.
    await runInDurableObject(shardOfCode(broken), (shard: ShardObject) => {
      const room = shard.rooms.get(broken)
      if (!room) throw new Error('no room')
      room.state.gen = {
        secret: () => {
          throw new Error('boom')
        },
        seed: () => 1,
      }
    })
    const second = await open(broken)
    say(second, hello(broken, B))
    expect(await first.closed).toBe(1012)

    // The other room's run went on, its sockets untouched...
    const after = seen(b)
    say(a, { t: 'in', k: 'move', d: [31] })
    expect(await stampedAt(b, 31)).toBeGreaterThanOrEqual(after)
    expect([a.closedWith, b.closedWith]).toEqual([null, null])
    // ...and the broken one came back from its storage, its seat kept and its randomness its own again.
    const again = await open(broken)
    say(again, hello(broken, A, { secret }))
    expect(await waitFor(again, (m) => (m.t === 'welcome' ? m.seat : null))).toBe(0)
    const third = await open(broken)
    say(third, hello(broken, B))
    expect(await waitFor(third, (m) => (m.t === 'welcome' ? m.seat : null))).toBe(1)
  })

  it('deletes an expired room\'s keys and leaves the other rooms of its shard theirs', async () => {
    const [gone, stays] = [await createRoom(), await createRoom()]
    const { a } = await playing(stays)
    await waitFor(a, (m) => (m.t === 'frame' && m.to >= 2 * LOG_BATCH ? true : null))
    const keysOf = (storage: DurableObjectStorage, code: string) => [...storage.kv.list({ prefix: `r:${code}:` })].length + (storage.kv.get(`room:${code}`) === undefined ? 0 : 1)
    const left = await runInDurableObject(shardOfCode(gone), async (shard: ShardObject, state) => {
      const room = shard.rooms.get(gone)
      if (!room?.state.room) throw new Error('no room')
      // Six hours on, as far as this room knows.
      room.state.room.createdAt -= TIMES.maxAge
      room.deadline = 0
      await shard.alarm()
      return { gone: keysOf(state.storage, gone), stays: keysOf(state.storage, stays), rooms: [...shard.rooms.keys()] }
    })
    expect(left.gone).toBe(0)
    expect(left.stays).toBeGreaterThan(1)
    expect(left.rooms).toContain(stays)
    expect(left.rooms).not.toContain(gone)
  })

  it('refuses a code with no room, one naming a shard and one naming none', async () => {
    const named = shardCode({ region: 'auto', index: 0 }, (n) => crypto.getRandomValues(new Uint8Array(n)))
    for (const code of [named, randomCode('sa')]) {
      const c = await open(code)
      expect(await waitFor(c, (m) => (m.t === 'refused' ? m.code : null))).toBe('unavailable')
      expect(await c.closed).toBe(CLOSE_CODES.refused)
    }
  })
})
