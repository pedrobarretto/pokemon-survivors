import { describe, expect, it } from 'vitest'
import type { ArenaReport } from '../../src/net/arena'
import { COOP_REPORT_PATH, type CoopReport } from '../../src/net/coopReport'
import { ARENA_REPORT_PATH, RETRY_MS, SIGNATURE_HEADER, createOutbox, outcomeOf, parseOutgoing, sign, type Fetcher, type Outgoing } from '../src/report'

const arena = (run = 1): ArenaReport => ({ v: 1, room: 'ABCDE', run, kind: 'ranked', region: 'enam', endedAt: 5000, seats: [{ slot: 0, userId: 'user_ash', handle: 'ash', left: false }], result: { v: 1 } })
const report = (run = 1) => ({ path: ARENA_REPORT_PATH, report: arena(run) })

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
    expect(JSON.parse(posts[0]?.body ?? '')).toEqual(arena())
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

  it("posts a co-op run's report to its own path, apart from an Arena match's of the same room and run", async () => {
    const { posts, fetcher } = api([503])
    const now = { t: 1000 }
    const { box, stored, logs } = outboxWith(fetcher, now)
    const coop: CoopReport = { v: 1, room: 'ABCDE', run: 1, region: 'sam', endedAt: 5000, seats: [], result: { v: 1 }, votes: 2 }
    await box.add({ path: COOP_REPORT_PATH, report: coop })
    await box.add(report())
    expect(posts.map((p) => p.url)).toEqual(['https://api.test/coop/report', 'https://api.test/arena/report'])
    expect(stored.size).toBe(2)
    expect([...stored.values()].map((o) => o.path).sort()).toEqual([ARENA_REPORT_PATH, COOP_REPORT_PATH])
    expect(logs).toEqual(['coop.report.retry', 'arena.report.retry'])
  })

  it('reads an entry stored before entries had a path as an Arena report, and refuses an unknown path', () => {
    const kept = { id: 'ABCDE-1-5000', body: '{}', attempts: 2, at: 7 }
    expect(parseOutgoing(kept)).toEqual({ ...kept, path: ARENA_REPORT_PATH })
    expect(parseOutgoing({ ...kept, path: COOP_REPORT_PATH })?.path).toBe(COOP_REPORT_PATH)
    expect(parseOutgoing({ ...kept, path: '/elsewhere' })).toBeNull()
  })
})
