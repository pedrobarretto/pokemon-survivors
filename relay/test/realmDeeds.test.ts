import { describe, expect, it } from 'vitest'
import { DEED_COOLDOWN_MS } from '../../src/data/realmStamps'
import { REALM_PROTOCOL, type RealmClientMessage, type RealmIdentity, type RealmServerMessage } from '../../src/net/realm'
import { DEEDS_EVERY_MS, DEEDS_MAX } from '../../src/net/realmRelay'
import { connect, createRealm, deedsAnswered, disconnect, hello, identified, message, tick, visited, type RealmEffect, type RealmState } from '../src/realm'
import { noteDeed, takeReport } from '../src/realmDeeds'

/** 00:16:40 UTC: no Hora do Realm and not the owl's hour. */
const T0 = 1_000_000

const sent = (effects: readonly RealmEffect[], to: string): RealmServerMessage[] => effects.flatMap((e) => (e.k === 'send' && e.to === to ? [e.msg] : []))

const join = (state: RealmState, conn: string, user: string, room = 'plaza', now = T0, over: Partial<RealmIdentity> = {}) => {
  connect(state, conn, 'pallet', now)
  const ask = hello(state, conn, { t: 'hello', v: REALM_PROTOCOL, city: 'pallet', token: 'tok', room }, user, now).find((e) => e.k === 'identify')
  if (ask?.k !== 'identify') throw new Error('no identify ask')
  const out = identified(state, ask.ask, { identities: { [user]: { userId: user, handle: user, partner: 'charmander', shiny: false, look: {}, supporter: null, stamps: 0, ...over } }, banned: [] }, now)
  const welcome = sent(out, conn).find((m) => m.t === 'welcome')
  if (welcome?.t !== 'welcome') throw new Error('not seated')
  return welcome.you
}

const trainer = (state: RealmState, id: number) => state.cities.get('pallet')!.trainers.get(id)!

/** A beat at `now`, sockets kept alive; the deeds report's entries if one went out. */
const beat = (state: RealmState, now: number) => {
  for (const c of state.conns.values()) c.heard = now
  for (const city of state.cities.values()) for (const t of city.trainers.values()) t.active = now
  return tick(state, now)
}

const reportOf = (effects: readonly RealmEffect[]) => effects.flatMap((e) => (e.k === 'deeds' ? [e] : []))[0]

/** Everything noted so far, as `user:deed`, the report answered (so the next can go). */
const flush = (state: RealmState, now: number): string[] => {
  const r = reportOf(beat(state, now))
  if (!r) return []
  deedsAnswered(state, r.ask, { stamps: {}, errands: {} })
  return r.report.deeds.map((d) => `${d.userId}:${d.deed}`)
}

const act = (state: RealmState, conn: string, msg: RealmClientMessage, now = T0) => message(state, conn, msg, now)

describe('what the relay sees trainers do', () => {
  it('notes a room on landing, once a cooldown however often it comes back or reconnects', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1')
    expect(flush(state, T0 + DEEDS_EVERY_MS)).toEqual(['u1:room:plaza'])
    disconnect(state, 'a', T0 + 4000)
    join(state, 'a2', 'u1', 'plaza', T0 + 5000)
    expect(flush(state, T0 + 2 * DEEDS_EVERY_MS)).toEqual([])
    disconnect(state, 'a2', T0 + DEED_COOLDOWN_MS + 1)
    join(state, 'a3', 'u1', 'plaza', T0 + DEED_COOLDOWN_MS + 2)
    expect(flush(state, T0 + DEED_COOLDOWN_MS + DEEDS_EVERY_MS)).toEqual(['u1:room:plaza'])
  })

  it('notes talk, emotes, seats and a nap on a town bench, but never a cosmetic emote', () => {
    const state = createRealm('sa', T0)
    const a = join(state, 'a', 'u1')
    flush(state, T0 + DEEDS_EVERY_MS)
    const t = trainer(state, a)
    // Spot 3 of the plaza is a bench.
    t.x = 172
    t.y = 314
    act(state, 'a', { t: 'say', line: 'hello' }, T0 + 3100)
    act(state, 'a', { t: 'emote', emote: 'wave' }, T0 + 3200)
    act(state, 'a', { t: 'perch', piece: { spot: 3 }, seat: 0 }, T0 + 3300)
    act(state, 'a', { t: 'emote', emote: 'sleep' }, T0 + 3400)
    act(state, 'a', { t: 'emote', emote: 'look' }, T0 + 3500)
    expect(flush(state, T0 + 2 * DEEDS_EVERY_MS).sort()).toEqual(['u1:bench:plaza:3', 'u1:emote:sleep', 'u1:emote:wave', 'u1:napBench', 'u1:say', 'u1:sit'])
  })


  it('counts a base visit for the visitor and hosting for its owner at home', () => {
    const state = createRealm('sa', T0)
    join(state, 'o', 'u1', 'base:u1')
    join(state, 'v', 'u2')
    flush(state, T0 + DEEDS_EVERY_MS)
    const go = act(state, 'v', { t: 'go', room: 'base:u1', x: 50, y: 50 }, T0 + 3100).find((e) => e.k === 'visit')
    if (go?.k !== 'visit') throw new Error('no visit ask')
    visited(state, go.ask, { allowed: true }, T0 + 3200)
    expect(flush(state, T0 + 2 * DEEDS_EVERY_MS).filter((d) => d.includes('base')).sort()).toEqual(['u1:base:host', 'u2:base:visit'])
  })

  it('counts a minute with someone in the same room, and starts over on leaving it', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1', 'cafe')
    let t = T0 + DEEDS_EVERY_MS
    expect(flush(state, t)).toEqual(['u1:room:cafe'])
    t += 30 * DEEDS_EVERY_MS
    expect(flush(state, t)).toEqual([])
    const b = join(state, 'b', 'u2', 'cafe', t, { partner: 'pichu' })
    t += DEEDS_EVERY_MS
    expect(flush(state, t)).toEqual(['u2:room:cafe'])
    t += 60_000
    expect(flush(state, t).sort()).toEqual(['u1:company', 'u2:company'])
    expect(trainer(state, b).company).toBe(t)
    trainer(state, b).x = 200
    trainer(state, b).y = 272
    act(state, 'b', { t: 'go', room: 'plaza', x: 320, y: 136 }, t + 1)
    expect(trainer(state, b).company).toBeNull()
  })

  it('finds a crowd, a twin, the lagoon and the small hours on the scan', () => {
    const state = createRealm('sa', T0)
    const ids = ['u1', 'u2', 'u3', 'u4', 'u5'].map((u, i) => join(state, u, u, 'pier', T0, { partner: i === 0 ? 'pichu' : i === 1 ? 'pichu' : 'mew' }))
    const a = trainer(state, ids[0]!)
    a.x = 340
    a.y = 304
    const deeds = flush(state, T0 + DEEDS_EVERY_MS)
    expect(deeds).toEqual(expect.arrayContaining(['u1:crowd', 'u1:twin', 'u2:twin', 'u1:lagoon']))
    expect(deeds).not.toContain('u3:lagoon')
    const night = createRealm('sa', Date.UTC(2026, 10, 9, 5, 59, 59))
    join(night, 'a', 'u1', 'plaza', Date.UTC(2026, 10, 9, 5, 59, 59))
    expect(flush(night, Date.UTC(2026, 10, 9, 6, 0, 3))).toContain('u1:owl')
  })

  it('counts a Hora do Realm once a window, and only in its room', () => {
    // 2026-11-09 12:00 UTC is a window (the kinds rotate with the day).
    const start = Date.UTC(2026, 10, 9, 12)
    const day = Math.floor(start / 86_400_000)
    const kind = (['tide', 'storm', 'tables'] as const)[(day + 1) % 3]!
    const room = { tide: 'pier', storm: 'arcade', tables: 'cafe' }[kind]
    const state = createRealm('sa', start)
    join(state, 'a', 'u1', room, start)
    join(state, 'b', 'u2', 'trail', start)
    const first = flush(state, start + 3000)
    expect(first).toEqual(expect.arrayContaining([`u1:event:${kind}`, 'u1:event']))
    expect(first.some((d) => d.startsWith('u2:event'))).toBe(false)
    expect(flush(state, start + 5 * 60_000).filter((d) => d.includes('event'))).toEqual([])
  })

  it('counts a table game played out, and nothing for one forfeited', () => {
    const state = createRealm('sa', T0)
    const a = join(state, 'a', 'u1', 'cafe')
    const b = join(state, 'b', 'u2', 'cafe')
    for (const id of [a, b]) {
      trainer(state, id).x = 110
      trainer(state, id).y = 280
    }
    act(state, 'a', { t: 'sit', table: 'cafe-1', game: 'fourInRow' })
    act(state, 'b', { t: 'sit', table: 'cafe-1', game: 'fourInRow' })
    const tb = state.cities.get('pallet')!.tables.get('cafe#cafe-1')!
    const first = tb.awaited[0]!
    const [mover, other, moverUser, otherUser] = first === 0 ? ['a', 'b', 'u1', 'u2'] : ['b', 'a', 'u2', 'u1']
    for (const col of [0, 1, 0, 1, 0, 1, 0]) act(state, col === 0 ? mover : other, { t: 'play', move: col }, T0 + 100)
    expect(flush(state, T0 + DEEDS_EVERY_MS)).toEqual(expect.arrayContaining([`${moverUser}:table:human`, `${otherUser}:table:human`, `${moverUser}:table:win`]))

    const quit = createRealm('sa', T0)
    const c = join(quit, 'c', 'u3', 'cafe')
    const d = join(quit, 'd', 'u4', 'cafe')
    for (const id of [c, d]) {
      trainer(quit, id).x = 110
      trainer(quit, id).y = 280
    }
    act(quit, 'c', { t: 'sit', table: 'cafe-1', game: 'fourInRow' })
    act(quit, 'd', { t: 'sit', table: 'cafe-1', game: 'fourInRow' })
    act(quit, 'c', { t: 'stand' })
    expect(flush(quit, T0 + DEEDS_EVERY_MS).filter((x) => x.includes('table'))).toEqual([])
  })
})

describe('the deeds report', () => {
  it('goes one at a time, empty while anyone walks, and not at all with nobody', () => {
    const state = createRealm('sa', T0)
    expect(reportOf(beat(state, T0 + DEEDS_EVERY_MS))).toBeUndefined()
    join(state, 'a', 'u1', 'plaza', T0 + DEEDS_EVERY_MS)
    const first = reportOf(beat(state, T0 + 2 * DEEDS_EVERY_MS))!
    expect(first.report.deeds).toEqual([{ userId: 'u1', deed: 'room:plaza' }])
    expect(reportOf(beat(state, T0 + 3 * DEEDS_EVERY_MS))).toBeUndefined()
    deedsAnswered(state, first.ask, null)
    const empty = reportOf(beat(state, T0 + 4 * DEEDS_EVERY_MS))!
    expect(empty.report.deeds).toEqual([])
    expect(empty.ask).not.toBe(first.ask)
  })

  it('shows new stamps to the room and finished errands to the trainer alone, and drops what a late answer names', () => {
    const state = createRealm('sa', T0)
    const a = join(state, 'a', 'u1')
    join(state, 'b', 'u2')
    const { ask } = reportOf(beat(state, T0 + DEEDS_EVERY_MS))!
    const out = deedsAnswered(state, ask, { stamps: { u1: ['firstSteps'], ghost: ['hello'] }, errands: { u1: ['room:pier:1'] } })
    expect(sent(out, 'b')).toEqual([{ t: 'stamped', id: a, stamps: ['firstSteps'] }])
    expect(sent(out, 'a')).toEqual([{ t: 'stamped', id: a, stamps: ['firstSteps'] }, { t: 'errands', done: ['room:pier:1'] }])
    expect(trainer(state, a).identity.stamps).toBe(1)
    expect(deedsAnswered(state, ask, { stamps: { u1: ['hello'] }, errands: {} })).toEqual([])
  })

  it('takes a failed report in stride: nobody is told, the walk goes on and the next report goes out', () => {
    const state = createRealm('sa', T0)
    const a = join(state, 'a', 'u1')
    const { ask } = reportOf(beat(state, T0 + DEEDS_EVERY_MS))!
    expect(deedsAnswered(state, ask, null)).toEqual([])
    const t = trainer(state, a)
    expect(act(state, 'a', { t: 'move', x: t.x + 5, y: t.y, facing: 0, moving: true }, T0 + 3300).some((e) => e.k === 'close')).toBe(false)
    expect(reportOf(beat(state, T0 + 2 * DEEDS_EVERY_MS))).toBeDefined()
  })

  it('stops noting past the cap, so an answer that never comes cannot grow the queue', () => {
    const log = createRealm('sa', T0).deeds
    for (let i = 0; i < DEEDS_MAX + 50; i++) noteDeed(log, `u${i}`, 'say', T0)
    expect(log.queue).toHaveLength(DEEDS_MAX)
    expect(takeReport(log, false, 1, T0)?.deeds).toHaveLength(DEEDS_MAX)
  })
})
