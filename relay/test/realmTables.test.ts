import { describe, expect, it } from 'vitest'
import { REALM_PROTOCOL, type RealmClientMessage, type RealmServerMessage } from '../../src/net/realm'
import { TABLE, type TableView } from '../../src/net/realmTables'
import { connect, createRealm, disconnect, hello, identified, message, tick, type RealmEffect, type RealmState } from '../src/realm'

const T0 = 1_000_000

const sent = (effects: readonly RealmEffect[], to: string): RealmServerMessage[] => effects.flatMap((e) => (e.k === 'send' && e.to === to ? [e.msg] : []))

/** The last table `to` heard of in these effects (`table`), or undefined. */
const tableTo = (effects: readonly RealmEffect[], to: string): TableView | undefined =>
  sent(effects, to)
    .flatMap((m) => (m.t === 'table' ? [m.table] : []))
    .at(-1)

/** Seats account `user` on `conn` in Pallet's `room`, standing at (`x`, `y`); returns its avatar id. */
const join = (state: RealmState, conn: string, user: string, room = 'cafe', at = { x: 110, y: 280 }) => {
  connect(state, conn, 'pallet', T0)
  const ask = hello(state, conn, { t: 'hello', v: REALM_PROTOCOL, city: 'pallet', token: 'tok', room }, user, T0).find((e) => e.k === 'identify')
  if (ask?.k !== 'identify') throw new Error('no identify ask')
  const out = identified(state, ask.ask, { identities: { [user]: { userId: user, handle: user, partner: 'charmander', shiny: false, look: {}, supporter: null, stamps: 0 } }, banned: [] }, T0)
  const welcome = sent(out, conn).find((m) => m.t === 'welcome')
  if (welcome?.t !== 'welcome') throw new Error('not seated')
  const t = state.cities.get('pallet')!.trainers.get(welcome.you)!
  t.x = at.x
  t.y = at.y
  return welcome.you
}

const say = (state: RealmState, conn: string, msg: RealmClientMessage, now = T0) => message(state, conn, msg, now)

const sit = (state: RealmState, conn: string, table = 'cafe-1', game = 'fourInRow', now = T0) => say(state, conn, { t: 'sit', table, game }, now)

/** Two trainers at cafe-1 with a match of Four in a Row on; the seat to drop first and its conn. */
const match = () => {
  const state = createRealm('sa', T0)
  const a = join(state, 'a', 'u1')
  const b = join(state, 'b', 'u2')
  sit(state, 'a')
  const v = tableTo(sit(state, 'b'), 'a')!
  const turn = v.pending[0]!
  return { state, a, b, v, turn, mover: turn === 0 ? 'a' : 'b', other: turn === 0 ? 'b' : 'a' }
}

describe('the realm’s tables', () => {
  it('opens a table at a café game spot, for its games only, from within reach', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1')
    expect(sit(state, 'a', 'cafe-9')).toEqual([])
    expect(sit(state, 'a', 'cafe-1', 'fishing')).toEqual([])
    join(state, 'far', 'u9', 'cafe', { x: 300, y: 100 })
    expect(sit(state, 'far')).toEqual([])
    const v = tableTo(sit(state, 'a'), 'a')!
    expect(v).toMatchObject({ id: 'cafe-1', game: 'fourInRow', phase: 'waiting', seats: [1, null], view: null, pending: [] })
  })

  it('shows the room every change, starts a match when the seats fill, and lets a third watch', () => {
    const state = createRealm('sa', T0)
    const a = join(state, 'a', 'u1')
    const b = join(state, 'b', 'u2')
    const c = join(state, 'c', 'u3')
    expect(tableTo(sit(state, 'a'), 'c')).toMatchObject({ seats: [a, null], phase: 'waiting' })
    const started = sit(state, 'b')
    for (const conn of ['a', 'b', 'c']) expect(tableTo(started, conn)).toMatchObject({ seats: [a, b], phase: 'playing', leftMs: TABLE.turnMs })
    expect(tableTo(started, 'a')!.view).not.toBeNull()
    const watching = sit(state, 'c')
    expect(tableTo(watching, 'c')).toMatchObject({ seats: [a, b] })
    expect(tableTo(watching, 'a')).toBeUndefined()
    expect(c).toBeGreaterThan(b)
  })

  it('takes the awaited seat’s moves through the rules and refuses the rest', () => {
    const { state, mover, other } = match()
    const wrong = say(state, other, { t: 'play', move: 3 })
    expect(tableTo(wrong, mover)).toBeUndefined()
    expect(tableTo(wrong, other)).toBeDefined()
    expect(tableTo(say(state, mover, { t: 'play', move: 9 }), other)).toBeUndefined()
    const ok = say(state, mover, { t: 'play', move: 3 }, T0 + 500)
    expect(tableTo(ok, other)!.view).toMatchObject({ moves: 1 })
  })

  it('forfeits a seat that keeps the match waiting past the turn clock', () => {
    const { state, turn, other } = match()
    expect(tick(state, T0 + TABLE.turnMs - 1).some((e) => e.k === 'send' && e.msg.t === 'table')).toBe(false)
    const late = tableTo(tick(state, T0 + TABLE.turnMs), other)!
    expect(late).toMatchObject({ phase: 'over', result: { winner: 1 - turn, forfeit: turn }, pending: [] })
  })

  it('restarts the clock for each seat as its turn comes', () => {
    const { state, mover, other } = match()
    say(state, mover, { t: 'play', move: 3 }, T0 + 20_000)
    expect(tableTo(tick(state, T0 + TABLE.turnMs + 1000), other)).toBeUndefined()
    expect(tableTo(tick(state, T0 + 20_000 + TABLE.turnMs), mover)).toMatchObject({ phase: 'over' })
  })

  it('forfeits a seat that stands, leaves the room or drops mid-match', () => {
    const stood = match()
    expect(tableTo(say(stood.state, 'a', { t: 'stand' }), 'b')).toMatchObject({ phase: 'over', result: { winner: 1, forfeit: 0 }, seats: [null, stood.b] })
    const left = match()
    Object.assign(left.state.cities.get('pallet')!.trainers.get(left.b)!, { x: 200, y: 288 })
    const door = say(left.state, 'b', { t: 'go', room: 'plaza', x: 320, y: 136 })
    expect(tableTo(door, 'a')).toMatchObject({ phase: 'over', result: { winner: 0, forfeit: 1 } })
    expect(sent(door, 'b').some((m) => m.t === 'tables')).toBe(true)
    const dropped = match()
    expect(tableTo(disconnect(dropped.state, 'a', T0), 'b')).toMatchObject({ result: { winner: 1, forfeit: 0 } })
  })

  it('starts the next match once both are ready, and a trainer sitting down after counts as ready', () => {
    const { state, a, b, mover, other } = match()
    for (const col of [0, 1, 0, 1, 0, 1, 0]) say(state, col === 0 ? mover : other, { t: 'play', move: col })
    expect(tableTo(say(state, 'a', { t: 'ready' }), 'b')).toMatchObject({ phase: 'over', ready: [a] })
    expect(tableTo(say(state, 'b', { t: 'ready' }), 'a')).toMatchObject({ phase: 'playing', ready: [], result: null })
    // b leaves after the next match; c sits down in its place.
    say(state, 'b', { t: 'stand' })
    const c = join(state, 'c', 'u3')
    say(state, 'a', { t: 'ready' })
    expect(tableTo(sit(state, 'c'), 'a')).toMatchObject({ phase: 'playing', seats: [a, c] })
    expect(b).not.toBe(c)
  })

  it('goes once its last seat stands, and is listed for whoever lands in the room', () => {
    const state = createRealm('sa', T0)
    const a = join(state, 'a', 'u1')
    sit(state, 'a')
    const landing = join(state, 'z', 'u7')
    expect(landing).toBeGreaterThan(a)
    const late = createRealm('sa', T0)
    join(late, 'a', 'u1')
    sit(late, 'a')
    connect(late, 'n', 'pallet', T0)
    const ask = hello(late, 'n', { t: 'hello', v: REALM_PROTOCOL, city: 'pallet', token: 't', room: 'cafe' }, 'u5', T0).find((e) => e.k === 'identify')
    if (ask?.k !== 'identify') throw new Error('no ask')
    const seated = identified(late, ask.ask, { identities: { u5: { userId: 'u5', handle: 'u5', partner: 'eevee', shiny: false, look: {}, supporter: null, stamps: 0 } }, banned: [] }, T0)
    const listed = sent(seated, 'n').find((m) => m.t === 'tables')
    expect(listed?.t === 'tables' && listed.tables.map((t) => t.id)).toEqual(['cafe-1'])
    const gone = tableTo(say(late, 'a', { t: 'stand' }), 'n')
    expect(gone?.seats).toEqual([null, null])
    expect(late.cities.get('pallet')!.tables.size).toBe(0)
  })

  it('takes one table per trainer: sitting at another stands it up first', () => {
    const state = createRealm('sa', T0)
    const a = join(state, 'a', 'u1')
    sit(state, 'a')
    state.cities.get('pallet')!.trainers.get(a)!.x = 290
    const moved = sit(state, 'a', 'cafe-2')
    expect(sent(moved, 'a').flatMap((m) => (m.t === 'table' ? [m.table.id] : []))).toEqual(['cafe-1', 'cafe-2'])
    expect([...state.cities.get('pallet')!.tables.values()].map((t) => t.id)).toEqual(['cafe-2'])
  })

  it('hosts a base’s furniture tables in that base only', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'ash', 'base:ash', { x: 100, y: 100 })
    expect(sit(state, 'a', 'cafe-1')).toEqual([])
    expect(tableTo(sit(state, 'a', 'f3-2', 'typeDuel'), 'a')).toMatchObject({ id: 'f3-2', game: 'typeDuel' })
  })

  describe('an open table (Ludo, Unown)', () => {
    const at = { x: 150, y: 228 }
    const LUDO_OPEN = { turnMs: 15_000, botMs: 900 }
    /** Two trainers at cafe-3's Ludo, both ready: the match on with two bots. */
    const gathered = () => {
      const state = createRealm('sa', T0)
      const a = join(state, 'a', 'u1', 'cafe', at)
      const b = join(state, 'b', 'u2', 'cafe', at)
      sit(state, 'a', 'cafe-3', 'ludo')
      sit(state, 'b', 'cafe-3', 'ludo')
      return { state, a, b }
    }

    it('starts once two or more sit and all are ready, the empty seats the bots’', () => {
      const { state, a, b } = gathered()
      const waiting = tableTo(say(state, 'a', { t: 'ready' }), 'b')!
      expect(waiting).toMatchObject({ seats: [a, b, null, null], phase: 'waiting', ready: [a] })
      const on = tableTo(say(state, 'b', { t: 'ready' }), 'a')!
      expect(on).toMatchObject({ seats: [a, b, null, null], phase: 'playing', leftMs: LUDO_OPEN.turnMs })
      const alone = createRealm('sa', T0)
      join(alone, 'a', 'u1', 'cafe', at)
      sit(alone, 'a', 'cafe-3', 'ludo')
      expect(tableTo(say(alone, 'a', { t: 'ready' }), 'a')).toMatchObject({ phase: 'waiting' })
    })

    it('plays the bots’ seats after their think, and the late seat’s turn for it', () => {
      const { state } = gathered()
      say(state, 'a', { t: 'ready' })
      const v = tableTo(say(state, 'b', { t: 'ready' }), 'a')!
      const first = v.pending[0]!
      const tb = [...state.cities.get('pallet')!.tables.values()][0]!
      const moves = () => (tb.match!.view(null) as { moves: number }).moves
      if (v.seats[first] === null) {
        expect(tick(state, T0 + LUDO_OPEN.botMs - 1)).toEqual([])
        tick(state, T0 + LUDO_OPEN.botMs)
        expect(moves()).toBe(1)
      } else {
        tick(state, T0 + LUDO_OPEN.botMs)
        expect(moves()).toBe(0)
        tick(state, T0 + LUDO_OPEN.turnMs)
        expect(moves()).toBe(1)
        expect(tb.phase).toBe('playing')
      }
    })

    it('hands a seat that stands mid-match to the bot, and lets someone sit in a bot’s seat', () => {
      const { state, a, b } = gathered()
      say(state, 'a', { t: 'ready' })
      say(state, 'b', { t: 'ready' })
      const stood = tableTo(say(state, 'b', { t: 'stand' }), 'a')!
      expect(stood).toMatchObject({ phase: 'playing', seats: [a, null, null, null], result: null })
      const c = join(state, 'c', 'u3', 'cafe', at)
      expect(tableTo(sit(state, 'c', 'cafe-3', 'ludo'), 'a')).toMatchObject({ phase: 'playing', seats: [a, c, null, null] })
      expect(b).not.toBe(c)
    })

    it('stands up a seat whose clock runs out twice running, the bot playing on', () => {
      const { state, a } = gathered()
      const tb = [...state.cities.get('pallet')!.tables.values()][0]!
      say(state, 'a', { t: 'ready' })
      say(state, 'b', { t: 'ready' })
      // Only a: b plays its turns at once, the bots after their think.
      let now = T0
      for (let i = 0; i < 400 && tb.seats[0] === a && tb.phase === 'playing'; i++) {
        now += 1000
        const seat = tb.awaited[0]
        if (seat === 1) say(state, 'b', { t: 'play', move: tb.match!.bot(1, i) }, now)
        else if (seat === 0) now += LUDO_OPEN.turnMs
        tick(state, now)
      }
      expect(tb.seats[0]).toBeNull()
      expect(state.cities.get('pallet')!.trainers.get(a)!.table).toBeNull()
    })
  })
})

