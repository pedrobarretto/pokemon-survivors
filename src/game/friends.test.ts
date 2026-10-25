import { describe, expect, it } from 'vitest'
import { beatMsFor, likePrefix, parseHandlePrefix, parsePresenceUpdate, parsePresenceView, parseRoomCode, presenceOnline, PRESENCE, splitFollows } from './friends'

describe('splitFollows', () => {
  it('makes friends of mutual follows and requests of one-way ones, each way', () => {
    const row = (handle: string, iFollow: boolean, followsMe: boolean) => ({ handle, name: handle.toUpperCase(), iFollow, followsMe })
    expect(splitFollows([row('ash', true, true), row('misty', false, true), row('brock', true, false)])).toEqual({
      friends: [{ handle: 'ash', name: 'ASH' }],
      incoming: [{ handle: 'misty', name: 'MISTY' }],
      outgoing: [{ handle: 'brock', name: 'BROCK' }],
    })
  })
})

describe('parseHandlePrefix', () => {
  it('takes what a player typed as a lower-case handle prefix of 2+ characters', () => {
    expect(parseHandlePrefix(' @AsH ')).toBe('ash')
    expect(parseHandlePrefix('a')).toBeNull()
    expect(parseHandlePrefix('a%')).toBeNull()
    expect(parseHandlePrefix(42)).toBeNull()
  })

  it('escapes LIKE wildcards, `_` included (handles allow it)', () => {
    expect(likePrefix('ash_k')).toBe('ash\\_k%')
  })
})

describe('parseRoomCode', () => {
  it('upper-cases letters and digits, 4 to 10 of them', () => {
    expect(parseRoomCode(' k7qf2 ')).toBe('K7QF2')
    expect(parseRoomCode('K7Q')).toBeNull()
    expect(parseRoomCode('K7QF-2')).toBeNull()
  })
})

describe('parsePresenceUpdate', () => {
  it('needs a room code in a room, allows one in a run and drops it in the lobby', () => {
    expect(parsePresenceUpdate({ activity: 'room', room: 'k7qf2' })).toEqual({ activity: 'room', room: 'K7QF2' })
    expect(parsePresenceUpdate({ activity: 'room' })).toBeNull()
    expect(parsePresenceUpdate({ activity: 'run' })).toEqual({ activity: 'run', room: null })
    expect(parsePresenceUpdate({ activity: 'lobby', room: 'K7QF2' })).toEqual({ activity: 'lobby', room: null })
  })

  it('refuses unknown activities and malformed rooms', () => {
    expect(parsePresenceUpdate({ activity: 'afk' })).toBeNull()
    expect(parsePresenceUpdate({ activity: 'run', room: '<script>' })).toBeNull()
    expect(parsePresenceUpdate(null)).toBeNull()
  })
})

describe('presenceOnline', () => {
  it('reads online for two missed beats of the activity plus the grace', () => {
    const lobby = 2 * PRESENCE.beatMs.lobby + PRESENCE.graceMs
    expect(presenceOnline('lobby', lobby)).toBe(true)
    expect(presenceOnline('lobby', lobby + 1)).toBe(false)
    // A run beats rarely, so it stays online much longer than the lobby.
    expect(presenceOnline('run', lobby + 1)).toBe(true)
  })
})

describe('beatMsFor', () => {
  it('keeps each activity\'s pace for a player who follows someone, and slows the rest down', () => {
    expect(beatMsFor('lobby', true)).toBe(PRESENCE.beatMs.lobby)
    expect(beatMsFor('room', true)).toBe(PRESENCE.beatMs.room)
    expect(beatMsFor('lobby', false)).toBe(PRESENCE.aloneMs)
    expect(beatMsFor('run', false)).toBe(Math.max(PRESENCE.beatMs.run, PRESENCE.aloneMs))
  })
})

describe('parsePresenceView', () => {
  it('keeps the well-formed friends and invites, and needs the next beat', () => {
    const view = parsePresenceView({
      friends: [{ handle: 'ash', name: 'Ash', online: true, activity: 'room', room: 'K7QF2' }, { handle: 'x' }],
      invites: [{ id: 'i', from: { handle: 'ash', name: 'Ash' }, room: 'K7QF2', at: 'a', expiresAt: 'b' }, { id: 'j' }],
      appearOffline: false,
      beatMs: 20_000,
    })
    expect(view?.friends).toEqual([{ handle: 'ash', name: 'Ash', online: true, activity: 'room', room: 'K7QF2' }])
    expect(view?.invites).toHaveLength(1)
    expect(parsePresenceView({ friends: [] })).toBeNull()
  })
})
