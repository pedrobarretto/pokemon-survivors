import { describe, expect, it } from 'vitest'
import { PLAYABLE_IDS } from '../data/hatchlings'
import type { CoopInvite } from '../game/friends'
import type { Member, RoomView } from '../net/protocol'
import { buildAdvice, coopAccess, coopStarter, freshInvites, memberState, readiness } from './lobby'

const member = (seat: number, o: Partial<Member> = {}): Member => ({
  seat,
  name: `P${seat}`,
  account: false,
  host: seat === 0,
  online: true,
  away: false,
  ready: false,
  loadout: { starter: 'charmander' },
  ...o,
})

const room = (members: Member[]): RoomView => ({ code: 'K7QF2', phase: 'lobby', members, settings: {}, run: 0 })

describe('memberState', () => {
  it('says the most pressing thing first', () => {
    expect(memberState(member(0, { online: false }))).toBe('offline')
    expect(memberState(member(1, { away: true, ready: true }))).toBe('away')
    expect(memberState(member(0))).toBe('host')
    expect(memberState(member(1, { ready: true }))).toBe('ready')
    expect(memberState(member(1))).toBe('picking')
  })

  it('a ready member without a Pokémon is still choosing', () => {
    expect(memberState(member(1, { ready: true, loadout: null }))).toBe('picking')
  })
})

describe('readiness', () => {
  it('counts the host as set and waits on the others online', () => {
    expect(readiness(room([member(0), member(1)]))).toEqual({ ready: 1, total: 2, all: false })
    expect(readiness(room([member(0), member(1, { ready: true })]))).toEqual({ ready: 2, total: 2, all: true })
  })

  it("doesn't wait on members who went offline", () => {
    expect(readiness(room([member(0), member(1, { ready: true }), member(2, { online: false })]))).toEqual({ ready: 2, total: 2, all: true })
  })

  it('a host alone can start', () => {
    expect(readiness(room([member(0)])).all).toBe(true)
  })
})

describe('freshInvites', () => {
  const invite = (id: string, room: string, expiresAt = '2026-10-20T12:10:00Z'): CoopInvite => ({ id, from: { handle: 'ash', name: 'Ash' }, room, at: '2026-10-20T12:00:00Z', expiresAt })
  const now = Date.parse('2026-10-20T12:05:00Z')

  it('skips what was shown, what expired and the room the player is in', () => {
    const list = [invite('a', 'AAAAA'), invite('b', 'BBBBB'), invite('c', 'CCCCC', '2026-10-20T12:04:00Z'), invite('d', 'K7QF2')]
    expect(freshInvites(list, new Set(['a']), 'K7QF2', now).map((i) => i.id)).toEqual(['b'])
  })
})

describe('buildAdvice', () => {
  it('reloads a page behind the room, never for a room behind the site, and never twice', () => {
    const at = (o: Partial<Parameters<typeof buildAdvice>[0]>) => buildAdvice({ own: 'old', room: 'new', latest: 'new', reloaded: false, ...o })
    expect(at({})).toBe('reload')
    // The room is older than the site: whatever this page runs, a reload can't reach it.
    expect(at({ own: 'new', room: 'old', latest: 'new' })).toBe('oldRoom')
    expect(at({ own: 'older', room: 'old', latest: 'new' })).toBe('oldRoom')
    // A relay that doesn't say: only a page behind the site reloads.
    expect(at({ room: null })).toBe('reload')
    expect(at({ own: 'new', room: null })).toBe('oldRoom')
    // The site didn't answer: one reload per room build, then the room is called old.
    expect(at({ latest: null })).toBe('reload')
    expect(at({ latest: null, reloaded: true })).toBe('oldRoom')
    expect(at({ reloaded: true })).toBe('oldRoom')
  })
})

describe('coopAccess', () => {
  it('opens co-op to an account with a handle only, where the build has accounts', () => {
    expect(coopAccess(true, { kind: 'signedIn', handle: 'ash' })).toBe('open')
    expect(coopAccess(true, { kind: 'guest' })).toBe('signIn')
    expect(coopAccess(true, { kind: 'signedIn', handle: null })).toBe('handle')
    expect(coopAccess(true, { kind: 'signedIn', handle: undefined })).toBe('wait')
    expect(coopAccess(true, { kind: 'busy' })).toBe('wait')
    // A dev build without accounts plays as a guest on the dev relay.
    expect(coopAccess(false, { kind: 'guest' })).toBe('open')
  })
})

describe('coopStarter', () => {
  it('brings the partner, or the first starter for a legend (no Legend mode in co-op)', () => {
    expect(coopStarter('gible')).toBe('gible')
    expect(coopStarter('squirtle')).toBe('squirtle')
    expect(coopStarter('mewtwo')).toBe(PLAYABLE_IDS[0])
  })
})
