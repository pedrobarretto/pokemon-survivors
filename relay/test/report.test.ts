import { describe, expect, it } from 'vitest'
import type { ArenaReport } from '../../src/net/arena'
import { RETRY_MS, SIGNATURE_HEADER, createOutbox, lookUpLooks, outcomeOf, sign, type Fetcher, type Outgoing } from '../src/report'

const report = (run = 1): ArenaReport => ({ v: 1, room: 'ABCDE', run, kind: 'ranked', region: 'enam', endedAt: 5000, seats: [{ slot: 0, userId: 'user_ash', handle: 'ash', left: false }], result: { v: 1 } })

/** A fake API answering each post with the next status of `statuses` (the last one after that), recording what came. */
const api = (statuses: number[]) => {
  const posts: { url: string; body: string; signature: string | null }[] = []
  const fetcher: Fetcher = async (url, init) => {
    const body = typeof init.body === 'string' ? init.body : ''
    posts.push({ url, body, signature: new Headers(init.headers).get(SIGNATURE_HEADER) })
    return new Response(null, { status: statuses[Math.min(posts.length - 1, statuses.length - 1)] ?? 200 })
  }
  return { posts, fetcher }
}

const outboxWith = (fetcher: Fetcher, now: { t: number }, withApi = true) => {
  const stored = new Map<string, Outgoing>()
  const logs: string[] = []
  const box = createOutbox({
    api: withApi ? { url: 'https://api.test', secret: 's3cret' } : null,
    save: (o) => stored.set(o.id, o),
    remove: (id) => stored.delete(id),
    log: (ev) => logs.push(ev),
    now: () => now.t,
    changed: () => undefined,
    fetcher,
  })
  return { box, stored, logs }
}

describe('arena reports', () => {
  it('signs with hex HMAC-SHA256 (RFC 4231, case 2)', async () => {
    expect(await sign('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })

  it('posts a report once, signed over its exact body, and forgets it when the API takes it', async () => {
    const { posts, fetcher } = api([200])
    const now = { t: 1000 }
    const { box, stored, logs } = outboxWith(fetcher, now)
    await box.add(report())
    expect(posts).toHaveLength(1)
    expect(posts[0]?.url).toBe('https://api.test/arena/report')
    expect(JSON.parse(posts[0]?.body ?? '')).toEqual(report())
    expect(posts[0]?.signature).toBe(await sign('s3cret', posts[0]?.body ?? ''))
    expect(stored.size).toBe(0)
    expect(logs).toEqual(['arena.report.sent'])
  })

  it('tries again with backoff when the API is down, and drops what it refuses', async () => {
    const { posts, fetcher } = api([503, 200])
    const now = { t: 1000 }
    const { box, stored } = outboxWith(fetcher, now)
    await box.add(report())
    expect(box.next()).toBe(1000 + RETRY_MS[1])
    await box.flush()
    expect(posts).toHaveLength(1)
    now.t += RETRY_MS[1]
    await box.flush()
    expect(posts).toHaveLength(2)
    expect(stored.size).toBe(0)
    expect(box.next()).toBeNull()

    expect([200, 204, 409].map(outcomeOf)).toEqual(['done', 'done', 'done'])
    expect([null, 500, 503, 429, 408].map(outcomeOf)).toEqual(['retry', 'retry', 'retry', 'retry', 'retry'])
    expect([400, 401, 422].map(outcomeOf)).toEqual(['drop', 'drop', 'drop'])
  })

  it('gives up after the last retry, and posts nothing without an API', async () => {
    const down = api([503])
    const now = { t: 0 }
    const { box } = outboxWith(down.fetcher, now)
    await box.add(report())
    for (const wait of RETRY_MS.slice(1)) {
      now.t += wait
      await box.flush()
    }
    expect(down.posts).toHaveLength(RETRY_MS.length)
    expect(box.size()).toBe(0)

    const none = api([200])
    const { box: off, logs } = outboxWith(none.fetcher, now, false)
    await off.add(report())
    expect(none.posts).toHaveLength(0)
    expect(logs).toEqual(['arena.report.noApi'])
  })
})

describe('looks for a friends\' Arena room', () => {
  const API = { url: 'https://api.test', secret: 's3cret' }

  it("asks for the accounts' looks, signed, and keeps only well-shaped ones by identity", async () => {
    const posts: { url: string; body: string; signature: string | null }[] = []
    const fetcher: Fetcher = async (url, init) => {
      const body = typeof init.body === 'string' ? init.body : ''
      posts.push({ url, body, signature: new Headers(init.headers).get(SIGNATURE_HEADER) })
      return Response.json({ looks: { user_ash: { head: 'strawHat' }, user_brock: { head: 7 } } })
    }
    expect(await lookUpLooks(API, ['u:user_ash', 'u:user_brock', 'g:guest'], fetcher)).toEqual({ 'u:user_ash': { head: 'strawHat' } })
    expect(posts).toEqual([{ url: 'https://api.test/arena/looks', body: '{"userIds":["user_ash","user_brock"]}', signature: await sign('s3cret', '{"userIds":["user_ash","user_brock"]}') }])
  })

  it('vouches for nothing when the API fails, is older or is unset', async () => {
    expect(await lookUpLooks(API, ['u:user_ash'], async () => new Response(null, { status: 404 }))).toEqual({})
    expect(await lookUpLooks(API, ['u:user_ash'], async () => Promise.reject(new Error('down')))).toEqual({})
    expect(await lookUpLooks(null, ['u:user_ash'])).toEqual({})
  })
})
