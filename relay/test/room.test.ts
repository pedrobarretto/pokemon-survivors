import { describe, expect, it } from 'vitest'
import { ARENA_RANKED } from '../../src/data/arenaRanked'
import { MAX_ARENA_PLAYERS, MAX_PLAYERS, PROTOCOL, type ClientMessage, type Hello, type ServerMessage } from '../../src/net/protocol'
import {
  BOUND_AHEAD,
  BOUND_REFRESH,
  LOG_BATCH,
  TIMES,
  connect,
  createRoom,
  deadline,
  disconnect,
  hello,
  loadState,
  majority,
  message,
  reattach,
  tick,
  type ArenaLock,
  type Effect,
  type Room,
  type State,
} from '../src/room'

const T0 = 1_000_000

const newState = (): State => {
  let n = 0
  const state = loadState(null, { secret: () => `secret-${String(++n).padStart(10, '0')}`, seed: () => 42 }, T0)
  createRoom(state, { code: 'ABCDE', build: 'b1', region: 'sam' }, T0)
  return state
}

const helloMsg = (guest: string, over: Partial<Hello> = {}): Hello => ({
  t: 'hello',
  v: PROTOCOL,
  build: 'b1',
  room: 'ABCDE',
  auth: { kind: 'guest', id: guest },
  secret: null,
  name: guest.slice(0, 6),
  resume: null,
  ...over,
})

const sent = (effects: readonly Effect[], to: string): ServerMessage[] => effects.flatMap((e) => (e.k === 'send' && e.to === to ? [e.msg] : e.k === 'sync' && e.to === to ? [e.msg] : []))

const of = <T extends ServerMessage['t']>(msgs: readonly ServerMessage[], t: T) => msgs.filter((m): m is Extract<ServerMessage, { t: T }> => m.t === t)

/** Opens socket `conn` and says hello as guest `guest`; returns the effects. */
const join = (state: State, conn: string, guest: string, now = T0, over: Partial<Hello> = {}) => {
  connect(state, conn, 'test-ua', now)
  return hello(state, conn, helloMsg(guest, over), { id: `g:${guest}`, account: false }, now, { guests: true })
}

const say = (state: State, conn: string, msg: ClientMessage, now: number) => message(state, conn, msg, now)

const roomOf = (state: State): Room => {
  if (!state.room) throw new Error('no room')
  return state.room
}

/** Two players in a running run, its clock started at `T0 + startDelay`. Returns when tick 0 is due. */
const playing = (players = 2) => {
  const state = newState()
  for (let i = 0; i < players; i++) {
    join(state, `c${i}`, `guest-${i}-xxxxxxxxxxxx`)
    say(state, `c${i}`, { t: 'loadout', loadout: { starter: 'pichu' } }, T0)
    if (i > 0) say(state, `c${i}`, { t: 'ready', ready: true }, T0)
  }
  say(state, 'c0', { t: 'start' }, T0)
  return { state, t0: T0 + TIMES.startDelay }
}

/** Every player sends a heartbeat at `now` (so nobody goes away while a test jumps the clock). */
const alive = (state: State, players: number, now: number) => {
  for (let i = 0; i < players; i++) say(state, `c${i}`, { t: 'hb' }, now)
}

const frames = (effects: readonly Effect[], to: string) => of(sent(effects, to), 'frame')

describe('seats', () => {
  it('refuses every unjoinable room the same way, but says so when the build differs', () => {
    const state = newState()
    for (let i = 0; i < 4; i++) join(state, `c${i}`, `guest-${i}-xxxxxxxxxxxx`)
    const full = join(state, 'c9', 'guest-9-xxxxxxxxxxxx')
    const ghost = loadState(null, { secret: () => 'x'.repeat(16), seed: () => 1 }, T0)
    connect(ghost, 'g', 'ua', T0)
    const missing = hello(ghost, 'g', helloMsg('guest-9-xxxxxxxxxxxx'), { id: 'g:guest-9-xxxxxxxxxxxx', account: false }, T0, { guests: true })
    const build = join(state, 'c8', 'guest-8-xxxxxxxxxxxx', T0, { build: 'b2' })
    expect(of(sent(full, 'c9'), 'refused')).toEqual([{ t: 'refused', code: 'unavailable' }])
    expect(of(sent(missing, 'g'), 'refused')).toEqual([{ t: 'refused', code: 'unavailable' }])
    expect(of(sent(build, 'c8'), 'refused')).toEqual([{ t: 'refused', code: 'build', build: 'b1' }])
  })

  it('where guests may not play, tells a guest to sign in whatever the room, and seats an account', () => {
    const state = newState()
    const off = { guests: false }
    connect(state, 'g1', 'ua', T0)
    expect(of(sent(hello(state, 'g1', helloMsg('guest-1-xxxxxxxxxxxx'), { id: 'g:guest-1-xxxxxxxxxxxx', account: false }, T0, off), 'g1'), 'refused')).toEqual([{ t: 'refused', code: 'signIn' }])
    connect(state, 'g2', 'ua', T0)
    expect(of(sent(hello(state, 'g2', helloMsg('guest-2-xxxxxxxxxxxx', { room: 'ZZZZZ' }), { id: 'g:guest-2-xxxxxxxxxxxx', account: false }, T0, off), 'g2'), 'refused')).toEqual([{ t: 'refused', code: 'signIn' }])
    connect(state, 'a1', 'ua', T0)
    const account = hello(state, 'a1', helloMsg('x'.repeat(16), { auth: { kind: 'clerk', token: 'jwt' }, name: '@ash' }), { id: 'u:user_ash', account: true }, T0, off)
    expect(of(sent(account, 'a1'), 'welcome')[0]?.room.members).toEqual([expect.objectContaining({ name: '@ash', account: true })])
  })

  it('gives a seat back to its identity from any socket, and tells the old one it was replaced', () => {
    const state = newState()
    const first = join(state, 'tab1', 'guest-a-xxxxxxxxxxxx')
    const welcome = of(sent(first, 'tab1'), 'welcome')[0]
    const stranger = join(state, 'tab2', 'guest-a-xxxxxxxxxxxx', T0 + 1, { secret: 'wrong-secret-0000000' })
    expect(of(sent(stranger, 'tab2'), 'refused')).toEqual([{ t: 'refused', code: 'unavailable' }])
    const again = join(state, 'tab3', 'guest-a-xxxxxxxxxxxx', T0 + 2, { secret: welcome?.secret ?? null })
    expect(of(sent(again, 'tab3'), 'welcome')[0]?.seat).toBe(welcome?.seat)
    expect(sent(again, 'tab1')).toContainEqual({ t: 'bye', reason: 'replaced' })
    expect(roomOf(state).seats).toHaveLength(1)
  })

  it('hands the room to the next seat when the host leaves, and to one online when the host is gone a while', () => {
    const state = newState()
    for (let i = 0; i < 3; i++) join(state, `c${i}`, `guest-${i}-xxxxxxxxxxxx`)
    say(state, 'c0', { t: 'leave' }, T0)
    expect(roomOf(state).host).toBe(1)
    disconnect(state, 'c1', T0 + 1000)
    tick(state, T0 + 1000 + TIMES.hostHandoff - 1)
    expect(roomOf(state).host).toBe(1)
    tick(state, T0 + 1000 + TIMES.hostHandoff)
    expect(roomOf(state).host).toBe(2)
  })

  it('keeps kicked identities out', () => {
    const state = newState()
    join(state, 'c0', 'guest-0-xxxxxxxxxxxx')
    const w = of(sent(join(state, 'c1', 'guest-1-xxxxxxxxxxxx'), 'c1'), 'welcome')[0]
    say(state, 'c0', { t: 'kick', seat: 1 }, T0)
    const back = join(state, 'c2', 'guest-1-xxxxxxxxxxxx', T0, { secret: w?.secret ?? null })
    expect(of(sent(back, 'c2'), 'refused')).toEqual([{ t: 'refused', code: 'unavailable' }])
  })
})

describe('clock', () => {
  it('stamps inputs into the next unsent tick, newest stick only, and logs them in one batch a second, never saving the room', () => {
    const { state, t0 } = playing()
    tick(state, t0 + 17)
    say(state, 'c0', { t: 'in', k: 'move', d: [1] }, t0 + 20)
    say(state, 'c0', { t: 'in', k: 'move', d: [2] }, t0 + 25)
    say(state, 'c1', { t: 'in', k: 'pick', d: [0, 3] }, t0 + 26)
    const out = tick(state, t0 + 34)
    expect(frames(out, 'c1')).toEqual([{ t: 'frame', from: 1, to: 2, ticks: [[1, [[0, 'move', 2], [1, 'pick', 0, 3]]]] }])
    const second: Effect[] = []
    for (let t = t0 + 50; t <= t0 + 1000 + 17; t += 17) {
      if (t > t0 + 500) say(state, 'c0', { t: 'in', k: 'move', d: [t] }, t)
      second.push(...tick(state, t))
    }
    const logs = [...out, ...second].filter((e) => e.k === 'log')
    expect(logs).toEqual([expect.objectContaining({ at: LOG_BATCH, ticks: expect.arrayContaining([[1, [[0, 'move', 2], [1, 'pick', 0, 3]]]]) })])
    expect(logs[0]?.k === 'log' && logs[0].ticks.length).toBeGreaterThan(20)
    expect([...out, ...second].some((e) => e.k === 'save')).toBe(false)
  })

  it('writes the clock bound ahead with every batch, never letting a frame out within BOUND_REFRESH of it', () => {
    const { state, t0 } = playing()
    expect(roomOf(state).run?.bound).toBe(BOUND_AHEAD)
    const bounds: [number, number][] = []
    let closest = Infinity
    for (let t = t0; t <= t0 + 13_000; t += 17) {
      alive(state, 2, t)
      for (const e of tick(state, t)) if (e.k === 'log') bounds.push([e.at, e.bound])
      const run = roomOf(state).run
      if (run) closest = Math.min(closest, run.bound - run.next)
    }
    // No input: a batch only to move the bound, each one `BOUND_AHEAD` past the ticks sent.
    expect(bounds.length).toBeGreaterThanOrEqual(10)
    for (const [at, bound] of bounds) expect(bound - at).toBe(BOUND_AHEAD)
    expect(closest).toBeGreaterThanOrEqual(BOUND_REFRESH)
  })

  it('writes the log before a sync reads it back', () => {
    const { state, t0 } = playing()
    tick(state, t0)
    say(state, 'c0', { t: 'in', k: 'move', d: [5] }, t0 + 5)
    tick(state, t0 + 20)
    disconnect(state, 'c1', t0 + 30)
    const back = join(state, 'c9', 'guest-1-xxxxxxxxxxxx', t0 + 40, { secret: roomOf(state).seats[1]?.secret ?? null, resume: { run: 1, from: 0 } })
    const order = back.flatMap((e) => (e.k === 'log' ? [`log:${e.ticks.map(([t]) => t).join(',')}`] : e.k === 'sync' ? ['sync'] : []))
    expect(order).toEqual(['log:0', 'sync'])
  })

  it('stamps a batch as its messages one by one at once: same tick, in order, newest stick only', () => {
    const { state, t0 } = playing()
    tick(state, t0 + 17)
    say(state, 'c1', { t: 'in', k: 'move', d: [5, 1] }, t0 + 19)
    const pong = say(state, 'c0', { t: 'batch', m: [{ t: 'in', k: 'move', d: [1, 7] }, { t: 'in', k: 'special', d: [] }, { t: 'in', k: 'move', d: [2, 8] }, { t: 'ping', at: 4 }] }, t0 + 20)
    expect(of(sent(pong, 'c0'), 'pong')).toHaveLength(1)
    say(state, 'c1', { t: 'in', k: 'pick', d: [0, 3] }, t0 + 26)
    expect(frames(tick(state, t0 + 34), 'c1')).toEqual([{ t: 'frame', from: 1, to: 2, ticks: [[1, [[1, 'move', 5, 1], [0, 'special'], [0, 'move', 2, 8], [1, 'pick', 0, 3]]]] }])
  })

  it('derives ticks from elapsed time: a late timer sends the whole range at once', () => {
    const { state, t0 } = playing()
    expect(frames(tick(state, t0 + 1000 / 60 * 10 + 1), 'c0')).toEqual([{ t: 'frame', from: 0, to: 10, ticks: [] }])
  })

  it('stops the clock while nobody is connected and resumes where it stopped', () => {
    const { state, t0 } = playing()
    tick(state, t0 + 1000)
    const next = roomOf(state).run?.next ?? -1
    disconnect(state, 'c0', t0 + 1000)
    disconnect(state, 'c1', t0 + 1000)
    expect(roomOf(state).run?.paused).toBe(true)
    const later = t0 + 120_000
    const back = join(state, 'c2', 'guest-0-xxxxxxxxxxxx', later, { secret: roomOf(state).seats[0]?.secret ?? null, resume: { run: 1, from: next } })
    expect(of(sent(back, 'c2'), 'sync')[0]).toMatchObject({ reason: 'resume', from: next, to: next })
    // Seat 1 never came back: it goes away right at the tick the clock resumed on.
    expect(frames(tick(state, later + 17), 'c2')).toEqual([{ t: 'frame', from: next, to: next + 1, ticks: [[next, [[1, 'away']]]] }])
  })

  it('expires a room whose last player leaves while a teammate is offline', () => {
    const { state, t0 } = playing()
    tick(state, t0 + 1000)
    disconnect(state, 'c1', t0 + 1000)
    say(state, 'c0', { t: 'leave' }, t0 + 2000)
    expect(roomOf(state)).toMatchObject({ emptySince: t0 + 2000, run: { paused: true } })
    expect(deadline(state)).toBe(t0 + 2000 + TIMES.idle)
    expect(tick(state, t0 + 2000 + TIMES.idle)).toContainEqual({ k: 'wipe' })
    expect(state.room).toBeNull()
  })

  it('stops the clock while everyone in the run is away, and starts it again where it stopped when one is back', () => {
    const { state, t0 } = playing()
    tick(state, t0)
    const gone = tick(state, t0 + TIMES.away + 20)
    expect(frames(gone, 'c0')[0]?.ticks).toEqual([[expect.any(Number), [[0, 'away'], [1, 'away']]]])
    expect(roomOf(state).run?.paused).toBe(true)
    const next = roomOf(state).run?.next ?? -1
    expect(frames(tick(state, t0 + 60_000), 'c0')).toEqual([])
    say(state, 'c1', { t: 'hb' }, t0 + 60_000)
    expect(roomOf(state).run?.paused).toBe(false)
    expect(frames(tick(state, t0 + 60_020), 'c0')).toEqual([{ t: 'frame', from: next, to: next + 1, ticks: [[next, [[1, 'back']]]] }])
  })

  it('wipes a room past its maximum age, whatever goes on in it', () => {
    const { state, t0 } = playing()
    expect(deadline(state)).toBeLessThanOrEqual(T0 + TIMES.maxAge)
    alive(state, 2, T0 + TIMES.maxAge - 1)
    expect(tick(state, T0 + TIMES.maxAge - 1).some((e) => e.k === 'wipe')).toBe(false)
    expect(tick(state, T0 + TIMES.maxAge)).toContainEqual({ k: 'wipe' })
    expect(t0).toBeGreaterThan(T0)
  })

  it('after a restart, resumes at the newest bound it wrote, past every tick it may have sent', () => {
    const { state, t0 } = playing()
    // The room was last saved at the start; the log batches carried the bound on since.
    const saved = JSON.parse(JSON.stringify(roomOf(state))) as Room
    const bounds: number[] = []
    for (let t = t0; t <= t0 + 13_000; t += 17) {
      alive(state, 2, t)
      for (const e of tick(state, t)) if (e.k === 'log') bounds.push(e.bound)
    }
    const sentTo = roomOf(state).run?.next ?? -1
    // A crash lost the newest batch: the one before still lies past every tick sent.
    const kept = bounds.at(-2) ?? 0
    expect(kept).toBeGreaterThan(sentTo)
    const restarted = loadState(saved, state.gen, t0 + 14_000, kept)
    const back = join(restarted, 'n0', 'guest-0-xxxxxxxxxxxx', t0 + 14_000, { secret: saved.seats[0]?.secret ?? null, resume: { run: 1, from: sentTo } })
    expect(of(sent(back, 'n0'), 'sync')[0]).toMatchObject({ reason: 'resume', from: sentTo, to: kept })
  })

  it('stamps a silent seat away and back when it is heard again', () => {
    const { state, t0 } = playing()
    tick(state, t0)
    for (let t = t0; t <= t0 + TIMES.away; t += 1000) say(state, 'c0', { t: 'hb' }, t)
    const out = tick(state, t0 + TIMES.away + 20)
    expect(frames(out, 'c0')[0]?.ticks).toEqual([[expect.any(Number), [[1, 'away']]]])
    say(state, 'c1', { t: 'hb' }, t0 + TIMES.away + 30)
    expect(frames(tick(state, t0 + TIMES.away + 60), 'c0')[0]?.ticks[0]?.[1]).toEqual([[1, 'back']])
  })
})

describe('hashes, snapshots and the end', () => {
  it('takes the most common hash, a tie going to the lowest seat', () => {
    expect(majority(new Map([[0, 'a'], [1, 'b'], [2, 'b']]))).toBe('b')
    expect(majority(new Map([[1, 'b'], [0, 'a']]))).toBe('a')
  })

  it('heals the minority from the agreed snapshot and records a dump', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 11_090)
    tick(state, t0 + 11_100)
    for (const c of ['c0', 'c1', 'c2']) say(state, c, { t: 'hash', tick: 600, h: 'good' }, t0 + 11_100)
    for (let part = 0; part < 2; part++) say(state, 'c0', { t: 'snap', tick: 600, h: 'good', part, parts: 2, data: 'AAAA' }, t0 + 11_100)
    expect(roomOf(state).run?.agreed).toEqual({ tick: 600, h: 'good', parts: 2 })
    say(state, 'c0', { t: 'hash', tick: 660, h: 'x' }, t0 + 11_100)
    say(state, 'c1', { t: 'hash', tick: 660, h: 'x' }, t0 + 11_100)
    const out = say(state, 'c2', { t: 'hash', tick: 660, h: 'y' }, t0 + 11_100)
    expect(of(sent(out, 'c2'), 'heal')).toEqual([{ t: 'heal', tick: 660 }])
    expect(of(sent(out, 'c2'), 'sync')[0]).toMatchObject({ reason: 'heal', from: 600, base: { tick: 600, h: 'good', parts: 2 } })
    expect(out.filter((e) => e.k === 'dump')).toHaveLength(1)
    expect(sent(out, 'c0').some((m) => m.t === 'heal')).toBe(false)
  })

  it('drops the chunks of a snapshot upload that was replaced or turned down, and of any upload lost in a restart', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 21_090)
    tick(state, t0 + 21_100)
    say(state, 'c0', { t: 'snap', tick: 600, h: 'a', part: 0, parts: 2, data: 'AAAA' }, t0 + 21_100)
    const replaced = say(state, 'c0', { t: 'snap', tick: 1200, h: 'b', part: 0, parts: 1, data: 'BBBB' }, t0 + 21_100)
    expect(replaced).toContainEqual({ k: 'dropSnapshot', run: 1, tick: 600 })
    const votes = [['c0', 'b'], ['c1', 'x'], ['c2', 'x']] as const
    const decided = votes.flatMap(([c, h]) => say(state, c, { t: 'hash', tick: 1200, h }, t0 + 21_100))
    // The upload's label lost the vote: turned down, its chunks dropped as the tick is decided.
    expect(decided).toContainEqual({ k: 'dropSnapshot', run: 1, tick: 1200 })
    expect(roomOf(state).run?.agreed).toBeNull()
    const saved = JSON.parse(JSON.stringify(roomOf(state))) as Room
    expect(reattach(loadState(saved, state.gen, t0 + 22_000), [], t0 + 22_000)).toContainEqual({ k: 'keepSnapshot', run: 1, tick: -1 })
  })

  it('turns a snapshot down when its tick was already decided otherwise, dropping its chunks', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 11_090)
    tick(state, t0 + 11_100)
    for (const c of ['c0', 'c1', 'c2']) say(state, c, { t: 'hash', tick: 600, h: 'x' }, t0 + 11_100)
    const out = say(state, 'c0', { t: 'snap', tick: 600, h: 'mine', part: 0, parts: 1, data: 'AAAA' }, t0 + 11_100)
    expect(out).toContainEqual({ k: 'dropSnapshot', run: 1, tick: 600 })
  })

  it('drops an agreed snapshot a restorer found bad, demotes its uploader and records a dump', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 11_090)
    tick(state, t0 + 11_100)
    for (const c of ['c0', 'c1', 'c2']) say(state, c, { t: 'hash', tick: 600, h: 'good' }, t0 + 11_100)
    say(state, 'c0', { t: 'snap', tick: 600, h: 'good', part: 0, parts: 1, data: 'AAAA' }, t0 + 11_100)
    expect(roomOf(state).run?.agreed?.tick).toBe(600)
    // A stale report changes nothing.
    expect(say(state, 'c2', { t: 'badSnap', tick: 0 }, t0 + 11_100)).toEqual([])
    const out = say(state, 'c2', { t: 'badSnap', tick: 600 }, t0 + 11_100)
    expect(roomOf(state).run).toMatchObject({ agreed: null, demoted: [0] })
    expect(out).toContainEqual({ k: 'dropSnapshot', run: 1, tick: 600 })
    expect(out.filter((e) => e.k === 'dump')).toEqual([expect.objectContaining({ reason: 'badSnap', minority: [2] })])
    expect(of(sent(out, 'c0'), 'role')).toEqual([{ t: 'role', snapshots: false }])
    expect(of(sent(out, 'c1'), 'role')).toEqual([{ t: 'role', snapshots: true }])
    // A fresh join now comes from the seed, not the bad bytes.
    const back = join(state, 'c9', 'guest-2-xxxxxxxxxxxx', t0 + 11_200, { secret: roomOf(state).seats[2]?.secret ?? null })
    expect(of(sent(back, 'c9'), 'sync')[0]).toMatchObject({ reason: 'join', from: 0, base: null })
  })

  it('charges `over` a token like any message, and saves only a vote that changed', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 4990)
    tick(state, t0 + 5000)
    expect(say(state, 'c0', { t: 'over', tick: 290, h: 'end' }, t0 + 5000)).toContainEqual({ k: 'save' })
    expect(say(state, 'c0', { t: 'over', tick: 290, h: 'end' }, t0 + 5000).some((e) => e.k === 'save')).toBe(false)
    const flood = Array.from({ length: 200 }, () => say(state, 'c0', { t: 'over', tick: 290, h: 'end' }, t0 + 5000)).flat()
    expect(of(sent(flood, 'c0'), 'slow')).toHaveLength(1)
    expect(flood.some((e) => e.k === 'save')).toBe(false)
  })

  it('heals a diverged seat once, not again for the hashes it sent before the heal reached it', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 12_090)
    tick(state, t0 + 12_100)
    for (const c of ['c0', 'c1', 'c2']) say(state, c, { t: 'hash', tick: 600, h: 'good' }, t0 + 12_100)
    for (let part = 0; part < 2; part++) say(state, 'c0', { t: 'snap', tick: 600, h: 'good', part, parts: 2, data: 'AAAA' }, t0 + 12_100)
    // c2 diverged and reported two ticks before its teammates did: both get decided after the first heal.
    say(state, 'c2', { t: 'hash', tick: 660, h: 'y' }, t0 + 12_100)
    say(state, 'c2', { t: 'hash', tick: 720, h: 'y' }, t0 + 12_100)
    say(state, 'c0', { t: 'hash', tick: 660, h: 'x' }, t0 + 12_100)
    const first = say(state, 'c1', { t: 'hash', tick: 660, h: 'x' }, t0 + 12_100)
    expect(of(sent(first, 'c2'), 'heal')).toHaveLength(1)
    say(state, 'c0', { t: 'hash', tick: 720, h: 'z' }, t0 + 12_100)
    const second = say(state, 'c1', { t: 'hash', tick: 720, h: 'z' }, t0 + 12_100)
    expect(of(sent(second, 'c2'), 'heal')).toHaveLength(0)
  })

  it('heals from the snapshot agreed on the same tick, never from one whose chunks that agreement drops', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 21_090)
    tick(state, t0 + 21_100)
    for (const c of ['c0', 'c1', 'c2']) say(state, c, { t: 'hash', tick: 600, h: 'a' }, t0 + 21_100)
    say(state, 'c0', { t: 'snap', tick: 600, h: 'a', part: 0, parts: 1, data: 'AAAA' }, t0 + 21_100)
    expect(roomOf(state).run?.agreed?.tick).toBe(600)
    // The next snapshot is in before tick 1200 is decided, and c2 diverged at that very tick.
    say(state, 'c0', { t: 'snap', tick: 1200, h: 'b', part: 0, parts: 1, data: 'BBBB' }, t0 + 21_100)
    say(state, 'c0', { t: 'hash', tick: 1200, h: 'b' }, t0 + 21_100)
    say(state, 'c2', { t: 'hash', tick: 1200, h: 'x' }, t0 + 21_100)
    const out = say(state, 'c1', { t: 'hash', tick: 1200, h: 'b' }, t0 + 21_100)
    const order = out.flatMap((e) => (e.k === 'keepSnapshot' ? ['keep'] : e.k === 'sync' ? [`sync@${e.msg.base?.tick}`] : []))
    expect(order).toEqual(['keep', 'sync@1200'])
  })

  it("doesn't agree on a snapshot whose hash the majority didn't report", () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 10_990)
    tick(state, t0 + 11_000)
    say(state, 'c0', { t: 'snap', tick: 600, h: 'mine', part: 0, parts: 1, data: 'AAAA' }, t0 + 11_000)
    for (const [c, h] of [['c0', 'mine'], ['c1', 'theirs'], ['c2', 'theirs']] as const) say(state, c, { t: 'hash', tick: 600, h }, t0 + 11_000)
    expect(roomOf(state).run?.agreed).toBeNull()
  })

  it('ends the run on a majority of the connected players, never on a lone one', () => {
    const { state, t0 } = playing(3)
    alive(state, 3, t0 + 4990)
    tick(state, t0 + 5000)
    say(state, 'c0', { t: 'over', tick: 290, h: 'end' }, t0 + 5000)
    expect(roomOf(state).phase).toBe('playing')
    const out = say(state, 'c1', { t: 'over', tick: 290, h: 'end' }, t0 + 5010)
    expect(roomOf(state).phase).toBe('ended')
    expect(of(sent(out, 'c2'), 'ended')).toEqual([{ t: 'ended', run: 1, tick: 290, h: 'end' }])
  })
})

describe('rate limit', () => {
  it('charges a batch a token per message it carries', () => {
    const { state, t0 } = playing()
    const batch: ClientMessage = { t: 'batch', m: Array.from({ length: 16 }, () => ({ t: 'in', k: 'move', d: [1] }) as const) }
    const out = Array.from({ length: 8 }, () => say(state, 'c0', batch, t0)).flat()
    expect(of(sent(out, 'c0'), 'slow')).toHaveLength(1)
  })

  it('drops a burst past the bucket, says so once, and closes only a flood', () => {
    const { state, t0 } = playing()
    const out = Array.from({ length: 200 }, () => say(state, 'c0', { t: 'in', k: 'move', d: [1] }, t0)).flat()
    expect(of(sent(out, 'c0'), 'slow')).toHaveLength(1)
    expect(out.some((e) => e.k === 'close')).toBe(false)
    const flood = Array.from({ length: 700 }, () => say(state, 'c0', { t: 'in', k: 'move', d: [1] }, t0 + 1)).flat()
    expect(flood).toContainEqual({ k: 'close', to: 'c0', reason: 'abuse' })
  })
})

describe('moving the room', () => {
  /** A lobby of `n` seats (c0 hosts), each with a loadout, the others ready. */
  const lobby = (n = 3) => {
    const state = newState()
    for (let i = 0; i < n; i++) {
      join(state, `c${i}`, `guest-${i}-xxxxxxxxxxxx`)
      say(state, `c${i}`, { t: 'loadout', loadout: { starter: 'pichu' } }, T0)
      if (i > 0) say(state, `c${i}`, { t: 'ready', ready: true }, T0)
    }
    return state
  }

  it("keeps each seat's round trips and shows them to the room, saving only a change", () => {
    const state = lobby(2)
    const out = say(state, 'c1', { t: 'rtt', ms: { cf: 100, sa: 230 } }, T0)
    expect(of(sent(out, 'c0'), 'room')[0]?.room.members[1]?.rtt).toEqual({ cf: 100, sa: 230 })
    expect(of(sent(out, 'c0'), 'room')[0]?.room.members[0]).not.toHaveProperty('rtt')
    expect(say(state, 'c1', { t: 'rtt', ms: { cf: 100, sa: 230 } }, T0 + 1)).toEqual([])
  })

  it("tells every seat where the room went and closes them, on the host's word only, in the lobby only", () => {
    const state = lobby()
    expect(say(state, 'c1', { t: 'move', code: '3QRST' }, T0)).toEqual([])
    expect(roomOf(state).movedTo).toBeNull()
    const out = say(state, 'c0', { t: 'move', code: '3QRST' }, T0)
    for (const c of ['c0', 'c1', 'c2']) {
      expect(of(sent(out, c), 'moved')).toEqual([{ t: 'moved', code: '3QRST' }])
      expect(out).toContainEqual({ k: 'close', to: c, reason: 'refused' })
    }
    expect(out[0]).toEqual({ k: 'save' })
    // Nothing more is taken there: not a start, not another move.
    expect(say(state, 'c0', { t: 'start' }, T0 + 1)).toEqual([])
    expect(say(state, 'c0', { t: 'move', code: '2ABCD' }, T0 + 1)).toEqual([])
    expect(roomOf(state).movedTo).toBe('3QRST')
  })

  it('never moves a room once a run was played in it', () => {
    const { state, t0 } = playing()
    expect(say(state, 'c0', { t: 'move', code: '3QRST' }, t0)).toEqual([])
    expect(roomOf(state).movedTo).toBeNull()
  })

  it('answers an old link with the new room until the room expires, past the idle limit', () => {
    const state = lobby()
    say(state, 'c0', { t: 'move', code: '3QRST' }, T0)
    for (const c of ['c0', 'c1', 'c2']) disconnect(state, c, T0 + 10)
    tick(state, T0 + 10 + TIMES.idle)
    expect(state.room).not.toBeNull()
    const late = join(state, 'late', 'guest-9-xxxxxxxxxxxx', T0 + 10 + TIMES.idle)
    expect(sent(late, 'late')).toEqual([{ t: 'moved', code: '3QRST' }, { t: 'refused', code: 'unavailable' }])
    expect(late).toContainEqual({ k: 'close', to: 'late', reason: 'refused' })
    expect(deadline(state)).toBe(T0 + TIMES.maxAge)
    expect(tick(state, T0 + TIMES.maxAge)).toContainEqual({ k: 'wipe' })
  })

  it("makes whoever says the room's claim its host, even after someone else got there first", () => {
    const state = loadState(null, { secret: () => 'claim-0000000000000', seed: () => 1 }, T0)
    const made = createRoom(state, { code: '3QRST', build: 'b1', region: 'vps:sa' }, T0)
    expect(made.ok && made.claim).toBe('claim-0000000000000')
    const room = { room: '3QRST' }
    join(state, 'bot', 'guest-1-xxxxxxxxxxxx', T0, room)
    expect(roomOf(state).host).toBe(0)
    const wrong = join(state, 'x', 'guest-2-xxxxxxxxxxxx', T0, { ...room, claim: 'claim-1111111111111' })
    expect(of(sent(wrong, 'x'), 'welcome')[0]?.room.members.find((m) => m.host)?.seat).toBe(0)
    const host = join(state, 'host', 'guest-0-xxxxxxxxxxxx', T0, { ...room, claim: 'claim-0000000000000' })
    expect(of(sent(host, 'host'), 'welcome')[0]?.room.members.find((m) => m.host)?.seat).toBe(2)
    expect(roomOf(state).claim).toBeNull()
  })
})

describe('arena rooms', () => {
  const guest = (i: number) => `guest-${i}-xxxxxxxxxxxx`
  const reports = (effects: readonly Effect[]) => effects.flatMap((e) => (e.k === 'report' ? [e.report] : []))

  /** A room made by the matchmaker for `players` (guest identities) on alternating teams (all on Blue: `oneSide`). */
  const matched = (players: number, ranked = true, oneSide = false) => {
    let n = 0
    const state = loadState(null, { secret: () => `secret-${String(++n).padStart(10, '0')}`, seed: () => 42 }, T0)
    const lock: Omit<ArenaLock, 'startBy'> = { queue: 'ranked', ranked, players: Array.from({ length: players }, (_, i) => ({ id: `g:${guest(i)}`, team: (oneSide ? 0 : i % 2) as 0 | 1 })) }
    createRoom(state, { code: 'ABCDE', build: 'b1', region: 'enam', lock }, T0)
    return state
  }

  /** Everyone in a matched room joins with a loadout asking for Blue: the run starts by itself. */
  const matchedPlaying = (players: number, ranked = true, oneSide = false) => {
    const state = matched(players, ranked, oneSide)
    for (let i = 0; i < players; i++) {
      join(state, `c${i}`, guest(i))
      say(state, `c${i}`, { t: 'loadout', loadout: { starter: 'pikachu', team: 0 } }, T0)
    }
    return state
  }

  const result = (winner: 0 | 1) => JSON.stringify({ v: 1, score: [10, 3], winner, seconds: 600, objective: null, seats: [] })

  it('seats two teams in an Arena room and a party of four elsewhere', () => {
    const coop = newState()
    for (let i = 0; i < MAX_PLAYERS; i++) join(coop, `c${i}`, guest(i))
    expect(of(sent(join(coop, 'c9', guest(9)), 'c9'), 'refused')).toEqual([{ t: 'refused', code: 'unavailable' }])

    const arena = newState()
    join(arena, 'c0', guest(0))
    say(arena, 'c0', { t: 'settings', settings: { difficulty: 'normal', mode: 'versus' } }, T0)
    for (let i = 1; i < MAX_ARENA_PLAYERS; i++) expect(of(sent(join(arena, `c${i}`, guest(i)), `c${i}`), 'welcome')).toHaveLength(1)
    expect(MAX_ARENA_PLAYERS).toBe(ARENA_RANKED.queue.players)
    expect(of(sent(join(arena, 'c9', guest(9)), 'c9'), 'refused')).toEqual([{ t: 'refused', code: 'unavailable' }])
    // A full Arena room can't become a co-op room of eight.
    say(arena, 'c0', { t: 'settings', settings: { difficulty: 'normal' } }, T0)
    expect(roomOf(arena).settings.mode).toBe('versus')
  })

  it('takes only the matched players, on their teams, and keeps its settings', () => {
    const state = matched(2)
    expect(of(sent(join(state, 'x', guest(7)), 'x'), 'refused')).toEqual([{ t: 'refused', code: 'unavailable' }])
    join(state, 'c1', guest(1))
    say(state, 'c1', { t: 'loadout', loadout: { starter: 'pikachu', team: 0 } }, T0)
    expect(roomOf(state).seats[0]?.loadout).toEqual({ starter: 'pikachu', team: 1 })
    say(state, 'c1', { t: 'settings', settings: { difficulty: 'hard' } }, T0)
    say(state, 'c1', { t: 'start' }, T0)
    expect(roomOf(state).settings).toEqual({ difficulty: 'normal', mode: 'versus', queue: 'ranked', locked: true })
    expect(roomOf(state).phase).toBe('lobby')
  })

  it('starts by itself once everyone is in, or at the join timeout with whoever came, and goes when nobody did', () => {
    const full = matchedPlaying(2)
    expect(roomOf(full).phase).toBe('playing')
    expect(roomOf(full).run?.start.players.map((p) => p.loadout.team)).toEqual([0, 1])

    const late = matched(3)
    join(late, 'c0', guest(0))
    say(late, 'c0', { t: 'loadout', loadout: { starter: 'pikachu' } }, T0)
    const startBy = T0 + ARENA_RANKED.queue.joinTimeout * 1000
    expect(deadline(late)).toBe(startBy)
    tick(late, startBy - 1)
    expect(roomOf(late).phase).toBe('lobby')
    const out = tick(late, startBy)
    expect(roomOf(late).run?.start.players).toHaveLength(1)
    expect(of(sent(out, 'c0'), 'start')).toHaveLength(1)

    const empty = matched(2)
    expect(tick(empty, startBy)).toContainEqual({ k: 'wipe' })
  })

  it('reports an agreed result once, with the accounts by slot, and never a co-op run', () => {
    const state = matchedPlaying(3)
    say(state, 'c0', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000)
    const out = say(state, 'c1', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000)
    const [report] = reports(out)
    expect(reports(out)).toHaveLength(1)
    expect(report).toMatchObject({ v: 1, room: 'ABCDE', run: 1, kind: 'ranked', region: 'enam', endedAt: T0 + 9000, result: JSON.parse(result(0)), confirmed: true })
    expect(report?.seats).toHaveLength(ARENA_RANKED.queue.players)
    // Guests have no account; the bots' slots follow the humans'.
    expect(report?.seats.slice(0, 4)).toEqual([0, 1, 2, 3].map((slot) => ({ slot, userId: null, handle: null, left: false })))
    expect(reports(say(state, 'c2', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9100))).toHaveLength(0)

    const { state: coop, t0 } = playing(2)
    say(coop, 'c0', { t: 'over', tick: 900, h: 'end', result: result(0) }, t0)
    expect(reports(say(coop, 'c1', { t: 'over', tick: 900, h: 'end', result: result(0) }, t0))).toHaveLength(0)
  })

  it("trusts no lone client: a split result isn't reported, a ranked match one human finished goes unconfirmed", () => {
    const split = matchedPlaying(2)
    say(split, 'c0', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000)
    const out = say(split, 'c1', { t: 'over', tick: 900, h: 'end', result: result(1) }, T0 + 9000)
    expect(roomOf(split).phase).toBe('ended')
    expect(reports(out)).toHaveLength(0)

    const left = matchedPlaying(2)
    say(left, 'c1', { t: 'leave' }, T0 + 5000)
    const [report] = reports(say(left, 'c0', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000))
    // Still ranked, so the API rates the leaver's loss; unconfirmed, so it rates nothing else.
    expect(report).toMatchObject({ kind: 'ranked', confirmed: false })
    expect(report?.seats[1]).toMatchObject({ slot: 1, left: true })

    // A match the matchmaker didn't rate stays casual.
    const unrated = matchedPlaying(2, false)
    say(unrated, 'c0', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000)
    const [casual] = reports(say(unrated, 'c1', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000))
    expect(casual).toMatchObject({ kind: 'casual', confirmed: true })
  })

  it('ends a match a player abandoned (tab closed) once their seat goes away, and reports them as having left', () => {
    const state = matchedPlaying(2)
    disconnect(state, 'c1', T0 + 4000)
    say(state, 'c0', { t: 'ping', at: 1 }, T0 + 8000)
    expect(reports(say(state, 'c0', { t: 'over', tick: 300, h: 'end', result: result(0) }, T0 + 8000))).toHaveLength(0)
    const [report] = reports(tick(state, T0 + 8000))
    expect(roomOf(state).phase).toBe('ended')
    expect(report).toMatchObject({ kind: 'ranked', confirmed: false })
    expect(report?.seats.slice(0, 2)).toMatchObject([{ slot: 0, left: false }, { slot: 1, left: true }])
  })

  it('plays a ranked match whose humans are all on one team as casual', () => {
    const state = matchedPlaying(2, true, true)
    say(state, 'c0', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000)
    const [report] = reports(say(state, 'c1', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000))
    expect(report).toMatchObject({ kind: 'casual', confirmed: true })
  })

  it('reports a match its humans all left as abandoned when the room closes, and nothing for a finished one', () => {
    const state = matchedPlaying(2)
    say(state, 'c0', { t: 'leave' }, T0 + 5000)
    const out = say(state, 'c1', { t: 'leave' }, T0 + 6000)
    expect(out).toContainEqual({ k: 'wipe' })
    const [report] = reports(out)
    expect(report).toMatchObject({ v: 1, room: 'ABCDE', run: 1, kind: 'ranked', endedAt: T0 + 6000, result: null, abandoned: true })
    expect(report?.seats.slice(0, 3)).toMatchObject([{ slot: 0, left: true }, { slot: 1, left: true }, { slot: 2, userId: null, left: false }])

    // Tabs closed: the room idles out and says the same.
    const quiet = matchedPlaying(2)
    disconnect(quiet, 'c0', T0 + 5000)
    disconnect(quiet, 'c1', T0 + 5000)
    expect(reports(tick(quiet, T0 + 5000 + TIMES.idle))).toMatchObject([{ abandoned: true }])

    const done = matchedPlaying(2)
    say(done, 'c0', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000)
    say(done, 'c1', { t: 'over', tick: 900, h: 'end', result: result(0) }, T0 + 9000)
    say(done, 'c0', { t: 'leave' }, T0 + 9500)
    expect(reports(say(done, 'c1', { t: 'leave' }, T0 + 9600))).toHaveLength(0)
  })

  it("reports a friends' Arena room as a room, and an account by its Clerk id and handle", () => {
    const state = newState()
    connect(state, 'a', 'ua', T0)
    hello(state, 'a', helloMsg('x'.repeat(16), { auth: { kind: 'clerk', token: 'jwt' }, name: '@ash' }), { id: 'u:user_ash', account: true }, T0, { guests: false })
    join(state, 'b', guest(1))
    say(state, 'a', { t: 'settings', settings: { difficulty: 'normal', mode: 'versus' } }, T0)
    say(state, 'a', { t: 'loadout', loadout: { starter: 'pikachu' } }, T0)
    say(state, 'b', { t: 'loadout', loadout: { starter: 'eevee' } }, T0)
    say(state, 'b', { t: 'ready', ready: true }, T0)
    say(state, 'a', { t: 'start' }, T0)
    say(state, 'a', { t: 'over', tick: 900, h: 'end', result: result(1) }, T0 + 9000)
    const [report] = reports(say(state, 'b', { t: 'over', tick: 900, h: 'end', result: result(1) }, T0 + 9000))
    expect(report?.kind).toBe('room')
    expect(report?.seats[0]).toEqual({ slot: 0, userId: 'user_ash', handle: 'ash', left: false })
  })
})
