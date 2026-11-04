import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { REALM_PROTOCOL, type RealmClientMessage, type RealmServerMessage } from '../../../src/net/realm'
import { REALM_ROOMS } from '../../../src/data/realmMap'
import { configFrom } from '../src/config'
import { startRelay, type Relay } from '../src/server'

type Client = { ws: WebSocket; inbox: RealmServerMessage[]; closed: Promise<number> }

const dir = mkdtempSync(join(tmpdir(), 'ps-realm-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const start = () => startRelay({ ...configFrom({}), host: '127.0.0.1', port: 0, dataDir: dir, allowGuests: true }, () => undefined)

const isMessage = (v: unknown): v is RealmServerMessage => typeof v === 'object' && v !== null && 't' in v

const open = async (relay: Relay, city: string): Promise<Client> => {
  const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/realm/${city}/ws`)
  const inbox: RealmServerMessage[] = []
  ws.addEventListener('message', (e) => {
    const v: unknown = JSON.parse(String(e.data))
    if (isMessage(v)) inbox.push(v)
  })
  const closed = new Promise<number>((resolve) => ws.addEventListener('close', (e) => resolve(e.code)))
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  return { ws, inbox, closed }
}

const say = (c: Client, msg: RealmClientMessage) => c.ws.send(JSON.stringify(msg))

const waitFor = async <T,>(c: Client, pick: (m: RealmServerMessage) => T | null, ms = 5000): Promise<T> => {
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

const helloAs = (guest: string): RealmClientMessage => ({ t: 'hello', v: REALM_PROTOCOL, city: 'pallet', token: `guest:${guest}`, room: 'plaza' })

describe('the realm on the São Paulo relay', () => {
  it('seats guests on a dev relay, shows them to each other and relays their walk', async () => {
    const relay = await start()
    try {
      const a = await open(relay, 'pallet')
      say(a, helloAs('ash'))
      const you = await waitFor(a, (m) => (m.t === 'welcome' ? m.you : null))
      const b = await open(relay, 'pallet')
      say(b, helloAs('misty'))
      const seen = await waitFor(b, (m) => (m.t === 'welcome' ? m.avatars.map((v) => v.handle).sort() : null))
      expect(seen).toEqual(['ash', 'misty'])
      expect(await waitFor(a, (m) => (m.t === 'join' ? m.avatar.handle : null))).toBe('misty')
      const { x, y } = REALM_ROOMS.plaza.spawn
      say(a, { t: 'move', x: x + 10, y, facing: 2, moving: true })
      expect(await waitFor(b, (m) => (m.t === 'moves' ? m.rows.find((r) => r[0] === you) ?? null : null))).toEqual([you, x + 10, y, 2, 1])
      const health: unknown = await (await fetch(`http://127.0.0.1:${relay.port}/health`)).json()
      expect(health).toMatchObject({ realm: { sockets: 2, trainers: 2, cities: { pallet: 2 } } })
      a.ws.close()
      b.ws.close()
    } finally {
      await relay.close()
    }
  })

  it('refuses a city it isn’t home to and a token it can’t verify', async () => {
    const relay = await start()
    try {
      await expect(open(relay, 'atlantis')).rejects.toBeDefined()
      const c = await open(relay, 'pallet')
      say(c, { t: 'hello', v: REALM_PROTOCOL, city: 'pallet', token: 'not-a-token', room: 'plaza' })
      expect(await waitFor(c, (m) => (m.t === 'refused' ? m.why : null))).toBe('signIn')
      expect(await c.closed).toBe(4100)
    } finally {
      await relay.close()
    }
  })
})
