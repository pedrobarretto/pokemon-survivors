import { describe, expect, it } from 'vitest'
import { REALM_ROOMS } from '../../src/data/realmMap'
import { REALM, REALM_LIMITS, REALM_PROTOCOL, type RealmClientMessage, type RealmIdentity, type RealmServerMessage } from '../../src/net/realm'
import { PRESENCE_EVERY_MS } from '../../src/net/realmRelay'
import { connect, createRealm, disconnect, hello, identified, message, parseRealmMessage, tick, visited, type RealmEffect, type RealmState } from '../src/realm'

const T0 = 1_000_000

const ident = (userId: string, over: Partial<RealmIdentity> = {}): RealmIdentity => ({ userId, handle: userId, partner: 'charmander', shiny: false, look: {}, supporter: null, ...over })

const sent = (effects: readonly RealmEffect[], to: string): RealmServerMessage[] => effects.flatMap((e) => (e.k === 'send' && e.to === to ? [e.msg] : []))

const of = <T extends RealmServerMessage['t']>(msgs: readonly RealmServerMessage[], t: T) => msgs.filter((m): m is Extract<RealmServerMessage, { t: T }> => m.t === t)

const closed = (effects: readonly RealmEffect[], to: string) => effects.some((e) => e.k === 'close' && e.to === to)

const helloMsg = (over: Partial<Extract<RealmClientMessage, { t: 'hello' }>> = {}) => ({ t: 'hello', v: REALM_PROTOCOL, city: 'pallet', token: 'tok', room: 'plaza', ...over }) as const

/** Opens `conn` in Pallet and seats account `user` (its identity answered at once); returns the seating effects. */
const join = (state: RealmState, conn: string, user: string, now = T0, over: Partial<RealmIdentity> = {}, room = 'plaza') => {
  connect(state, conn, 'pallet', now)
  const asked = hello(state, conn, helloMsg({ room }), user, now)
  const ask = asked.find((e) => e.k === 'identify')
  if (ask?.k !== 'identify') throw new Error('no identify ask')
  return identified(state, ask.ask, { identities: { [user]: ident(user, over) }, banned: [] }, now)
}

const youOf = (effects: readonly RealmEffect[], conn: string) => of(sent(effects, conn), 'welcome')[0]!.you

describe('parseRealmMessage', () => {
  it('reads valid messages and rounds positions', () => {
    expect(parseRealmMessage(JSON.stringify({ t: 'move', x: 10.4, y: 20.6, facing: 3, moving: true }))).toEqual({ t: 'move', x: 10, y: 21, facing: 3, moving: true })
    expect(parseRealmMessage(JSON.stringify({ t: 'go', room: 'BASE:Misty', x: 1, y: 2 }))).toEqual({ t: 'go', room: 'base:misty', x: 1, y: 2 })
    expect(parseRealmMessage(JSON.stringify({ t: 'partyGo', mode: 'coop', code: 'ABC23' }))).toEqual({ t: 'partyGo', mode: 'coop', code: 'ABC23' })
  })

  it('refuses malformed, unknown and oversized messages', () => {
    expect(parseRealmMessage('{')).toBeNull()
    expect(parseRealmMessage(JSON.stringify({ t: 'say', line: 'free text' }))).toBeNull()
    expect(parseRealmMessage(JSON.stringify({ t: 'move', x: 1, y: 2, facing: 8, moving: true }))).toBeNull()
    expect(parseRealmMessage(JSON.stringify({ t: 'go', room: 'moon', x: 1, y: 2 }))).toBeNull()
    expect(parseRealmMessage(JSON.stringify({ t: 'partyGo', mode: 'coop', code: 'abc' }))).toBeNull()
    expect(parseRealmMessage(JSON.stringify({ t: 'hello', v: 1, city: 'pallet', token: 'x'.repeat(REALM_LIMITS.token + 1), room: 'plaza' }))).toBeNull()
    expect(parseRealmMessage(JSON.stringify({ t: 'ping', at: 1, pad: 'x'.repeat(REALM_LIMITS.message) }))).toBeNull()
  })
})

describe('hello', () => {
  it('refuses a wrong version, another city or no account before asking anything', () => {
    const state = createRealm('sa', T0)
    connect(state, 'a', 'pallet', T0)
    expect(sent(hello(state, 'a', helloMsg({ v: 99 }), 'u1', T0), 'a')).toEqual([{ t: 'refused', why: 'version' }])
    connect(state, 'b', 'pallet', T0)
    expect(sent(hello(state, 'b', helloMsg({ city: 'viridian' }), 'u1', T0), 'b')).toEqual([{ t: 'refused', why: 'city' }])
    connect(state, 'c', 'pallet', T0)
    expect(sent(hello(state, 'c', helloMsg(), null, T0), 'c')).toEqual([{ t: 'refused', why: 'signIn' }])
  })

  it('batches the identity asks: hellos arriving while one is out go in the next', () => {
    const state = createRealm('sa', T0)
    for (const c of ['a', 'b', 'c']) connect(state, c, 'pallet', T0)
    const first = hello(state, 'a', helloMsg(), 'u1', T0)
    expect(first).toEqual([{ k: 'identify', ask: 1, userIds: ['u1'] }])
    expect(hello(state, 'b', helloMsg(), 'u2', T0)).toEqual([])
    expect(hello(state, 'c', helloMsg(), 'u3', T0)).toEqual([])
    const answered = identified(state, 1, { identities: { u1: ident('u1') }, banned: [] }, T0)
    expect(of(sent(answered, 'a'), 'welcome')).toHaveLength(1)
    expect(answered.filter((e) => e.k === 'identify')).toEqual([{ k: 'identify', ask: 2, userIds: ['u2', 'u3'] }])
  })

  it('refuses accounts the API leaves out, bans, or can’t answer for', () => {
    const state = createRealm('sa', T0)
    for (const c of ['a', 'b']) connect(state, c, 'pallet', T0)
    hello(state, 'a', helloMsg(), 'u1', T0)
    const out = identified(state, 1, { identities: {}, banned: ['u1'] }, T0)
    expect(sent(out, 'a')).toEqual([{ t: 'refused', why: 'banned' }])
    expect(closed(out, 'a')).toBe(true)
    hello(state, 'b', helloMsg(), 'u2', T0)
    expect(sent(identified(state, 2, { identities: {}, banned: [] }, T0), 'b')).toEqual([{ t: 'refused', why: 'profile' }])
    connect(state, 'c', 'pallet', T0)
    hello(state, 'c', helloMsg(), 'u3', T0)
    expect(sent(identified(state, 3, null, T0), 'c')).toEqual([{ t: 'refused', why: 'busy' }])
  })

  it('welcomes into the room with everyone there and tells them', () => {
    const state = createRealm('sa', T0)
    const a = youOf(join(state, 'a', 'u1'), 'a')
    const out = join(state, 'b', 'u2')
    const welcome = of(sent(out, 'b'), 'welcome')[0]!
    expect(welcome.room).toBe('plaza')
    expect(welcome.avatars.map((v) => v.id).sort()).toEqual([a, welcome.you].sort())
    expect(welcome.avatars.find((v) => v.id === welcome.you)).toMatchObject({ handle: 'u2', ...REALM_ROOMS.plaza.spawn })
    expect(of(sent(out, 'a'), 'join').map((m) => m.avatar.id)).toEqual([welcome.you])
  })

  it('keeps one seat per account: a second hello takes over and the first is sent elsewhere', () => {
    const state = createRealm('sa', T0)
    const old = youOf(join(state, 'a', 'u1'), 'a')
    join(state, 'w', 'u9')
    const out = join(state, 'b', 'u1')
    expect(sent(out, 'a')).toContainEqual({ t: 'refused', why: 'elsewhere' })
    expect(closed(out, 'a')).toBe(true)
    expect(of(sent(out, 'w'), 'gone').map((m) => m.id)).toEqual([old])
    expect(of(sent(out, 'b'), 'welcome')).toHaveLength(1)
  })

  it('refuses a full city', () => {
    const state = createRealm('sa', T0)
    for (let i = 0; i < REALM.cityCap; i++) join(state, `c${i}`, `u${i}`)
    connect(state, 'x', 'pallet', T0)
    expect(sent(hello(state, 'x', helloMsg(), 'late', T0), 'x')).toEqual([{ t: 'refused', why: 'full' }])
  })

  it('lands in its own base at once, and in the plaza first for someone else’s', () => {
    const state = createRealm('sa', T0)
    expect(of(sent(join(state, 'a', 'ash', T0, {}, 'base:ash'), 'a'), 'welcome')[0]!.room).toBe('base:ash')
    const out = join(state, 'b', 'gary', T0, {}, 'base:ash')
    expect(of(sent(out, 'b'), 'welcome')[0]!.room).toBe('plaza')
    expect(out.find((e) => e.k === 'visit')).toMatchObject({ req: { visitor: 'gary', owner: 'ash', city: 'pallet' } })
  })
})

describe('walking', () => {
  const walker = () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1')
    join(state, 'b', 'u2')
    return state
  }
  const spawn = REALM_ROOMS.plaza.spawn
  const rate = REALM.speed * REALM.speedSlack

  it('takes steps inside the walk earned and snaps back ones past it or out of bounds', () => {
    const state = walker()
    expect(message(state, 'a', { t: 'move', x: spawn.x + 20, y: spawn.y, facing: 2, moving: true }, T0 + 200)).toEqual([])
    // What it landed with (half a second's) and 0.4 s of walk, less the step taken, is short of 1.1 s's worth.
    expect(sent(message(state, 'a', { t: 'move', x: spawn.x + 20 + Math.round(rate * 1.1), y: spawn.y, facing: 2, moving: true }, T0 + 400), 'a')).toEqual([{ t: 'snap', x: spawn.x + 20, y: spawn.y }])
    expect(sent(message(state, 'a', { t: 'move', x: -5, y: spawn.y, facing: 2, moving: true }, T0 + 10_000), 'a')).toEqual([{ t: 'snap', x: spawn.x + 20, y: spawn.y }])
  })

  it('banks at most a second of walk after standing still', () => {
    const state = walker()
    const far = Math.round(rate * 1.5)
    expect(sent(message(state, 'a', { t: 'move', x: spawn.x - far, y: spawn.y, facing: 6, moving: true }, T0 + 60_000), 'a')).toEqual([{ t: 'snap', ...spawn }])
  })

  it('batches each room’s movers at the beat, and a lone mover hears none of its own', () => {
    const state = walker()
    message(state, 'a', { t: 'move', x: spawn.x + 10, y: spawn.y, facing: 2, moving: true }, T0 + 200)
    const out = tick(state, T0 + 200)
    expect(of(sent(out, 'b'), 'moves')).toEqual([{ t: 'moves', rows: [[1, spawn.x + 10, spawn.y, 2, 1]] }])
    expect(of(sent(out, 'a'), 'moves')).toEqual([])
    expect(of(sent(tick(state, T0 + 360), 'b'), 'moves')).toEqual([])
  })
})

describe('rooms and bases', () => {
  const door = REALM_ROOMS.plaza.doors.find((d) => d.to === 'pier')!
  const atDoor: { x: number; y: number } = { x: door.at.x, y: door.at.y + door.at.h / 2 }

  /** Walks `conn` to the plaza's pier door in steps it may take. */
  const walkToDoor = (state: RealmState, conn: string, from: number) => {
    let t = from
    let x: number = REALM_ROOMS.plaza.spawn.x
    let y: number = REALM_ROOMS.plaza.spawn.y
    while (x !== atDoor.x || y !== atDoor.y) {
      t += 200
      x += Math.sign(atDoor.x - x) * Math.min(20, Math.abs(atDoor.x - x))
      y += Math.sign(atDoor.y - y) * Math.min(20, Math.abs(atDoor.y - y))
      expect(message(state, conn, { t: 'move', x, y, facing: 2, moving: true }, t)).toEqual([])
    }
    return t
  }

  it('goes through a door it stands at, telling both rooms', () => {
    const state = createRealm('sa', T0)
    const a = youOf(join(state, 'a', 'u1'), 'a')
    join(state, 'b', 'u2')
    const t = walkToDoor(state, 'a', T0)
    const out = message(state, 'a', { t: 'go', room: 'pier', ...door.spawn }, t + 100)
    expect(of(sent(out, 'a'), 'room')[0]).toMatchObject({ room: 'pier' })
    expect(of(sent(out, 'b'), 'gone')).toEqual([{ t: 'gone', id: a }])
  })

  it('stays put for a door it isn’t near or a room with no door from here', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1')
    expect(sent(message(state, 'a', { t: 'go', room: 'pier', ...door.spawn }, T0 + 100), 'a')).toEqual([{ t: 'snap', ...REALM_ROOMS.plaza.spawn }])
    expect(of(sent(message(state, 'a', { t: 'go', room: 'trail', x: 600, y: 240 }, T0 + 200), 'a'), 'snap')).toHaveLength(1)
  })

  it('enters its own base directly and asks the API for someone else’s', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'ash')
    expect(of(sent(message(state, 'a', { t: 'go', room: 'base:ash', x: 100, y: 100 }, T0 + 100), 'a'), 'room')[0]).toMatchObject({ room: 'base:ash' })
    const out = message(state, 'a', { t: 'go', room: 'base:misty', x: 100, y: 100 }, T0 + 200)
    expect(out).toEqual([{ k: 'visit', ask: 2, req: { visitor: 'ash', owner: 'misty', city: 'pallet' } }])
    expect(sent(visited(state, 2, { allowed: false, why: 'private' }), 'a')).toEqual([{ t: 'refused', why: 'private' }])
    expect(closed(visited(state, 2, { allowed: true }), 'a')).toBe(false)
  })

  it('walks into a base the API allows', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'ash')
    const ask = message(state, 'a', { t: 'go', room: 'base:misty', x: 100, y: 100 }, T0 + 100).find((e) => e.k === 'visit')
    if (ask?.k !== 'visit') throw new Error('no visit')
    expect(of(sent(visited(state, ask.ask, { allowed: true }), 'a'), 'room')[0]).toMatchObject({ room: 'base:misty' })
  })
})

describe('talk', () => {
  it('relays lines and emotes to the room within the burst limit', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1')
    join(state, 'b', 'u2')
    const said = [0, 1, 2, 3].map((i) => of(sent(message(state, 'a', { t: 'say', line: 'hello' }, T0 + i), 'b'), 'said').length)
    expect(said).toEqual([1, 1, 1, 0])
    expect(of(sent(message(state, 'a', { t: 'say', line: 'bye' }, T0 + REALM.talkWindowMs), 'b'), 'said')).toHaveLength(1)
    expect(of(sent(message(state, 'a', { t: 'emote', emote: 'heart' }, T0 + REALM.talkWindowMs), 'b'), 'emoted')).toHaveLength(1)
  })

  it('plays the look emote only for a look that has one', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1')
    join(state, 'b', 'u2', T0, { look: { emote: 'victoryEmote' } })
    join(state, 'c', 'u3')
    expect(of(sent(message(state, 'a', { t: 'emote', emote: 'look' }, T0), 'c'), 'emoted')).toHaveLength(0)
    expect(of(sent(message(state, 'b', { t: 'emote', emote: 'look' }, T0), 'c'), 'emoted')).toHaveLength(1)
  })
})

describe('parties', () => {
  const four = () => {
    const state = createRealm('sa', T0)
    const ids = ['a', 'b', 'c', 'd', 'e'].map((c, i) => youOf(join(state, c, `u${i}`), c))
    return { state, ids }
  }
  const form = (state: RealmState, from: string, fromId: number, to: string, toId: number, now = T0) => {
    message(state, from, { t: 'invite', id: toId }, now)
    return message(state, to, { t: 'answer', from: fromId, yes: true }, now)
  }

  it('forms on an accepted invite and tells every member', () => {
    const { state, ids } = four()
    expect(of(sent(message(state, 'a', { t: 'invite', id: ids[1]! }, T0), 'b'), 'invited')).toEqual([{ t: 'invited', from: ids[0] }])
    const out = message(state, 'b', { t: 'answer', from: ids[0]!, yes: true }, T0)
    const party = { leader: ids[0], members: [ids[0], ids[1]] }
    expect(of(sent(out, 'a'), 'party')).toEqual([{ t: 'party', party }])
    expect(of(sent(out, 'b'), 'party')).toEqual([{ t: 'party', party }])
  })

  it('ignores an answer to an invite that expired or never was', () => {
    const { state, ids } = four()
    expect(message(state, 'b', { t: 'answer', from: ids[0]!, yes: true }, T0)).toEqual([])
    message(state, 'a', { t: 'invite', id: ids[1]! }, T0)
    expect(message(state, 'b', { t: 'answer', from: ids[0]!, yes: true }, T0 + REALM.inviteMs)).toEqual([])
  })

  it('holds up to the cap, and only the leader invites', () => {
    const { state, ids } = four()
    form(state, 'a', ids[0]!, 'b', ids[1]!)
    expect(message(state, 'b', { t: 'invite', id: ids[2]! }, T0)).toEqual([])
    form(state, 'a', ids[0]!, 'c', ids[2]!)
    form(state, 'a', ids[0]!, 'd', ids[3]!)
    expect(REALM.partyCap).toBe(4)
    expect(message(state, 'a', { t: 'invite', id: ids[4]! }, T0)).toEqual([])
  })

  it('hands the lead on when the leader leaves, and ends a party of one', () => {
    const { state, ids } = four()
    form(state, 'a', ids[0]!, 'b', ids[1]!)
    form(state, 'a', ids[0]!, 'c', ids[2]!)
    const out = message(state, 'a', { t: 'leaveParty' }, T0)
    expect(of(sent(out, 'a'), 'party')).toEqual([{ t: 'party', party: null }])
    expect(of(sent(out, 'c'), 'party')).toEqual([{ t: 'party', party: { leader: ids[1], members: [ids[1], ids[2]] } }])
    const gone = disconnect(state, 'c')
    expect(of(sent(gone, 'b'), 'party')).toEqual([{ t: 'party', party: null }])
  })

  it('relays the leader’s partyGo to the other members only', () => {
    const { state, ids } = four()
    form(state, 'a', ids[0]!, 'b', ids[1]!)
    const out = message(state, 'a', { t: 'partyGo', mode: 'arena', code: 'ABC23' }, T0)
    expect(sent(out, 'b')).toEqual([{ t: 'partyGo', mode: 'arena', code: 'ABC23' }])
    expect(sent(out, 'a')).toEqual([])
    expect(sent(out, 'c')).toEqual([])
    expect(message(state, 'b', { t: 'partyGo', mode: 'coop', code: 'ABC23' }, T0)).toEqual([])
  })
})

describe('time', () => {
  it('drops a silent socket and sends an idle trainer away as AFK', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'u1')
    join(state, 'b', 'u2')
    let t = T0
    while (t < T0 + REALM.afkMs - 1000) {
      t += 20_000
      message(state, 'a', { t: 'ping', at: t }, t)
    }
    const quiet = tick(state, T0 + REALM.idleDropMs)
    expect(closed(quiet, 'b')).toBe(true)
    expect(closed(quiet, 'a')).toBe(false)
    message(state, 'a', { t: 'ping', at: 0 }, T0 + REALM.afkMs)
    expect(sent(tick(state, T0 + REALM.afkMs), 'a')).toEqual([{ t: 'refused', why: 'afk' }])
  })

  it('reports presence when due, and at once when a city empties', () => {
    const state = createRealm('sa', T0)
    join(state, 'a', 'ash')
    expect(tick(state, T0 + 1).filter((e) => e.k === 'presence')).toEqual([])
    expect(tick(state, T0 + PRESENCE_EVERY_MS).find((e) => e.k === 'presence')).toEqual({ k: 'presence', report: { home: 'sa', at: T0 + PRESENCE_EVERY_MS, cities: { pallet: ['ash'] } } })
    disconnect(state, 'a')
    expect(tick(state, T0 + PRESENCE_EVERY_MS + 1).find((e) => e.k === 'presence')).toMatchObject({ report: { cities: {} } })
  })
})
